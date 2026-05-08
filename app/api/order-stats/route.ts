import { NextRequest, NextResponse } from 'next/server';
import { fetchMdbStats } from '@/lib/mdb-stats';

/**
 * 自動提案で使う「昨年同時期の受注実績」を返す API。
 *
 * 実データは Windows ローカルにある Access の MDB ファイルにあるため、
 * 別 PC で起動している MDB API サーバー (scripts/mdb-server.py) に対して
 * HTTP で問い合わせる。共通ヘルパー lib/mdb-stats.ts に処理を委譲する。
 */
export async function POST(request: NextRequest) {
  const { deliveryDate, mdbPath } = await request.json();

  if (!deliveryDate) {
    return NextResponse.json(
      { error: '納品予定日が設定されていません' },
      { status: 400 },
    );
  }

  const result = await fetchMdbStats(deliveryDate, mdbPath);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
