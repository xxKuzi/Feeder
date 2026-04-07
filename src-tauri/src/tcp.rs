use crate::{
    bluetooth,
    electro,
    sql,
    sql::Mode,
};
use log::{info, warn};
use once_cell::sync::OnceCell;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicI32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

const DEFAULT_TCP_ADDRESS: &str = "127.0.0.1:7878";
const REMOTE_AUTH_ENV_FILE: &str = ".remote-control.env";
const USER_PASSWORD_KEY: &str = "REMOTE_USER_PASSWORD";
const DEV_PASSWORD_KEY: &str = "REMOTE_DEV_PASSWORD";

struct ClientConnection {
    id: u64,
    writer: Arc<Mutex<TcpStream>>,
}

#[derive(Clone)]
struct TcpTelemetryServer {
    clients: Arc<Mutex<Vec<ClientConnection>>>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum RemoteRole {
    User,
    Developer,
}

#[derive(Clone)]
struct AuthConfig {
    user_password: String,
    dev_password: String,
    env_path: PathBuf,
}

static TELEMETRY_SERVER: OnceCell<TcpTelemetryServer> = OnceCell::new();
static AUTH_CONFIG: OnceCell<Arc<Mutex<AuthConfig>>> = OnceCell::new();
static NEXT_CLIENT_ID: AtomicU64 = AtomicU64::new(1);
static ACTIVE_MODE_ID: AtomicI32 = AtomicI32::new(0);

fn now_unix_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn parse_env(content: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once('=') {
            let mut parsed_value = value.trim().to_string();
            if (parsed_value.starts_with('"') && parsed_value.ends_with('"'))
                || (parsed_value.starts_with('\'') && parsed_value.ends_with('\''))
            {
                parsed_value = parsed_value[1..parsed_value.len() - 1].to_string();
            }
            map.insert(key.trim().to_string(), parsed_value);
        }
    }

    map
}

fn write_env_file(path: &PathBuf, user_password: &str, dev_password: &str) -> Result<(), String> {
    let content = format!(
        "# Local-only remote control credentials. Keep this file out of git.\n{USER_PASSWORD_KEY}={}\n{DEV_PASSWORD_KEY}={}\n",
        user_password, dev_password
    );

    fs::write(path, content).map_err(|e| format!("Failed to write auth env file: {e}"))
}

fn resolve_auth_env_path() -> PathBuf {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let root_candidate = cwd.join(REMOTE_AUTH_ENV_FILE);
    let src_tauri_candidate = cwd.join("src-tauri").join(REMOTE_AUTH_ENV_FILE);

    if root_candidate.exists() {
        return root_candidate;
    }

    if src_tauri_candidate.exists() {
        return src_tauri_candidate;
    }

    if cwd.join("src-tauri").is_dir() {
        return src_tauri_candidate;
    }

    root_candidate
}

fn load_auth_config() -> AuthConfig {
    let env_path = resolve_auth_env_path();
    let from_file = fs::read_to_string(&env_path).unwrap_or_default();
    let map = parse_env(&from_file);

    let user_password = std::env::var(USER_PASSWORD_KEY)
        .ok()
        .or_else(|| map.get(USER_PASSWORD_KEY).cloned())
        .unwrap_or_else(|| "user123".to_string());

    let dev_password = std::env::var(DEV_PASSWORD_KEY)
        .ok()
        .or_else(|| map.get(DEV_PASSWORD_KEY).cloned())
        .unwrap_or_else(|| "dev123".to_string());

    AuthConfig {
        user_password,
        dev_password,
        env_path,
    }
}

fn write_json_line(stream: &mut TcpStream, payload: &Value) -> std::io::Result<()> {
    let mut line = serde_json::to_vec(payload).map_err(std::io::Error::other)?;
    line.push(b'\n');
    stream.write_all(&line)
}

fn write_to_client(client: &ClientConnection, payload: &Value) -> std::io::Result<()> {
    let mut stream = client.writer.lock().map_err(|_| {
        std::io::Error::new(std::io::ErrorKind::Other, "Mutex poisoned")
    })?;
    write_json_line(&mut stream, payload)
}

