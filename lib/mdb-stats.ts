// MDB (Access) から「昨年同時期 30 日間」の受注実績を取得する共通ヘルパー。
// 自動提案 (POST /api/order-stats) と 在庫登録 (POST /api/stock-check) の
// 両方で使う。実体は ngrok / Cloudflare Tunnel 越しに開発(本番)PC で動く
// Flask サーバー (scripts/mdb-server.py) への HTTP 呼び出し。

export type SizeCode = 'SS' | 'S' | 'M' | 'M_PLUS' | 'L' | 'LL';
export type ColorCode = 'YELLOW_OAK' | 'BROWN' | 'WHITE';

export interface MdbStats {
  stats: Record<string, Record<string, number>>;
  period: { from: string; to: string };
  totalOrders: number;
}

export type MdbStatsResult =
  | { ok: true; data: MdbStats }
  | { ok: false; error: string; status: number };

/**
 * 指定された納品予定日(YYYY-MM-DD)を基準に、昨年同時期30日間の受注実績を
 * MDB API サーバーから取得する。失敗してもエラーは投げず、結果型で返す。
 */
export async function fetchMdbStats(deliveryDate: string, mdbPath?: string): Promise<MdbStatsResult> {
  const apiUrl = process.env.MDB_API_URL;
  const apiToken = process.env.MDB_API_TOKEN;

  if (!apiUrl || !apiToken) {
    return {
      ok: false,
      error: 'MDB API サービスのURLが設定されていません。管理者に連絡してください。',
      status: 503,
    };
  }

  const target = new URL('/order-stats', apiUrl);
  target.searchParams.set('deliveryDate', deliveryDate);
  if (mdbPath) target.searchParams.set('mdbPath', mdbPath);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(target.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiToken}` },
      signal: controller.signal,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (data && typeof data.error === 'string' && data.error) || `MDB API がエラーを返しました (HTTP ${res.status})`;
      return { ok: false, error: message, status: res.status };
    }
    return { ok: true, data: data as MdbStats };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const message = isAbort
      ? 'MDB API の応答がタイムアウトしました。サービスPCの状態を確認してください。'
      : 'MDB API に接続できません。サービスPCの起動状況を確認してください。';
    return { ok: false, error: message, status: 502 };
  } finally {
    clearTimeout(timer);
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
