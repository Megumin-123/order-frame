import { NextRequest, NextResponse } from 'next/server';

/**
 * 自動提案で使う「昨年同時期の受注実績」を返す API。
 *
 * 実データは Windows ローカルにある Access の MDB ファイルにあるため、
 * 別 PC で起動している MDB API サーバー (scripts/mdb-server.py) に対して
 * HTTP で問い合わせる。サーバーの URL とトークンは環境変数で渡す:
 *   - MDB_API_URL   例) https://mdb-dev.example.com
 *   - MDB_API_TOKEN 共有シークレット
 *
 * これにより Vercel 等のサーバーレス環境でも自動提案が利用可能になる。
 */
export async function POST(request: NextRequest) {
  const { deliveryDate, mdbPath } = await request.json();

  if (!deliveryDate) {
    return NextResponse.json(
      { error: '納品予定日が設定されていません' },
      { status: 400 },
    );
  }

  const apiUrl = process.env.MDB_API_URL;
  const apiToken = process.env.MDB_API_TOKEN;

  if (!apiUrl || !apiToken) {
    return NextResponse.json(
      {
        error:
          '自動提案サービスのURLが設定されていません。管理者に連絡してください。',
      },
      { status: 503 },
    );
  }

  // URL 構築（mdbPath は任意。指定があればサーバー側に伝える）
  const target = new URL('/order-stats', apiUrl);
  target.searchParams.set('deliveryDate', deliveryDate);
  if (mdbPath) target.searchParams.set('mdbPath', mdbPath);

  // タイムアウト 30 秒
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
      const message =
        (data && typeof data.error === 'string' && data.error) ||
        `自動提案サービスがエラーを返しました (HTTP ${res.status})`;
      return NextResponse.json({ error: message }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('MDB API fetch error:', error);
    const isAbort =
      error instanceof Error && error.name === 'AbortError';
    const message = isAbort
      ? '自動提案サービスの応答がタイムアウトしました。サービスPCの状態を確認してください。'
      : '自動提案サービスに接続できません。サービスPCの起動状況を確認してください。';
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
