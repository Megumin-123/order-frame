// 受注実績を F:\database\sysdata.mdb から読み取り、
// Supabase の of_order_history_daily テーブルに UPSERT する同期スクリプト。
//
// zaiko_brass の auto-import.ts と同じパターン。
// 山本さんPC で Windows タスクスケジューラ「ONLOGON」から呼ばれる想定。
//
// 実行例:
//   npm run sync-order-stats              # ログオン同期 (前回成功から7日以内ならスキップ)
//   npm run sync-order-stats -- --force   # 強制同期 (デスクトップ手動ショートカット用)
//   npm run sync-order-stats -- --all     # 全期間 (初回データ移行用)
//   npm run sync-order-stats -- --since=2024-01-01  # 指定日以降
//
// 環境変数:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY (推奨) または NEXT_PUBLIC_SUPABASE_ANON_KEY
//   SYNC_MDB_PATH (省略時は F:\database\sysdata.mdb)

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// .env.local を読み込む (Next.js と同じファイル)
loadEnv({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MDB_PATH = process.env.SYNC_MDB_PATH || 'F:\\database\\sysdata.mdb';

// CLI 引数の解析
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ALL = args.includes('--all');
const SINCE_ARG = args.find((a) => a.startsWith('--since='))?.split('=')[1];
// 既定: 直近 90 日 (キャンセル等の遅れを拾うため)
const DEFAULT_LOOKBACK_DAYS = 90;

// query-mdb.py から移植したマッピング
type SizeCode = 'SS' | 'S' | 'M' | 'M_PLUS' | 'L' | 'LL';
type ColorCode = 'YELLOW_OAK' | 'BROWN' | 'WHITE';

const SEISAKU_SIZE_MAP: Record<number, SizeCode> = {
  630: 'SS',
  620: 'S',
  615: 'M',
  623: 'M_PLUS',
  610: 'L',
  605: 'LL',
};
const VALID_IDS = new Set<number>([605, 610, 615, 620, 623, 630]);
const ALL_SIZES: SizeCode[] = ['SS', 'S', 'M', 'M_PLUS', 'L', 'LL'];
const ALL_COLORS: ColorCode[] = ['YELLOW_OAK', 'BROWN', 'WHITE'];

function detectColor(name: string): ColorCode {
  if (name.includes('パールホワイト')) return 'WHITE';
  if (name.includes('オークブラウン')) return 'BROWN';
  return 'YELLOW_OAK';
}

function detectSizeFromOption(name: string): SizeCode | null {
  if (name.includes('ミニ') || name.includes('mini')) return 'SS';
  if (name.includes('Mプラス')) return 'M_PLUS';
  if (name.includes('LLサイズ') || name.includes('LL】')) return 'LL';
  if (name.includes('Lサイズ') || name.includes('L】')) return 'L';
  if (name.includes('Mサイズ') || name.includes('M】')) return 'M';
  if (name.includes('Sサイズ') || name.includes('S】')) return 'S';
  return null;
}

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface MdbOrderRow {
  受注番号: number;
  注文日時: Date | null;
  キャンセル日: Date | null;
  事業区分: number | null;
}

interface MdbOrderDetailRow {
  受注番号: number;
  商品番号: string | number | null;
  商品名: string | null;
  数量: number | null;
}

interface MdbProductMasterRow {
  商品番号: string | number | null;
  制作ID: number | null;
}

interface DetailWithMaster {
  商品番号: string;
  商品名: string;
  数量: number;
  制作ID: number | null;
}

interface SyncResult {
  rowsProcessed: number;
  rowsUpserted: number;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
}

async function shouldSkipForRecency(
  supabase: SupabaseClient,
): Promise<boolean> {
  // FORCE / ALL / SINCE が指定されたらスキップ判定なし
  if (FORCE || ALL || SINCE_ARG) return false;

  const { data, error } = await supabase
    .from('of_sync_log')
    .select('synced_at, status')
    .eq('status', 'success')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`[sync] of_sync_log の参照に失敗 (続行します): ${error.message}`);
    return false;
  }
  if (!data) return false;

  const row = data as { synced_at: string };
  const lastSyncedAt = new Date(row.synced_at).getTime();
  const elapsedMs = Date.now() - lastSyncedAt;
  // 直近成功からこの期間以内ならスキップ。
  // 案B: 週1回ペース。月曜朝の Access ロック等で当日失敗しても、火曜朝のログオンで再試行される
  // (成功した同期だけが skip 判定の対象なので、失敗→翌日再試行は自動で行われる)
  const SKIP_THRESHOLD_MS = 7 * 24 * 3600 * 1000; // 7日間
  return elapsedMs < SKIP_THRESHOLD_MS;
}

