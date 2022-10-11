use std::{
    net::TcpStream,
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

use tungstenite::{Message, WebSocket};

pub struct ObserverClientManager;
impl ObserverClientManager {
    pub fn run(
        data: Arc<Mutex<crate::ServerState>>,
        observers: Arc<Mutex<Vec<(usize, WebSocket<TcpStream>)>>>,
    ) {
        loop {
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
            thread::sleep(Duration::from_secs_f64(super::DELTA));
        }
    }
}