fn with_auth_config<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce(&mut AuthConfig) -> Result<R, String>,
{
    let holder = AUTH_CONFIG
        .get()
        .ok_or_else(|| "Auth config not initialized".to_string())?
        .clone();

    let mut lock = holder
        .lock()
        .map_err(|_| "Auth config mutex poisoned".to_string())?;

    f(&mut lock)
}

fn check_password(password: &str) -> Result<Option<RemoteRole>, String> {
    with_auth_config(|cfg| {
        if password == cfg.dev_password {
            Ok(Some(RemoteRole::Developer))
        } else if password == cfg.user_password {
            Ok(Some(RemoteRole::User))
        } else {
            Ok(None)
        }
    })
}

fn update_password(role: RemoteRole, new_password: &str) -> Result<(), String> {
    if new_password.trim().len() < 4 {
        return Err("Password must be at least 4 characters".to_string());
    }

    with_auth_config(|cfg| {
        match role {
            RemoteRole::User => cfg.user_password = new_password.trim().to_string(),
            RemoteRole::Developer => cfg.dev_password = new_password.trim().to_string(),
        }

        write_env_file(&cfg.env_path, &cfg.user_password, &cfg.dev_password)
    })
}

fn role_to_str(role: RemoteRole) -> &'static str {
    match role {
        RemoteRole::User => "user",
        RemoteRole::Developer => "developer",
    }
}

fn build_message(event: &str, payload: Value) -> Value {
    json!({
        "type": "telemetry",
        "event": event,
        "timestamp_ms": now_unix_ms(),
        "payload": payload
    })
}

fn connected_client_count() -> usize {
    let Some(server) = TELEMETRY_SERVER.get() else {
        return 0;
    };

    match server.clients.lock() {
        Ok(lock) => lock.len(),
        Err(_) => 0,
    }
}

fn parse_mode(args: &Value) -> Result<Mode, String> {
    serde_json::from_value::<Mode>(args.clone())
        .map_err(|e| format!("Invalid mode payload: {e}"))
}

fn requires_auth(role: Option<RemoteRole>) -> Result<RemoteRole, String> {
    role.ok_or_else(|| "Authentication required".to_string())
}

fn requires_developer(role: Option<RemoteRole>) -> Result<RemoteRole, String> {
    match role {
        Some(RemoteRole::Developer) => Ok(RemoteRole::Developer),
        Some(RemoteRole::User) => Err("Developer role required".to_string()),
        None => Err("Authentication required".to_string()),
    }
}

fn extract_i32(args: &Value, key: &str) -> Result<i32, String> {
    args.get(key)
        .and_then(Value::as_i64)
        .and_then(|v| i32::try_from(v).ok())
        .ok_or_else(|| format!("Missing or invalid integer field: {key}"))
}

fn extract_u32(args: &Value, key: &str) -> Result<u32, String> {
    args.get(key)
        .and_then(Value::as_u64)
        .and_then(|v| u32::try_from(v).ok())
        .ok_or_else(|| format!("Missing or invalid unsigned integer field: {key}"))
}

fn extract_string(args: &Value, key: &str) -> Result<String, String> {
    args.get(key)
        .and_then(Value::as_str)
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Missing or invalid string field: {key}"))
}

