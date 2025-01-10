mod sql;
mod electro;
use sql::{connect_to_database, add_record, add_user, load_users, select_user, delete_user, load_current_data, load_records, rename_user, add_mode, load_modes, delete_mode}; // Re-export the functions/commands
use crate::electro::servo_control::{set_servo_angle};

pub async fn run() {
    connect_to_database().await;

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![add_record, add_user, load_users, select_user, delete_user, load_current_data, load_records, rename_user, add_mode, load_modes, delete_mode, set_servo_angle])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
