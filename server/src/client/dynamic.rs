use std::{
    net::TcpStream,
    sync::{Arc, Mutex},
    thread,
};

use image::{imageops::grayscale_with_type, ImageBuffer, Pixel, Rgba};
use imageproc::{
    corners::{corners_fast9, Corner},
    drawing,
};
use once_cell::sync::Lazy;
use serde::Deserialize;
use tungstenite::{Message, WebSocket};

use crate::{PositionData, ServerState};

pub struct KeyPoint {
    pub x: u32,
    pub y: u32,
}
pub type Descriptor = u32;

pub type Feature = (KeyPoint, Descriptor);

pub type Quaternion = [f64; 4];
pub type Vec3 = [f64; 3];

#[derive(Deserialize, Debug)]
#[serde(tag = "type", content = "data")]
enum IMUMeasurement {
    Rotation(Quaternion),
    Acceleration(Vec3),
}

pub enum FrameType {
    Viewer,
    Racket,
}

/// A Client which reports state changes and stored motion data
pub struct DynamicClient {
    /// Shared referece to the position data that gets broacasted out to every observer client
    position_data: Arc<Mutex<ServerState>>,
    /// 3D velocity of the object
    velocity: Vec3,
    /// 3D acceleration of the object
    acceleration: Vec3,
    frame_type: FrameType,
    /// Represents the id of the connected client
    user: usize,
    /// Config for data from the client's stream.
    /// only applicable if the client is opting into odometry
    stream_config: (u32, u32),

    last_features: Option<Vec<Feature>>,
}
impl DynamicClient {
    pub fn new(user: usize, position_data: Arc<Mutex<ServerState>>, frame_type: FrameType) -> Self {
        Self {
            user,
            frame_type,
            position_data,
            velocity: [0.0, 0.0, 0.0],
            acceleration: [0.0, 0.0, 0.0],
            stream_config: (300, 150),
            last_features: None,
        }
    }

    pub fn handle(mut self, mut websocket_stream: WebSocket<TcpStream>) {
        thread::spawn(move || {
            // continue processing requests from the connection
            while let Ok(message) = websocket_stream.read_message() {
                match message {
                    // using text messages for json payloads and data structures
                    Message::Text(text) => match serde_json::from_str::<IMUMeasurement>(&text) {
                        Ok(client_data) => self.process_imu_measurement(client_data, super::DELTA),
                        Err(e) => log::error!("[{}]", e),
                    },
                    // using binary messages for video stream frame data
                    Message::Binary(mut data) => {
                        match ImageBuffer::<Rgba<u8>, &mut [u8]>::from_raw(
                            self.stream_config.0,
                            self.stream_config.1,
                            &mut data,
                        ) {
                            Some(frame) => self.process_image_buffer(frame),
                            None => log::error!(
                                "failed to parse bytes as [`ImageBuffer::<Rgba<u8>, &[u8]>`]."
                            ),
                        }
                    }
                    Message::Close(frame) => log::info!("connection closing [{:?}]", frame),
                    Message::Ping(ping) => log::info!("ping [{:?}]", ping),
                    Message::Pong(pong) => log::info!("pong [{:?}]", pong),
                    _ => log::warn!("unused message [{:?}]", message),
                }
            }

            log::info!("cleaning up data for client [{}].", self.user);
            self.cleanup_client();
            log::info!("racket client [{}] disconnected.", self.user);
        });
    }

    /// Compute updates to positional and motion data from the IMU measurements takes from the client device.
    /// This could be acclerometers, gyroscopes, magnometers, etc...
    fn process_imu_measurement(&mut self, client_imu_data: IMUMeasurement, delta: f64) {
        let Self {
            ref mut velocity,
            ref mut acceleration,
            ..
        } = self;

        // ask for exclusive access to the positional data in order to update our own current state
        if let Ok(mut data) = self.position_data.lock() {
            let PositionData {
                ref mut position,
                ref mut rotation,
            } = data
                .entry(self.user)
                .or_insert_with(|| PositionData::default());

            match client_imu_data {
                IMUMeasurement::Acceleration([x, y, z]) => {
                    const SCALING_FACTOR: f64 = 1.0;
                    let acceleration_update = quaternion::rotate_vector(
                        (rotation[3], [rotation[0], rotation[1], rotation[2]]),
                        match self.frame_type {
                            // see rotation logic, then apply the negated transformation since we have no valid negative 'w' component
                            // undos: *rotation = [-x, -z, y, -w];
                            FrameType::Racket => [x, z, -y],
                            FrameType::Viewer => [x, y, z],
                        },
                    );

                    let mut velocity_update = [
                        velocity[0] + (acceleration[0] + acceleration_update[0]) * 0.5 * delta,
                        velocity[1] + (acceleration[1] + acceleration_update[1]) * 0.5 * delta,
                        velocity[2] + (acceleration[2] + acceleration_update[2]) * 0.5 * delta,
                    ];

                    // Temporary dampening logic
                    if acceleration_update
                        .into_iter()
                        .all(|f| f < SCALING_FACTOR / 10.0 && f > -SCALING_FACTOR / 10.0)
                    {
                        for vel_comp in &mut velocity_update {
                            *vel_comp *= 0.8;
                        }
                    }

                    position[0] += (velocity[0] + velocity_update[0]) * 0.5 * delta;
                    position[1] += (velocity[1] + velocity_update[1]) * 0.5 * delta;
                    position[2] += (velocity[2] + velocity_update[2]) * 0.5 * delta;

                    // update current references
                    *velocity = velocity_update;
                    *acceleration = acceleration_update;
                }
                IMUMeasurement::Rotation([x, y, z, w]) => {
                    match self.frame_type {
                        FrameType::Racket => {
                            // Racket Control
                            // invert and reverse the X and Y rotation:
                            //      1. flip y and z based on how we interpret them
                            //      2. flip sign of everything but W for inverse = conjugate
                            //      3. mirror the XY plane (negation of the Z and W values).
                            *rotation = [-x, -z, y, -w];
                        }
                        FrameType::Viewer => {
                            // Head Control
                            let (w, [x, y, z]) =
                                quaternion::mul((w, [x, y, z]), *BASE_CAMERA_QUATERNION);

                            *rotation = [-y, z, -x, w];
                        }
                    }
                }
            }
        }
    }

