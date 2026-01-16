use crate::db::{StockLedger, StockSummary, Stats, HistoryEntry};
use sqlx::{mysql::MySqlPool, Row};
use rust_decimal::Decimal;
use uuid::Uuid;
use serde::{Deserialize, Serialize};

pub struct AppState {
    pub pool: MySqlPool,
}

#[tauri::command]
pub async fn login_user(
    state: tauri::State<'_, AppState>,
    username: String,
    password_hash: String,
) -> Result<bool, String> {
    let clean_user = username.trim();
    let clean_pass = password_hash.trim();

    let row = sqlx::query("SELECT password_hash FROM users WHERE username = ?")
        .bind(clean_user)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = row {
        let stored_hash: String = row.get(0);
        let matches = stored_hash.trim() == clean_pass;
        println!("Login attempt for {}: match={}", clean_user, matches);
        Ok(matches)
    } else {
        println!("Login attempt for {}: user not found", clean_user);
        Ok(false)
    }
}

#[derive(Serialize)]
pub struct InventoryResponse {
    pub items: Vec<StockSummary>,
    pub total_count: i64,
}

#[tauri::command]
pub async fn get_inventory(
    state: tauri::State<'_, AppState>,
    page: i32,
    page_size: i32,
    search: Option<String>,
) -> Result<InventoryResponse, String> {
    let offset = (page - 1) * page_size;
    
    // 1. Build Base Filter Clause
    let mut where_clause = String::new();
    if let Some(ref s) = search {
        if !s.is_empty() {
            let s_lower = s.to_lowercase();
             where_clause.push_str(&format!(
                " WHERE LOWER(m.part_name) LIKE '%{}%' OR LOWER(m.project) LIKE '%{}%' OR LOWER(m.supplier_name) LIKE '%{}%' OR LOWER(m.invoice) LIKE '%{}%'",
                s_lower, s_lower, s_lower, s_lower
            ));
        }
    }

    // 2. Count Total Matching Rows (Grouped)
    // We need to count the number of groups that match the criteria
    let count_query = format!(
        "SELECT COUNT(*) FROM (
            SELECT 1 
            FROM stock_master m 
            {}
            GROUP BY m.project, m.part_name, m.uom, m.location, m.description
        ) as count_table",
        where_clause
    );

    let total_count: i64 = sqlx::query_scalar(&count_query)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Failed to count items: {}", e))?;

    // 3. Fetch Data
    let mut query_str = String::from(
        "SELECT 
            MAX(m.stock_id) as stock_id, 
            MAX(m.project) as project, 
            MAX(m.part_name) as part_name, 
            MAX(m.description) as description, 
            MAX(m.uom) as uom, 
            MAX(m.location) as location, 
            MAX(m.remarks) as remarks, 
            MAX(m.created_at) as created_at,
            MAX(m.supplier_name) as supplier_name,
            MAX(m.invoice) as invoice,
            MAX(m.po_no) as po_no,
            (
                SELECT COALESCE(SUM(l2.quantity_change), 0)
                FROM stock_ledger l2
                JOIN stock_master m2 ON l2.stock_id = m2.stock_id
                WHERE LOWER(TRIM(m2.project)) = LOWER(TRIM(m.project)) 
                  AND LOWER(TRIM(m2.part_name)) = LOWER(TRIM(m.part_name)) 
                  AND LOWER(TRIM(m2.uom)) = LOWER(TRIM(m.uom)) 
                  AND LOWER(TRIM(m2.location)) = LOWER(TRIM(m.location))
                  AND LOWER(TRIM(m2.description)) = LOWER(TRIM(m.description))
            ) as available_quantity,
            MAX(COALESCE(t.min_quantity, 0)) as min_quantity,
            (
                SELECT MAX(l3.transaction_date)
                FROM stock_ledger l3
                JOIN stock_master m3 ON l3.stock_id = m3.stock_id
                WHERE LOWER(TRIM(m3.project)) = LOWER(TRIM(m.project)) 
                  AND LOWER(TRIM(m3.part_name)) = LOWER(TRIM(m.part_name)) 
                  AND LOWER(TRIM(m3.uom)) = LOWER(TRIM(m.uom)) 
                  AND LOWER(TRIM(m3.location)) = LOWER(TRIM(m.location))
                  AND LOWER(TRIM(m3.description)) = LOWER(TRIM(m.description))
            ) as last_movement
        FROM stock_master m
        LEFT JOIN stock_threshold t ON m.stock_id = t.stock_id
        "
    );

    query_str.push_str(&where_clause);
    query_str.push_str(" GROUP BY m.project, m.part_name, m.uom, m.location, m.description");
    query_str.push_str(" ORDER BY MAX(m.created_at) DESC LIMIT ? OFFSET ?");

    let items = sqlx::query_as::<sqlx::MySql, StockSummary>(&query_str)
        .bind(page_size)
        .bind(offset)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(InventoryResponse { items, total_count })
}

