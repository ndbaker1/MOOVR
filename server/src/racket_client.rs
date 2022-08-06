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
        log::info!("client disconnected.");
    }

    fn handle_client_data(&mut self, client_data: &ChangeData, delta: f64) {
        if let Ok(mut data) = self.data.lock() {
            let PlayerData {
                ref mut position,
                ref mut rotation,
                ..
            } = data
                .entry(self.user)
                .or_insert_with(|| PlayerData::default());

            match &client_data {
                ChangeData::Acceleration(client_acceleration) => {
                    position[0] += client_acceleration[0] * delta;
                    position[1] += client_acceleration[1] * delta;
                    position[2] += client_acceleration[2] * delta;
                }
                ChangeData::Rotation(client_rotation) => {
                    rotation[0] = client_rotation[0];
                    // switch
                    rotation[1] = client_rotation[2];
                    rotation[2] = client_rotation[1];
                    rotation[3] = client_rotation[3];
                }
            }
        }
    }
}
