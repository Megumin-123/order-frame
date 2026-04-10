import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

const SIZE_ORDER = ['SS', 'S', 'M', 'M_PLUS', 'L', 'LL'];
const SIZE_LABELS: Record<string, string> = {
  SS: 'ミニサイズ', S: 'Sサイズ', M: 'Mサイズ', M_PLUS: 'Mプラスサイズ', L: 'Lサイズ', LL: 'LLサイズ',
};
const COLOR_ORDER = ['YELLOW_OAK', 'BROWN', 'WHITE'];

export async function GET(request: NextRequest) {
  const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));
  const month = parseInt(request.nextUrl.searchParams.get('month') || String(new Date().getMonth() + 1));

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endYear = month === 12 ? year + 1 : year;
  const endMonth = month === 12 ? 1 : month + 1;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data: deliveries } = await supabase.from('of_delivery_schedules')
    .select(`*, of_products!inner(size_code, color_code, size_label, color_label, frame_size_name),
             of_orders!inner(status)`)
    .gte('delivery_date', startDate)
    .lt('delivery_date', endDate)
    .gt('quantity', 0)
    .in('of_orders.status', ['submitted', 'partially_delivered', 'delivered'])
    .order('delivery_date');

  // Collect unique dates
  const dates = new Set<string>();
  (deliveries || []).forEach(d => dates.add(d.delivery_date));
  const sortedDates = Array.from(dates).sort();

  // Cross-tabulate: size x color x date
  const matrix: Record<string, Record<string, Record<string, number>>> = {};
  SIZE_ORDER.forEach(size => {
    matrix[size] = {};
    COLOR_ORDER.forEach(color => {
      matrix[size][color] = {};
      sortedDates.forEach(date => { matrix[size][color][date] = 0; });
    });
  });

  (deliveries || []).forEach(d => {
    const sizeCode = d.of_products?.size_code;
    const colorCode = d.of_products?.color_code;
    if (sizeCode && colorCode && matrix[sizeCode]?.[colorCode]) {
      matrix[sizeCode][colorCode][d.delivery_date] = (matrix[sizeCode][colorCode][d.delivery_date] || 0) + d.quantity;
    }
  });

  return NextResponse.json({
    year, month, dates: sortedDates, matrix,
    sizeOrder: SIZE_ORDER, sizeLabels: SIZE_LABELS, colorOrder: COLOR_ORDER,
  });
}