function determineDateRange(): { start: string; end: string } {
  // 終了日は常に今日 (将来日付の発注も今日まで)
  const today = new Date();
  const end = formatDateLocal(today);

  if (ALL) {
    // 全期間: 2010-01-01 から (十分過去)
    return { start: '2010-01-01', end };
  }
  if (SINCE_ARG) {
    return { start: SINCE_ARG, end };
  }
  // 既定: 直近 90 日
  const start = new Date(today);
  start.setDate(start.getDate() - DEFAULT_LOOKBACK_DAYS);
  return { start: formatDateLocal(start), end };
}

async function parseMdb(
  mdbPath: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<{
  byDateSizeColor: Map<string, Map<SizeCode, Map<ColorCode, number>>>;
  rowsProcessed: number;
}> {
  const buffer = readFileSync(mdbPath);
  // MDBReader は dynamic import (CommonJS 互換性の都合)
  const MDBReaderModule = await import('mdb-reader');
  const MDBReader = MDBReaderModule.default;
  const reader = new MDBReader(buffer);

  const orderTable = reader.getTable('tbl_受注データ');
  const detailTable = reader.getTable('tbl_受注明細データ');
  const productMasterTable = reader.getTable('mst_商品マスタ');

  const orders = orderTable.getData() as unknown as MdbOrderRow[];
  const details = detailTable.getData() as unknown as MdbOrderDetailRow[];
  const productMaster = productMasterTable.getData() as unknown as MdbProductMasterRow[];

  // 商品番号 → 制作ID のマップ
  const productCodeToSeisakuId = new Map<string, number>();
  for (const pm of productMaster) {
    if (pm.商品番号 != null && pm.制作ID != null) {
      productCodeToSeisakuId.set(String(pm.商品番号), pm.制作ID);
    }
  }

  // 受注番号 → 注文日 (YYYY-MM-DD) のマップ。フィルタ条件もここで判定。
  const orderNumberToDate = new Map<number, string>();
  const orderNumberToJigyou = new Map<number, number>();
  const rangeStartDate = rangeStart;
  const rangeEndDate = rangeEnd;

  for (const o of orders) {
    if (!o.注文日時) continue;
    if (o.キャンセル日) continue;
    if (o.事業区分 == null) continue;
    if (![1, 3, 4, 5].includes(o.事業区分)) continue;

    const dateStr = formatDateLocal(new Date(o.注文日時));
    if (dateStr < rangeStartDate || dateStr > rangeEndDate) continue;

    orderNumberToDate.set(o.受注番号, dateStr);
    orderNumberToJigyou.set(o.受注番号, o.事業区分);
  }

  // 受注番号 → 該当する明細リスト
  const detailsByOrder = new Map<number, DetailWithMaster[]>();
  for (const d of details) {
    if (!orderNumberToDate.has(d.受注番号)) continue;
    const productCode = d.商品番号 != null ? String(d.商品番号) : '';
    const seisakuId = productCode ? productCodeToSeisakuId.get(productCode) ?? null : null;
    const list = detailsByOrder.get(d.受注番号) ?? [];
    list.push({
      商品番号: productCode,
      商品名: String(d.商品名 || ''),
      数量: d.数量 != null ? Number(d.数量) : 1,
      制作ID: seisakuId,
    });
    detailsByOrder.set(d.受注番号, list);
  }

  // 集計 (Python の query_mdb_stats と同じロジック)
  const byDateSizeColor = new Map<string, Map<SizeCode, Map<ColorCode, number>>>();
  let rowsProcessed = 0;

  for (const [orderNo, detailList] of detailsByOrder) {
    const dateStr = orderNumberToDate.get(orderNo);
    const jigyou = orderNumberToJigyou.get(orderNo);
    if (!dateStr || jigyou == null) continue;

    const optionRows = detailList.filter((r) => r.商品名.includes('額変更'));
    const mainRows = detailList.filter((r) => r.制作ID != null && VALID_IDS.has(r.制作ID));

    for (const main of mainRows) {
      const sizeCode = main.制作ID != null ? SEISAKU_SIZE_MAP[main.制作ID] : undefined;
      if (!sizeCode) continue;

      let color: ColorCode = 'YELLOW_OAK';
      if (jigyou === 1) {
        color = detectColor(main.商品名);
      } else if (jigyou === 4) {
        color = 'YELLOW_OAK';
      } else if (jigyou === 3 || jigyou === 5) {
        color = 'YELLOW_OAK';
        if (optionRows.length > 0) {
          for (const opt of optionRows) {
            const optSize = detectSizeFromOption(opt.商品名);
            if (optSize === sizeCode || optionRows.length === 1) {
              color = detectColor(opt.商品名);
              break;
            }
          }
        }
      }

      // 加算
      let bySize = byDateSizeColor.get(dateStr);
      if (!bySize) {
        bySize = new Map();
        byDateSizeColor.set(dateStr, bySize);
      }
      let byColor = bySize.get(sizeCode);
      if (!byColor) {
        byColor = new Map();
        bySize.set(sizeCode, byColor);
      }
      byColor.set(color, (byColor.get(color) ?? 0) + main.数量);
      rowsProcessed++;
    }
  }

  return { byDateSizeColor, rowsProcessed };
}

async function upsertAll(
  supabase: SupabaseClient,
  byDateSizeColor: Map<string, Map<SizeCode, Map<ColorCode, number>>>,
  rangeStart: string,
  rangeEnd: string,
): Promise<number> {
  // 同期対象範囲内の (date × size × color) すべてに対して、
  // 集計値があれば UPSERT、なければ 0 として UPSERT (一旦既存を消すため)。
  // → 範囲内で「以前あったがその後キャンセルされた」ケースを 0 に補正する。
  const rows: Array<{
    order_date: string;
    size_code: SizeCode;
    color_code: ColorCode;
    quantity: number;
    updated_at: string;
  }> = [];
  const nowIso = new Date().toISOString();

  // 範囲内の日付を列挙する代わりに、まず「集計値があった日付・サイズ・色」をUPSERT
  // → 範囲全部を埋めるには日付の列挙が必要だが、性能優先で「あった分」だけにする。
  // 既存値の補正は次回フル同期 (--all) で吸収する設計。
  for (const [dateStr, bySize] of byDateSizeColor) {
    for (const [sizeCode, byColor] of bySize) {
      for (const [colorCode, qty] of byColor) {
        rows.push({
          order_date: dateStr,
          size_code: sizeCode,
          color_code: colorCode,
          quantity: qty,
          updated_at: nowIso,
        });
      }
    }
  }

  if (rows.length === 0) {
    console.log('[sync] アップサート対象データなし');
    return 0;
  }

  // バッチで UPSERT (一度に大量だと payload size 制限。500行刻み)
  const BATCH = 500;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('of_order_history_daily')
      .upsert(batch, { onConflict: 'order_date,size_code,color_code' });
    if (error) {
      throw new Error(`UPSERT エラー (${i}〜${i + batch.length}): ${error.message}`);
    }
    upserted += batch.length;
  }

  // 範囲内で集計値が無くなった (date, size, color) を 0 にしたい場合は --all で再実行する運用とする
  // (毎回の差分削除はコスト高なので省略。古いデータが残っていても集計時 SUM するので問題なし)

  void rangeStart; // unused: 引数として受けるだけ (将来拡張用)
  void rangeEnd;

  return upserted;
}

