-- ==============================================================================
-- Supabase / PostgreSQL Relational Schema for Rithka Billing ERP
-- ==============================================================================

-- Compatibility function: Enables DATE(text_date) in PostgreSQL queries
CREATE OR REPLACE FUNCTION date(val text) RETURNS date AS $$
BEGIN
  IF val IS NULL OR val = '' THEN
    RETURN NULL;
  END IF;
  RETURN val::date;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK(role IN ('owner', 'worker')),
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Company Settings Table
CREATE TABLE IF NOT EXISTS company_settings (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  gst_no VARCHAR(50) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  logo_url TEXT,
  default_tax_rate NUMERIC(6, 2) DEFAULT 9.0,
  inward_prefix VARCHAR(50) DEFAULT 'INW-',
  outward_prefix VARCHAR(50) DEFAULT 'DC-',
  challan_year_format VARCHAR(50) DEFAULT '26-27',
  starting_serial_no INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  customer_code VARCHAR(100),
  company_name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  gst_no VARCHAR(50) NOT NULL,
  company_type VARCHAR(100),
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Goods Master Table
CREATE TABLE IF NOT EXISTS goods (
  id SERIAL PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  unit_value NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
  uom VARCHAR(50) NOT NULL DEFAULT 'Nos',
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Unit of Measurement (UOM)
CREATE TABLE IF NOT EXISTS uom (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Kind of Packages Table
CREATE TABLE IF NOT EXISTS packages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Standard Delivery Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  text TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Inward Stock Entries
CREATE TABLE IF NOT EXISTS inward_entries (
  id SERIAL PRIMARY KEY,
  inward_no VARCHAR(100) UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  po_no VARCHAR(100),
  po_date VARCHAR(50),
  dc_no VARCHAR(100),
  dc_date VARCHAR(50),
  vehicle_no VARCHAR(100),
  total_quantity NUMERIC(12, 2) DEFAULT 0,
  total_value NUMERIC(12, 2) DEFAULT 0,
  remarks TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Inward Items
CREATE TABLE IF NOT EXISTS inward_items (
  id SERIAL PRIMARY KEY,
  inward_id INTEGER NOT NULL REFERENCES inward_entries(id) ON DELETE CASCADE,
  goods_id INTEGER REFERENCES goods(id),
  item_description VARCHAR(255) NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL,
  uom VARCHAR(50) NOT NULL,
  package_type VARCHAR(100),
  unit_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  note TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. Outward Delivery Challans
CREATE TABLE IF NOT EXISTS outward_challans (
  id SERIAL PRIMARY KEY,
  challan_no VARCHAR(100) UNIQUE NOT NULL,
  inward_id INTEGER NOT NULL REFERENCES inward_entries(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  challan_date VARCHAR(50) NOT NULL,
  po_no VARCHAR(100),
  po_date VARCHAR(50),
  cust_dc_no VARCHAR(100),
  cust_dc_date VARCHAR(50),
  vehicle_no VARCHAR(100),
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6, 2) NOT NULL DEFAULT 9.0,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  note TEXT,
  remarks TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Outward Items
CREATE TABLE IF NOT EXISTS outward_items (
  id SERIAL PRIMARY KEY,
  challan_id INTEGER NOT NULL REFERENCES outward_challans(id) ON DELETE CASCADE,
  inward_item_id INTEGER NOT NULL REFERENCES inward_items(id),
  goods_id INTEGER REFERENCES goods(id),
  item_description VARCHAR(255) NOT NULL,
  your_ref_no VARCHAR(100),
  quantity NUMERIC(12, 2) NOT NULL,
  uom VARCHAR(50) NOT NULL,
  package_type VARCHAR(100),
  unit_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_value NUMERIC(12, 2) NOT NULL DEFAULT 0
);

-- 12. Stock Transactions Ledger
CREATE TABLE IF NOT EXISTS stock_transactions (
  id SERIAL PRIMARY KEY,
  transaction_type VARCHAR(20) NOT NULL CHECK(transaction_type IN ('INWARD', 'OUTWARD')),
  reference_type VARCHAR(50) NOT NULL,
  reference_id INTEGER NOT NULL,
  inward_no VARCHAR(100),
  challan_no VARCHAR(100),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  goods_id INTEGER REFERENCES goods(id),
  item_description VARCHAR(255) NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL,
  uom VARCHAR(50) NOT NULL,
  unit_value NUMERIC(12, 2) DEFAULT 0,
  total_value NUMERIC(12, 2) DEFAULT 0,
  user_id INTEGER NOT NULL REFERENCES users(id),
  notes TEXT,
  transaction_date VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  username VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100),
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_inward_customer ON inward_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_outward_inward ON outward_challans(inward_id);
CREATE INDEX IF NOT EXISTS idx_stock_cust_goods ON stock_transactions(customer_id, goods_id);
CREATE INDEX IF NOT EXISTS idx_stock_date ON stock_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