fn run_command(role: Option<RemoteRole>, command: &str, args: &Value, app: &AppHandle) -> Result<Value, String> {
    match command {
        "manual_move_position" => {
            let _ = requires_auth(role)?;
            let steps = extract_i32(args, "steps")?;
            let safety = args.get("safety").and_then(Value::as_bool).unwrap_or(false);
            let queued = electro::motor_system::rotate_stepper_motor(app.clone(), steps, safety)?;
            Ok(json!({
                "ok": true,
                "steps": steps,
                "safety": safety,
                "queued": queued
            }))
        }
        "manual_try_shot" => {
            let _ = requires_auth(role)?;
            let result = electro::motor_system::feed_ball_to_servo1()?;
            Ok(json!({ "ok": true, "message": result }))
        }
        "manual_run_shots" => {
            let _ = requires_auth(role)?;
            let shots = extract_u32(args, "shots")?;
            let interval_ms = args
                .get("interval_ms")
                .and_then(Value::as_u64)
                .unwrap_or(1200)
                .clamp(120, 15000);

            for _ in 0..shots {
                electro::motor_system::feed_ball_to_servo1()?;
                std::thread::sleep(Duration::from_millis(interval_ms));
            }

            Ok(json!({ "ok": true, "shots": shots, "interval_ms": interval_ms }))
        }
        "pause_workout" => {
            let _ = requires_auth(role)?;
            tauri::async_runtime::block_on(bluetooth::set_workout_state_remote(false))?;
            Ok(json!({ "ok": true }))
        }
        "start_workout" => {
            let _ = requires_auth(role)?;
            let requested_mode_id = args
                .get("mode_id")
                .and_then(Value::as_i64)
                .and_then(|v| i32::try_from(v).ok());
            let active_mode_id = if let Some(mode_id) = requested_mode_id {
                ACTIVE_MODE_ID.store(mode_id, Ordering::Relaxed);
                mode_id
            } else {
                ACTIVE_MODE_ID.load(Ordering::Relaxed)
            };
            tauri::async_runtime::block_on(bluetooth::set_workout_state_remote(true))?;
            let _ = app.emit("active-mode-changed", json!({ "mode_id": active_mode_id }));
            let _ = app.emit(
                "remote-start-workout",
                json!({ "mode_id": active_mode_id }),
            );
            Ok(json!({ "ok": true }))
        }
        "exit_workout" => {
            let _ = requires_auth(role)?;
            tauri::async_runtime::block_on(bluetooth::set_workout_state_remote(false))?;
            let _ = app.emit("remote-exit-workout", json!({ "to": "menu" }));
            Ok(json!({ "ok": true }))
        }
        "get_workout_state" => {
            let _ = requires_auth(role)?;
            Ok(json!({ "state": tauri::async_runtime::block_on(bluetooth::get_workout_state()) }))
        }
        "load_modes" => {
            let _ = requires_auth(role)?;
            let modes = tauri::async_runtime::block_on(sql::load_modes())?;
            Ok(json!({ "modes": modes, "activeModeId": ACTIVE_MODE_ID.load(Ordering::Relaxed) }))
        }
        "select_mode" => {
            let _ = requires_auth(role)?;
            let mode_id = extract_i32(args, "mode_id")?;
            ACTIVE_MODE_ID.store(mode_id, Ordering::Relaxed);
            let _ = send_event("active_mode_changed", json!({ "mode_id": mode_id }));
            let _ = app.emit("active-mode-changed", json!({ "mode_id": mode_id }));
            Ok(json!({ "mode_id": mode_id }))
        }
        "export_all_data" => {
            let _ = requires_developer(role)?;
            let users = tauri::async_runtime::block_on(sql::load_users())?;
            let records = tauri::async_runtime::block_on(sql::load_records())?;
            let modes = tauri::async_runtime::block_on(sql::load_modes())?;
            let current_data = tauri::async_runtime::block_on(sql::load_current_data())?;
            let accuracy = tauri::async_runtime::block_on(sql::load_user_accuracy_summary())?;

            Ok(json!({
                "exportedAt": now_unix_ms(),
                "users": users,
                "records": records,
                "modes": modes,
                "currentData": current_data,
                "accuracySummary": accuracy,
                "workoutState": tauri::async_runtime::block_on(bluetooth::get_workout_state())
            }))
        }
        "add_user" => {
            let _ = requires_developer(role)?;
            let name = extract_string(args, "name")?;
            let number = args.get("number").and_then(Value::as_u64).and_then(|n| u32::try_from(n).ok());
            let id = tauri::async_runtime::block_on(sql::add_user(name, number))?;
            Ok(json!({ "user_id": id }))
        }
        "rename_user" => {
            let _ = requires_developer(role)?;
            let user_id = extract_i32(args, "user_id")?;
            let new_name = extract_string(args, "new_name")?;
            let new_number = extract_i32(args, "new_number")?;
            tauri::async_runtime::block_on(sql::rename_user(user_id, new_name, new_number))?;
            Ok(json!({ "ok": true }))
        }
        "delete_user" => {
            let _ = requires_developer(role)?;
            let user_id = extract_i32(args, "user_id")?;
            tauri::async_runtime::block_on(sql::delete_user(user_id))?;
            Ok(json!({ "ok": true }))
        }
        "add_mode" => {
            let _ = requires_developer(role)?;
            let mode = parse_mode(args)?;
            tauri::async_runtime::block_on(sql::add_mode(mode))?;
            Ok(json!({ "ok": true }))
        }
        "update_mode" => {
            let _ = requires_developer(role)?;
            let mode = parse_mode(args)?;
            tauri::async_runtime::block_on(sql::update_mode(mode))?;
            Ok(json!({ "ok": true }))
        }
        "delete_mode" => {
            let _ = requires_developer(role)?;
            let mode_id = extract_i32(args, "mode_id")?;
            tauri::async_runtime::block_on(sql::delete_mode(mode_id))?;
            Ok(json!({ "ok": true }))
        }
        "change_password" => {
            let _ = requires_developer(role)?;
            let target_role = extract_string(args, "role")?;
            let new_password = extract_string(args, "new_password")?;

            let role = match target_role.as_str() {
                "user" => RemoteRole::User,
                "developer" => RemoteRole::Developer,
                _ => return Err("role must be 'user' or 'developer'".to_string()),
            };

            update_password(role, &new_password)?;
            Ok(json!({ "ok": true }))
        }
        "list_profiles" => {
            let _ = requires_auth(role)?;
            let users = tauri::async_runtime::block_on(sql::load_users())?;
            let accuracy = tauri::async_runtime::block_on(sql::load_user_accuracy_summary())?;
            Ok(json!({ "users": users, "accuracySummary": accuracy }))
        }
        "ping" => Ok(json!({ "pong": true, "connectedClients": connected_client_count() })),
        other => Err(format!("Unknown command: {other}")),
    }
}

