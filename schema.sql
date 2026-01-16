CREATE DATABASE IF NOT EXISTS inventory_db;
USE inventory_db;

CREATE TABLE IF NOT EXISTS stock_master (
    stock_id VARCHAR(36) PRIMARY KEY,
    project VARCHAR(100) NOT NULL,
    supplier_name VARCHAR(100) NOT NULL,
    invoice VARCHAR(100) NOT NULL,
    po_no VARCHAR(100) NOT NULL,
    part_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    uom VARCHAR(50) NOT NULL,
    location VARCHAR(100) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_identity (project, supplier_name, invoice, po_no, part_name, uom, location)
);

CREATE TABLE IF NOT EXISTS stock_ledger (
    ledger_id INT AUTO_INCREMENT PRIMARY KEY,
    stock_id VARCHAR(36) NOT NULL,
    transaction_type ENUM('IN', 'OUT', 'REVERSAL') NOT NULL,
    quantity_change DECIMAL(15, 4) NOT NULL,
    transaction_date DATETIME NOT NULL,
    reference VARCHAR(255),
    optional_reason TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stock_master(stock_id)
);

CREATE TABLE IF NOT EXISTS stock_threshold (
    stock_id VARCHAR(36) PRIMARY KEY,
    min_quantity DECIMAL(15, 4) DEFAULT 0,
    slow_moving_days INT DEFAULT 30,
    dead_stock_days INT DEFAULT 90,
    FOREIGN KEY (stock_id) REFERENCES stock_master(stock_id)
);

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a default user (password: admin123)
-- In a real app, we should use a proper hash, but for local LAN app with single login, we'll handle this in Rust.
INSERT IGNORE INTO users (username, password_hash) VALUES ('admin', 'admin123');
