use futures::SinkExt;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use tokio::{
    net::{TcpListener, TcpStream},
    sync::{
        mpsc::{self, UnboundedSender},
        Mutex,
    },
};
use tokio_tungstenite::{
    accept_hdr_async,
    tungstenite::{handshake::server::Request, Message},
    WebSocketStream,
};

use crate::{observer_client::ObserverClientHandler, racket_client::RacketClientHandler};

mod observer_client;
mod racket_client;

const PORT: u16 = 42069;

fn main() {
    env_logger::init();
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async { Server::default().serve(&format!("0.0.0.0:{}", PORT)).await });
}

type AxisData = [f64; 3];

#[derive(Deserialize, Debug)]
enum SensorType {
    #[serde(rename = "acceleration")]
    Acceleration,
    #[serde(rename = "orientation")]
    Orientation,
}

#[derive(Deserialize, Debug)]
struct ChangeData {
    #[serde(alias = "type")]
    type_name: SensorType,
    axis_data: AxisData,
}

#[derive(Debug, Default, Serialize)]
pub struct PlayerData {
    /// 3D coordinate of the player
    position: AxisData,
    /// velocity of the player's racket
    velocity: AxisData,
    /// measures in 180 degrees
    rotation: AxisData,
}

type ServerState = HashMap<usize, PlayerData>;

#[derive(Debug, Default)]
struct Server {
    data: Arc<Mutex<ServerState>>,
}

impl Server {
    async fn serve(&mut self, listener_addr: &str) {
        let listener = TcpListener::bind(listener_addr).await.unwrap();

        log::info!("listening for connections.");
        loop {
            match listener.accept().await {
                Ok((tcp, _addr)) => {
                    let data = self.data.clone();
                    // Waits for new connections asynchronously
                    // when a client attempts to connect, read the URI to get extra metadata
                    let mut request_uri = None;
                    if let Ok(websocket_stream) =
                        accept_hdr_async(tcp, |request: &Request, response| {
                            log::info!("processing client request with URI [{}]", request.uri());
                            request_uri = Some(request.uri().clone().to_string());
                            Ok(response)
                        })
                        .await
                    {
                        log::info!("client connected!");
                        let url_string = request_uri.unwrap_or_default();
                        let url = url_string.trim_start_matches('/');
                        let user = url
                            .split('/')
                            .collect::<Vec<_>>()
                            .get(1)
                            .unwrap()
                            .parse()
                            .expect("head connections need a user index.");

                        let observer_sender = ObserverClientHandler::create(data.clone());

                        if url.starts_with(RacketClientHandler::NAME) {
                            log::info!("spawning racket client with id [{}].", user);
                            tokio::spawn(async move {
                                RacketClientHandler::new(data, user)
                                    .handle(websocket_stream)
                                    .await;
                                log::info!("client disconnected.");
                            });
                        } else if url.starts_with(ObserverClientHandler::NAME) {
                            log::info!("spawning observer client with id [{}].", user);
                            if let Err(e) = observer_sender.send(websocket_stream) {
                                log::error!("observer error [{}]", e);
                            }
                        } else {
                            log::error!("incomming connection did not provide valid type in url.");
                        }
                    }
                }
                Err(e) => {
                    log::error!("what happened [{}]", e);
                }
            };
        }
    }
}
