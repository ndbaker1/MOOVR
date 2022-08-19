use std::{
    net::TcpStream,
    sync::{Arc, Mutex},
    thread,
};

use once_cell::sync::Lazy;
use serde::Deserialize;
use tungstenite::{Message, WebSocket};

use crate::{PositionData, ServerState};

pub type Quaternion = [f64; 4];
pub type Vec3 = [f64; 3];

#[derive(Deserialize, Debug)]
#[serde(tag = "type", content = "data")]
enum PhysicsUpdate {
    Rotation(Quaternion),
    Acceleration(Vec3),
}

#[derive(Debug, Default)]
pub struct MotionData {
    /// 3D velocity of the object
    velocity: Vec3,
    /// 3D acceleration of the object
    acceleration: Vec3,
    /// Rotation of the object's previous frame
    /// Used to track change in rotation for accelerometer adjustments
    prev_rotation: Quaternion,
}

pub enum FrameType {
    Viewer,
    Racket,
}

pub struct DynamicClient {
    position_data: Arc<Mutex<ServerState>>,
    motion_data: MotionData,
    frame_type: FrameType,
    user: usize,
}
impl DynamicClient {
    pub fn new(user: usize, position_data: Arc<Mutex<ServerState>>, frame_type: FrameType) -> Self {
        Self {
            user,
            frame_type,
            position_data,
            motion_data: MotionData::default(),
        }
    }

    pub fn handle(mut self, mut websocket_stream: WebSocket<TcpStream>) {
        thread::spawn(move || {
            // continue processing requests from the connection
            while let Ok(message) = websocket_stream.read_message() {
                match message {
                    Message::Text(text) => match serde_json::from_str::<PhysicsUpdate>(&text) {
                        Ok(client_data) => self.update(client_data, super::DELTA),
                        Err(e) => log::error!("[{}]", e),
                    },
                    Message::Binary(data) => log::info!("binary [{:?}]", data),
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

    fn update(&mut self, client_data: PhysicsUpdate, delta: f64) {
        let MotionData {
            ref mut velocity,
            ref mut acceleration,
            ref mut prev_rotation,
        } = self.motion_data;

        if let Ok(mut data) = self.position_data.lock() {
            let PositionData {
                ref mut position,
                ref mut rotation,
            } = data
                .entry(self.user)
                .or_insert_with(|| PositionData::default());

            match client_data {
                PhysicsUpdate::Acceleration([x, y, z]) => {
                    const SCALING_FACTOR: f64 = 1.0;
                    // TODO viewer acceleration is still not correct
                    let acceleration_update = quaternion::rotate_vector(
                        (rotation[3], [rotation[0], rotation[1], rotation[2]]),
                        match self.frame_type {
                            // see rotation logic, then apply the negated transformation since we have no valid negative 'w' component
                            // undos: *rotation = [-x, -z, y, -w];
                            FrameType::Racket => [x, z, -y],
                            // undos: *rotation = [-y, z, -x, w];
                            FrameType::Viewer => [-y, z, -x],
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
                PhysicsUpdate::Rotation([x, y, z, w]) => {
                    // track the rotation from our last frame
                    prev_rotation.copy_from_slice(rotation);

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

    fn cleanup_client(&mut self) {
        // remove the user data once they disconnect
        self.position_data.lock().unwrap().remove(&self.user);
    }
}

static BASE_CAMERA_QUATERNION: Lazy<quaternion::Quaternion<f64>> = Lazy::new(|| {
    quaternion::mul(
        // offset the phone so that looking down is not looking straight
        quaternion::axis_angle([0.0, 1.0, 0.0], 1.68),
        // the phone needs to be rotated in order to use it sideways
        quaternion::axis_angle([1.0, 0.0, 0.0], -1.68),
    )
});
