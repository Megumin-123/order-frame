// 受注実績の取得ヘルパー。
//
// 旧実装: 山本さんPC の Flask サーバー (mdb-server.py) を Cloudflare Tunnel 経由で呼んでいた。
// 新実装 (本ファイル): Supabase の of_order_history_daily テーブルを直接 SUM クエリする。
//   - 山本さんPC の sync-order-stats スクリプトが定期的に MDB → Supabase へ同期している前提
//   - Vercel から外部PCへの問い合わせがなくなり、トンネルや環境変数が不要になった
//
// 自動提案 (POST /api/order-stats) と 在庫登録 (POST /api/stock-check) の両方で使う。
import { supabase } from '@/lib/supabase';

export type SizeCode = 'SS' | 'S' | 'M' | 'M_PLUS' | 'L' | 'LL';
export type ColorCode = 'YELLOW_OAK' | 'BROWN' | 'WHITE';

const ALL_SIZES: SizeCode[] = ['SS', 'S', 'M', 'M_PLUS', 'L', 'LL'];
const ALL_COLORS: ColorCode[] = ['YELLOW_OAK', 'BROWN', 'WHITE'];

export interface MdbStats {
  stats: Record<string, Record<string, number>>;
  period: { from: string; to: string };
  totalOrders: number;
}

export type MdbStatsResult =
  | { ok: true; data: MdbStats }
  | { ok: false; error: string; status: number };

function buildEmptyStats(): Record<string, Record<string, number>> {
  const stats: Record<string, Record<string, number>> = {};
  for (const size of ALL_SIZES) {
    stats[size] = {};
    for (const color of ALL_COLORS) {
      stats[size][color] = 0;
    }
  }
  return stats;
}

function shiftYear(dateStr: string, deltaYears: number): string {
  // YYYY-MM-DD を年だけシフトして返す。閏年(2/29 → 2/28)対応のため Date 経由ではなく文字列で処理。
  const [y, m, d] = dateStr.split('-');
  const yNum = parseInt(y, 10) + deltaYears;
  const month = parseInt(m, 10);
  let day = parseInt(d, 10);
  // 2/29 を非閏年へシフトしたら 2/28 に補正
  if (month === 2 && day === 29) {
    const isLeap = (yNum % 4 === 0 && yNum % 100 !== 0) || yNum % 400 === 0;
    if (!isLeap) day = 28;
  }
  return `${yNum}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * 指定された納品予定日(YYYY-MM-DD)を基準に、昨年同時期30日間の受注実績を
 * Supabase (of_order_history_daily) から SUM して返す。
 *
 * mdbPath 引数は旧実装との互換のために残してあるが現在は使用されない (Supabase 経由のため)。
 */
export async function fetchMdbStats(deliveryDate: string, mdbPath?: string): Promise<MdbStatsResult> {
  void mdbPath; // 旧シグネチャ互換のためのダミー

  // YYYY-MM-DD のフォーマットチェック
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
    return {
      ok: false,
      error: `納品予定日の形式が不正です: ${deliveryDate}`,
      status: 400,
    };
  }

  // 昨年同時期 30 日間: start = (deliveryDate - 1年), end = start + 30日 (end は exclusive)
  const startDate = shiftYear(deliveryDate, -1);
  const endDate = addDays(startDate, 30);

  try {
    const { data, error } = await supabase
      .from('of_order_history_daily')
      .select('size_code, color_code, quantity, order_date')
      .gte('order_date', startDate)
      .lt('order_date', endDate);

    if (error) {
      return {
        ok: false,
        error: `Supabase 受注履歴の取得エラー: ${error.message}`,
        status: 500,
      };
    }

    // size × color で集計
    const stats = buildEmptyStats();
    let totalOrders = 0;
    for (const row of data || []) {
      const sz = String(row.size_code) as SizeCode;
      const cl = String(row.color_code) as ColorCode;
      const qty = Number(row.quantity) || 0;
      if (stats[sz] && stats[sz][cl] != null) {
        stats[sz][cl] += qty;
        totalOrders += qty;
      }
    }

    return {
      ok: true,
      data: {
        stats,
        period: { from: startDate, to: endDate },
        totalOrders,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `受注履歴の取得に失敗しました: ${message}`,
      status: 500,
    };
  }
}

/**
 * 「日需要 × 安全在庫日数」で安全在庫数(個数)を計算する。
 * 日需要は画面表示と整合させるため小数1桁に丸めて使う。
 */
export function calcSafetyStockQty(thirtyDayOrder: number, safetyDays: number): number {
  const dailyDemand = thirtyDayOrder / 30;
  const dailyDisplay = Math.round(dailyDemand * 10) / 10;
  return Math.round(dailyDisplay * safetyDays);
}
