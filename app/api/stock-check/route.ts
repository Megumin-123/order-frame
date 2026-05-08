import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import type { Product } from '@/lib/types';
import { sendStockAlert, type StockAlertItem } from '@/lib/stock-alert';

export async function GET() {
  // 全商品の未受領納品予定数を集計 (商品IDごと)
  const { data: pendingDeliveries } = await supabase.from('of_delivery_schedules')
    .select('product_id, quantity')
    .eq('is_received', 0)
    .gt('quantity', 0);
  const pendingMap: Record<number, number> = {};
  (pendingDeliveries || []).forEach(d => {
    pendingMap[d.product_id] = (pendingMap[d.product_id] || 0) + d.quantity;
  });

  const { data: latestCheck } = await supabase.from('of_stock_checks').select('id, checked_at').order('id', { ascending: false }).limit(1).single();
  if (!latestCheck) {
    return NextResponse.json({ checkedAt: null, items: [], pendingByProduct: pendingMap });
  }

  const { data: items } = await supabase.from('of_stock_check_items').select('product_id, current_stock').eq('stock_check_id', latestCheck.id);
  return NextResponse.json({ checkedAt: latestCheck.checked_at, items: items || [], pendingByProduct: pendingMap });
}

export async function POST(request: Request) {
  const { items, memo } = await request.json();

  const { data: products } = await supabase.from('of_products').select('*').eq('is_active', 1);
  const productMap = new Map((products || []).map((p: Product) => [p.id, p]));

  // 全商品の未受領納品予定数を集計 (商品IDごと)
  const { data: pendingDeliveries } = await supabase.from('of_delivery_schedules')
    .select('product_id, quantity')
    .eq('is_received', 0)
    .gt('quantity', 0);
  const pendingMap = new Map<number, number>();
  (pendingDeliveries || []).forEach(d => {
    pendingMap.set(d.product_id, (pendingMap.get(d.product_id) || 0) + d.quantity);
  });

  const { data: checkData } = await supabase.from('of_stock_checks').insert({ memo: memo || null }).select('id').single();
  const stockCheckId = checkData!.id;

  const checkItems = [];
  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) continue;
    const pending = pendingMap.get(item.productId) || 0;
    const effectiveStock = item.currentStock + pending;
    // 有効在庫(現在庫 + 未受領の納品予定) が安全在庫数以下のとき発注必要と判定
    const needsOrder = effectiveStock <= product.trigger_stock ? 1 : 0;
    const suggestedQuantity = needsOrder ? product.order_quantity : 0;

    await supabase.from('of_stock_check_items').insert({
      stock_check_id: stockCheckId, product_id: item.productId, current_stock: item.currentStock,
      avg_daily_20d: item.avgDaily20d || null, avg_monthly: item.avgMonthly || null,
      needs_order: needsOrder, suggested_quantity: suggestedQuantity,
    });

    checkItems.push({
      product_id: item.productId, current_stock: item.currentStock, pending_delivery: pending,
      effective_stock: effectiveStock,
      needs_order: needsOrder, suggested_quantity: suggestedQuantity,
      product_name: product.name, size_label: product.size_label, color_label: product.color_label,
      color_code: product.color_code, frame_size_name: product.frame_size_name,
      unit_price: product.unit_price, specs: product.specs, trigger_stock: product.trigger_stock,
      order_quantity: product.order_quantity,
    });
  }

  // 安全在庫を下回った商品があれば LINE / メールで通知。
  // 通知の失敗は在庫登録自体の失敗にはしない (try/catch で握る)。
  const alertItems: StockAlertItem[] = checkItems
    .filter(it => it.needs_order === 1)
    .map(it => ({
      productName: it.product_name,
      colorLabel: it.color_label,
      frameSizeName: it.frame_size_name,
      sizeLabel: it.size_label,
      currentStock: it.current_stock,
      pendingDelivery: it.pending_delivery,
      triggerStock: it.trigger_stock,
      suggestedQuantity: it.suggested_quantity,
    }));
  let alert = null as null | Awaited<ReturnType<typeof sendStockAlert>>;
  if (alertItems.length > 0) {
    try {
      alert = await sendStockAlert(alertItems);
    } catch (e) {
      console.error('Stock alert send error:', e);
    }
  }

  return NextResponse.json({ stockCheckId, items: checkItems, alert });
}
