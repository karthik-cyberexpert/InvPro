mod db;
mod commands;

use commands::*;
use std::env;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
        "mysql://root:root@localhost:3306/inventory_db".to_string()
    });

    tauri::async_runtime::block_on(async {
        let pool = sqlx::mysql::MySqlPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(std::time::Duration::from_secs(3))
            .connect(&database_url)
            .await
            .expect("Failed to connect to MySQL");
        
        tauri::Builder::default()
            .plugin(tauri_plugin_opener::init())
            .manage(commands::AppState { pool })
            .invoke_handler(tauri::generate_handler![
                login_user,
                get_inventory,
                issue_stock,
                get_stats,
                bulk_upload_preview,
                confirm_bulk_upload,
                get_history,
                reverse_transaction,
                add_stock_entry,
                add_stock_quantity
            ])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    });
}
