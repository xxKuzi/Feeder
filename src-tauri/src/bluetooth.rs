use std::sync::{
    atomic::{AtomicI32, Ordering},
    Arc,
};
use once_cell::sync::OnceCell;
use tauri::Emitter;
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;
use tauri::AppHandle;
use crate::tcp;

// Import logging macros.
use log::{info, error, warn};
// Bring the PeripheralImpl trait into scope so its methods are available.
use ble_peripheral_rust::{Peripheral, PeripheralImpl};

use ble_peripheral_rust::{
    gatt::{
        characteristic::Characteristic,
        descriptor::Descriptor,
        peripheral_event::{PeripheralEvent, ReadRequestResponse, RequestResponse, WriteRequestResponse},
        properties::{AttributePermission, CharacteristicProperty},
        service::Service,
    },
    uuid::ShortUuid,
};

pub const WORKOUT_STATE_PAUSE: i32 = 0;
pub const WORKOUT_STATE_RUNNING: i32 = 1;
pub const WORKOUT_STATE_BREAK: i32 = 2;

/// Global workout state represented as integer codes.
pub static STATE: AtomicI32 = AtomicI32::new(WORKOUT_STATE_RUNNING);

/// Shared app state that holds the BLE peripheral and characteristic UUID.
#[derive(Clone)]
pub struct AppState {
    pub peripheral: Arc<Mutex<Peripheral>>,
    pub char_uuid: Uuid,
}

static BLE_APP_STATE: OnceCell<AppState> = OnceCell::new();
static REMOTE_APP_HANDLE: OnceCell<AppHandle> = OnceCell::new();

async fn set_workout_state_internal(state_code: i32, source: &str) -> Result<(), String> {
    let normalized = match state_code {
        WORKOUT_STATE_RUNNING | WORKOUT_STATE_PAUSE | WORKOUT_STATE_BREAK => state_code,
        _ => WORKOUT_STATE_PAUSE,
    };
    STATE.store(normalized, Ordering::SeqCst);
    let ble_value = if normalized == WORKOUT_STATE_RUNNING { "on" } else { "off" };

    // Try to update BLE characteristic if available
    if let Some(app_state) = BLE_APP_STATE.get() {
        let mut periph = app_state.peripheral.lock().await;
        let _ = periph
            .update_characteristic(app_state.char_uuid, ble_value.into())
            .await;
    }

    // Also emit Tauri event for local UI if app handle is available
    if let Some(app) = REMOTE_APP_HANDLE.get() {
        let _ = app.emit("state-changed", &normalized);
    }

    // Broadcast telemetry
    let _ = tcp::send_event(
        "workout_state",
        serde_json::json!({
            "state": normalized,
            "source": source
        }),
    );

    info!("Workout state changed to {} (source: {})", normalized, source);
    Ok(())
}

pub async fn set_workout_state_remote(state_code: i32) -> Result<(), String> {
    set_workout_state_internal(state_code, "remote_tcp").await
}