#[tauri::command]
pub async fn issue_stock(
    state: tauri::State<'_, AppState>,
    stock_id: String,
    quantity: Decimal,
    reference: String,
    reason: Option<String>,
    user: String,
) -> Result<(), String> {
    // 1. Check if enough shared stock is available for this item's identity set
    let available: Decimal = sqlx::query_scalar(
        "SELECT COALESCE(SUM(l.quantity_change), 0)
         FROM stock_ledger l
         JOIN stock_master m ON l.stock_id = m.stock_id
         JOIN stock_master target ON 
            LOWER(TRIM(m.project)) = LOWER(TRIM(target.project)) AND 
            LOWER(TRIM(m.part_name)) = LOWER(TRIM(target.part_name)) AND 
            LOWER(TRIM(m.description)) = LOWER(TRIM(target.description)) AND 
            LOWER(TRIM(m.uom)) = LOWER(TRIM(target.uom)) AND 
            LOWER(TRIM(m.location)) = LOWER(TRIM(target.location))
         WHERE target.stock_id = ?"
    )
    .bind(&stock_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if available < quantity {
        return Err("Insufficient stock".to_string());
    }

    // 2. Insert negative ledger entry
    sqlx::query("INSERT INTO stock_ledger (stock_id, transaction_type, quantity_change, transaction_date, reference, optional_reason, created_by) VALUES (?, 'OUT', ?, NOW(), ?, ?, ?)")
        .bind(stock_id)
        .bind(-quantity)
        .bind(reference)
        .bind(reason)
        .bind(user)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_stats(state: tauri::State<'_, AppState>) -> Result<Stats, String> {
    let total_unique: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT project, part_name, uom, location) FROM stock_master"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let total_received: Decimal = sqlx::query_scalar(
        "SELECT COALESCE(SUM(l.quantity_change), 0) FROM stock_ledger l 
         WHERE l.transaction_type = 'IN' 
         AND NOT EXISTS (SELECT 1 FROM stock_ledger WHERE reference LIKE CONCAT('%Ledger ID: ', l.ledger_id, '%') AND transaction_type = 'REVERSAL')"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let total_issued: Decimal = sqlx::query_scalar(
        "SELECT ABS(COALESCE(SUM(l.quantity_change), 0)) FROM stock_ledger l 
         WHERE l.transaction_type = 'OUT' 
         AND NOT EXISTS (SELECT 1 FROM stock_ledger WHERE reference LIKE CONCAT('%Ledger ID: ', l.ledger_id, '%') AND transaction_type = 'REVERSAL')"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let low_stock_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM (
            SELECT 
                MAX(m.project) as project, 
                MAX(m.part_name) as part_name, 
                MAX(m.uom) as uom, 
                MAX(m.location) as location,
                COALESCE(SUM(l.quantity_change), 0) as available_grouped,
                MAX(COALESCE(t.min_quantity, 0)) as max_min_qty
            FROM stock_master m
            LEFT JOIN stock_ledger l ON m.stock_id = l.stock_id
            LEFT JOIN stock_threshold t ON m.stock_id = t.stock_id
            GROUP BY LOWER(TRIM(m.project)), LOWER(TRIM(m.part_name)), LOWER(TRIM(m.uom)), LOWER(TRIM(m.location)), LOWER(TRIM(m.description))
        ) as grouped_inventory WHERE available_grouped < max_min_qty"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(Stats {
        total_unique_items: total_unique,
        total_received,
        total_issued,
        low_stock_count,
    })
}

