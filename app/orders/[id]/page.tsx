'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { COLOR_OPTIONS, ORDER_STATUS } from '@/lib/constants';
import type { OrderWithItems, Product } from '@/lib/types';
import { toast } from 'sonner';

interface EditDelivery { deliveryDate: string; quantity: number; }
interface EditItem {
  productId: number; quantity: number; unitPrice: number;
  productName: string; sizeLabel: string; colorLabel: string; colorCode: string;
  frameSizeName: string; specs: string; triggerStock: number; stdOrderQty: number;
  piecesPerBox: number; currentStock: number | null; pendingDelivery: number;
  pendingDeliveryDetails: { date: string; qty: number }[];
  avgDaily20d: number | null; avgMonthly: number | null;
  deliverySchedules: EditDelivery[]; memo: string;
  category?: string;
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [items, setItems] = useState<EditItem[]>([]);
  const [orderDate, setOrderDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<{ delivery_lead_days?: string; mdb_path?: string }>({});
  const [orderStats, setOrderStats] = useState<Record<string, Record<string, number>> | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<{ from: string; to: string } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const isEditable = order?.status === 'draft';

  const fetchOrder = async () => {
    const res = await fetch(`/api/orders/${id}`);
    const data = await res.json();
    setOrder(data);
    setOrderDate(data.order_date);
    setItems(data.items.map((item: Record<string, unknown>) => ({
      productId: item.product_id, quantity: item.quantity, unitPrice: item.unit_price,
      productName: item.product_name as string, sizeLabel: item.size_label as string,
      colorLabel: item.color_label as string, colorCode: item.color_code as string,
      frameSizeName: item.frame_size_name as string, specs: (item.specs as string) || '',
      triggerStock: (item.trigger_stock as number) || 0, stdOrderQty: (item.std_order_qty as number) || 0,
      piecesPerBox: (item.pieces_per_box as number) || 1, currentStock: (item.current_stock as number) ?? null,
      pendingDelivery: (item.pending_delivery as number) || 0,
      pendingDeliveryDetails: (item.pending_delivery_details as { date: string; qty: number }[]) || [],
      avgDaily20d: (item.avg_daily_20d as number) ?? null, avgMonthly: (item.avg_monthly as number) ?? null,
      deliverySchedules: ((item.delivery_schedules as { delivery_date: string; quantity: number }[]) || []).map(ds => ({
        deliveryDate: ds.delivery_date, quantity: ds.quantity,
      })),
      memo: (item.memo as string) || '',
      category: (item.category as string) || 'frame',
    })));
    setLoading(false);
  };

  useEffect(() => { fetchOrder(); fetch('/api/settings').then(r => r.json()).then(setSettings); }, [id]);

  const updateDelivery = (itemIndex: number, deliveryIndex: number, field: string, value: string | number) => {
    setItems(prev => {
      const next = [...prev]; const item = { ...next[itemIndex] };
      item.deliverySchedules = [...item.deliverySchedules];
      item.deliverySchedules[deliveryIndex] = { ...item.deliverySchedules[deliveryIndex], [field]: value };
      next[itemIndex] = item; return next;
    });
  };

  const addDeliveryDate = (index: number) => {
    setItems(prev => {
      const next = [...prev]; const item = { ...next[index] };
      item.deliverySchedules = [...item.deliverySchedules, { deliveryDate: '', quantity: 0 }];
      next[index] = item; return next;
    });
  };

  const removeDelivery = (itemIndex: number, deliveryIndex: number) => {
    setItems(prev => {
      const next = [...prev]; const item = { ...next[itemIndex] };
      item.deliverySchedules = item.deliverySchedules.filter((_, i) => i !== deliveryIndex);
      next[itemIndex] = item; return next;
    });
  };

  const removeItem = (index: number) => { setItems(prev => prev.filter((_, i) => i !== index)); };

  const handleSave = async () => {
    setSaving(true);
    const syncedItems = items.map(item => {
      // 空の納品日行を除外（日付なし or 数量0）
      const validSchedules = item.deliverySchedules.filter(d => d.deliveryDate && d.quantity > 0);
      return { ...item, deliverySchedules: validSchedules, quantity: validSchedules.reduce((s, d) => s + (d.quantity || 0), 0) };
    });
    try {
      await fetch(`/api/orders/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: syncedItems, orderDate }),
      });
      toast.success('保存しました'); fetchOrder();
    } catch { toast.error('エラーが発生しました'); }
    setSaving(false);
  };

  const [sendingLine, setSendingLine] = useState(false);

  const handleCalcStats = async () => {
    // Find the first delivery date from items
    let deliveryDate = '';
    for (const item of items) {
      for (const ds of item.deliverySchedules) {
        if (ds.deliveryDate && (!deliveryDate || ds.deliveryDate < deliveryDate)) {
          deliveryDate = ds.deliveryDate;
        }
      }
    }
    if (!deliveryDate) { toast.warning('納品予定日が設定されていません'); return; }

    setLoadingStats(true);
    try {
      const res = await fetch('/api/order-stats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryDate, mdbPath: settings.mdb_path }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); }
      else {
        setOrderStats(data.stats);
        setStatsPeriod(data.period);
        toast.success('注文実績を計算しました');
      }
    } catch { toast.error('注文実績の計算に失敗しました'); }
    setLoadingStats(false);
  };

  const handleSendLine = async () => {
    setSendingLine(true);
    try {
      const res = await fetch('/api/line/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('LINEに承認依頼を送信しました');
      } else {
        toast.error(data.error || 'LINE送信に失敗しました');
      }
    } catch {
      toast.error('通信エラーが発生しました');
    }
    setSendingLine(false);
  };

  const handleStatusChange = async (status: string) => {
    await fetch(`/api/orders/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    toast.success(status === 'submitted' ? '発注を確定しました' : 'ステータスを更新しました');
    setShowConfirmSubmit(false); fetchOrder();
  };

  const handleExport = (format: string) => { window.open(`/api/orders/${id}/export?format=${format}`, '_blank'); };

  const handleOpenAddProduct = async () => {
    if (allProducts.length === 0) { const res = await fetch('/api/products'); setAllProducts(await res.json()); }
    setShowAddProduct(true);
  };

  const handleAddProduct = (product: Product) => {
    if (items.some(i => i.productId === product.id)) { toast.warning('この商品は既に追加されています'); return; }
    const leadDays = parseInt(settings.delivery_lead_days || '21');
    const d = new Date(orderDate || new Date().toISOString().split('T')[0]);
    d.setDate(d.getDate() + leadDays);
    const deliveryDateStr = d.toISOString().split('T')[0];
    setItems(prev => [...prev, {
      productId: product.id, quantity: 0, unitPrice: product.unit_price,
      productName: product.name, sizeLabel: product.size_label, colorLabel: product.color_label,
      colorCode: product.color_code, frameSizeName: product.frame_size_name, specs: product.specs || '',
      triggerStock: product.trigger_stock, stdOrderQty: product.order_quantity,
      piecesPerBox: product.pieces_per_box, currentStock: null, pendingDelivery: 0,
      pendingDeliveryDetails: [], avgDaily20d: null, avgMonthly: null,
      deliverySchedules: [{ deliveryDate: deliveryDateStr, quantity: 0 }], memo: '',
      category: product.category,
    }]);
    setShowAddProduct(false);
    toast.success(`${product.name}を追加しました`);
  };

  const getColorStyle = (code: string) => COLOR_OPTIONS.find(c => c.code === code) || COLOR_OPTIONS[0];

  if (loading) return <div className="text-center py-12 text-lg">読み込み中...</div>;
  if (!order) return <div className="text-center py-12 text-lg">発注書が見つかりません</div>;

  const subtotal = items.reduce((sum, item) => {
    const q = item.deliverySchedules.reduce((s, d) => s + (d.quantity || 0), 0);
    return sum + q * item.unitPrice;
  }, 0);
  const taxAmount = Math.floor(subtotal * 0.10);
  const total = subtotal + taxAmount;
  const status = ORDER_STATUS[order.status as keyof typeof ORDER_STATUS] || ORDER_STATUS.draft;

  const deliveryDates = new Map<string, { count: number; total: number }>();
  items.forEach(item => { item.deliverySchedules.forEach(ds => {
    if (ds.deliveryDate && ds.quantity > 0) {
      const entry = deliveryDates.get(ds.deliveryDate) || { count: 0, total: 0 };
      entry.count++; entry.total += ds.quantity || 0; deliveryDates.set(ds.deliveryDate, entry);
    }
  });});

  // Group by color
  const frameItems: { colorCode: string; colorLabel: string; items: { item: EditItem; globalIdx: number }[] }[] = [];
  const otherItems: { item: EditItem; globalIdx: number }[] = [];
  const colorMap = new Map<string, number>();
  items.forEach((item, idx) => {
    if (item.category === 'other') { otherItems.push({ item, globalIdx: idx }); return; }
    if (!colorMap.has(item.colorCode)) {
      colorMap.set(item.colorCode, frameItems.length);
      frameItems.push({ colorCode: item.colorCode, colorLabel: item.colorLabel, items: [] });
    }
    frameItems[colorMap.get(item.colorCode)!].items.push({ item, globalIdx: idx });
  });

  const existingProductIds = new Set(items.map(i => i.productId));
  const availableOtherProducts = allProducts.filter(p => p.category === 'other' && !existingProductIds.has(p.id));

  // Render a frame color group as a card
  const renderColorGroup = (group: typeof frameItems[0]) => {
    const cs = getColorStyle(group.colorCode);
    return (
      <div key={group.colorCode} className={`rounded-lg border-2 ${cs.borderClass} overflow-hidden mb-4`}>
        <div className={`${cs.headerBg} px-4 py-2`}>
          <span className={`text-lg font-bold ${cs.textClass}`}>{group.colorLabel}</span>
        </div>
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{width:'125px'}} />{/* サイズ */}
            <col style={{width:'135px'}} />{/* 納品日 */}
            <col style={{width:'60px'}} />{/* 数量 */}
            <col style={{width:'50px'}} />{/* 数量計 */}
            <col style={{width:'65px'}} />{/* 単価 */}
            <col style={{width:'85px'}} />{/* 小計 */}
            <col style={{width:'6px'}} />{/* 区切り */}
            <col style={{width:'55px'}} />{/* 有効在庫 */}
            {orderStats && <col style={{width:'55px'}} />}{/* 注文実績 */}
            <col style={{width:'48px'}} />{/* 下限値 */}
            <col style={{width:'48px'}} />{/* 補充数 */}
            <col style={{width:'48px'}} />{/* 入数/箱 */}
          </colgroup>
          <thead>
            <tr className={cs.bgClass}>
              <th className="text-left px-2 py-2 font-semibold">サイズ</th>
              <th className="text-center px-1 py-2 text-sm font-semibold">納品日</th>
              <th className="text-center px-1 py-2 text-sm font-semibold">数量</th>
              <th className="text-center px-1 py-2 text-sm font-semibold">数量計</th>
              <th className="text-right px-2 py-2 font-semibold">単価</th>
              <th className="text-right px-2 py-2 font-semibold">小計</th>
              <th className="py-2"></th>
              <th className="text-center px-1 py-2 text-sm font-semibold text-gray-500" title="現在庫 + 他の発注の未納品数">有効在庫</th>
              {orderStats && (
                <th className="text-center px-1 py-2 text-sm font-semibold text-orange-600"
                  title={statsPeriod ? `${statsPeriod.from} ～ ${statsPeriod.to} の注文数` : ''}>30日注文</th>
              )}
              <th className="text-center px-1 py-2 text-sm font-semibold text-gray-500">下限値</th>
              <th className="text-center px-1 py-2 text-sm font-semibold text-gray-500">補充数</th>
              <th className="text-center px-1 py-2 text-sm font-semibold text-gray-500">入数/箱</th>
            </tr>
          </thead>
          <tbody>
            {group.items.map(({ item, globalIdx }) => {
              const qtyTotal = item.deliverySchedules.reduce((s, d) => s + (d.quantity || 0), 0);
              const hasQty = qtyTotal > 0;
              const rowBg = hasQty ? 'bg-white' : 'bg-gray-100';
              const rowCount = Math.max(item.deliverySchedules.length, 1);
              const firstDs = item.deliverySchedules[0];
              const restDs = item.deliverySchedules.slice(1);
              return (
                <React.Fragment key={globalIdx}>
                  <tr className={`border-t ${rowBg}`}>
                    <td className="px-2 py-1.5 font-medium whitespace-nowrap" rowSpan={rowCount}>
                      {item.frameSizeName}（{item.sizeLabel}）
                    </td>
                    <td className="px-1 py-1.5">
                      <div className="flex items-center gap-1">
                        {firstDs ? (
                          isEditable ? (
                            <>
                              <Input type="date" className="h-9 text-sm bg-white border-blue-300 flex-1" value={firstDs.deliveryDate}
                                onChange={e => updateDelivery(globalIdx, 0, 'deliveryDate', e.target.value)} />
                              <button className="w-6 h-6 rounded-full bg-red-100 text-red-500 text-sm hover:bg-red-200 flex items-center justify-center shrink-0"
                                onClick={() => removeDelivery(globalIdx, 0)} title="削除">×</button>
                            </>
                          ) : <span className="text-sm">{firstDs.deliveryDate}</span>
                        ) : (
                          <div className="flex-1" />
                        )}
                        {isEditable && (
                          <button className="w-8 h-8 rounded-full bg-blue-500 text-white text-xl font-bold hover:bg-blue-600 flex items-center justify-center shrink-0"
                            onClick={() => addDeliveryDate(globalIdx)} title="納品日追加">+</button>
                        )}
                      </div>
                    </td>
                    <td className="px-1 py-1.5 text-center">
                      {firstDs ? (
                        isEditable ? (
                          <Input type="number" className="w-full h-9 text-sm text-center bg-white border-blue-300"
                            value={firstDs.quantity}
                            onChange={e => updateDelivery(globalIdx, 0, 'quantity', parseInt(e.target.value) || 0)} />
                        ) : <span className="text-sm">{firstDs.quantity}</span>
                      ) : null}
                    </td>
                    <td className="px-1 py-1.5 text-center font-bold" rowSpan={rowCount}>{qtyTotal > 0 ? qtyTotal : '-'}</td>
                    <td className="px-2 py-1.5 text-right" rowSpan={rowCount}>{item.unitPrice.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right font-medium" rowSpan={rowCount}>
                      {qtyTotal > 0 ? (qtyTotal * item.unitPrice).toLocaleString() : '-'}
                    </td>
                    <td className="text-center text-gray-200" rowSpan={rowCount}>|</td>
                    <td className="px-1 py-1.5 text-center relative group" rowSpan={rowCount}>
                      {item.currentStock !== null ? (
                        <span className="cursor-help text-base font-medium text-gray-700 inline-flex items-center gap-0.5">
                          {item.currentStock + item.pendingDelivery}
                          {item.pendingDelivery > 0 && <span className="text-blue-500 text-xs">*</span>}
                          <span className="text-gray-400 text-xs">&#9432;</span>
                        </span>
                      ) : <span className="text-sm text-gray-400">-</span>}
                      {item.currentStock !== null && (
                        <div className="hidden group-hover:block absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm whitespace-nowrap shadow-lg">
                          <div className="font-medium mb-1">在庫内訳</div>
                          <div>現在庫: {item.currentStock}個</div>
                          {item.pendingDeliveryDetails.length > 0 ? (
                            <>
                              <div className="mt-1 font-medium text-blue-300">納品予定:</div>
                              {item.pendingDeliveryDetails.map((d, i) => (
                                <div key={i} className="ml-2">{d.date} {d.qty}個</div>
                              ))}
                              <div className="mt-1 border-t border-gray-600 pt-1 font-medium">合計: {item.currentStock + item.pendingDelivery}個</div>
                            </>
                          ) : (
                            <div className="text-gray-400 text-xs mt-1">納品予定なし</div>
                          )}
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                        </div>
                      )}
                    </td>
                    {orderStats && (
                      <td className="px-1 py-1.5 text-center relative group/stats" rowSpan={rowCount}>
                        {(() => {
                          const sizeMap: Record<string, string> = { SS:'SS', S:'S', M:'M', M_PLUS:'M_PLUS', L:'L', LL:'LL' };
                          const sizeCode = Object.entries(sizeMap).find(([, v]) => v === item.sizeLabel.replace('mini(SS)','SS').replace('Sサイズ','S').replace('Mサイズ','M').replace('Mプラス','M_PLUS').replace('Lサイズ','L').replace('LLサイズ','LL'))?.[1];
                          const colorMap: Record<string, string> = { '黄オーク':'YELLOW_OAK', 'ブラウン':'BROWN', 'ホワイト':'WHITE' };
                          const colorCode = colorMap[item.colorLabel] || 'YELLOW_OAK';
                          const count = sizeCode && orderStats[sizeCode] ? orderStats[sizeCode][colorCode] || 0 : 0;
                          return (
                            <>
                              <span className={`text-base font-medium cursor-help ${count > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                {count}
                              </span>
                              {statsPeriod && (
                                <div className="hidden group-hover/stats:block absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm whitespace-nowrap shadow-lg">
                                  <div className="font-medium">30日間の注文数: {count}個</div>
                                  <div className="text-gray-300 text-xs mt-1">{statsPeriod.from} ～ {statsPeriod.to}</div>
                                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </td>
                    )}
                    <td className="px-1 py-1.5 text-center text-sm text-gray-500" rowSpan={rowCount}>{item.triggerStock}</td>
                    <td className="px-1 py-1.5 text-center text-sm text-gray-500" rowSpan={rowCount}>{item.stdOrderQty}</td>
                    <td className="px-1 py-1.5 text-center text-sm text-gray-500" rowSpan={rowCount}>{item.piecesPerBox}</td>
                  </tr>
                  {restDs.map((ds, di) => (
                    <tr key={di} className={`border-t border-dashed ${rowBg}`}>
                      <td className="px-1 py-1">
                        <div className="flex items-center gap-1">
                          {isEditable ? (
                            <Input type="date" className="h-9 text-sm bg-white border-blue-300 flex-1" value={ds.deliveryDate}
                              onChange={e => updateDelivery(globalIdx, di + 1, 'deliveryDate', e.target.value)} />
                          ) : <span className="text-sm">{ds.deliveryDate}</span>}
                          {isEditable && (
                            <button className="w-7 h-7 rounded-full bg-red-100 text-red-500 text-base hover:bg-red-200 flex items-center justify-center shrink-0"
                              onClick={() => removeDelivery(globalIdx, di + 1)} title="削除">×</button>
                          )}
                        </div>
                      </td>
                      <td className="px-1 py-1 text-center">
                        {isEditable ? (
                          <Input type="number" className="w-full h-9 text-sm text-center bg-white border-blue-300"
                            value={ds.quantity}
                            onChange={e => updateDelivery(globalIdx, di + 1, 'quantity', parseInt(e.target.value) || 0)} />
                        ) : <span className="text-sm">{ds.quantity}</span>}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      {/* Top bar */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">{order.order_number}</h1>
            <span className={`px-4 py-1 rounded-full text-sm font-medium ${status.color}`}>{status.label}</span>
          </div>
          <div className="flex gap-2">
            {isEditable && (
              <>
                <Button className="text-base h-10 px-5" onClick={handleSave} disabled={saving}>
                  {saving ? '保存中...' : '保存'}</Button>
                <Button className="text-base h-10 px-5 bg-green-600 hover:bg-green-700"
                  onClick={() => setShowConfirmSubmit(true)}>発注確定</Button>
              </>
            )}
            <Button className="text-base h-10 px-5 bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={handleSendLine} disabled={sendingLine}>
              {sendingLine ? '送信中...' : '承認依頼をLINEで送信'}
            </Button>
            <Button variant="outline" className="text-base h-10 px-5 text-orange-600 border-orange-300 hover:bg-orange-50"
              onClick={handleCalcStats} disabled={loadingStats}>
              {loadingStats ? '計算中...' : '注文実績'}
            </Button>
            <Button variant="outline" className="text-base h-10 px-5" onClick={() => handleExport('xlsx')}>Excel</Button>
            <Button variant="outline" className="text-base h-10 px-5" onClick={() => handleExport('pdf')}>PDF</Button>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">発注日:</span>
            {isEditable ? (
              <Input type="date" className="w-44 h-9" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
            ) : <span className="font-medium">{order.order_date}</span>}
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <span className="text-gray-500 text-sm">税抜: {subtotal.toLocaleString()}円</span>
            <span className="text-gray-500 text-sm">税: {taxAmount.toLocaleString()}円</span>
            <span className="text-xl font-bold bg-blue-50 border border-blue-200 rounded-lg px-4 py-1">合計: {total.toLocaleString()}円</span>
          </div>
        </div>
        {deliveryDates.size > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t flex-wrap">
            <span className="text-sm text-gray-600 font-medium">納品日別:</span>
            {Array.from(deliveryDates.entries()).sort().map(([date, info]) => (
              <span key={date} className="px-3 py-1 bg-blue-50 text-blue-800 rounded text-sm">
                {date} ({info.count}品/{info.total}個)
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Frame groups */}
      {frameItems.map(group => renderColorGroup(group))}

      {/* Other items group */}
      {(otherItems.length > 0 || isEditable) && (
        <div className="rounded-lg border-2 border-gray-300 overflow-hidden mb-4">
          <div className="bg-gray-100 px-4 py-2 flex justify-between items-center">
            <span className="text-lg font-bold text-gray-700">その他</span>
            {isEditable && (
              <Button variant="outline" size="sm" className="text-sm" onClick={handleOpenAddProduct}>+ 商品を追加</Button>
            )}
          </div>
          {otherItems.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-sm font-semibold">商品名</th>
                  <th className="text-center px-3 py-2 text-sm font-semibold w-32">納品日</th>
                  <th className="text-center px-3 py-2 text-sm font-semibold w-20">数量</th>
                  <th className="text-right px-3 py-2 text-sm font-semibold w-16">単価</th>
                  <th className="text-right px-3 py-2 text-sm font-semibold w-20">小計</th>
                  {isEditable && <th className="w-12"></th>}
                </tr>
              </thead>
              <tbody>
                {otherItems.map(({ item, globalIdx }) => {
                  const firstDs = item.deliverySchedules[0];
                  const qty = firstDs?.quantity || 0;
                  return (
                    <tr key={globalIdx} className="border-t bg-white">
                      <td className="px-3 py-1.5 text-sm font-medium">{item.productName}</td>
                      <td className="px-3 py-1.5 text-center">
                        {firstDs && isEditable ? (
                          <Input type="date" className="w-32 h-8 text-xs bg-white border-blue-300 mx-auto" value={firstDs.deliveryDate}
                            onChange={e => updateDelivery(globalIdx, 0, 'deliveryDate', e.target.value)} />
                        ) : firstDs ? <span className="text-xs">{firstDs.deliveryDate}</span> : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {firstDs && isEditable ? (
                          <Input type="number" className="w-16 h-8 text-sm text-center bg-white border-blue-300 mx-auto"
                            value={qty}
                            onChange={e => updateDelivery(globalIdx, 0, 'quantity', parseInt(e.target.value) || 0)} />
                        ) : <span className="text-xs">{qty}</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right text-sm">{item.unitPrice.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right text-sm font-medium">{qty > 0 ? (qty * item.unitPrice).toLocaleString() : '-'}</td>
                      {isEditable && (
                        <td className="px-2 py-1.5 text-center">
                          <Button variant="ghost" size="sm" className="text-red-500 h-6 text-xs" onClick={() => removeItem(globalIdx)}>削除</Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {otherItems.length === 0 && !isEditable && (
            <div className="px-4 py-3 text-sm text-gray-400">その他の商品はありません</div>
          )}
        </div>
      )}

      {/* Confirm submit */}
      <Dialog open={showConfirmSubmit} onOpenChange={setShowConfirmSubmit}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-xl">発注を確定しますか？</DialogTitle></DialogHeader>
          <p className="text-base">発注書 <strong>{order.order_number}</strong> を確定します。</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="text-base h-12 px-6" onClick={() => setShowConfirmSubmit(false)}>いいえ</Button>
            <Button className="text-base h-12 px-6 bg-green-600 hover:bg-green-700"
              onClick={() => handleStatusChange('submitted')}>はい、確定する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add product dialog - only other category */}
      <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-xl">その他の商品を追加</DialogTitle></DialogHeader>
          {availableOtherProducts.length > 0 ? (
            <div className="space-y-1">
              {availableOtherProducts.map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-gray-50"
                  onClick={() => handleAddProduct(product)}>
                  <div>
                    <span className="font-medium">{product.name}</span>
                    <span className="text-sm text-gray-500 ml-2">{product.unit_price.toLocaleString()}円</span>
                  </div>
                  <Button size="sm" variant="outline" className="text-sm">追加</Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">追加できる商品はありません。商品マスタの「その他」で登録してください。</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
