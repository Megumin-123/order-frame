'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { COLOR_OPTIONS, ORDER_STATUS } from '@/lib/constants';
import type { Order, DeliveryScheduleWithProduct } from '@/lib/types';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);
  const d = new Date(year, month - 1, day);
  const weekday = WEEKDAYS[d.getDay()];
  const currentYear = new Date().getFullYear();
  if (year !== currentYear) return `${year}/${month}/${day}(${weekday})`;
  return `${month}/${day}(${weekday})`;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryScheduleWithProduct[]>([]);
  const [lastStockCheckDate, setLastStockCheckDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/orders').then(r => r.json()),
      fetch('/api/deliveries?status=pending&confirmedOnly=1').then(r => r.json()),
      fetch('/api/stock-check').then(r => r.json()),
    ]).then(([ordersData, deliveriesData, stockData]) => {
      setOrders(ordersData);
      setDeliveries(deliveriesData);
      setLastStockCheckDate(stockData.checkedAt);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center py-12 text-lg">読み込み中...</div>;

  const draftOrders = orders.filter(o => o.status === 'draft');
  const activeOrders = orders.filter(o => ['submitted', 'partially_delivered'].includes(o.status));
  const today = getTodayStr();
  const getColorStyle = (code: string) => COLOR_OPTIONS.find(c => c.code === code) || COLOR_OPTIONS[0];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">ダッシュボード</h1>

      {/* 在庫登録リマインダー */}
      {(() => {
        if (!lastStockCheckDate) return (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-red-800">在庫登録がまだ行われていません</p>
              <p className="text-sm text-red-600">在庫登録画面で現在の在庫数を登録してください</p>
            </div>
            <Link href="/stock-check" className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">在庫登録へ</Link>
          </div>
        );
        const lastDate = new Date(lastStockCheckDate);
        const daysSince = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince >= 7) return (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6 flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <p className="font-bold text-yellow-800">在庫登録から{daysSince}日経過しています</p>
              <p className="text-sm text-yellow-600">週1回の在庫登録をお願いします（前回: {lastStockCheckDate.split('T')[0]}）</p>
            </div>
            <Link href="/stock-check" className="ml-auto px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium">在庫登録へ</Link>
          </div>
        );
        return null;
      })()}

      <div className="grid grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-600">下書き発注書</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{draftOrders.length}件</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-600">進行中の発注</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeOrders.length}件</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-600">未納品アイテム</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{deliveries.length}件</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold">納品予定（全未納品）</h2>
            <Link href="/deliveries">
              <span className="text-blue-600 hover:underline text-base">納品一覧へ</span>
            </Link>
          </div>
          {deliveries.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                納品予定はありません
              </CardContent>
            </Card>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">納品予定日</th>
                    <th className="text-left px-2 py-2 font-semibold">商品</th>
                    <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">数量</th>
                    <th className="text-left px-2 py-2 text-xs text-gray-400 whitespace-nowrap">発注番号</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map(d => {
                    const colorStyle = getColorStyle(d.color_code);
                    const isToday = d.delivery_date === today;
                    const isOverdue = d.delivery_date < today;
                    return (
                      <tr key={d.id} className={`border-t ${isOverdue ? 'bg-red-50' : colorStyle.bgClass}`}>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {formatDate(d.delivery_date)}
                          {isToday && <span className="ml-1 px-1.5 py-0.5 bg-green-500 text-white rounded text-xs font-bold">本日</span>}
                          {isOverdue && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded text-xs font-bold">遅延</span>}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span className={`px-1 py-0.5 rounded text-sm ${colorStyle.bgClass} ${colorStyle.textClass} mr-1`}>{d.color_label}</span>
                          {d.frame_size_name}（{d.size_label}）
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {d.quantity}個
                          {d.received_quantity != null && d.received_quantity > 0 && d.received_quantity < d.quantity && (
                            <span className="ml-1 text-xs text-orange-600 font-bold">({d.received_quantity}個済)</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <Link href={`/orders/${d.order_id}`} className="text-xs text-gray-400 hover:text-blue-600 hover:underline">
                            {d.order_number}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold">進行中の発注書</h2>
            <Link href="/orders">
              <span className="text-blue-600 hover:underline text-base">すべて見る</span>
            </Link>
          </div>
          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                発注書はありません
              </CardContent>
            </Card>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-2 font-semibold">発注日</th>
                    <th className="text-left px-4 py-2 font-semibold">発注番号</th>
                    <th className="text-center px-4 py-2 font-semibold">納品状況</th>
                    <th className="text-right px-4 py-2 font-semibold">合計</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.filter(o => o.status !== 'delivered').map(order => {
                    const st = ORDER_STATUS[order.status as keyof typeof ORDER_STATUS] || ORDER_STATUS.draft;
                    return (
                      <tr key={order.id} className="border-t">
                        <td className="px-4 py-2">{formatDate(order.order_date)}</td>
                        <td className="px-4 py-2">
                          <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline">
                            {order.order_number}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">{order.total_amount.toLocaleString()}円</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
