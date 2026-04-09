import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const colorCode = searchParams.get('colorCode');
  const status = searchParams.get('status');
  const confirmedOnly = searchParams.get('confirmedOnly');

  let query = supabase.from('of_delivery_schedules').select(`
    *, of_products!inner(name, size_label, color_label, color_code, frame_size_name),
    of_orders!inner(order_number, order_date, status)
  `).order('delivery_date').order('id');

  if (dateFrom) query = query.gte('delivery_date', dateFrom);
  if (dateTo) query = query.lte('delivery_date', dateTo);
  if (colorCode) query = query.eq('of_products.color_code', colorCode);
  if (status === 'pending') query = query.eq('is_received', 0);
  if (status === 'received') query = query.eq('is_received', 1);
  if (confirmedOnly) query = query.in('of_orders.status', ['submitted', 'partially_delivered', 'delivered']);

  const { data } = await query;

  const mapped = (data || []).map(d => ({
    ...d,
    product_name: d.of_products.name,
    size_label: d.of_products.size_label,
    color_label: d.of_products.color_label,
    color_code: d.of_products.color_code,
    frame_size_name: d.of_products.frame_size_name,
    order_number: d.of_orders.order_number,
    order_date: d.of_orders.order_date,
    of_products: undefined,
    of_orders: undefined,
  }));

  return NextResponse.json(mapped);
}
