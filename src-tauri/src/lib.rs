// src-tauri/src/lib.rs

mod sql;

use sql::{connect_to_database, add_record, add_user, load_users,  select_user, delete_user, load_current_data, load_records, rename_user, add_mode, load_modes}; // Re-export the functions/commands

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub async fn run() {
    connect_to_database().await;

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet, add_record, add_user, load_users, select_user, delete_user, load_current_data, load_records, rename_user, add_mode, load_modes])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
