import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';

export async function POST(request: NextRequest) {
  const { deliveryDate, mdbPath } = await request.json();

  if (!deliveryDate) {
    return NextResponse.json({ error: '納品予定日が設定されていません' }, { status: 400 });
  }

  const dbPath = mdbPath || 'C:\\Users\\smili\\Documents\\system\\sysdata.mdb';

  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'query-mdb.py');

    const result = execSync(`python "${scriptPath}" "${deliveryDate}" "${dbPath}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    });

    const data = JSON.parse(result.trim());
    return NextResponse.json(data);

  } catch (error) {
    console.error('MDB query error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      error: `データベースの読み取りに失敗しました: ${message.slice(0, 200)}`,
    }, { status: 500 });
  }
}
