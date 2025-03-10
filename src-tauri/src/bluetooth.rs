use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::Emitter;
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;
use tauri::{AppHandle, Manager, WebviewWindow};

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

/// Global state: true means "running", false means "paused".
pub static STATE: AtomicBool = AtomicBool::new(true);

/// Shared app state that holds the BLE peripheral and characteristic UUID.
#[derive(Clone)]
pub struct AppState {
    pub peripheral: Arc<Mutex<Peripheral>>,
    pub char_uuid: Uuid,
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
    tokio::spawn(async move {
        while let Some(event) = receiver_rx.recv().await {
            handle_updates(event, peripheral_for_events.clone(), char_uuid_for_events, app_handle.clone()).await;
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

    Ok(AppState { peripheral, char_uuid })
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
            let response_value = if current_state { "on" } else { "off" };

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
            request,
            offset: _,
            value,
            responder,
        } => {
            if let Ok(msg) = String::from_utf8(value.clone()) {
                info!("WriteRequest: Received message -> {}", msg);

                let new_value = match msg.trim() {
                    "on" => {
                        STATE.store(true, Ordering::SeqCst);
                        info!("STATE changed to: ON (running)");
                        "on"
                    }
                    "off" => {
                        STATE.store(false, Ordering::SeqCst);
                        info!("STATE changed to: OFF (paused)");
                        "off"
                    }
                    _ => {
                        warn!("WriteRequest: Unrecognized value -> {}", msg);
                        msg.as_str()
                    }
                };
                println!("new_value: {:?}", new_value);
                if let Err(e) = app_handle.emit_to("main", "state-changed", &new_value) {
                    eprintln!("Failed to emit event to frontend: {}", e);
                }

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
        _ => {
            info!("Unhandled event: {:?}", event);
        }
    }
}

/// Tauri command to start the workout (set state to "running").
#[tauri::command]
pub async fn start_workout(app_state: tauri::State<'_, AppState>) -> Result<(), String> {
    STATE.store(true, Ordering::SeqCst);
    let mut periph = app_state.peripheral.lock().await;
    periph
        .update_characteristic(app_state.char_uuid, "on".into())
        .await
        .map_err(|e| format!("Failed to update characteristic: {:?}", e))?;
    info!("Workout started (state set to running)");
    
    Ok(())
}

/// Tauri command to pause the workout (set state to "paused").
#[tauri::command]
pub async fn pause_workout(app_state: tauri::State<'_, AppState>) -> Result<(), String> {
    STATE.store(false, Ordering::SeqCst);
    let mut periph = app_state.peripheral.lock().await;
    periph
        .update_characteristic(app_state.char_uuid, "off".into())
        .await
        .map_err(|e| format!("Failed to update characteristic: {:?}", e))?;
    info!("Workout paused (state set to off)");
    Ok(())
}

/// Tauri command to get the current workout state.
#[tauri::command]
pub async fn get_workout_state() -> String {
    println!("get_workout_state");
    if STATE.load(Ordering::SeqCst) {
        "running".to_string()
    } else {
        "paused".to_string()
    }
}
