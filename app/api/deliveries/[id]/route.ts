import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await request.json();

  // Memo-only update
  if (data.isReceived === undefined && data.memo !== undefined && data.receivedAt === undefined) {
    await supabase.from('of_delivery_schedules').update({ memo: data.memo || null, updated_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ success: true });
  }

  // Received date change only
  if (data.isReceived === undefined && data.receivedAt !== undefined) {
    await supabase.from('of_delivery_schedules').update({ received_at: data.receivedAt, updated_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ success: true });
  }

  // Full receive/unreceive
  await supabase.from('of_delivery_schedules').update({
    is_received: data.isReceived ? 1 : 0,
    received_at: (data.isReceived || data.receivedQuantity) ? (data.receivedAt || new Date().toISOString()) : null,
    received_quantity: data.receivedQuantity !== undefined ? data.receivedQuantity : null,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  // Update order status
  const { data: delivery } = await supabase.from('of_delivery_schedules').select('order_id').eq('id', id).single();
  if (delivery) {
    const { data: total } = await supabase.from('of_delivery_schedules').select('id', { count: 'exact' }).eq('order_id', delivery.order_id);
    const { data: received } = await supabase.from('of_delivery_schedules').select('id', { count: 'exact' }).eq('order_id', delivery.order_id).eq('is_received', 1);

    const totalCount = total?.length || 0;
    const receivedCount = received?.length || 0;

    let newStatus: string;
    if (receivedCount === 0) newStatus = 'submitted';
    else if (receivedCount === totalCount) newStatus = 'delivered';
    else newStatus = 'partially_delivered';

    await supabase.from('of_orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', delivery.order_id);
  }

  return NextResponse.json({ success: true });
}
