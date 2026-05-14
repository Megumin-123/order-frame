-- of_sync_log に notification_sent_at 列を追加する。
--
-- 用途:
--   sync-order-stats.ts は同期失敗時に of_sync_log に status='error' を記録するが、
--   人間への通知は無かった。直近成功から 14日以上経過 + 当日も失敗のとき
--   LINE で社長に通知する仕組みを追加。
--   24時間以内の重複通知を防ぐため、通知を送った of_sync_log 行に
--   notification_sent_at をセットして、次回判定時に参照する。
--
-- 既存行はすべて NULL のままで支障なし (= まだ通知していない扱い)。

ALTER TABLE of_sync_log
  ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ NULL;
