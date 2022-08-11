use std::{
    net::TcpStream,
    sync::{Arc, Mutex},
    thread,
};

use tungstenite::{Message, WebSocket};

use crate::{ChangeData, PlayerData, ServerState};

pub struct RacketClientHandler {
    data: Arc<Mutex<ServerState>>,
    user: usize,
}
impl RacketClientHandler {
    pub const NAME: &'static str = "racket";
    pub const DELTA: f64 = 1f64 / 60f64;

    pub fn run(
        data: Arc<Mutex<ServerState>>,
        user: usize,
        mut websocket_stream: WebSocket<TcpStream>,
    ) {
        let mut client = Self { data, user };
        thread::spawn(move || {
            // continue processing requests from the connection
            while let Ok(message) = websocket_stream.read_message() {
                match message {
                    Message::Text(text) => match serde_json::from_str::<ChangeData>(&text) {
                        Ok(ref client_data) => {
                            client.handle_client_data(client_data, Self::DELTA);
                        }
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

    fn handle_client_data(&mut self, client_data: &ChangeData, delta: f64) {
        if let Ok(mut data) = self.data.lock() {
            let PlayerData {
                ref mut position,
                ref mut rotation,
                ref mut velocity,
                ref mut acceleration,
            } = data
                .entry(self.user)
                .or_insert_with(|| PlayerData::default());

            match &client_data {
                ChangeData::Acceleration(client_acceleration) => {
                    // let client_acceleration = quaternion::rotate_vector(
                    //     (rotation[3], [-rotation[0], -rotation[1], -rotation[2]]),
                    //     *client_acceleration,
                    // );

                    let velocity_update = [
                        velocity[0] + (acceleration[0] + client_acceleration[0]) * 0.5 * delta,
                        velocity[1] + (acceleration[1] + client_acceleration[1]) * 0.5 * delta,
                        velocity[2] + (acceleration[2] + client_acceleration[2]) * 0.5 * delta,
                    ];

                    position[0] += (velocity[0] + velocity_update[0]) * 0.5 * delta;
                    position[1] += (velocity[1] + velocity_update[1]) * 0.5 * delta;
                    position[2] += (velocity[2] + velocity_update[2]) * 0.5 * delta;

                    // update current references
                    *velocity = velocity_update;
                    *acceleration = *client_acceleration;
                }
                ChangeData::Rotation(client_rotation) => {
                    rotation.copy_from_slice(&client_rotation[..])
                }
            }
        }
    }

    fn cleanup_client(&mut self) {
        // remove the user data once they disconnect
        self.data.lock().unwrap().remove(&self.user);
    }
}
