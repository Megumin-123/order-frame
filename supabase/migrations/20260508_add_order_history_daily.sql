-- 受注実績の日別集計テーブル
-- 山本さんPC の sync-order-stats スクリプトが MDB から読み取った
-- 日付 × サイズ × 色 ごとの受注数量を UPSERT する。
-- order-frame の自動提案・安全在庫計算が、このテーブルを SUM して使う。

CREATE TABLE IF NOT EXISTS of_order_history_daily (
  id SERIAL PRIMARY KEY,
  order_date DATE NOT NULL,
  size_code TEXT NOT NULL,       -- SS, S, M, M_PLUS, L, LL
  color_code TEXT NOT NULL,      -- YELLOW_OAK, BROWN, WHITE
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT of_order_history_daily_unique UNIQUE (order_date, size_code, color_code)
);

CREATE INDEX IF NOT EXISTS idx_of_order_history_daily_date ON of_order_history_daily(order_date);

-- 同期ログ
CREATE TABLE IF NOT EXISTS of_sync_log (
  id SERIAL PRIMARY KEY,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,             -- 'auto' (ログオン自動) / 'manual' (手動実行) / 'initial' (初回移行)
  status TEXT NOT NULL,             -- 'success' / 'skipped' / 'error'
  records_processed INTEGER,
  records_upserted INTEGER,
  date_range_start DATE,
  date_range_end DATE,
  duration_ms INTEGER,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_of_sync_log_synced_at ON of_sync_log(synced_at DESC);

-- RLS: 読み取りは anon に許可 (Web画面で表示するため)
ALTER TABLE of_order_history_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "of_order_history_daily_select_anon" ON of_order_history_daily;
CREATE POLICY "of_order_history_daily_select_anon"
  ON of_order_history_daily
  FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER TABLE of_sync_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "of_sync_log_select_anon" ON of_sync_log;
CREATE POLICY "of_sync_log_select_anon"
  ON of_sync_log
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 書き込み (INSERT/UPDATE/DELETE) は service_role キーでのみ可能。
-- 同期スクリプトは SUPABASE_SERVICE_ROLE_KEY を使うため、RLS ポリシーなしでも書き込める。
-- anon キーからの書き込みは RLS により自動的にブロックされる。
