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
            let data = data.lock().unwrap();
            observers.lock().unwrap().retain_mut(|observer| {
                if let Err(e) =
                    observer.write_message(Message::text(serde_json::to_string(&*data).unwrap()))
                {
                    log::error!("observer error [{}]", e);
                    return false;
                }

                true
            });

            // drop lock and then sleep for 60 seconds to prevent resource starvation
            drop(data);
            thread::sleep(Duration::from_secs_f64(RacketClientHandler::DELTA));
        });

        sx
    }
}
