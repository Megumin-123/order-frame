import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { SUPPLIER_NAME, SUPPLIER_FAX, COMPANY_NAME, COMPANY_ADDRESS, COMPANY_TEL, COMPANY_FAX } from '@/lib/constants';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = request.nextUrl.searchParams.get('format') || 'xlsx';

  const { data: order } = await supabase.from('of_orders').select('*').eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: items } = await supabase.from('of_order_items').select(`
    *, of_products!inner(name, size_label, color_label, color_code, frame_size_name, specs)
  `).eq('order_id', id).gt('quantity', 0).order('id');

  const { data: deliveries } = await supabase.from('of_delivery_schedules').select('*').eq('order_id', id).order('delivery_date');

  const deliveryMap = new Map<number, typeof deliveries>();
  (deliveries || []).forEach(d => {
    const list = deliveryMap.get(d.order_item_id) || [];
    list.push(d);
    deliveryMap.set(d.order_item_id, list);
  });

  const mappedItems = (items || []).map(item => {
    const p = item.of_products;
    return { ...item, product_name: p.name, size_label: p.size_label, color_label: p.color_label, color_code: p.color_code, frame_size_name: p.frame_size_name, specs: p.specs };
  });

  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('発注書');

    ws.columns = [
      { width: 5 }, { width: 28 }, { width: 28 }, { width: 10 }, { width: 12 }, { width: 15 },
    ];

    const titleStyle: Partial<ExcelJS.Style> = { font: { bold: true, size: 16 }, alignment: { horizontal: 'center' } };
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    };
    const cellBorder: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = '注文書'; ws.getCell('A1').style = titleStyle;
    ws.getCell('A3').value = `${SUPPLIER_NAME}　御中`; ws.getCell('A3').font = { bold: true, size: 12 };
    ws.getCell('A4').value = `(fax:${SUPPLIER_FAX})`;
    ws.getCell('E3').value = COMPANY_NAME; ws.getCell('E3').font = { bold: true };
    ws.getCell('E4').value = COMPANY_ADDRESS;
    ws.getCell('E5').value = `TEL. ${COMPANY_TEL} FAX.${COMPANY_FAX}`;
    ws.getCell('A6').value = `発注番号: ${order.order_number}`;
    ws.getCell('A7').value = `発注日: ${order.order_date}`;
    ws.getCell('A8').value = '下記の通り注文させていただきます。';

    let row = 10;
    ['No.', '商品名', '商品仕様', '数量', '単価(税抜)', '金額(税抜)'].forEach((h, i) => {
      const cell = ws.getCell(row, i + 1); cell.value = h; Object.assign(cell, { style: headerStyle });
    });

    row = 11;
    mappedItems.forEach((item, idx) => {
      const itemDeliveries = deliveryMap.get(item.id) || [];
      const cells = [
        { col: 1, value: idx + 1, align: 'center' as const },
        { col: 2, value: `${item.color_label} ${item.frame_size_name}(${item.size_label})`, align: 'left' as const },
        { col: 3, value: item.specs || '', align: 'left' as const },
        { col: 4, value: item.quantity, align: 'right' as const },
        { col: 5, value: item.unit_price, align: 'right' as const },
        { col: 6, value: item.subtotal, align: 'right' as const },
      ];
      cells.forEach(c => {
        const cell = ws.getCell(row, c.col); cell.value = c.value;
        cell.border = cellBorder; cell.alignment = { horizontal: c.align, vertical: 'middle' };
        if (c.col >= 5) cell.numFmt = '#,##0';
      });
      row++;
      itemDeliveries.forEach(ds => {
        ws.getCell(row, 2).value = `  → ${ds.delivery_date} 納品: ${ds.quantity}個`;
        ws.getCell(row, 2).font = { color: { argb: 'FF0066CC' }, size: 10 };
        row++;
      });
    });

    row += 1;
    ws.getCell(row, 5).value = '税抜小計:'; ws.getCell(row, 5).font = { bold: true }; ws.getCell(row, 5).alignment = { horizontal: 'right' };
    ws.getCell(row, 6).value = order.subtotal; ws.getCell(row, 6).numFmt = '#,##0'; ws.getCell(row, 6).font = { bold: true }; ws.getCell(row, 6).alignment = { horizontal: 'right' };
    row++;
    ws.getCell(row, 5).value = '消費税(10%):'; ws.getCell(row, 5).alignment = { horizontal: 'right' };
    ws.getCell(row, 6).value = order.tax_amount; ws.getCell(row, 6).numFmt = '#,##0'; ws.getCell(row, 6).alignment = { horizontal: 'right' };
    row++;
    ws.getCell(row, 5).value = '税込合計:'; ws.getCell(row, 5).font = { bold: true, size: 12 }; ws.getCell(row, 5).alignment = { horizontal: 'right' };
    ws.getCell(row, 6).value = order.total_amount; ws.getCell(row, 6).numFmt = '#,##0'; ws.getCell(row, 6).font = { bold: true, size: 12 }; ws.getCell(row, 6).alignment = { horizontal: 'right' };

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${order.order_number}.xlsx"`,
      },
    });
  }

  // PDF (HTML)
  const itemRows = mappedItems.map((item, idx) => {
    const itemDeliveries = deliveryMap.get(item.id) || [];
    const deliveryRows = itemDeliveries.map(ds => `<tr><td colspan="7" style="padding-left:40px;color:#0066CC;font-size:12px;">&rarr; ${ds.delivery_date} 納品: ${ds.quantity}個</td></tr>`).join('');
    return `<tr>
      <td style="text-align:center;border:1px solid #ccc;padding:6px;">${idx + 1}</td>
      <td style="border:1px solid #ccc;padding:6px;">${item.color_label} ${item.frame_size_name}(${item.size_label})</td>
      <td style="border:1px solid #ccc;padding:6px;">${item.specs || ''}</td>
      <td style="text-align:right;border:1px solid #ccc;padding:6px;">${item.quantity}</td>
      <td style="text-align:right;border:1px solid #ccc;padding:6px;">${item.unit_price.toLocaleString()}</td>
      <td style="text-align:right;border:1px solid #ccc;padding:6px;">${item.subtotal.toLocaleString()}</td>
    </tr>${deliveryRows}`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>発注書 ${order.order_number}</title>
<style>body{font-family:'MS Gothic',monospace;font-size:14px;margin:40px}h1{text-align:center;font-size:24px}table{border-collapse:collapse;width:100%;margin:20px 0}th{background:#e8e8e8;border:1px solid #ccc;padding:8px;text-align:center}.totals{text-align:right;margin-top:20px}.totals div{margin:4px 0}@media print{body{margin:20mm}}</style></head>
<body><h1>注文書</h1>
<div style="display:flex;justify-content:space-between;margin:20px 0"><div><strong style="font-size:16px">${SUPPLIER_NAME} 御中</strong><br>(fax:${SUPPLIER_FAX})</div><div style="text-align:right"><strong>${COMPANY_NAME}</strong><br>${COMPANY_ADDRESS}<br>TEL.${COMPANY_TEL} FAX.${COMPANY_FAX}</div></div>
<div>発注番号: ${order.order_number} | 発注日: ${order.order_date}</div>
<table><thead><tr><th>No.</th><th>商品名</th><th>商品仕様</th><th>数量</th><th>単価(税抜)</th><th>金額(税抜)</th></tr></thead><tbody>${itemRows}</tbody></table>
<div class="totals"><div>税抜小計: ¥${order.subtotal.toLocaleString()}</div><div>消費税(10%): ¥${order.tax_amount.toLocaleString()}</div><div style="font-size:18px;font-weight:bold;border-top:2px solid #000;padding-top:4px">税込合計: ¥${order.total_amount.toLocaleString()}</div></div>
<script>window.print();</script></body></html>`;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
