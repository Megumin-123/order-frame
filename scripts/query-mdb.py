# -*- coding: utf-8 -*-
import sys
import json
import pyodbc
from datetime import datetime, timedelta

def main():
    # Args: deliveryDate mdbPath
    delivery_date = sys.argv[1]
    mdb_path = sys.argv[2] if len(sys.argv) > 2 else r'C:\Users\smili\Documents\system\sysdata.mdb'

    # 昨年の同時期の30日間を集計
    base_date = datetime.strptime(delivery_date, '%Y-%m-%d')
    start_date = base_date.replace(year=base_date.year - 1)
    end_date = start_date + timedelta(days=30)
    start_str = start_date.strftime('%Y/%m/%d')
    end_str = end_date.strftime('%Y/%m/%d')

    SEISAKU_SIZE_MAP = {630:'SS', 620:'S', 615:'M', 623:'M_PLUS', 610:'L', 605:'LL'}
    VALID_IDS = [605, 610, 615, 620, 623, 630]

    conn_str = f'DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={mdb_path};'
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()

    sql = f'''SELECT d.[受注番号], d.[商品名], d.[数量], m.[制作ID], o.[事業区分], d.[商品番号]
    FROM (([tbl_受注明細データ] AS d
    LEFT JOIN [mst_商品マスタ] AS m ON d.[商品番号] = m.[商品番号])
    INNER JOIN [tbl_受注データ] AS o ON d.[受注番号] = o.[受注番号])
    WHERE o.[キャンセル日] IS NULL
    AND o.[事業区分] IN (1,3,4,5)
    AND o.[注文日時] >= #{start_str}#
    AND o.[注文日時] < #{end_str}#
    ORDER BY d.[受注番号]'''

    cursor.execute(sql)
    rows = cursor.fetchall()

    # Initialize stats
    stats = {}
    for size_code in SEISAKU_SIZE_MAP.values():
        stats[size_code] = {'YELLOW_OAK': 0, 'BROWN': 0, 'WHITE': 0}

    # Group by order number
    order_groups = {}
    for row in rows:
        order_no = row[0]
        if order_no not in order_groups:
            order_groups[order_no] = []
        order_groups[order_no].append({
            '受注番号': row[0], '商品名': str(row[1] or ''),
            '数量': row[2] or 1, '制作ID': row[3],
            '事業区分': row[4], '商品番号': str(row[5] or '')
        })

    def detect_color(name):
        if 'パールホワイト' in name: return 'WHITE'
        if 'オークブラウン' in name: return 'BROWN'
        return 'YELLOW_OAK'

    def detect_size_from_option(name):
        if 'ミニ' in name or 'mini' in name: return 'SS'
        if 'Mプラス' in name: return 'M_PLUS'
        if 'LLサイズ' in name or 'LL】' in name: return 'LL'
        if 'Lサイズ' in name or 'L】' in name: return 'L'
        if 'Mサイズ' in name or 'M】' in name: return 'M'
        if 'Sサイズ' in name or 'S】' in name: return 'S'
        return None

    for order_no, order_rows in order_groups.items():
        jigyou = order_rows[0]['事業区分']
        option_rows = [r for r in order_rows if '額変更' in r['商品名']]
        main_rows = [r for r in order_rows if r['制作ID'] and r['制作ID'] in VALID_IDS]

        for main_row in main_rows:
            size_code = SEISAKU_SIZE_MAP.get(main_row['制作ID'])
            if not size_code:
                continue

            color = 'YELLOW_OAK'

            if jigyou == 1:
                color = detect_color(main_row['商品名'])
            elif jigyou == 4:
                color = 'YELLOW_OAK'
            elif jigyou in (3, 5):
                color = 'YELLOW_OAK'
                if option_rows:
                    for opt in option_rows:
                        opt_size = detect_size_from_option(opt['商品名'])
                        if opt_size == size_code or len(option_rows) == 1:
                            color = detect_color(opt['商品名'])
                            break

            stats[size_code][color] += main_row['数量']

    conn.close()

    result = {
        'stats': stats,
        'period': {
            'from': start_date.strftime('%Y-%m-%d'),
            'to': end_date.strftime('%Y-%m-%d')
        },
        'totalOrders': len(rows)
    }

    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
