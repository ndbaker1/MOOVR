use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env,
    net::TcpListener,
    sync::{Arc, Mutex},
};

use tungstenite::{accept_hdr, handshake::server::Request};

use crate::{observer_client::ObserverClientHandler, racket_client::RacketClientHandler};

mod observer_client;
mod racket_client;

fn main() {
    env_logger::init();
    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| String::from("42069"))
        .parse()
        .expect("PORT must be a number");
    Server::serve(&format!("0.0.0.0:{}", port));
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
    /// 3D coordinate of the player
    velocity: Vec3,
    /// measures in 180 degrees
    rotation: Quaternion,
}

type ServerState = HashMap<usize, PlayerData>;

struct Server;

impl Server {
    fn serve(listener_addr: &str) {
        let listener = TcpListener::bind(listener_addr).unwrap();

        let data = Arc::new(Mutex::new(ServerState::default()));

        log::info!("creating handler for observers...");
        let observers = Arc::new(Mutex::new(Vec::new()));
        ObserverClientHandler::run(data.clone(), observers.clone());

        log::info!("listening for connections on [{}].", listener_addr);
        loop {
            match listener.accept() {
                Ok((tcp, _addr)) => {
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

                        if url.starts_with(RacketClientHandler::NAME) {
                            log::info!("spawning racket client with id [{}].", user);
                            RacketClientHandler::run(data.clone(), user, websocket_stream);
                        } else if url.starts_with(ObserverClientHandler::NAME) {
                            // observer websockets will be added to a Vec that way each does client doesn't try to acquire a lock to the data mutex.
                            // the master client handler will lock data once and send it through all of the websockets.
                            log::info!("spawning observer client with id [{}].", user);
                            observers
                                .lock()
                                .expect("add new observer websocket.")
                                .push(websocket_stream);
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
