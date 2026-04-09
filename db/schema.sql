CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'frame',
  size_code TEXT NOT NULL DEFAULT '',
  size_label TEXT NOT NULL DEFAULT '',
  color_code TEXT NOT NULL DEFAULT '',
  color_label TEXT NOT NULL DEFAULT '',
  frame_size_name TEXT NOT NULL DEFAULT '',
  unit_price INTEGER NOT NULL,
  specs TEXT,
  pieces_per_box INTEGER NOT NULL DEFAULT 1,
  classification_code TEXT,
  trigger_stock INTEGER NOT NULL DEFAULT 0,
  order_quantity INTEGER NOT NULL DEFAULT 0,
  auto_order INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS stock_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checked_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  memo TEXT
);

CREATE TABLE IF NOT EXISTS stock_check_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_check_id INTEGER NOT NULL REFERENCES stock_checks(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  current_stock INTEGER NOT NULL,
  avg_daily_20d REAL,
  avg_monthly REAL,
  needs_order INTEGER NOT NULL DEFAULT 0,
  suggested_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  order_date TEXT NOT NULL,
  supplier_name TEXT NOT NULL DEFAULT '寺下額縁株式会社',
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  stock_check_id INTEGER REFERENCES stock_checks(id),
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('delivery_lead_days', '21');

CREATE TABLE IF NOT EXISTS delivery_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  delivery_date TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  is_received INTEGER NOT NULL DEFAULT 0,
  received_at TEXT,
  received_quantity INTEGER,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
