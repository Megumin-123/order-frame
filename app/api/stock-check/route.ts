import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import type { Product } from '@/lib/types';
import { sendStockAlert, type StockAlertItem } from '@/lib/stock-alert';
import { fetchMdbStats, calcSafetyStockQty } from '@/lib/mdb-stats';

// その日の MDB stats を使って商品ごとの safety threshold を計算する。
// MDB が見えなければ trigger_stock を使う。
async function computeSafetyMap(
  products: Product[],
  safetyDays: number,
): Promise<{ map: Record<number, number>; mdbAvailable: boolean; mdbError?: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const result = await fetchMdbStats(today);
  const safetyMap: Record<number, number> = {};

  if (!result.ok) {
    // フォールバック: 商品マスタの trigger_stock を使う
    for (const p of products) safetyMap[p.id] = p.trigger_stock;
    return { map: safetyMap, mdbAvailable: false, mdbError: result.error };
  }

  for (const p of products) {
    const sizeStats = result.data.stats[p.size_code] || {};
    const thirtyDayOrder = sizeStats[p.color_code] || 0;
    if (thirtyDayOrder > 0) {
      safetyMap[p.id] = calcSafetyStockQty(thirtyDayOrder, safetyDays);
    } else {
      // MDB に該当データがない商品はマスタの値にフォールバック
      safetyMap[p.id] = p.trigger_stock;
    }
  }
  return { map: safetyMap, mdbAvailable: true };
}

async function getSafetyDays(): Promise<number> {
  const { data } = await supabase.from('of_settings').select('value').eq('key', 'safety_stock_days').single();
  return parseInt(data?.value || '28');
}

export async function GET() {
  const safetyDays = await getSafetyDays();

  // 全商品の未受領納品予定数を集計 (商品IDごと)
  const { data: pendingDeliveries } = await supabase.from('of_delivery_schedules')
    .select('product_id, quantity')
    .eq('is_received', 0)
    .gt('quantity', 0);
  const pendingMap: Record<number, number> = {};
  (pendingDeliveries || []).forEach(d => {
    pendingMap[d.product_id] = (pendingMap[d.product_id] || 0) + d.quantity;
  });

  // 動的安全在庫数を計算
  const { data: products } = await supabase.from('of_products').select('*').eq('is_active', 1);
  const { map: safetyMap, mdbAvailable, mdbError } = await computeSafetyMap((products || []) as Product[], safetyDays);

  const { data: latestCheck } = await supabase.from('of_stock_checks').select('id, checked_at').order('id', { ascending: false }).limit(1).single();
  const items = latestCheck
    ? (await supabase.from('of_stock_check_items').select('product_id, current_stock').eq('stock_check_id', latestCheck.id)).data || []
    : [];
  return NextResponse.json({
    checkedAt: latestCheck?.checked_at || null,
    items,
    pendingByProduct: pendingMap,
    safetyByProduct: safetyMap,
    mdbAvailable,
    mdbError,
    safetyStockDays: safetyDays,
  });
}

export async function POST(request: Request) {
  const { items, memo } = await request.json();
  const safetyDays = await getSafetyDays();

  const { data: products } = await supabase.from('of_products').select('*').eq('is_active', 1);
  const productMap = new Map((products || []).map((p: Product) => [p.id, p]));

  // 全商品の未受領納品予定数を集計
  const { data: pendingDeliveries } = await supabase.from('of_delivery_schedules')
    .select('product_id, quantity')
    .eq('is_received', 0)
    .gt('quantity', 0);
  const pendingMap = new Map<number, number>();
  (pendingDeliveries || []).forEach(d => {
    pendingMap.set(d.product_id, (pendingMap.get(d.product_id) || 0) + d.quantity);
  });

  // 動的安全在庫数の計算
  const { map: safetyMap, mdbAvailable } = await computeSafetyMap((products || []) as Product[], safetyDays);

  const { data: checkData } = await supabase.from('of_stock_checks').insert({ memo: memo || null }).select('id').single();
  const stockCheckId = checkData!.id;

  const checkItems = [];
  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) continue;
    const pending = pendingMap.get(item.productId) || 0;
    const effectiveStock = item.currentStock + pending;
    // 動的に計算した安全在庫数で判定 (MDB 不可なら trigger_stock にフォールバック)
    const safetyStock = safetyMap[item.productId] ?? product.trigger_stock;
    const needsOrder = effectiveStock <= safetyStock ? 1 : 0;
    const suggestedQuantity = needsOrder ? product.order_quantity : 0;

    await supabase.from('of_stock_check_items').insert({
      stock_check_id: stockCheckId, product_id: item.productId, current_stock: item.currentStock,
      avg_daily_20d: item.avgDaily20d || null, avg_monthly: item.avgMonthly || null,
      needs_order: needsOrder, suggested_quantity: suggestedQuantity,
    });

    checkItems.push({
      product_id: item.productId, current_stock: item.currentStock, pending_delivery: pending,
      effective_stock: effectiveStock, safety_stock: safetyStock,
      needs_order: needsOrder, suggested_quantity: suggestedQuantity,
      product_name: product.name, size_label: product.size_label, color_label: product.color_label,
      color_code: product.color_code, frame_size_name: product.frame_size_name,
      unit_price: product.unit_price, specs: product.specs, trigger_stock: product.trigger_stock,
      order_quantity: product.order_quantity,
    });
  }

  // 安全在庫を下回った商品があればメール通知 (LINEは送らない)
  const alertItems: StockAlertItem[] = checkItems
    .filter(it => it.needs_order === 1)
    .map(it => ({
      productName: it.product_name,
      colorLabel: it.color_label,
      frameSizeName: it.frame_size_name,
      sizeLabel: it.size_label,
      currentStock: it.current_stock,
      pendingDelivery: it.pending_delivery,
      triggerStock: it.safety_stock,
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

  return NextResponse.json({ stockCheckId, items: checkItems, alert, mdbAvailable });
}
