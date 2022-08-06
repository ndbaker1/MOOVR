use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::TcpListener,
    sync::{Arc, Mutex},
    thread,
};

use tungstenite::{accept_hdr, handshake::server::Request};

use crate::{observer_client::ObserverClientHandler, racket_client::RacketClientHandler};

mod observer_client;
mod racket_client;

const PORT: u16 = 42069;

fn main() {
    env_logger::init();
    Server::default().serve(&format!("0.0.0.0:{}", PORT));
}

type Quaternion = [f64; 4];
type Vec3 = [f64; 3];

#[derive(Deserialize, Debug)]
#[serde(tag = "type", content = "data")]
enum ChangeData {
    Rotation(Quaternion),
    Acceleration(Vec3),
}

#[derive(Debug, Default, Serialize)]
pub struct PlayerData {
    /// 3D coordinate of the player
    position: Vec3,
    /// measures in 180 degrees
    rotation: Quaternion,
}

type ServerState = HashMap<usize, PlayerData>;

#[derive(Debug, Default)]
struct Server {
    data: Arc<Mutex<ServerState>>,
}

impl Server {
    fn serve(&mut self, listener_addr: &str) {
        let listener = TcpListener::bind(listener_addr).unwrap();

        log::info!("listening for connections.");
        loop {
            match listener.accept() {
                Ok((tcp, _addr)) => {
                    let data = self.data.clone();
                    // Waits for new connections asynchronously
                    // when a client attempts to connect, read the URI to get extra metadata
                    let mut request_uri = None;
                    if let Ok(websocket_stream) = accept_hdr(tcp, |request: &Request, response| {
                        log::info!("processing client request with URI [{}]", request.uri());
                        request_uri = Some(request.uri().clone().to_string());
                        Ok(response)
                    }) {
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
                            thread::spawn(move || {
                                RacketClientHandler::new(data, user).handle(websocket_stream);
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
