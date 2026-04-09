import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { TAX_RATE } from '@/lib/constants';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: order } = await supabase.from('of_orders').select('*').eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: items } = await supabase.from('of_order_items').select(`
    *, of_products!inner(name, size_label, color_label, color_code, frame_size_name, specs,
    trigger_stock, order_quantity, pieces_per_box, category)
  `).eq('order_id', id).order('id');

  const { data: deliveries } = await supabase.from('of_delivery_schedules').select('*').eq('order_id', id).order('delivery_date');

  const deliveryMap = new Map<number, typeof deliveries>();
  (deliveries || []).forEach(d => {
    const list = deliveryMap.get(d.order_item_id) || [];
    list.push(d);
    deliveryMap.set(d.order_item_id, list);
  });

  // Get latest stock check data
  const { data: latestCheck } = await supabase.from('of_stock_checks').select('id').order('id', { ascending: false }).limit(1).single();
  const stockMap = new Map<number, { current_stock: number; avg_daily_20d: number | null; avg_monthly: number | null }>();
  if (latestCheck) {
    const { data: stockItems } = await supabase.from('of_stock_check_items').select('product_id, current_stock, avg_daily_20d, avg_monthly').eq('stock_check_id', latestCheck.id);
    (stockItems || []).forEach(si => stockMap.set(si.product_id, si));
  }

  // Get pending delivery quantities from OTHER orders (not this order)
  const { data: pendingDeliveries } = await supabase.from('of_delivery_schedules')
    .select('product_id, quantity')
    .neq('order_id', parseInt(id))
    .eq('is_received', 0);

  const pendingMap = new Map<number, number>();
  (pendingDeliveries || []).forEach(d => {
    pendingMap.set(d.product_id, (pendingMap.get(d.product_id) || 0) + d.quantity);
  });

  const itemsWithDeliveries = (items || []).map(item => {
    const p = item.of_products;
    const stock = stockMap.get(item.product_id);
    const pendingQty = pendingMap.get(item.product_id) || 0;
    return {
      ...item, of_products: undefined,
      product_name: p.name, size_label: p.size_label, color_label: p.color_label,
      color_code: p.color_code, frame_size_name: p.frame_size_name, specs: p.specs,
      trigger_stock: p.trigger_stock, std_order_qty: p.order_quantity,
      pieces_per_box: p.pieces_per_box, category: p.category,
      delivery_schedules: deliveryMap.get(item.id) || [],
      current_stock: stock?.current_stock ?? null,
      pending_delivery: pendingQty,
      avg_daily_20d: stock?.avg_daily_20d ?? null,
      avg_monthly: stock?.avg_monthly ?? null,
    };
  });

  return NextResponse.json({ ...order, items: itemsWithDeliveries });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await request.json();

  if (data.status) {
    await supabase.from('of_orders').update({ status: data.status, updated_at: new Date().toISOString() }).eq('id', id);
  }

  if (data.memo !== undefined) {
    await supabase.from('of_orders').update({ memo: data.memo, updated_at: new Date().toISOString() }).eq('id', id);
  }

  if (data.orderDate) {
    await supabase.from('of_orders').update({ order_date: data.orderDate, updated_at: new Date().toISOString() }).eq('id', id);
  }

  if (data.items) {
    await supabase.from('of_delivery_schedules').delete().eq('order_id', id);
    await supabase.from('of_order_items').delete().eq('order_id', id);

    let subtotal = 0;
    for (const item of data.items) {
      const itemSubtotal = item.quantity * item.unitPrice;
      subtotal += itemSubtotal;
      const { data: itemData } = await supabase.from('of_order_items').insert({
        order_id: parseInt(id), product_id: item.productId, quantity: item.quantity,
        unit_price: item.unitPrice, subtotal: itemSubtotal, memo: item.memo || null,
      }).select('id').single();

      if (item.deliverySchedules) {
        for (const ds of item.deliverySchedules) {
          await supabase.from('of_delivery_schedules').insert({
            order_item_id: itemData!.id, order_id: parseInt(id), product_id: item.productId,
            delivery_date: ds.deliveryDate, quantity: ds.quantity,
          });
        }
      }
    }

    const taxAmount = Math.floor(subtotal * TAX_RATE);
    await supabase.from('of_orders').update({
      subtotal, tax_amount: taxAmount, total_amount: subtotal + taxAmount,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await supabase.from('of_delivery_schedules').delete().eq('order_id', id);
  await supabase.from('of_order_items').delete().eq('order_id', id);
  await supabase.from('of_orders').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