fn remove_client(server: &TcpTelemetryServer, id: u64) {
    if let Ok(mut lock) = server.clients.lock() {
        lock.retain(|c| c.id != id);
    }
}

fn handle_client(mut stream: TcpStream, app_handle: AppHandle, server: TcpTelemetryServer, id: u64) {
    let peer = stream
        .peer_addr()
        .map(|a| a.to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    let mut auth_role: Option<RemoteRole> = None;
    let hello = json!({
        "type": "hello",
        "server": "feeder",
        "address": DEFAULT_TCP_ADDRESS,
        "authRequired": true,
        "commands": [
            "auth",
            "manual_move_position",
            "manual_try_shot",
            "manual_run_shots",
            "pause_workout",
            "start_workout",
            "exit_workout",
            "get_workout_state",
            "load_modes",
            "select_mode",
            "export_all_data",
            "add_user",
            "rename_user",
            "delete_user",
            "add_mode",
            "update_mode",
            "delete_mode",
            "change_password",
            "list_profiles"
        ]
    });
    let _ = write_json_line(&mut stream, &hello);

    let read_stream = match stream.try_clone() {
        Ok(s) => s,
        Err(e) => {
            warn!("Failed to clone TCP stream for {peer}: {e}");
            remove_client(&server, id);
            return;
        }
    };

    let mut reader = BufReader::new(read_stream);

    loop {
        let mut line = String::new();
        let read = match reader.read_line(&mut line) {
            Ok(n) => n,
            Err(e) => {
                warn!("TCP read error from {peer}: {e}");
                break;
            }
        };

        if read == 0 {
            break;
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let packet: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(e) => {
                let _ = write_json_line(
                    &mut stream,
                    &json!({ "type": "error", "message": format!("Invalid JSON: {e}") }),
                );
                continue;
            }
        };

        let req_type = packet.get("type").and_then(Value::as_str).unwrap_or("");
        let request_id = packet.get("request_id").cloned().unwrap_or_else(|| json!(null));

        if req_type == "auth" {
            let password = packet
                .get("password")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();

            match check_password(&password) {
                Ok(Some(role)) => {
                    auth_role = Some(role);
                    let _ = write_json_line(
                        &mut stream,
                        &json!({
                            "type": "auth_response",
                            "request_id": request_id,
                            "ok": true,
                            "role": role_to_str(role)
                        }),
                    );
                }
                Ok(None) => {
                    let _ = write_json_line(
                        &mut stream,
                        &json!({
                            "type": "auth_response",
                            "request_id": request_id,
                            "ok": false,
                            "error": "Invalid password"
                        }),
                    );
                }
                Err(e) => {
                    let _ = write_json_line(
                        &mut stream,
                        &json!({
                            "type": "auth_response",
                            "request_id": request_id,
                            "ok": false,
                            "error": e
                        }),
                    );
                }
            }
            continue;
        }

        if req_type != "command" {
            let _ = write_json_line(
                &mut stream,
                &json!({
                    "type": "response",
                    "request_id": request_id,
                    "ok": false,
                    "error": "Unsupported request type"
                }),
            );
            continue;
        }

        let command = packet.get("command").and_then(Value::as_str).unwrap_or("");
        let args = packet.get("args").cloned().unwrap_or_else(|| json!({}));

        let response = match run_command(auth_role, command, &args, &app_handle) {
            Ok(data) => json!({
                "type": "response",
                "request_id": request_id,
                "ok": true,
                "data": data
            }),
            Err(e) => json!({
                "type": "response",
                "request_id": request_id,
                "ok": false,
                "error": e
            }),
        };

        let _ = write_json_line(&mut stream, &response);
    }

    remove_client(&server, id);
    info!("TCP client disconnected: {peer}");
}

pub fn start_tcp_server(app_handle: AppHandle) -> Result<(), String> {
    if TELEMETRY_SERVER.get().is_some() {
        return Ok(());
    }

    let auth = load_auth_config();
    if !auth.env_path.exists() {
        let _ = write_env_file(&auth.env_path, &auth.user_password, &auth.dev_password);
    }
    let _ = AUTH_CONFIG.set(Arc::new(Mutex::new(auth)));

    let listener = TcpListener::bind(DEFAULT_TCP_ADDRESS)
        .map_err(|e| format!("Failed to bind TCP server on {DEFAULT_TCP_ADDRESS}: {e}"))?;
    let clients = Arc::new(Mutex::new(Vec::<ClientConnection>::new()));
    let server = TcpTelemetryServer { clients };

    let server_for_accept = server.clone();
    thread::spawn(move || {
        info!("TCP telemetry server listening on {DEFAULT_TCP_ADDRESS}");
        for stream in listener.incoming() {
            match stream {
                Ok(incoming) => {
                    let peer = incoming
                        .peer_addr()
                        .map(|a| a.to_string())
                        .unwrap_or_else(|_| "unknown".to_string());

                    if let Err(e) = incoming.set_nodelay(true) {
                        warn!("Failed to set TCP_NODELAY for {peer}: {e}");
                    }

                    let id = NEXT_CLIENT_ID.fetch_add(1, Ordering::Relaxed);
                    
                    let read_stream = match incoming.try_clone() {
                        Ok(s) => s,
                        Err(e) => {
                            warn!("Failed to clone stream for {peer}: {e}");
                            continue;
                        }
                    };

                    let writer = Arc::new(Mutex::new(incoming));
                    if let Ok(mut lock) = server_for_accept.clients.lock() {
                        lock.push(ClientConnection { id, writer });
                    }

                    let app_handle_clone = app_handle.clone();
                    let server_clone = server_for_accept.clone();
                    thread::spawn(move || handle_client(read_stream, app_handle_clone, server_clone, id));
                    info!("TCP client connected: {peer}");
                }
                Err(e) => warn!("TCP accept error: {e}"),
            }
        }
    });

    TELEMETRY_SERVER
        .set(server)
        .map_err(|_| "TCP server already initialized".to_string())?;

    Ok(())
}

pub fn send_event(event: &str, payload: Value) -> Result<usize, String> {
    let server = TELEMETRY_SERVER
        .get()
        .ok_or_else(|| "TCP telemetry server is not initialized".to_string())?
        .clone();

    let mut clients = server
        .clients
        .lock()
        .map_err(|_| "TCP clients mutex poisoned".to_string())?;

    if clients.is_empty() {
        // Remote connection is optional, soto_client(clientork when nobody is connected.
        return Ok(0);
    }

    let message = build_message(event, payload);
    let mut sent_count = 0usize;

    clients.retain_mut(|client| match write_to_client(client, &message) {
        Ok(_) => {
            sent_count += 1;
            true
        }
        Err(e) => {
            warn!("Dropping disconnected TCP client {}: {e}", client.id);
            false
        }
    });

    Ok(sent_count)
}

#[tauri::command]
pub fn tcp_send_event(event: String, payload: Value) -> Result<usize, String> {
    send_event(event.trim(), payload)
}
