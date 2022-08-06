use std::{
    net::TcpStream,
    sync::{
        mpsc::{self, Sender},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};

use tungstenite::{Message, WebSocket};

use crate::{racket_client::RacketClientHandler, ServerState};

pub struct ObserverClientHandler;
impl ObserverClientHandler {
    pub const NAME: &'static str = "observer";

    pub fn create(data: Arc<Mutex<ServerState>>) -> Sender<WebSocket<TcpStream>> {
        let (sx, rx) = mpsc::channel::<WebSocket<TcpStream>>();

        let observers = Arc::new(Mutex::new(Vec::new()));

        let watched_observers = observers.clone();
        thread::spawn(move || {
            while let Ok(a) = rx.recv() {
                log::info!("adding new user.");
                watched_observers.lock().unwrap().push(a);
            }
        });

        thread::spawn(move || loop {
            if let Ok(data) = data.lock() {
                // don't send empty messages to the users
                if !data.is_empty() {
                    observers.lock().unwrap().retain_mut(|observer| {
                        if let Err(e) = observer
                            .write_message(Message::text(serde_json::to_string(&*data).unwrap()))
                        {
                            log::error!("observer error [{}]", e);
                            return false;
                        }

                        true
                    });
                }
            }

            // sleep for 60 seconds to prevent resource starvation
            thread::sleep(Duration::from_secs_f64(RacketClientHandler::DELTA));
        });

        sx
    }
}
