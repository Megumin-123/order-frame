import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const all = url.searchParams.get('all');
  let query = supabase.from('of_products').select('*').order('sort_order').order('id');
  if (!all) query = query.eq('is_active', 1);
  const { data } = await query;
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const product = await request.json();
  const { data: maxSort } = await supabase.from('of_products').select('sort_order').order('sort_order', { ascending: false }).limit(1).single();
  await supabase.from('of_products').insert({
    name: product.name, category: 'other', unit_price: product.unit_price || 0,
    specs: product.specs || null, pieces_per_box: product.pieces_per_box || 1,
    classification_code: product.classification_code || null,
    sort_order: (maxSort?.sort_order || 18) + 1,
  });
  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  const product = await request.json();
  const updateData: Record<string, unknown> = {
    name: product.name, unit_price: product.unit_price, specs: product.specs,
    size_label: product.size_label, frame_size_name: product.frame_size_name,
    pieces_per_box: product.pieces_per_box, classification_code: product.classification_code,
    trigger_stock: product.trigger_stock, order_quantity: product.order_quantity,
    updated_at: new Date().toISOString(),
  };
  if (product.is_active !== undefined) updateData.is_active = product.is_active;
  await supabase.from('of_products').update(updateData).eq('id', product.id);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  await supabase.from('of_products').update({ is_active: 0 }).eq('id', id);
  return NextResponse.json({ success: true });
}
