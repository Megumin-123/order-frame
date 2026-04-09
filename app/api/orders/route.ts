import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { TAX_RATE } from '@/lib/constants';

async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;
  const { data } = await supabase.from('of_orders').select('order_number').like('order_number', `${prefix}%`).order('order_number', { ascending: false }).limit(1).single();
  const seq = data ? parseInt(data.order_number.slice(-4)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

function getDeliveryDate(orderDate: string, leadDays: number): string {
  const date = new Date(orderDate);
  date.setDate(date.getDate() + leadDays);
  return date.toISOString().split('T')[0];
}

export async function GET() {
  const { data } = await supabase.from('of_orders').select('*').order('created_at', { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.autoFromStock) {
    const { data: latestCheck } = await supabase.from('of_stock_checks').select('id').order('id', { ascending: false }).limit(1).single();
    if (!latestCheck) return NextResponse.json({ error: '在庫登録データがありません。先に在庫登録を行ってください。' }, { status: 400 });

    const { data: allProducts } = await supabase.from('of_products').select('id, unit_price, order_quantity, trigger_stock').eq('is_active', 1).eq('auto_order', 1).order('sort_order');
    const { data: stockItems } = await supabase.from('of_stock_check_items').select('product_id, current_stock').eq('stock_check_id', latestCheck.id);

    // Get pending deliveries (not yet received) from all existing orders
    const { data: pendingDeliveries } = await supabase.from('of_delivery_schedules').select('product_id, quantity').eq('is_received', 0);
    const pendingMap = new Map<number, number>();
    (pendingDeliveries || []).forEach(d => {
      pendingMap.set(d.product_id, (pendingMap.get(d.product_id) || 0) + d.quantity);
    });

    const stockMap = new Map((stockItems || []).map(si => [si.product_id, si]));
    if (!allProducts?.length) return NextResponse.json({ error: '商品が登録されていません。' }, { status: 400 });

    const items = allProducts.map(p => {
      const si = stockMap.get(p.id);
      const currentStock = si?.current_stock ?? 0;
      const pendingQty = pendingMap.get(p.id) || 0;
      const effectiveStock = currentStock + pendingQty;
      const needsOrder = effectiveStock <= p.trigger_stock;
      return { productId: p.id, quantity: needsOrder ? p.order_quantity : 0, unitPrice: p.unit_price };
    });

    return createOrder(items, latestCheck.id, body.orderDate, body.memo);
  }

  return createOrder(body.items, body.stockCheckId, body.orderDate, body.memo);
}

async function createOrder(
  items: { productId: number; quantity: number; unitPrice: number; deliverySchedules?: { deliveryDate: string; quantity: number }[] }[],
  stockCheckId: number | null, orderDate?: string, memo?: string
) {
  const { data: leadSetting } = await supabase.from('of_settings').select('value').eq('key', 'delivery_lead_days').single();
  const leadDays = parseInt(leadSetting?.value || '21');

  const orderNumber = await generateOrderNumber();
  const finalOrderDate = orderDate || new Date().toISOString().split('T')[0];
  const defaultDeliveryDate = getDeliveryDate(finalOrderDate, leadDays);

  let subtotal = 0;
  for (const item of items) subtotal += item.quantity * item.unitPrice;
  const taxAmount = Math.floor(subtotal * TAX_RATE);
  const totalAmount = subtotal + taxAmount;

  const { data: orderData } = await supabase.from('of_orders').insert({
    order_number: orderNumber, order_date: finalOrderDate, subtotal, tax_amount: taxAmount,
    total_amount: totalAmount, status: 'draft', stock_check_id: stockCheckId || null, memo: memo || null,
  }).select('id').single();

  const orderId = orderData!.id;

  for (const item of items) {
    const itemSubtotal = item.quantity * item.unitPrice;
    const { data: itemData } = await supabase.from('of_order_items').insert({
      order_id: orderId, product_id: item.productId, quantity: item.quantity,
      unit_price: item.unitPrice, subtotal: itemSubtotal,
    }).select('id').single();

    const orderItemId = itemData!.id;

    if (item.deliverySchedules?.length) {
      for (const ds of item.deliverySchedules) {
        await supabase.from('of_delivery_schedules').insert({
          order_item_id: orderItemId, order_id: orderId, product_id: item.productId,
          delivery_date: ds.deliveryDate, quantity: ds.quantity,
        });
      }
    } else if (item.quantity > 0) {
      await supabase.from('of_delivery_schedules').insert({
        order_item_id: orderItemId, order_id: orderId, product_id: item.productId,
        delivery_date: defaultDeliveryDate, quantity: item.quantity,
      });
    }
  }

  return NextResponse.json({ orderId, orderNumber });
}
