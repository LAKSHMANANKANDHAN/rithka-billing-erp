-- SQLite Relational Schema for Billing, Inward Stock, Outward Challan and ERP Software

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner', 'worker')),
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  gst_no TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  default_tax_rate REAL DEFAULT 9.0,
  inward_prefix TEXT DEFAULT 'INW-',
  outward_prefix TEXT DEFAULT 'DC-',
  challan_year_format TEXT DEFAULT '26-27',
  starting_serial_no INTEGER DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_code TEXT,
  company_name TEXT NOT NULL,
  address TEXT NOT NULL,
  gst_no TEXT NOT NULL,
  company_type TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  unit_value REAL NOT NULL DEFAULT 0.0,
  uom TEXT NOT NULL DEFAULT 'Nos',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS uom (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inward_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inward_no TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL,
  po_no TEXT,
  po_date TEXT,
  dc_no TEXT,
  dc_date TEXT,
  vehicle_no TEXT,
  total_quantity REAL DEFAULT 0,
  total_value REAL DEFAULT 0,
  remarks TEXT,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inward_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inward_id INTEGER NOT NULL,
  goods_id INTEGER,
  item_description TEXT NOT NULL,
  quantity REAL NOT NULL,
  uom TEXT NOT NULL,
  package_type TEXT,
  unit_value REAL NOT NULL DEFAULT 0,
  total_value REAL NOT NULL DEFAULT 0,
  note TEXT,
  remarks TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inward_id) REFERENCES inward_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (goods_id) REFERENCES goods(id)
);

CREATE TABLE IF NOT EXISTS outward_challans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challan_no TEXT UNIQUE NOT NULL,
  inward_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  challan_date TEXT NOT NULL,
  po_no TEXT,
  po_date TEXT,
  cust_dc_no TEXT,
  cust_dc_date TEXT,
  vehicle_no TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 9.0,
  tax_amount REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  note TEXT,
  remarks TEXT,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inward_id) REFERENCES inward_entries(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS outward_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challan_id INTEGER NOT NULL,
  inward_item_id INTEGER NOT NULL,
  goods_id INTEGER,
  item_description TEXT NOT NULL,
  your_ref_no TEXT,
  quantity REAL NOT NULL,
  uom TEXT NOT NULL,
  package_type TEXT,
  unit_value REAL NOT NULL DEFAULT 0,
  total_value REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (challan_id) REFERENCES outward_challans(id) ON DELETE CASCADE,
  FOREIGN KEY (inward_item_id) REFERENCES inward_items(id),
  FOREIGN KEY (goods_id) REFERENCES goods(id)
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('INWARD', 'OUTWARD')),
  reference_type TEXT NOT NULL,
  reference_id INTEGER NOT NULL,
  inward_no TEXT,
  challan_no TEXT,
  customer_id INTEGER NOT NULL,
  goods_id INTEGER,
  item_description TEXT NOT NULL,
  quantity REAL NOT NULL,
  uom TEXT NOT NULL,
  unit_value REAL DEFAULT 0,
  total_value REAL DEFAULT 0,
  user_id INTEGER NOT NULL,
  notes TEXT,
  transaction_date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inward_customer ON inward_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_outward_inward ON outward_challans(inward_id);
CREATE INDEX IF NOT EXISTS idx_stock_cust_goods ON stock_transactions(customer_id, goods_id);
CREATE INDEX IF NOT EXISTS idx_stock_date ON stock_transactions(transaction_date);
