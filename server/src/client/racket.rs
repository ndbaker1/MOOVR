use std::{
    net::TcpStream,
    sync::{Arc, Mutex},
    thread,
};

use tungstenite::{Message, WebSocket};

use crate::{MotionData, PhysicsUpdate, PositionData, ServerState};

pub struct RacketClientHandler {
    position_data: Arc<Mutex<ServerState>>,
    motion_data: MotionData,
    user: usize,
}
impl RacketClientHandler {
    pub const NAME: &'static str = "racket";

    pub fn run(
        position_data: Arc<Mutex<ServerState>>,
        user: usize,
        mut websocket_stream: WebSocket<TcpStream>,
    ) {
        let mut client = Self {
            position_data,
            user,
            motion_data: MotionData::default(),
        };

        thread::spawn(move || {
            // continue processing requests from the connection
            while let Ok(message) = websocket_stream.read_message() {
                match message {
                    Message::Text(text) => match serde_json::from_str::<PhysicsUpdate>(&text) {
                        Ok(ref client_data) => client.update(client_data, super::DELTA),
                        Err(e) => log::error!("[{}]", e),
                    },
                    Message::Binary(data) => log::info!("binary [{:?}]", data),
                    Message::Close(frame) => log::info!("connection closing [{:?}]", frame),
                    Message::Ping(ping) => log::info!("ping [{:?}]", ping),
                    Message::Pong(pong) => log::info!("pong [{:?}]", pong),
                    _ => log::warn!("unused message [{:?}]", message),
                }
            }

            log::info!("cleaning up data for client [{}].", client.user);
            client.cleanup_client();
            log::info!("racket client [{}] disconnected.", client.user);
        });
    }

    fn update(&mut self, client_data: &PhysicsUpdate, delta: f64) {
        if let Ok(mut data) = self.position_data.lock() {
            let PositionData {
                ref mut position,
                ref mut rotation,
            } = data
                .entry(self.user)
                .or_insert_with(|| PositionData::default());

            let MotionData {
                ref mut velocity,
                ref mut acceleration,
                ref mut prev_rotation,
            } = self.motion_data;

            match &client_data {
                PhysicsUpdate::Acceleration(client_acceleration) => {
                    const SCALING_FACTOR: f64 = 750.0;
                    let acceleration_update = quaternion::rotate_vector(
                        (rotation[3], [rotation[0], rotation[1], rotation[2]]),
                        // see rotation logic, then apply the negated transformation since we have no valid negative 'w' component
                        [
                            client_acceleration[0] * SCALING_FACTOR,
                            client_acceleration[2] * SCALING_FACTOR,
                            -client_acceleration[1] * SCALING_FACTOR,
                        ],
                    );

                    let mut velocity_update = [
                        velocity[0] + (acceleration[0] + acceleration_update[0]) * 0.5 * delta,
                        velocity[1] + (acceleration[1] + acceleration_update[1]) * 0.5 * delta,
                        velocity[2] + (acceleration[2] + acceleration_update[2]) * 0.5 * delta,
                    ];

                    // Temporary dampening logic
                    if acceleration_update
                        .into_iter()
                        .all(|f| f < 100.0 && f > -100.0)
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
                    // flip y and z based on how we interpret them.
                    // reverse the X and Y rotation,
                    // which means mirror the XY plane (negation of the Z and W values).
                    *rotation = [-x, -z, *y, -w];
                }
            }
        }
    }

    fn cleanup_client(&mut self) {
        // remove the user data once they disconnect
        self.position_data.lock().unwrap().remove(&self.user);
    }
}
