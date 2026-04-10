import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

const SIZE_ORDER = ['SS', 'S', 'M', 'M_PLUS', 'L', 'LL'];
const SIZE_LABELS: Record<string, string> = {
  SS: 'ミニサイズ', S: 'Sサイズ', M: 'Mサイズ', M_PLUS: 'Mプラスサイズ', L: 'Lサイズ', LL: 'LLサイズ',
};
const COLOR_ORDER = ['YELLOW_OAK', 'BROWN', 'WHITE'];
const COLOR_LABELS: Record<string, string> = { YELLOW_OAK: '黄オーク', BROWN: 'ブラウン', WHITE: 'ホワイト' };
const COLOR_FILLS: Record<string, string> = { YELLOW_OAK: 'FFFEF3C7', BROWN: 'FFDBC8A8', WHITE: 'FFE0F2FE' };

export async function GET(request: NextRequest) {
  const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));
  const month = parseInt(request.nextUrl.searchParams.get('month') || String(new Date().getMonth() + 1));

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endYear = month === 12 ? year + 1 : year;
  const endMonth = month === 12 ? 1 : month + 1;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data: deliveries } = await supabase.from('of_delivery_schedules')
    .select(`*, of_products!inner(size_code, color_code), of_orders!inner(status)`)
    .gte('delivery_date', startDate).lt('delivery_date', endDate).gt('quantity', 0)
    .in('of_orders.status', ['submitted', 'partially_delivered', 'delivered'])
    .order('delivery_date');

  const dates = new Set<string>();
  (deliveries || []).forEach(d => dates.add(d.delivery_date));
  const sortedDates = Array.from(dates).sort();

  // Build matrix
  const matrix: Record<string, Record<string, Record<string, number>>> = {};
  SIZE_ORDER.forEach(size => {
    matrix[size] = {};
    COLOR_ORDER.forEach(color => {
      matrix[size][color] = {};
      sortedDates.forEach(date => { matrix[size][color][date] = 0; });
    });
  });
  (deliveries || []).forEach(d => {
    const sc = d.of_products?.size_code;
    const cc = d.of_products?.color_code;
    if (sc && cc && matrix[sc]?.[cc]) {
      matrix[sc][cc][d.delivery_date] = (matrix[sc][cc][d.delivery_date] || 0) + d.quantity;
    }
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('納品早見表');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  const border: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' },
  };

  // Title
  let row = 1;
  ws.getCell(row, 1).value = `納品日別納品早見表`;
  ws.getCell(row, 1).font = { bold: true, size: 14 };
  row++;

  // Date header row
  row++;
  ws.getCell(row, 1).value = '納品日';
  ws.getCell(row, 1).font = { bold: true }; ws.getCell(row, 1).border = border;
  ws.getColumn(1).width = 14;

  let col = 2;
  sortedDates.forEach(date => {
    const parts = date.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dateLabel = `${parseInt(parts[1])}/${parseInt(parts[2])}(${weekdays[d.getDay()]})`;
    ws.mergeCells(row, col, row, col + 2);
    const cell = ws.getCell(row, col);
    cell.value = dateLabel;
    cell.font = { bold: true }; cell.alignment = { horizontal: 'center' }; cell.border = border;
    ws.getColumn(col).width = 8; ws.getColumn(col + 1).width = 8; ws.getColumn(col + 2).width = 8;
    col += 3;
  });
  // Monthly total
  ws.mergeCells(row, col, row, col + 2);
  ws.getCell(row, col).value = `${month}月合計`;
  ws.getCell(row, col).font = { bold: true }; ws.getCell(row, col).alignment = { horizontal: 'center' }; ws.getCell(row, col).border = border;

  // Color header row
  row++;
  ws.getCell(row, 1).value = '種類';
  ws.getCell(row, 1).font = { bold: true }; ws.getCell(row, 1).border = border;

  col = 2;
  for (let i = 0; i <= sortedDates.length; i++) {
    COLOR_ORDER.forEach((color, ci) => {
      const c = ws.getCell(row, col + ci);
      c.value = COLOR_LABELS[color];
      c.font = { bold: true, size: 9 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_FILLS[color] } };
      c.alignment = { horizontal: 'center' }; c.border = border;
    });
    col += 3;
  }

  // Data rows
  SIZE_ORDER.forEach(size => {
    row++;
    ws.getCell(row, 1).value = SIZE_LABELS[size];
    ws.getCell(row, 1).font = { bold: true }; ws.getCell(row, 1).border = border;

    col = 2;
    sortedDates.forEach(date => {
      COLOR_ORDER.forEach((color, ci) => {
        const val = matrix[size][color][date] || 0;
        const c = ws.getCell(row, col + ci);
        c.value = val || '';
        c.alignment = { horizontal: 'center' }; c.border = border;
        if (val > 0) c.font = { bold: true };
      });
      col += 3;
    });

    // Monthly total
    COLOR_ORDER.forEach((color, ci) => {
      const total = sortedDates.reduce((s, date) => s + (matrix[size][color][date] || 0), 0);
      const c = ws.getCell(row, col + ci);
      c.value = total || '';
      c.alignment = { horizontal: 'center' }; c.border = border;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      if (total > 0) c.font = { bold: true };
    });
  });

  // Total row
  row++;
  ws.getCell(row, 1).value = '合計';
  ws.getCell(row, 1).font = { bold: true }; ws.getCell(row, 1).border = border;
  ws.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };

  col = 2;
  sortedDates.forEach(date => {
    COLOR_ORDER.forEach((color, ci) => {
      const total = SIZE_ORDER.reduce((s, size) => s + (matrix[size][color][date] || 0), 0);
      const c = ws.getCell(row, col + ci);
      c.value = total || '';
      c.alignment = { horizontal: 'center' }; c.border = border;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      if (total > 0) c.font = { bold: true };
    });
    col += 3;
  });
  COLOR_ORDER.forEach((color, ci) => {
    const grandTotal = SIZE_ORDER.reduce((s, size) =>
      s + sortedDates.reduce((s2, date) => s2 + (matrix[size][color][date] || 0), 0), 0);
    const c = ws.getCell(row, col + ci);
    c.value = grandTotal || '';
    c.alignment = { horizontal: 'center' }; c.border = border;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
    if (grandTotal > 0) c.font = { bold: true, size: 12 };
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="delivery-summary-${year}-${String(month).padStart(2,'0')}.xlsx"`,
    },
  });
}
