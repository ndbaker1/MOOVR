use std::{sync::Arc, time::Instant};

use futures::StreamExt;
use tokio::{net::TcpStream, sync::Mutex};
use tokio_tungstenite::{tungstenite::Message, WebSocketStream};

use crate::{ChangeData, PlayerData, SensorType, ServerState};

pub struct RacketClientHandler {
    data: Arc<Mutex<ServerState>>,
    user: usize,
    last_instant: Instant,
}
impl RacketClientHandler {
    pub const NAME: &'static str = "racket";

    pub fn new(data: Arc<Mutex<ServerState>>, user: usize) -> Self {
        Self {
            data,
            user,
            last_instant: Instant::now(),
        }
    }

    pub async fn handle(&mut self, mut websocket_stream: WebSocketStream<TcpStream>) {
        self.last_instant = Instant::now();
        // continue processing requests from the connection
        while let Some(Ok(message)) = websocket_stream.next().await {
            let now = Instant::now();
            let delta = now - self.last_instant;
            self.last_instant = now;
            match message {
                Message::Text(text) => match serde_json::from_str::<ChangeData>(&text) {
                    Ok(ref client_data) => {
                        self.handle_client_data(client_data, delta.as_secs_f64())
                            .await
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

    async fn handle_client_data(&mut self, client_data: &ChangeData, delta: f64) {
        let PlayerData {
            mut position,
            mut velocity,
            mut rotation,
        } = self
            .data
            .lock()
            .await
            .entry(self.user)
            .or_insert_with(|| PlayerData::default());

        match client_data.type_name {
            SensorType::Acceleration => {
                velocity[0] += client_data.axis_data[0];
                velocity[1] += client_data.axis_data[1];
                velocity[2] += client_data.axis_data[2];

                position[0] += velocity[0] * delta;
                position[1] += velocity[1] * delta;
                position[2] += velocity[2] * delta;
            }
            SensorType::Orientation => {
                rotation[0] += client_data.axis_data[0];
                rotation[1] += client_data.axis_data[1];
                rotation[2] += client_data.axis_data[2];
            }
        }

        log::info!("[{:?}]", position);
    }
}
