use log::{info, warn};
use once_cell::sync::OnceCell;
use serde_json::{json, Value};
use std::io::{ErrorKind, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_TCP_ADDRESS: &str = "127.0.0.1:7878";

#[derive(Clone)]
struct TcpTelemetryServer {
    clients: Arc<Mutex<Vec<TcpStream>>>,
}

static TELEMETRY_SERVER: OnceCell<TcpTelemetryServer> = OnceCell::new();

fn now_unix_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn write_json_line(stream: &mut TcpStream, payload: &Value) -> std::io::Result<()> {
    let mut line = serde_json::to_vec(payload).map_err(std::io::Error::other)?;
    line.push(b'\n');
    stream.write_all(&line)
}

fn build_message(event: &str, payload: Value) -> Value {
    json!({
        "type": "telemetry",
        "event": event,
        "timestamp_ms": now_unix_ms(),
        "payload": payload
    })
}

pub fn start_tcp_server() -> Result<(), String> {
    if TELEMETRY_SERVER.get().is_some() {
        return Ok(());
    }

    let listener = TcpListener::bind(DEFAULT_TCP_ADDRESS)
        .map_err(|e| format!("Failed to bind TCP server on {DEFAULT_TCP_ADDRESS}: {e}"))?;
    let clients = Arc::new(Mutex::new(Vec::<TcpStream>::new()));

    let clients_for_accept = clients.clone();
    thread::spawn(move || {
        info!("TCP telemetry server listening on {DEFAULT_TCP_ADDRESS}");
        for stream in listener.incoming() {
            match stream {
                Ok(mut incoming) => {
                    let peer = incoming
                        .peer_addr()
                        .map(|a| a.to_string())
                        .unwrap_or_else(|_| "unknown".to_string());

                    if let Err(e) = incoming.set_nodelay(true) {
                        warn!("Failed to set TCP_NODELAY for {peer}: {e}");
                    }

                    let hello = build_message(
                        "server_hello",
                        json!({
                            "server": "feeder",
                            "address": DEFAULT_TCP_ADDRESS
                        }),
                    );

                    if let Err(e) = write_json_line(&mut incoming, &hello) {
                        warn!("Failed to send hello message to {peer}: {e}");
                        continue;
                    }

                    info!("TCP telemetry client connected: {peer}");
                    if let Ok(mut lock) = clients_for_accept.lock() {
                        lock.push(incoming);
                    }
                }
                Err(e) if e.kind() == ErrorKind::WouldBlock => {}
                Err(e) => warn!("TCP accept error: {e}"),
            }
        }
    });

    TELEMETRY_SERVER
        .set(TcpTelemetryServer { clients })
        .map_err(|_| "TCP server already initialized".to_string())?;

    Ok(())
}

pub fn send_event(event: &str, payload: Value) -> Result<usize, String> {
    let server = TELEMETRY_SERVER
        .get()
        .ok_or_else(|| "TCP telemetry server is not initialized".to_string())?
        .clone();

    let message = build_message(event, payload);
    let mut sent_count = 0usize;

    let mut clients = server
        .clients
        .lock()
        .map_err(|_| "TCP clients mutex poisoned".to_string())?;

    clients.retain_mut(|stream| match write_json_line(stream, &message) {
        Ok(_) => {
            sent_count += 1;
            true
        }
        Err(e) => {
            warn!("Dropping disconnected TCP client: {e}");
            false
        }
    });

    Ok(sent_count)
}

#[tauri::command]
pub fn tcp_send_event(event: String, payload: Value) -> Result<usize, String> {
    send_event(event.trim(), payload)
}