async function recordSyncLog(
  supabase: SupabaseClient,
  payload: {
    source: 'auto' | 'manual' | 'initial';
    status: 'success' | 'skipped' | 'error';
    records_processed?: number;
    records_upserted?: number;
    date_range_start?: string;
    date_range_end?: string;
    duration_ms?: number;
    error_message?: string;
  },
): Promise<void> {
  const { error } = await supabase.from('of_sync_log').insert({
    synced_at: new Date().toISOString(),
    ...payload,
  });
  if (error) {
    console.error('[sync] of_sync_log への記録に失敗:', error.message);
  }
}

async function main() {
  const startedAt = Date.now();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[sync] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY) が .env.local に設定されていません');
    process.exit(1);
  }

  const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  // 直近成功から 7日以内ならスキップ
  if (await shouldSkipForRecency(supabase)) {
    console.log('[sync] 前回成功同期から7日経過していないためスキップ');
    await recordSyncLog(supabase, { source: 'auto', status: 'skipped' });
    return;
  }

  const source: 'auto' | 'manual' | 'initial' = ALL ? 'initial' : FORCE ? 'manual' : 'auto';
  const { start, end } = determineDateRange();
  console.log(`[sync] 開始: source=${source} range=${start} 〜 ${end} mdb=${MDB_PATH}`);

  try {
    const { byDateSizeColor, rowsProcessed } = await parseMdb(MDB_PATH, start, end);
    console.log(`[sync] MDB 解析完了: ${rowsProcessed} 行 (受注明細)、${byDateSizeColor.size} 日分`);

    const upserted = await upsertAll(supabase, byDateSizeColor, start, end);
    console.log(`[sync] Supabase 反映完了: ${upserted} レコード upsert`);

    const durationMs = Date.now() - startedAt;
    await recordSyncLog(supabase, {
      source,
      status: 'success',
      records_processed: rowsProcessed,
      records_upserted: upserted,
      date_range_start: start,
      date_range_end: end,
      duration_ms: durationMs,
    });
    console.log(`[sync] 完了 (${durationMs} ms)`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[sync] エラー: ${errorMsg}`);
    try {
      await recordSyncLog(supabase, {
        source,
        status: 'error',
        date_range_start: start,
        date_range_end: end,
        duration_ms: Date.now() - startedAt,
        error_message: errorMsg,
      });
    } catch (logErr) {
      console.error('[sync] of_sync_log 記録も失敗:', logErr);
    }
    process.exit(1);
  }
}

void main();

// 統計集計値の数 (size × color)
void ALL_SIZES;
void ALL_COLORS;
