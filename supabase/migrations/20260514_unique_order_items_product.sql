-- of_order_items に「同じ発注内で同一商品は1行まで」の制約を追加する。
--
-- 経緯:
--   ORD-2026-0005 で同一 product_id (ホワイト F10 LL) が2行存在し、
--   税込合計が 41,800円 多く表示される問題が発生した。
--   UI には重複追加ガードがあるが、過去の race condition か Supabase 側の
--   transient retry で同じ行が二重挿入された可能性がある。
--   物理的に重複行を入れられないようにする。
--
-- 前提:
--   このマイグレーションを適用する前に、既存の重複行をすべてクリーンアップ
--   しておくこと (本件では id=658 を削除済み)。重複が残ったまま実行すると
--   制約追加が失敗する。

ALTER TABLE of_order_items
  ADD CONSTRAINT of_order_items_unique_product_per_order UNIQUE (order_id, product_id);
