import { NextRequest, NextResponse } from 'next/server';

// Size mapping: 制作ID -> size code
const SEISAKU_SIZE_MAP: Record<number, string> = {
  630: 'SS',    // mini
  620: 'S',     // Sサイズ
  615: 'M',     // Mサイズ
  623: 'M_PLUS',// Mプラス
  610: 'L',     // Lサイズ
  605: 'LL',    // LLサイズ
};

const VALID_SEISAKU_IDS = [605, 610, 615, 620, 623, 630];

// Detect color from product name
function detectColor(productName: string): string {
  if (productName.includes('パールホワイト')) return 'WHITE';
  if (productName.includes('オークブラウン')) return 'BROWN';
  return 'YELLOW_OAK'; // default including オークカラー
}

// Detect size from option product name
function detectSizeFromOptionName(name: string): string | null {
  if (name.includes('ミニ') || name.includes('mini')) return 'SS';
  if (name.includes('Sサイズ') || name.includes('S】')) return 'S';
  if (name.includes('Mプラス')) return 'M_PLUS';
  if (name.includes('Mサイズ') || name.includes('M】')) return 'M';
  if (name.includes('Lサイズ') || name.includes('L】')) return 'L';
  if (name.includes('LLサイズ') || name.includes('LL】')) return 'LL';
  return null;
}

interface OrderRow {
  受注番号: number;
  商品名: string;
  数量: number;
  制作ID: number | null;
  事業区分: number;
  商品番号: string;
}

export async function POST(request: NextRequest) {
  const { deliveryDate, mdbPath } = await request.json();

  if (!deliveryDate) {
    return NextResponse.json({ error: '納品予定日が指定されていません' }, { status: 400 });
  }

  const dbPath = mdbPath || process.env.MDB_PATH || 'C:\\Users\\smili\\Documents\\system\\sysdata.mdb';

  try {
    // Dynamic import for node-adodb (Windows only)
    const ADODB = (await import('node-adodb')).default;
    const connection = ADODB.open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${dbPath};`);

    // Calculate date range: deliveryDate to deliveryDate + 30 days
    const startDate = new Date(deliveryDate);
    const endDate = new Date(deliveryDate);
    endDate.setDate(endDate.getDate() + 30);

    const startStr = `${startDate.getFullYear()}/${String(startDate.getMonth() + 1).padStart(2, '0')}/${String(startDate.getDate()).padStart(2, '0')}`;
    const endStr = `${endDate.getFullYear()}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${String(endDate.getDate()).padStart(2, '0')}`;

    // Query: get all frame orders in the date range (based on 注文日時)
    const sql = `
      SELECT d.[受注番号], d.[商品名], d.[数量], m.[制作ID], o.[事業区分], d.[商品番号]
      FROM (([tbl_受注明細データ] AS d
      LEFT JOIN [mst_商品マスタ] AS m ON d.[商品番号] = m.[商品番号])
      INNER JOIN [tbl_受注データ] AS o ON d.[受注番号] = o.[受注番号])
      WHERE o.[キャンセル日] IS NULL
      AND o.[事業区分] IN (1,3,4,5)
      AND o.[注文日時] >= #${startStr}#
      AND o.[注文日時] < #${endStr}#
      ORDER BY d.[受注番号]
    `;

    const rows = await connection.query(sql) as OrderRow[];

    // Aggregate by size + color
    const stats: Record<string, Record<string, number>> = {};
    // Initialize
    for (const sizeCode of Object.values(SEISAKU_SIZE_MAP)) {
      stats[sizeCode] = { YELLOW_OAK: 0, BROWN: 0, WHITE: 0 };
    }

    // Group rows by 受注番号 for option detection
    const orderGroups = new Map<number, OrderRow[]>();
    for (const row of rows) {
      const list = orderGroups.get(row.受注番号) || [];
      list.push(row);
      orderGroups.set(row.受注番号, list);
    }

    // Process each order
    for (const [, orderRows] of orderGroups) {
      const jigyouKubun = orderRows[0].事業区分;

      // Find option rows (額変更オプション)
      const optionRows = orderRows.filter(r => r.商品名 && r.商品名.includes('額変更'));
      // Find main product rows (with valid 制作ID)
      const mainRows = orderRows.filter(r => r.制作ID && VALID_SEISAKU_IDS.includes(r.制作ID));

      for (const mainRow of mainRows) {
        const sizeCode = SEISAKU_SIZE_MAP[mainRow.制作ID!];
        if (!sizeCode) continue;

        let color = 'YELLOW_OAK'; // default

        if (jigyouKubun === 1) {
          // 自社サイト: check product name for color
          color = detectColor(mainRow.商品名 || '');
        } else if (jigyouKubun === 4) {
          // Amazon: all yellow oak
          color = 'YELLOW_OAK';
        } else if (jigyouKubun === 3 || jigyouKubun === 5) {
          // Yahoo/楽天: default yellow oak, check for option
          color = 'YELLOW_OAK';

          // Check if this order has a 額変更オプション
          if (optionRows.length > 0) {
            // Find matching option by size
            for (const opt of optionRows) {
              const optSize = detectSizeFromOptionName(opt.商品名 || '');
              if (optSize === sizeCode || optionRows.length === 1) {
                // This option applies to this main row
                color = detectColor(opt.商品名 || '');
                break;
              }
            }
          }
        }

        stats[sizeCode][color] += mainRow.数量 || 1;
      }
    }

    return NextResponse.json({
      stats,
      period: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
      },
      totalOrders: rows.length,
    });

  } catch (error) {
    console.error('MDB query error:', error);
    return NextResponse.json({
      error: `データベースの読み取りに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    }, { status: 500 });
  }
}