/// Initializes the BLE peripheral, adds the service, starts advertising,
/// and spawns the background event handler.
///
/// This function is called when your Tauri app starts.
pub async fn init_ble(app_handle: AppHandle) -> Result<AppState, Box<dyn std::error::Error>> {
    let app_handle = Arc::new(app_handle);
    info!("Initializing BLE peripheral...333");
    
    // Define characteristic and service UUIDs.
    let char_uuid = Uuid::from_short(0x2A3D_u16);
    let service = Service {
        uuid: Uuid::from_short(0x1234_u16),
        primary: true,
        characteristics: vec![
            Characteristic {
                uuid: char_uuid,
                properties: vec![
                    CharacteristicProperty::Read,
                    CharacteristicProperty::Write,
                    CharacteristicProperty::Notify,
                ],
                permissions: vec![
                    AttributePermission::Readable,
                    AttributePermission::Writeable,
                ],
                value: None,
                descriptors: vec![Descriptor {
                    uuid: Uuid::from_short(0x2A13_u16),
                    value: Some(vec![0, 1]),
                    ..Default::default()
                }],
            },
            // An additional characteristic example.
            Characteristic {
                uuid: Uuid::from_string("1209"),
                ..Default::default()
            },
        ],
    };

    let (sender_tx, mut receiver_rx) = mpsc::channel::<PeripheralEvent>(256);

    // Create the BLE peripheral.
    let peripheral = Arc::new(Mutex::new(Peripheral::new(sender_tx).await?));

    // Spawn event handler for BLE events.
    let peripheral_for_events = peripheral.clone();
    let char_uuid_for_events = char_uuid.clone();
    let app_handle_for_events = app_handle.clone();
    tokio::spawn(async move {
        while let Some(event) = receiver_rx.recv().await {
            handle_updates(event, peripheral_for_events.clone(), char_uuid_for_events, app_handle_for_events.clone()).await;
        }
    });

    // Wait until the peripheral is powered on.
    loop {
        let powered = {
            let mut periph = peripheral.lock().await;
            periph.is_powered().await.unwrap_or(false)
        };
        if powered {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    // Add the service.
    {
        let mut periph = peripheral.lock().await;
        periph.add_service(&service).await?;
    }
    info!("Service Added");

    // Start advertising.
    {
        let mut periph = peripheral.lock().await;
        periph.start_advertising("RustBLE", &[service.uuid]).await?;
    }
    info!("Advertising Started");

    // Set initial state to "on" (running).
    {
        let mut periph = peripheral.lock().await;
        periph.update_characteristic(char_uuid, "on".into()).await?;
    }

    let state = AppState { peripheral, char_uuid };
    let _ = BLE_APP_STATE.set(state.clone());
    // Store the app handle for remote commands (AppHandle is Arc<_> internally, so clone is cheap)
    let _ = REMOTE_APP_HANDLE.set((*app_handle).clone());
    Ok(state)
}

/// Handles incoming BLE events such as read and write requests.
async fn handle_updates(
    event: PeripheralEvent,
    peripheral: Arc<Mutex<Peripheral>>,
    char_uuid: Uuid,
    app_handle: Arc<AppHandle>,
) {
    match event {
        // app_handle = Arc::clone(&app_handle);
        PeripheralEvent::StateUpdate { is_powered } => {
            info!("PowerOn: {:?}", is_powered);
        }
        PeripheralEvent::CharacteristicSubscriptionUpdate { request, subscribed } => {
            info!(
                "CharacteristicSubscriptionUpdate: Subscribed {} {:?}",
                subscribed, request
            );
        }
        PeripheralEvent::ReadRequest {
            request,
            offset,
            responder,
        } => {
            let current_state = STATE.load(Ordering::SeqCst);
            let response_value = if current_state == WORKOUT_STATE_RUNNING {
                "on"
            } else {
                "off"
            };

            info!(
                "ReadRequest: {:?} Offset: {} -> Responding: {}",
                request, offset, response_value
            );

            if let Err(e) = responder.send(ReadRequestResponse {
                value: response_value.into(),
                response: RequestResponse::Success,
            }) {
                error!("Failed to send read response: {:?}", e);
            }
        }
        PeripheralEvent::WriteRequest {
            request: _,
            offset: _,
            value,
            responder,
        } => {
            if let Ok(msg) = String::from_utf8(value.clone()) {
                info!("WriteRequest: Received message -> {}", msg);

                let new_value = match msg.trim() {
                    "on" => {
                        STATE.store(WORKOUT_STATE_RUNNING, Ordering::SeqCst);
                        info!("STATE changed to: ON (running)");
                        "on"
                    }
                    "off" => {
                        STATE.store(WORKOUT_STATE_PAUSE, Ordering::SeqCst);
                        info!("STATE changed to: OFF (paused)");
                        "off"
                    }
                    _ => {
                        warn!("WriteRequest: Unrecognized value -> {}", msg);
                        msg.as_str()
                    }
                };
                println!("new_value: {:?}", new_value);
                let state_code = if new_value == "on" {
                    WORKOUT_STATE_RUNNING
                } else {
                    WORKOUT_STATE_PAUSE
                };
                if let Err(e) = app_handle.emit_to("main", "state-changed", &state_code) {
                    eprintln!("Failed to emit event to frontend: {}", e);
                }

                let _ = tcp::send_event(
                    "workout_state",
                    serde_json::json!({
                        "state": state_code,
                        "source": "ble_write"
                    }),
                );

                // Update the characteristic to notify subscribed clients.
                if let Err(e) = peripheral
                    .lock()
                    .await
                    .update_characteristic(char_uuid, new_value.into())
                    .await
                {
                    error!("Error updating characteristic in WriteRequest: {:?}", e);
                }
            } else {
                error!("WriteRequest: Received non-UTF8 data");
            }

            if let Err(e) = responder.send(WriteRequestResponse {
                response: RequestResponse::Success,
            }) {
                error!("Failed to send write response: {:?}", e);
            }
        }
    }
}

/// Tauri command to start the workout (set state to "running").
#[tauri::command]
pub async fn start_workout(app_state: tauri::State<'_, AppState>) -> Result<(), String> {
    let _ = app_state;
    set_workout_state_internal(WORKOUT_STATE_RUNNING, "tauri_command").await?;
    info!("Workout started (state set to running)");
    
    Ok(())
}

/// Tauri command to pause the workout (set state to "paused").
#[tauri::command]
pub async fn pause_workout(app_state: tauri::State<'_, AppState>) -> Result<(), String> {
    let _ = app_state;
    set_workout_state_internal(WORKOUT_STATE_PAUSE, "tauri_command").await?;
    info!("Workout paused (state set to off)");
    Ok(())
}

/// Tauri command to end the workout (set state to "break").
#[tauri::command]
pub async fn exit_workout(app_state: tauri::State<'_, AppState>) -> Result<(), String> {
    let _ = app_state;
    set_workout_state_internal(WORKOUT_STATE_BREAK, "tauri_command").await?;
    info!("Workout ended (state set to break)");
    Ok(())
}

/// Tauri command to get the current workout state.
#[tauri::command]
pub async fn get_workout_state() -> i32 {
    println!("get_workout_state");
    STATE.load(Ordering::SeqCst)
}
