'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface PaymentItem {
  deliveryDate: string;
  productName: string;
  colorLabel: string;
  frameSizeName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  orderNumber: string;
  isReceived: boolean;
}

interface PaymentMonth {
  month: string;
  paymentDate: string;
  items: PaymentItem[];
  total: number;
  tax: number;
  totalWithTax: number;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
function formatPaymentMonth(monthStr: string): string {
  const parts = monthStr.split('-');
  return `${parts[0]}年${parseInt(parts[1])}月`;
}
function formatPaymentDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return `${parseInt(parts[1])}/${parseInt(parts[2])}(${WEEKDAYS[d.getDay()]})`;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/payments').then(r => r.json()).then(data => {
      setPayments(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center py-12 text-lg">読み込み中...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">支払一覧</h1>
        <Button variant="outline" className="text-base h-10 px-4" onClick={() => window.print()}>
          印刷
        </Button>
      </div>

      <p className="text-gray-500 mb-4 text-sm">末締め翌月末払い（納品予定分も含む）</p>

      {payments.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <p className="text-lg text-gray-500">支払データはありません</p>
        </div>
      ) : (
        <>
          {/* Summary table */}
          <div className="bg-white rounded-lg border overflow-hidden mb-6">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold">支払月</th>
                  <th className="text-left px-4 py-3 font-semibold">支払期日</th>
                  <th className="text-right px-4 py-3 font-semibold">税抜合計</th>
                  <th className="text-right px-4 py-3 font-semibold">消費税</th>
                  <th className="text-right px-4 py-3 font-semibold">税込合計</th>
                  <th className="text-center px-4 py-3 font-semibold">明細</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(pm => (
                  <tr key={pm.month} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{formatPaymentMonth(pm.month)}</td>
                    <td className="px-4 py-3">{formatPaymentDate(pm.paymentDate)}</td>
                    <td className="px-4 py-3 text-right">{pm.total.toLocaleString()}円</td>
                    <td className="px-4 py-3 text-right">{pm.tax.toLocaleString()}円</td>
                    <td className="px-4 py-3 text-right font-bold text-lg">{pm.totalWithTax.toLocaleString()}円</td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="outline" size="sm" className="text-sm"
                        onClick={() => setExpandedMonth(expandedMonth === pm.month ? null : pm.month)}>
                        {expandedMonth === pm.month ? '閉じる' : '表示'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail for expanded month */}
          {expandedMonth && (() => {
            const pm = payments.find(p => p.month === expandedMonth);
            if (!pm) return null;
            return (
              <div className="bg-white rounded-lg border overflow-hidden mb-6">
                <div className="bg-gray-50 px-4 py-3 font-semibold">
                  {formatPaymentMonth(pm.month)}の明細（支払期日: {pm.paymentDate}）
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-4 py-2 font-semibold text-sm">納品日</th>
                      <th className="text-left px-4 py-2 font-semibold text-sm">色</th>
                      <th className="text-left px-4 py-2 font-semibold text-sm">商品名</th>
                      <th className="text-right px-4 py-2 font-semibold text-sm">数量</th>
                      <th className="text-right px-4 py-2 font-semibold text-sm">単価</th>
                      <th className="text-right px-4 py-2 font-semibold text-sm">小計</th>
                      <th className="text-center px-4 py-2 font-semibold text-sm">状態</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-400">発注番号</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pm.items.map((item, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-2 text-sm">{item.deliveryDate}</td>
                        <td className="px-4 py-2 text-sm">{item.colorLabel}</td>
                        <td className="px-4 py-2 text-sm">{item.frameSizeName}</td>
                        <td className="px-4 py-2 text-right text-sm">{item.quantity}</td>
                        <td className="px-4 py-2 text-right text-sm">{item.unitPrice.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-sm font-medium">{item.subtotal.toLocaleString()}</td>
                        <td className="px-4 py-2 text-center">
                          {item.isReceived ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">納品済</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">予定</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-400">{item.orderNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-gray-50">
                      <td colSpan={5} className="px-4 py-2 text-right font-semibold">税抜合計:</td>
                      <td className="px-4 py-2 text-right font-bold">{pm.total.toLocaleString()}円</td>
                      <td colSpan={2}></td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-2 text-right font-semibold">消費税(10%):</td>
                      <td className="px-4 py-2 text-right">{pm.tax.toLocaleString()}円</td>
                      <td colSpan={2}></td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-2 text-right font-semibold text-lg">税込合計:</td>
                      <td className="px-4 py-2 text-right font-bold text-lg">{pm.totalWithTax.toLocaleString()}円</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