    // load the raw bytes into an RBGA image buffer to use for Visual Odometry
    fn process_image_buffer(&mut self, mut image_buffer: ImageBuffer<Rgba<u8>, &mut [u8]>) {
        // first step - detect viable feature keypoints using the FAST-detection algorithm
        // second step - compute descriptors about keypoints (using BRIEF?)
        let features: Vec<_> = corners_fast9(&grayscale_with_type(&image_buffer), 20)
            .into_iter()
            .map(|Corner { x, y, .. }| {
                let keypoint = KeyPoint { x, y };
                let descriptor = compute_descriptor(&keypoint);
                (keypoint, descriptor)
            })
            .collect();

        if let Some(last_features) = &self.last_features {
            for (keypoint, _) in last_features {
                drawing::draw_hollow_circle_mut(
                    &mut image_buffer,
                    // draw the keypoint onto the image
                    (keypoint.x as _, keypoint.y as _),
                    // draw everything as a dot
                    1,
                    *GREEN,
                );
            }

            for (keypoint, _) in &features {
                drawing::draw_hollow_circle_mut(
                    &mut image_buffer,
                    // draw the keypoint onto the image
                    (keypoint.x as _, keypoint.y as _),
                    // draw everything as a dot
                    1,
                    *GREEN,
                );
            }

            // draw matches
            for ((kp1, _), (kp2, _)) in compute_matches(&features, &last_features) {
                drawing::draw_line_segment_mut(
                    &mut image_buffer,
                    (kp1.x as _, kp1.y as _),
                    (kp2.x as _, kp2.y as _),
                    *BLUE,
                );
            }
        }

        self.last_features = Some(features);

        image_buffer.save("slam-test.jpg").unwrap();
    }

    fn cleanup_client(&mut self) {
        // remove the user data once they disconnect
        self.position_data.lock().unwrap().remove(&self.user);
    }
}

fn compute_descriptor(keypoint: &KeyPoint) -> Descriptor {
    return 5;
}

fn compute_matches<'a>(
    features1: &'a Vec<Feature>,
    features2: &'a Vec<Feature>,
) -> Vec<(&'a Feature, &'a Feature)> {
    let mut matches = Vec::new();
    for feature1 in features1 {
        for feature2 in features2 {
            if features_compatible(feature1, feature2) {
                matches.push((feature1, feature2));
            }
        }
    }
    return matches;
}

fn features_compatible(feature1: &Feature, feature2: &Feature) -> bool {
    return feature1.0.x.abs_diff(feature2.0.x).pow(2) + feature1.0.y.abs_diff(feature2.0.y).pow(2)
        < 50;
}

/// This quaternion orients a phone such that the viewing perspecting
/// is based upon the orientation of the camera and is meant to be handled horizontally.
static BASE_CAMERA_QUATERNION: Lazy<quaternion::Quaternion<f64>> = Lazy::new(|| {
    quaternion::mul(
        // offset the phone so that looking down is not looking straight
        quaternion::axis_angle([0.0, 1.0, 0.0], 1.68),
        // the phone needs to be rotated in order to use it sideways
        quaternion::axis_angle([1.0, 0.0, 0.0], -1.68),
    )
});

static GREEN: Lazy<Rgba<u8>> = Lazy::new(|| *Rgba::from_slice(&[0, 255, 0, 255]));
static BLUE: Lazy<Rgba<u8>> = Lazy::new(|| *Rgba::from_slice(&[0, 0, 255, 255]));
