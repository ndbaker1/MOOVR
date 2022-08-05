use std::{
    sync::Arc,
    thread::{self, Thread},
    time::Duration,
};

use futures::SinkExt;
use tokio::{
    net::TcpStream,
    sync::{
        mpsc::{self, UnboundedSender},
        Mutex,
    },
};
use tokio_tungstenite::{tungstenite::Message, WebSocketStream};

use crate::ServerState;

pub struct ObserverClientHandler;
impl ObserverClientHandler {
    pub const NAME: &'static str = "observer";

    pub fn create(data: Arc<Mutex<ServerState>>) -> UnboundedSender<WebSocketStream<TcpStream>> {
        let (sx, mut rx) = mpsc::unbounded_channel::<WebSocketStream<TcpStream>>();
        tokio::spawn(async move {
            let mut observers = Vec::new();
            loop {
                if let Some(a) = rx.recv().await {
                    observers.push(a);
                }

                let data = &*data.lock().await;
                for observer in &mut observers {
                    if let Err(e) = observer
                        .send(Message::text(serde_json::to_string(data).unwrap()))
                        .await
                    {
                        log::error!("observer error [{}]", e);
                    }
                }
                drop(data);

                thread::sleep(Duration::from_secs_f32(1.0 / 60.0));
            }
        });

        sx
    }
}
