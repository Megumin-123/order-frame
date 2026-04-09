import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  // Get all delivery schedules with order and product info
  const { data: deliveries } = await supabase.from('of_delivery_schedules')
    .select(`
      *, of_order_items!inner(unit_price, quantity),
      of_orders!inner(order_number, status),
      of_products!inner(name, color_label, frame_size_name, size_label)
    `)
    .gt('quantity', 0)
    .in('of_orders.status', ['submitted', 'partially_delivered', 'delivered'])
    .order('delivery_date');

  // Group by payment month (末締め翌月末払い)
  // delivery_date in month X → payment in month X+1 end
  const paymentMonths = new Map<string, {
    month: string; paymentDate: string;
    items: { deliveryDate: string; productName: string; colorLabel: string; frameSizeName: string;
      quantity: number; unitPrice: number; subtotal: number; orderNumber: string; isReceived: boolean }[];
    total: number;
  }>();

  (deliveries || []).forEach(d => {
    const dd = d.delivery_date;
    if (!dd) return;
    const parts = dd.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);

    // 末締め翌月末払い
    const payMonth = month === 12 ? 1 : month + 1;
    const payYear = month === 12 ? year + 1 : year;
    const paymentKey = `${payYear}-${String(payMonth).padStart(2, '0')}`;
    const lastDay = new Date(payYear, payMonth, 0).getDate();
    const paymentDate = `${payYear}-${String(payMonth).padStart(2, '0')}-${lastDay}`;

    const entry = paymentMonths.get(paymentKey) || {
      month: paymentKey, paymentDate, items: [], total: 0,
    };

    const unitPrice = d.of_order_items?.unit_price || 0;
    const subtotal = d.quantity * unitPrice;

    entry.items.push({
      deliveryDate: dd,
      productName: d.of_products?.name || '',
      colorLabel: d.of_products?.color_label || '',
      frameSizeName: d.of_products?.frame_size_name || '',
      quantity: d.quantity,
      unitPrice,
      subtotal,
      orderNumber: d.of_orders?.order_number || '',
      isReceived: !!d.is_received,
    });
    entry.total += subtotal;
    paymentMonths.set(paymentKey, entry);
  });

  // Sort by month and add tax
  const result = Array.from(paymentMonths.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({
      ...m,
      tax: Math.floor(m.total * 0.10),
      totalWithTax: m.total + Math.floor(m.total * 0.10),
    }));

  return NextResponse.json(result);
}
