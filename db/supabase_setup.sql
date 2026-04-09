-- 額縁発注管理システム用テーブル
-- Supabase SQL Editorで実行してください

-- 商品マスタ
CREATE TABLE IF NOT EXISTS of_products (
  id SERIAL PRIMARY KEY,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 在庫チェック履歴
CREATE TABLE IF NOT EXISTS of_stock_checks (
  id SERIAL PRIMARY KEY,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  memo TEXT
);

-- 在庫チェック明細
CREATE TABLE IF NOT EXISTS of_stock_check_items (
  id SERIAL PRIMARY KEY,
  stock_check_id INTEGER NOT NULL REFERENCES of_stock_checks(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES of_products(id),
  current_stock INTEGER NOT NULL,
  avg_daily_20d REAL,
  avg_monthly REAL,
  needs_order INTEGER NOT NULL DEFAULT 0,
  suggested_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 発注書ヘッダ
CREATE TABLE IF NOT EXISTS of_orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  order_date TEXT NOT NULL,
  supplier_name TEXT NOT NULL DEFAULT '寺下額縁株式会社',
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  stock_check_id INTEGER REFERENCES of_stock_checks(id),
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 発注明細
CREATE TABLE IF NOT EXISTS of_order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES of_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES of_products(id),
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 納品予定
CREATE TABLE IF NOT EXISTS of_delivery_schedules (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES of_order_items(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES of_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES of_products(id),
  delivery_date TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  is_received INTEGER NOT NULL DEFAULT 0,
  received_at TEXT,
  received_quantity INTEGER,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 設定テーブル
CREATE TABLE IF NOT EXISTS of_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO of_settings (key, value) VALUES ('delivery_lead_days', '21') ON CONFLICT (key) DO NOTHING;

-- 初期商品データ（18商品）
INSERT INTO of_products (name, category, size_code, size_label, color_code, color_label, frame_size_name, unit_price, specs, pieces_per_box, trigger_stock, order_quantity, auto_order, sort_order) VALUES
('額(黄オーク) mini', 'frame', 'SS', 'mini(SS)', 'YELLOW_OAK', '黄オーク', 'SS', 1340, '額:ガラス マット:オフホワイト', 40, 50, 80, 1, 1),
('額(黄オーク) S', 'frame', 'S', 'Sサイズ', 'YELLOW_OAK', '黄オーク', 'インチ', 1502, '額:ガラス マット:オフホワイト', 25, 140, 175, 1, 2),
('額(黄オーク) M', 'frame', 'M', 'Mサイズ', 'YELLOW_OAK', '黄オーク', '太子', 2253, '額:ガラス マット:オフホワイト', 12, 110, 120, 1, 3),
('額(黄オーク) Mプラス', 'frame', 'M_PLUS', 'Mプラス', 'YELLOW_OAK', '黄オーク', '四切', 2807, '額:ガラス マット:オフホワイト', 11, 30, 44, 1, 4),
('額(黄オーク) L', 'frame', 'L', 'Lサイズ', 'YELLOW_OAK', '黄オーク', '大衣', 3431, '額:ガラス マット:オフホワイト', 8, 30, 48, 1, 5),
('額(黄オーク) LL', 'frame', 'LL', 'LLサイズ', 'YELLOW_OAK', '黄オーク', 'F10', 7484, '額:アクリル マット:オフホワイト', 5, 10, 15, 1, 6),
('額(ブラウン) mini', 'frame', 'SS', 'mini(SS)', 'BROWN', 'ブラウン', 'SS', 1340, '額:ガラス マット:オフホワイト', 40, 5, 5, 1, 7),
('額(ブラウン) S', 'frame', 'S', 'Sサイズ', 'BROWN', 'ブラウン', 'インチ', 1502, '額:ガラス マット:オフホワイト', 25, 5, 5, 1, 8),
('額(ブラウン) M', 'frame', 'M', 'Mサイズ', 'BROWN', 'ブラウン', '太子', 2253, '額:ガラス マット:オフホワイト', 12, 5, 5, 1, 9),
('額(ブラウン) Mプラス', 'frame', 'M_PLUS', 'Mプラス', 'BROWN', 'ブラウン', '四切', 2807, '額:ガラス マット:オフホワイト', 11, 5, 3, 1, 10),
('額(ブラウン) L', 'frame', 'L', 'Lサイズ', 'BROWN', 'ブラウン', '大衣', 3431, '額:ガラス マット:オフホワイト', 8, 5, 3, 1, 11),
('額(ブラウン) LL', 'frame', 'LL', 'LLサイズ', 'BROWN', 'ブラウン', 'F10', 7484, '額:アクリル マット:オフホワイト', 5, 5, 3, 1, 12),
('額(ホワイト) mini', 'frame', 'SS', 'mini(SS)', 'WHITE', 'ホワイト', 'SS', 2108, '額:ガラス マット:ホワイト', 40, 5, 5, 1, 13),
('額(ホワイト) S', 'frame', 'S', 'Sサイズ', 'WHITE', 'ホワイト', 'インチ', 2293, '額:ガラス マット:ホワイト', 25, 10, 20, 1, 14),
('額(ホワイト) M', 'frame', 'M', 'Mサイズ', 'WHITE', 'ホワイト', '太子', 2859, '額:ガラス マット:ホワイト', 12, 10, 20, 1, 15),
('額(ホワイト) Mプラス', 'frame', 'M_PLUS', 'Mプラス', 'WHITE', 'ホワイト', '四切', 3442, '額:ガラス マット:ホワイト', 11, 8, 10, 1, 16),
('額(ホワイト) L', 'frame', 'L', 'Lサイズ', 'WHITE', 'ホワイト', '大衣', 3980, '額:ガラス マット:ホワイト', 8, 8, 5, 1, 17),
('額(ホワイト) LL', 'frame', 'LL', 'LLサイズ', 'WHITE', 'ホワイト', 'F10', 7600, '額:アクリル マット:ホワイト', 5, 5, 5, 1, 18)
ON CONFLICT DO NOTHING;

-- RLS（Row Level Security）ポリシー - 全ユーザーアクセス可
ALTER TABLE of_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE of_stock_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE of_stock_check_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE of_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE of_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE of_delivery_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE of_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on of_products" ON of_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on of_stock_checks" ON of_stock_checks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on of_stock_check_items" ON of_stock_check_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on of_orders" ON of_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on of_order_items" ON of_order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on of_delivery_schedules" ON of_delivery_schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on of_settings" ON of_settings FOR ALL USING (true) WITH CHECK (true);
