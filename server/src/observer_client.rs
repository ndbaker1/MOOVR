use std::{
    net::TcpStream,
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

use tungstenite::{Message, WebSocket};

use crate::{racket_client::RacketClientHandler, ServerState};

pub struct ObserverClientHandler;
impl ObserverClientHandler {
    pub const NAME: &'static str = "observer";

    pub fn run(
        data: Arc<Mutex<ServerState>>,
        observers: Arc<Mutex<Vec<(usize, WebSocket<TcpStream>)>>>,
    ) {
        thread::spawn(move || loop {
            if let Ok(data) = data.lock() {
                // don't send empty messages to the users
                if !data.is_empty() {
                    observers.lock().unwrap().retain_mut(|(user, observer)| {
                        if let Err(e) = observer
                            .write_message(Message::text(serde_json::to_string(&*data).unwrap()))
                        {
                            log::warn!("observer error [{}]", e);
                            log::info!("removing client with id [{}]", user);
                            return false;
                        }

                        true
                    });
                }
            }

            // sleep for 60 seconds to prevent resource starvation
            thread::sleep(Duration::from_secs_f64(RacketClientHandler::DELTA));
        });
    }
}