fn normalize_string(s: &str) -> String {
    s.trim()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportRow {
    pub project: String,
    pub supplier_name: String,
    pub invoice: String,
    pub po_no: String,
    pub part_name: String,
    pub description: String,
    pub quantity: Decimal,
    pub uom: String,
    pub location: String,
    #[serde(default)]
    pub remarks: Option<String>,
    #[serde(default)]
    pub rec_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportPreview {
    pub row: ImportRow,
    pub status: String, // "NEW" | "MERGED"
    #[serde(default)]
    pub diff_reason: Option<String>,
    #[serde(default)]
    pub existing_stock_id: Option<String>,
}

#[tauri::command]
pub async fn bulk_upload_preview(
    state: tauri::State<'_, AppState>,
    rows: Vec<ImportRow>,
) -> Result<Vec<ImportPreview>, String> {
    println!("Bulk upload preview requested for {} rows", rows.len());
    let mut previews = Vec::new();

    for row in rows {
        let norm_project = normalize_string(&row.project);
        let norm_supplier = normalize_string(&row.supplier_name);
        let norm_invoice = normalize_string(&row.invoice);
        let norm_po = normalize_string(&row.po_no);
        let norm_part = normalize_string(&row.part_name);
        let norm_description = normalize_string(&row.description);
        let norm_uom = normalize_string(&row.uom);
        let norm_location = normalize_string(&row.location);

        // Find match in DB - Matching ONLY on the core Identity Set
        let existing = sqlx::query("SELECT stock_id FROM stock_master WHERE 
            LOWER(TRIM(project)) = ? AND 
            LOWER(TRIM(part_name)) = ? AND 
            LOWER(TRIM(uom)) = ? AND 
            LOWER(TRIM(description)) = ? AND 
            LOWER(TRIM(location)) = ?")
            .bind(&norm_project)
            .bind(&norm_part)
            .bind(&norm_uom)
            .bind(&norm_description)
            .bind(&norm_location)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| e.to_string())?;

        if let Some(r) = existing {
            let stock_id: String = r.get(0);
            previews.push(ImportPreview {
                row,
                status: "MERGED".to_string(),
                diff_reason: None,
                existing_stock_id: Some(stock_id),
            });
        } else {
            previews.push(ImportPreview {
                row,
                status: "NEW".to_string(),
                diff_reason: None,
                existing_stock_id: None,
            });
        }
    }

    Ok(previews)
}

#[tauri::command]
pub async fn confirm_bulk_upload(
    state: tauri::State<'_, AppState>,
    previews: Vec<ImportPreview>,
    user: String,
) -> Result<(), String> {
    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;

    for preview in previews {
        let stock_id = if let Some(id) = preview.existing_stock_id.as_ref() {
            id.clone()
        } else {
            let new_id = Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO stock_master (stock_id, project, supplier_name, invoice, po_no, part_name, description, uom, location, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .bind(&new_id)
                .bind(&preview.row.project)
                .bind(&preview.row.supplier_name)
                .bind(&preview.row.invoice)
                .bind(&preview.row.po_no)
                .bind(&preview.row.part_name)
                .bind(&preview.row.description)
                .bind(&preview.row.uom)
                .bind(&preview.row.location)
                .bind(&preview.row.remarks)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
            new_id
        };

        sqlx::query("INSERT INTO stock_ledger (stock_id, transaction_type, quantity_change, transaction_date, reference, created_by) VALUES (?, 'IN', ?, NOW(), ?, ?)")
            .bind(stock_id)
            .bind(preview.row.quantity)
            .bind(format!("Excel Import: {} | Supplier: {}", preview.row.invoice, preview.row.supplier_name))
            .bind(&user)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize)]
pub struct HistoryResponse {
    pub items: Vec<HistoryEntry>,
    pub total_count: i64,
}

#[tauri::command]
pub async fn get_history(
    state: tauri::State<'_, AppState>,
    page: i32,
    page_size: i32,
    search: Option<String>,
) -> Result<HistoryResponse, String> {
    let offset = (page - 1) * page_size;
    
    // 1. Build Filter Clause
    let mut where_clause = String::new();
    if let Some(ref s) = search {
        if !s.is_empty() {
            let s_lower = s.to_lowercase();
            where_clause.push_str(&format!(
                " WHERE LOWER(l.reference) LIKE '%{}%' OR LOWER(l.transaction_type) LIKE '%{}%' OR LOWER(l.optional_reason) LIKE '%{}%' OR LOWER(l.created_by) LIKE '%{}%' OR LOWER(m.part_name) LIKE '%{}%' OR LOWER(m.description) LIKE '%{}%'",
                s_lower, s_lower, s_lower, s_lower, s_lower, s_lower
            ));
        }
    }

    // 2. Get Total Count
    let count_query = format!("SELECT COUNT(*) FROM stock_ledger l JOIN stock_master m ON l.stock_id = m.stock_id {}", where_clause);
    let total_count: i64 = sqlx::query_scalar(&count_query)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    // 3. Fetch Data
    let query = format!(
        "SELECT l.*, m.part_name, m.description,
        EXISTS(SELECT 1 FROM stock_ledger WHERE reference LIKE CONCAT('%Ledger ID: ', l.ledger_id, '%') AND transaction_type = 'REVERSAL') as is_already_reversed
        FROM stock_ledger l 
        JOIN stock_master m ON l.stock_id = m.stock_id
        {} 
        ORDER BY l.transaction_date DESC LIMIT ? OFFSET ?",
        where_clause
    );

    let items = sqlx::query_as::<sqlx::MySql, HistoryEntry>(&query)
        .bind(page_size)
        .bind(offset)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(HistoryResponse { items, total_count })
}

#[tauri::command]
pub async fn get_export_history(
    state: tauri::State<'_, AppState>,
    date_from: Option<String>,
    date_to: Option<String>,
    status: Option<String>,
) -> Result<Vec<HistoryEntry>, String> {
    let mut where_clause = String::from("WHERE 1=1");
    
    if let Some(from) = date_from {
        if !from.is_empty() {
            where_clause.push_str(&format!(" AND l.transaction_date >= '{}'", from));
        }
    }
    if let Some(to) = date_to {
        if !to.is_empty() {
            where_clause.push_str(&format!(" AND l.transaction_date <= '{} 23:59:59'", to)); // End of day
        }
    }
    if let Some(s) = status {
        if !s.is_empty() && s != "All" {
            where_clause.push_str(&format!(" AND l.transaction_type = '{}'", s));
        }
    }

    let query = format!(
        "SELECT l.*, m.part_name, m.description,
        EXISTS(SELECT 1 FROM stock_ledger WHERE reference LIKE CONCAT('%Ledger ID: ', l.ledger_id, '%') AND transaction_type = 'REVERSAL') as is_already_reversed
        FROM stock_ledger l 
        JOIN stock_master m ON l.stock_id = m.stock_id
        {}
        ORDER BY l.transaction_date DESC",
        where_clause
    );

    let items = sqlx::query_as::<sqlx::MySql, HistoryEntry>(&query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[tauri::command]
pub async fn reverse_transaction(
    state: tauri::State<'_, AppState>,
    ledger_id: i32,
    user: String,
) -> Result<(), String> {
    // 1. Check if already reversed
    let already_reversed: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM stock_ledger WHERE reference LIKE CONCAT('%Ledger ID: ', ?, '%') AND transaction_type = 'REVERSAL')"
    )
    .bind(ledger_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    if already_reversed {
        return Err("This transaction has already been reversed.".to_string());
    }

    // 2. Get original details
    let original = sqlx::query("SELECT * FROM stock_ledger WHERE ledger_id = ?")
        .bind(ledger_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let stock_id: String = original.get("stock_id");
    let qty: Decimal = original.get("quantity_change");
    let reference: String = original.get("reference");

    // 3. Insert reversal entry
    sqlx::query("INSERT INTO stock_ledger (stock_id, transaction_type, quantity_change, transaction_date, reference, optional_reason, created_by) VALUES (?, 'REVERSAL', ?, NOW(), ?, ?, ?)")
        .bind(stock_id)
        .bind(-qty)
        .bind(format!("Reversal of Ledger ID: {}", ledger_id))
        .bind(format!("Original Ref: {}", reference))
        .bind(user)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn add_stock_entry(
    state: tauri::State<'_, AppState>,
    row: ImportRow,
    user: String,
) -> Result<(), String> {
    let preview = bulk_upload_preview(state.clone(), vec![row]).await?;
    confirm_bulk_upload(state, preview, user).await?;
    Ok(())
}

#[tauri::command]
pub async fn add_stock_quantity(
    state: tauri::State<'_, AppState>,
    stock_id: String,
    quantity: Decimal,
    user: String,
) -> Result<(), String> {
    
    // Insert positive ledger entry (IN)
    sqlx::query("INSERT INTO stock_ledger (stock_id, transaction_type, quantity_change, transaction_date, reference, created_by) VALUES (?, 'IN', ?, NOW(), ?, ?)")
        .bind(stock_id)
        .bind(quantity)
        .bind("Manual Stock Addition")
        .bind(user)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
