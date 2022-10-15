use std::{
    net::TcpStream,
    sync::{Arc, Mutex},
};

use image::{ImageBuffer, Rgba};
use once_cell::sync::Lazy;
use serde::Deserialize;
use slamr::system::get_camera_intrinsic;
use tungstenite::{Message, WebSocket};

use crate::{Pose, ServerState};

pub type Quaternion = [f64; 4];
pub type Vec3 = [f64; 3];

#[derive(Deserialize, Debug)]
#[serde(tag = "type", content = "data")]
enum IMUMeasurement {
    Orientation(Quaternion),
    Acceleration(Vec3),
}

pub enum FrameType {
    Viewer,
    Racket,
}

/// A Client which reports state changes and stores motion data
pub struct DynamicClient {
    /// Shared referece to the position data that gets broacasted out to every observer client
    position_data: Arc<Mutex<ServerState>>,
    /// 3D velocity of the object
    velocity: Vec3,
    /// 3D acceleration of the object
    acceleration: Vec3,
    /// Indicator of which component the client wants to send or receive data for
    frame_type: FrameType,
    /// Represents the id of the connected client
    user: usize,
    /// SLAM Module
    slam: Option<slamr::system::System>,
    /// Config for data from the client's stream.
    /// only applicable if the client is opting into odometry
    stream_config: (u32, u32),
}
impl DynamicClient {
    pub fn new(user: usize, position_data: Arc<Mutex<ServerState>>, frame_type: FrameType) -> Self {
        let (w, h) = (150, 150);
        let k = get_camera_intrinsic(200.0, w as _, h as _);
        let k_inv = k.try_inverse().unwrap();

        Self {
            user,
            frame_type,
            position_data,
            velocity: [0.0, 0.0, 0.0],
            acceleration: [0.0, 0.0, 0.0],
            stream_config: (w, h),
            slam: Some(slamr::system::System {
                camera_intrinsics: (k, k_inv),
                ..Default::default()
            }),
        }
    }

    pub fn handle(mut self, mut websocket_stream: WebSocket<TcpStream>) {
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
                            "failed to parse bytes as [`ImageBuffer::<Rgba<u8>, &mut [u8]>`]. Message is {} bytes long.", data.len()
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
            let Pose {
                ref mut position,
                ref mut orientation,
            } = data.entry(self.user).or_insert_with(|| Pose::default());

            match client_imu_data {
                IMUMeasurement::Acceleration(acclereation_measurement) => {
                    const SCALING_FACTOR: f64 = 1.0;
                    let acceleration_update = preproccess_acceleration(
                        acclereation_measurement,
                        orientation,
                        &self.frame_type,
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
                IMUMeasurement::Orientation(measured_orientation) => {
                    *orientation = preprocess_orientation(measured_orientation, &self.frame_type)
                }
            }
        }
    }

    // Load the raw bytes into an RBGA image buffer to use for Visual Odometry
    fn process_image_buffer(&mut self, mut image_buffer: ImageBuffer<Rgba<u8>, &mut [u8]>) {
        if let Some(slam) = &mut self.slam {
            // run monocular slam on image buffer
            slam.track_monocular(&mut image_buffer, 0.0);
            // testing image slideshow
            image_buffer.save("slam-test.jpg").unwrap();
        }
    }

    /// Remove and data that persists for a client when they are connected to the session
    fn cleanup_client(&mut self) {
        // remove the user data once they disconnect
        self.position_data.lock().unwrap().remove(&self.user);
    }
}

/// Preprocess rotations based on orientation of phone
fn preprocess_orientation(orientation: Quaternion, frame_type: &FrameType) -> Quaternion {
    let [rx, ry, rz, w] = orientation;
    match frame_type {
        FrameType::Racket => {
            // Racket Control
            // invert and reverse the X and Y rotation:
            //      1. flip y and z based on how we interpret them
            //      2. flip sign of everything but W for inverse = conjugate
            //      3. mirror the XY plane (negation of the Z and W values).
            [-rx, -rz, ry, -w]
        }
        FrameType::Viewer => {
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

            // Head Control
            let (w, [x, y, z]) = quaternion::mul((w, [rx, ry, rz]), *BASE_CAMERA_QUATERNION);

            [-y, z, -x, w]
        }
    }
}

/// Process accelerometer measuerments to accomodate phone rotation
fn preproccess_acceleration(
    acceleration: Vec3,
    orientation: &Quaternion,
    frame_type: &FrameType,
) -> Vec3 {
    let [ax, ay, az] = acceleration;
    let [rx, ry, rz, w] = *orientation;
    quaternion::rotate_vector(
        (w, [rx, ry, rz]),
        match frame_type {
            // see rotation logic, then apply the negated transformation since we have no valid negative 'w' component
            // undos: *rotation = [-x, -z, y, -w];
            FrameType::Racket => [ax, az, -ay],
            FrameType::Viewer => [ax, ay, az],
        },
    )
}
