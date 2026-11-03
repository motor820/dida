pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod state;

use crate::{db::Database, state::AppState};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") { let _ = window.set_focus(); }
        }))
        .setup(|app| {
            // 获取应用数据目录
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");

            // 确保目录存在
            std::fs::create_dir_all(&app_data_dir)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&app_data_dir, std::fs::Permissions::from_mode(0o700))?;
            }

            // 初始化数据库
            let db_path = app_data_dir.join("dida.db");
            let db = Database::new(db_path).expect("Failed to initialize database");

            // 设置应用状态
            let state = AppState::new(db);
            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::task::get_tasks,
            commands::list::get_lists,
            commands::tag::get_tags,
            commands::sync::sync_local_load,
            commands::sync::sync_local_save,
            commands::sync::sync_has_session,
            commands::sync::sync_request,
            commands::sync::sync_forget_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
