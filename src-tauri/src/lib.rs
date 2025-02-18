mod sql;
mod electro;
use sql::{connect_to_database, add_record, add_user, load_users, select_user, delete_user, load_current_data, load_records, rename_user, add_mode, load_modes, delete_mode}; // Re-export the functions/commands
use crate::electro::servo_control::{set_servo_angle, blink_led};

pub async fn run() {
    connect_to_database().await;

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![add_record, add_user, load_users, select_user, delete_user, load_current_data, load_records, rename_user, add_mode, load_modes, delete_mode, set_servo_angle, exit_app, blink_led])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn exit_app() {
  std::process::exit(0x0);
}