pub mod sql;
pub mod electro;
pub mod bluetooth;
use tauri::Emitter;
use log::{info, error, warn};

use bluetooth::{get_workout_state, init_ble, pause_workout, start_workout, AppState};
use sql::{
    connect_to_database, add_record, add_user, load_users, select_user, delete_user,
    load_current_data, load_records, rename_user, add_mode, load_modes, delete_mode, update_mode,
};
use electro::servo_control::{rotate_servo};

use tauri::{Manager, AppHandle};
use once_cell::sync::OnceCell;

static GLOBAL_APP_HANDLE: OnceCell<AppHandle> = OnceCell::new();

#[derive(Clone, serde::Serialize)]
pub struct Payload {
    pub message: String,
}

/// Global callback function that other modules can call to emit an event to the frontend.
/// For example, call this from your BLE event handler when you want to notify the UI.
pub fn my_callback_on_click(message: impl Into<String>) {
    if let Some(app_handle) = GLOBAL_APP_HANDLE.get() {
         app_handle
             .emit("onClick", Payload { message: message.into() })
             .unwrap();
    }
}

/// The main run function that initializes logging, connects to the database,
/// initializes BLE (using a separate Tokio runtime), and builds the Tauri app.
pub async fn run() {
    std::env::set_var("RUST_LOG", "info");
    if let Err(err) = pretty_env_logger::try_init() {
        eprintln!("WARNING: failed to initialize logging framework: {}", err);
    }
    println!("Starting the application...");
    info!("Starting the application... 222");

    // Connect to the SQLite database.
    connect_to_database().await;

    // // Create a new Tokio runtime to initialize BLE.
    // let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
    // let ble_state: AppState = rt.block_on(init_ble()).expect("Failed to initialize BLE peripheral");

    tauri::Builder::default()
    .setup(|app| {
        // Blocking call to initialize BLE using the app handle from Tauri.
        // Note: This may block the setup, so ensure the BLE initialization is quick.
        let ble_state = tauri::async_runtime::block_on(init_ble(app.handle().clone()))
            .expect("Failed to initialize BLE peripheral");
        // Register the BLE state so commands can access it.
        app.manage(ble_state);
        Ok(())
    })
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
        add_record,
        add_user,
        load_users,
        select_user,
        delete_user,
        load_current_data,
        load_records,
        rename_user,
        add_mode,
        load_modes,
        delete_mode,        
        exit_app,
        rotate_servo,
        update_mode,
        start_workout,
        pause_workout,
        get_workout_state,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
fn exit_app() {
    std::process::exit(0);
}
