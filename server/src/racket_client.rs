use std::{
    net::TcpStream,
    sync::{Arc, Mutex},
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

    pub fn new(data: Arc<Mutex<ServerState>>, user: usize) -> Self {
        Self { data, user }
    }

    pub fn handle(&mut self, mut websocket_stream: WebSocket<TcpStream>) {
        // continue processing requests from the connection
        while let Ok(message) = websocket_stream.read_message() {
            match message {
                Message::Text(text) => match serde_json::from_str::<ChangeData>(&text) {
                    Ok(ref client_data) => {
                        self.handle_client_data(client_data, Self::DELTA);
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

        log::info!("cleaning up data for [{}].", self.user);
        self.cleanup_client();
        log::info!("client [{}] disconnected.", self.user);
    }

    fn handle_client_data(&mut self, client_data: &ChangeData, delta: f64) {
        if let Ok(mut data) = self.data.lock() {
            let PlayerData {
                ref mut position,
                ref mut rotation,
                ref mut velocity,
            } = data
                .entry(self.user)
                .or_insert_with(|| PlayerData::default());

            match &client_data {
                ChangeData::Acceleration(client_acceleration) => {
                    velocity[0] += client_acceleration[0];
                    velocity[1] += client_acceleration[1];
                    velocity[2] += client_acceleration[2];

                    velocity[0] *= 0.9;
                    velocity[1] *= 0.9;
                    velocity[2] *= 0.9;

                    position[0] += velocity[0] * delta;
                    position[1] += velocity[1] * delta;
                    position[2] += velocity[2] * delta;
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
