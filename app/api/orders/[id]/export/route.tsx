import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { renderToBuffer } from '@react-pdf/renderer';
import { SUPPLIER_NAME, SUPPLIER_FAX, COMPANY_NAME, COMPANY_ADDRESS, COMPANY_TEL, COMPANY_FAX } from '@/lib/constants';
import { OrderPdf, ensureFontRegistered } from './order-pdf';

// PDF 生成は Node ランタイム必須 (fs を使ってフォントを読む)
export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = request.nextUrl.searchParams.get('format') || 'xlsx';

  const { data: order } = await supabase.from('of_orders').select('*').eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: items } = await supabase.from('of_order_items').select(`
    *, of_products!inner(name, size_label, color_label, color_code, frame_size_name, specs, sort_order)
  `).eq('order_id', id).gt('quantity', 0).order('id');
  // 商品マスタの sort_order 順に並べ替え (詳細は /api/orders/[id]/route.ts のコメント参照)
  (items || []).sort((a, b) => {
    const aOrd = (a.of_products as { sort_order?: number })?.sort_order ?? 0;
    const bOrd = (b.of_products as { sort_order?: number })?.sort_order ?? 0;
    if (aOrd !== bOrd) return aOrd - bOrd;
    return a.id - b.id;
  });

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
        ws.getCell(row, 2).font = { color: { argb: 'FF000000' }, size: 10 };
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

  // PDF (本物の PDF ファイル)
  const deliveryRecord: Record<number, { delivery_date: string; quantity: number }[]> = {};
  deliveryMap.forEach((list, key) => {
    deliveryRecord[key] = (list || []).map(d => ({ delivery_date: d.delivery_date, quantity: d.quantity }));
  });

  let buffer: Buffer;
  try {
    // 日本語フォントを public/ から fetch して登録 (1度だけ)
    const reqUrl = new URL(request.url);
    const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
    await ensureFontRegistered(baseUrl);

    buffer = await renderToBuffer(
      <OrderPdf
        order={{
          order_number: order.order_number,
          order_date: order.order_date,
          subtotal: order.subtotal,
          tax_amount: order.tax_amount,
          total_amount: order.total_amount,
        }}
        items={mappedItems.map(i => ({
          id: i.id,
          product_name: i.product_name,
          size_label: i.size_label,
          color_label: i.color_label,
          frame_size_name: i.frame_size_name,
          specs: i.specs,
          quantity: i.quantity,
          unit_price: i.unit_price,
          subtotal: i.subtotal,
        }))}
        deliveryMap={deliveryRecord}
      />
    );
  } catch (err) {
    console.error('PDF generation failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `PDF 生成に失敗しました: ${message}` }, { status: 500 });
  }

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${order.order_number}.pdf"`,
    },
  });
}
