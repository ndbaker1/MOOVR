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
            } = data
                .entry(self.user)
                .or_insert_with(|| PlayerData::default());

            match &client_data {
                ChangeData::Acceleration(client_acceleration) => {
                    // let client_acceleration = quaternion::rotate_vector(
                    //     (rotation[3], [-rotation[0], -rotation[1], -rotation[2]]),
                    //     *client_acceleration,
                    // );

                    let delta_squared_over_two = delta * delta / 2.0;
                    position[0] += client_acceleration[0] * delta; // * delta_squared_over_two;
                    position[1] += client_acceleration[1] * delta; // * delta_squared_over_two;
                    position[2] += client_acceleration[2] * delta; // * delta_squared_over_two;
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
