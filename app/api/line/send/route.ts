import { supabase } from '@/lib/supabase';
import { sendLinePushMessage } from '@/lib/line';
import { NextResponse } from 'next/server';
import { COMPANY_NAME, SUPPLIER_NAME } from '@/lib/constants';

export async function POST(request: Request) {
  const body = await request.json();

  if (body.testMessage) {
    const result = await sendLinePushMessage('【テスト】額縁発注管理システムからのテスト送信です。このメッセージが届いていればLINE連携は正常に動作しています。');
    return NextResponse.json(result);
  }

  const { orderId } = body;
  const { data: order } = await supabase.from('of_orders').select('*').eq('id', orderId).single();
  if (!order) return NextResponse.json({ success: false, error: '発注書が見つかりません' }, { status: 404 });

  const { data: items } = await supabase.from('of_order_items').select(`
    *, of_products!inner(name, size_label, color_label, frame_size_name)
  `).eq('order_id', orderId).gt('quantity', 0).order('id');

  const { data: deliveries } = await supabase.from('of_delivery_schedules').select('*').eq('order_id', orderId).order('delivery_date');

  const deliveryMap = new Map<number, typeof deliveries>();
  (deliveries || []).forEach(d => {
    const list = deliveryMap.get(d.order_item_id) || [];
    list.push(d);
    deliveryMap.set(d.order_item_id, list);
  });

  let text = `【発注承認依頼】\n${COMPANY_NAME}より\n\n`;
  text += `発注番号: ${order.order_number}\n発注先: ${SUPPLIER_NAME}\n発注日: ${order.order_date}\n\n`;

  const colorGroups = new Map<string, Array<Record<string, unknown>>>();
  (items || []).forEach(item => {
    const p = item.of_products as Record<string, unknown>;
    const label = p.color_label as string;
    const list = colorGroups.get(label) || [];
    list.push(item);
    colorGroups.set(label, list);
  });

  colorGroups.forEach((groupItems, colorLabel) => {
    text += `■【${colorLabel}】\n`;
    groupItems.forEach(item => {
      const p = item.of_products as Record<string, unknown>;
      const itemDeliveries = deliveryMap.get(item.id as number) || [];
      text += `・${p.frame_size_name}（${p.size_label}） ${item.quantity}個`;
      if (itemDeliveries.length > 0) {
        const dates = itemDeliveries.map(d => `${d.delivery_date}:${d.quantity}個`).join('、');
        text += ` [納品: ${dates}]`;
      }
      text += '\n';
    });
    text += '\n';
  });

  text += `税抜小計: ¥${order.subtotal.toLocaleString()}\n`;
  text += `消費税: ¥${order.tax_amount.toLocaleString()}\n`;
  text += `税込合計: ¥${order.total_amount.toLocaleString()}\n\n`;
  text += `承認をお願いいたします。`;

  const result = await sendLinePushMessage(text);
  return NextResponse.json(result);
}
