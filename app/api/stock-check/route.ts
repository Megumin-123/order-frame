import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import type { Product } from '@/lib/types';

export async function GET() {
  const { data: latestCheck } = await supabase.from('of_stock_checks').select('id, checked_at').order('id', { ascending: false }).limit(1).single();
  if (!latestCheck) return NextResponse.json({ checkedAt: null, items: [] });

  const { data: items } = await supabase.from('of_stock_check_items').select('product_id, current_stock').eq('stock_check_id', latestCheck.id);
  return NextResponse.json({ checkedAt: latestCheck.checked_at, items: items || [] });
}

export async function POST(request: Request) {
  const { items, memo } = await request.json();

  const { data: products } = await supabase.from('of_products').select('*').eq('is_active', 1);
  const productMap = new Map((products || []).map((p: Product) => [p.id, p]));

  const { data: checkData } = await supabase.from('of_stock_checks').insert({ memo: memo || null }).select('id').single();
  const stockCheckId = checkData!.id;

  const checkItems = [];
  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) continue;
    const needsOrder = item.currentStock <= product.trigger_stock ? 1 : 0;
    const suggestedQuantity = needsOrder ? product.order_quantity : 0;

    await supabase.from('of_stock_check_items').insert({
      stock_check_id: stockCheckId, product_id: item.productId, current_stock: item.currentStock,
      avg_daily_20d: item.avgDaily20d || null, avg_monthly: item.avgMonthly || null,
      needs_order: needsOrder, suggested_quantity: suggestedQuantity,
    });

    checkItems.push({
      product_id: item.productId, current_stock: item.currentStock,
      needs_order: needsOrder, suggested_quantity: suggestedQuantity,
      product_name: product.name, size_label: product.size_label, color_label: product.color_label,
      color_code: product.color_code, frame_size_name: product.frame_size_name,
      unit_price: product.unit_price, specs: product.specs, trigger_stock: product.trigger_stock,
      order_quantity: product.order_quantity,
    });
  }

  return NextResponse.json({ stockCheckId, items: checkItems });
}
