mod sql;
mod electro;
mod bluetooth;
use bluetooth::{get_workout_state, init_ble, pause_workout, start_workout, AppState};
use sql::{connect_to_database, add_record, add_user, load_users, select_user, delete_user, load_current_data, load_records, rename_user, add_mode, load_modes, delete_mode, update_mode}; // Re-export the functions/commands
use crate::electro::servo_control::{set_servo_angle, blink_led};

pub async fn run() {
     std::env::set_var("RUST_LOG", "info");
  if let Err(err) = pretty_env_logger::try_init() {
      eprintln!("WARNING: failed to initialize logging framework: {}", err);
  }

      // Connect to the SQLite database.
      connect_to_database().await;

      // Create a new Tokio runtime to initialize BLE.
      let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
      let ble_state: AppState = rt.block_on(init_ble()).expect("Failed to initialize BLE peripheral");
  

    tauri::Builder::default()
    .manage(ble_state)
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![add_record, add_user, load_users, select_user, delete_user, load_current_data, load_records, rename_user, add_mode, load_modes, delete_mode, set_servo_angle, exit_app, blink_led, update_mode,  start_workout,
          pause_workout,
          get_workout_state,])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn exit_app() {
  std::process::exit(0x0);
}