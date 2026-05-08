'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { COLOR_OPTIONS, SIZE_OPTIONS } from '@/lib/constants';
import type { Product } from '@/lib/types';
import { toast } from 'sonner';

interface StockInput {
  productId: number;
  currentStock: number;
  avgDaily20d: number | null;
  avgMonthly: number | null;
}

export default function StockCheckPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockInputs, setStockInputs] = useState<Map<number, StockInput>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [, setPrevStockValues] = useState<Map<number, number>>(new Map());
  const [pendingByProduct, setPendingByProduct] = useState<Record<number, number>>({});
  const [safetyByProduct, setSafetyByProduct] = useState<Record<number, number>>({});
  const [mdbAvailable, setMdbAvailable] = useState<boolean>(true);
  const [mdbError, setMdbError] = useState<string | undefined>(undefined);
  const [safetyStockDays, setSafetyStockDays] = useState<string>('28');

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then(r => r.json()),
      fetch('/api/stock-check').then(r => r.json()),
    ]).then(([productsData, stockData]: [
      Product[],
      {
        checkedAt: string | null;
        items: { product_id: number; current_stock: number }[];
        pendingByProduct?: Record<number, number>;
        safetyByProduct?: Record<number, number>;
        mdbAvailable?: boolean;
        mdbError?: string;
        safetyStockDays?: number;
      }
    ]) => {
      setProducts(productsData);
      setLastCheckedAt(stockData.checkedAt);
      setPendingByProduct(stockData.pendingByProduct || {});
      setSafetyByProduct(stockData.safetyByProduct || {});
      setMdbAvailable(stockData.mdbAvailable ?? true);
      setMdbError(stockData.mdbError);
      if (stockData.safetyStockDays) setSafetyStockDays(String(stockData.safetyStockDays));

      // Build a map of previous stock values
      const prevMap = new Map<number, number>();
      stockData.items.forEach(item => {
        prevMap.set(item.product_id, item.current_stock);
      });
      setPrevStockValues(prevMap);

      // Initialize inputs with previous values or 0
      const inputs = new Map<number, StockInput>();
      productsData.forEach((p: Product) => {
        inputs.set(p.id, {
          productId: p.id,
          currentStock: prevMap.get(p.id) ?? 0,
          avgDaily20d: null,
          avgMonthly: null,
        });
      });
      setStockInputs(inputs);
      setLoading(false);
    });
  }, []);

  const updateStock = (productId: number, value: number) => {
    setStockInputs(prev => {
      const next = new Map(prev);
      const item = next.get(productId)!;
      next.set(productId, { ...item, currentStock: value });
      return next;
    });
  };

  const getProduct = (sizeCode: string, colorCode: string) => {
    return products.find(p => p.size_code === sizeCode && p.color_code === colorCode);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const items = Array.from(stockInputs.values());
      await fetch('/api/stock-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      setLastCheckedAt(new Date().toLocaleString('ja-JP'));
      toast.success('在庫を登録しました');
    } catch {
      toast.error('エラーが発生しました');
    }
    setSubmitting(false);
  };

  const handlePrintCheckSheet = () => {
    const today = new Date().toLocaleDateString('ja-JP');
    const colorHeaders = COLOR_OPTIONS.map(c => `<th style="padding:8px 16px;text-align:center;border:1px solid #ddd;background:${
      c.code === 'YELLOW_OAK' ? '#fef3c7' : c.code === 'BROWN' ? '#dbc8a8' : '#e0f2fe'
    };font-weight:bold;">${c.label}</th>`).join('');

    const rows = SIZE_OPTIONS.map(size => {
      const cells = COLOR_OPTIONS.map(color => {
        const product = getProduct(size.code, color.code);
        if (!product || !product.is_active) return '<td style="padding:8px 16px;text-align:center;border:1px solid #ddd;background:#f5f5f5;">-</td>';
        return '<td style="padding:12px 16px;text-align:center;border:1px solid #ddd;min-width:60px;">&nbsp;</td>';
      }).join('');
      return `<tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold;">${size.label}</td><td style="padding:8px 12px;border:1px solid #ddd;">${size.frameName}</td>${cells}</tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>在庫チェック表</title>
<style>body{font-family:'MS Gothic',sans-serif;margin:30px}table{border-collapse:collapse;width:100%}
@media print{body{margin:15mm}}</style></head>
<body><h2 style="text-align:center">在庫チェック表</h2>
<p style="text-align:right">チェック日: ${today}　担当者: ＿＿＿＿＿＿</p>
<table><thead><tr><th style="padding:8px;text-align:left;background:#f0f0f0;border:1px solid #ddd;">サイズ</th>
<th style="padding:8px;text-align:left;background:#f0f0f0;border:1px solid #ddd;">額サイズ</th>${colorHeaders}</tr></thead>
<tbody>${rows}</tbody></table>
<p style="margin-top:20px;font-size:12px">※ 各セルに在庫数を記入してください</p>
<script>window.print();</script></body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  if (loading) return <div className="text-center py-12 text-lg">読み込み中...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">在庫登録</h1>
        {lastCheckedAt && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span className="text-sm text-gray-600">前回登録日: </span>
            <span className="text-base font-medium text-blue-800">{lastCheckedAt}</span>
          </div>
        )}
      </div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-600">各商品の現在庫数を入力してください</p>
        <Button className="text-base h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white" onClick={handlePrintCheckSheet}>
          チェック表を印刷
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-base">
        <div className="font-semibold text-blue-800">📊 安全在庫数は <strong className="text-blue-900">{safetyStockDays}日</strong> で計算しています（日需要 × {safetyStockDays}日）</div>
        <div className="text-sm text-gray-600 mt-1">
          ※ 各セルに表示している数値がその商品の安全在庫数です。<strong>有効在庫（現在庫＋納品予定）</strong>がそれを下回ると、登録時にメールで通知されます。
        </div>
        {!mdbAvailable && (
          <div className="text-sm text-orange-700 mt-2 bg-orange-50 border border-orange-200 rounded px-2 py-1">
            ⚠ 昨年実績データ（MDB API）が取得できないため、商品マスタの「下限値」で代替表示しています。
            {mdbError ? `（${mdbError}）` : ''}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left px-4 py-3 font-semibold w-32">サイズ</th>
              {COLOR_OPTIONS.map(color => (
                <th key={color.code} className={`text-center px-4 py-3 font-semibold ${color.headerBg} ${color.textClass}`}>
                  {color.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIZE_OPTIONS.map(size => (
              <tr key={size.code} className="border-t">
                <td className="px-4 py-3 font-medium">
                  <div>{size.label}</div>
                  <div className="text-sm text-gray-500">{size.frameName}</div>
                </td>
                {COLOR_OPTIONS.map(color => {
                  const product = getProduct(size.code, color.code);
                  if (!product) return <td key={color.code} />;
                  const input = stockInputs.get(product.id);
                  const stock = input?.currentStock || 0;
                  const pending = pendingByProduct[product.id] || 0;
                  const effective = stock + pending;
                  // 安全在庫数: API から動的計算済みの値を使う (見つからなければ商品マスタにフォールバック)
                  const safetyStock = safetyByProduct[product.id] ?? product.trigger_stock;
                  // 有効在庫(入力値+納品予定) が安全在庫以下なら警告
                  const isLow = effective <= safetyStock;
                  return (
                    <td key={color.code} className={`px-4 py-3 ${color.bgClass}`}>
                      <div className="flex flex-col items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          className={`w-24 h-11 text-center text-base font-medium rounded-md border px-2 bg-white ${isLow ? 'border-red-400 text-red-700 bg-red-50' : 'border-gray-300'}`}
                          value={stock}
                          onChange={e => updateStock(product.id, parseInt(e.target.value) || 0)}
                          onFocus={e => e.target.select()}
                        />
                        {pending > 0 && (
                          <div className="text-xs text-blue-700">
                            +納品予定 {pending}個（合計 {effective}）
                          </div>
                        )}
                        <div className={`text-xs ${isLow ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                          安全在庫: {safetyStock}個
                          {isLow && ' ⚠'}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          className="text-lg h-14 px-8"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? '登録中...' : '登録'}
        </Button>
      </div>
    </div>
  );
}
