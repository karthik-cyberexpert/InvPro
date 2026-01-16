use serde::{Deserialize, Serialize};
use sqlx::{mysql::MySqlPool, FromRow};
use rust_decimal::Decimal;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct StockMaster {
    pub stock_id: String,
    pub project: String,
    pub supplier_name: String,
    pub invoice: String,
    pub po_no: String,
    pub part_name: String,
    pub description: String,
    pub uom: String,
    pub location: String,
    pub remarks: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct StockLedger {
    pub ledger_id: i32,
    pub stock_id: String,
    pub transaction_type: String,
    pub quantity_change: Decimal,
    pub transaction_date: DateTime<Utc>,
    pub reference: Option<String>,
    pub optional_reason: Option<String>,
    pub created_by: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub is_already_reversed: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct StockSummary {
    #[sqlx(flatten)]
    #[serde(flatten)]
    pub master: StockMaster,
    pub available_quantity: Decimal,
    pub min_quantity: Decimal,
    pub last_movement: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Stats {
    pub total_unique_items: i64,
    pub total_received: Decimal,
    pub total_issued: Decimal,
    pub low_stock_count: i64,
}


