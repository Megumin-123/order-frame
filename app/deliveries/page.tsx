'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { COLOR_OPTIONS } from '@/lib/constants';
import type { DeliveryScheduleWithProduct } from '@/lib/types';
import { toast } from 'sonner';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
function formatDateWithDay(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return `${dateStr} (${WEEKDAYS[d.getDay()]})`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const parts = dateStr.split(/[-T]/);
  if (parts.length < 3) return dateStr;
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<DeliveryScheduleWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [editMemoId, setEditMemoId] = useState<number | null>(null);
  const [editMemoText, setEditMemoText] = useState('');
  const [editDateId, setEditDateId] = useState<number | null>(null);
  const [editDateText, setEditDateText] = useState('');

  const fetchDeliveries = async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (filterColor) params.set('colorCode', filterColor);
    if (filterStatus) params.set('status', filterStatus);
    params.set('confirmedOnly', '1');
    const res = await fetch(`/api/deliveries?${params}`);
    setDeliveries(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchDeliveries(); }, [dateFrom, dateTo, filterColor, filterStatus]);

  const handleReceive = async (id: number) => {
    await fetch(`/api/deliveries/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isReceived: true, receivedAt: todayStr() }),
    });
    toast.success('納品を登録しました');
    // 画面に残すためリロードせず、ローカルのデータだけ更新
    setDeliveries(prev => prev.map(d =>
      d.id === id ? { ...d, is_received: 1, received_at: todayStr() } : d
    ));
  };

  const handleUnreceive = async (id: number) => {
    await fetch(`/api/deliveries/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isReceived: false }),
    });
    toast.success('納品登録を取り消しました');
    setDeliveries(prev => prev.map(d =>
      d.id === id ? { ...d, is_received: 0, received_at: null } : d
    ));
  };

  const handleSaveMemo = async (id: number) => {
    await fetch(`/api/deliveries/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memo: editMemoText }),
    });
    toast.success('備考を保存しました');
    setEditMemoId(null);
    fetchDeliveries();
  };

  const handleSaveReceivedDate = async (id: number) => {
    await fetch(`/api/deliveries/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receivedAt: editDateText }),
    });
    toast.success('納品日を変更しました');
    setEditDateId(null);
    fetchDeliveries();
  };

  const getColorStyle = (code: string) => COLOR_OPTIONS.find(c => c.code === code) || COLOR_OPTIONS[0];

  const handlePrintList = () => {
    const today = new Date().toLocaleDateString('ja-JP');
    const rows = deliveries.map(d => {
      const dd = d.delivery_date || '';
      const parts = dd.split('-');
      let dateWithDay = dd;
      if (parts.length === 3) {
        const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        dateWithDay = `${dd} (${WEEKDAYS[dt.getDay()]})`;
      }
      return `<tr>
        <td style="border:1px solid #999;padding:6px;white-space:nowrap">${dateWithDay}</td>
        <td style="border:1px solid #999;padding:6px">${d.color_label}</td>
        <td style="border:1px solid #999;padding:6px">${d.frame_size_name}（${d.size_label}）</td>
        <td style="border:1px solid #999;padding:6px;text-align:right">${d.quantity}個</td>
        <td style="border:1px solid #999;padding:6px;text-align:center">${d.is_received ? '済' : '未'}</td>
        <td style="border:1px solid #999;padding:6px">${d.memo || ''}</td>
        <td style="border:1px solid #999;padding:6px;font-size:11px;color:#888">${d.order_number}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>納品一覧表</title>
<style>body{font-family:'MS Gothic',sans-serif;margin:30px;font-size:13px}table{border-collapse:collapse;width:100%}
@media print{@page{size:landscape}body{margin:10mm}}</style></head>
<body><h2 style="text-align:center">納品一覧表</h2>
<p style="text-align:right">印刷日: ${today}</p>
<table><thead><tr style="background:#f0f0f0">
<th style="border:1px solid #999;padding:6px;text-align:left">納品予定日</th>
<th style="border:1px solid #999;padding:6px;text-align:left">色</th>
<th style="border:1px solid #999;padding:6px;text-align:left">商品名</th>
<th style="border:1px solid #999;padding:6px;text-align:right">予定数</th>
<th style="border:1px solid #999;padding:6px;text-align:center">状態</th>
<th style="border:1px solid #999;padding:6px;text-align:left">備考</th>
<th style="border:1px solid #999;padding:6px;text-align:left">発注番号</th>
</tr></thead><tbody>${rows}</tbody></table>
<script>window.print();</script></body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const groupedByDate = new Map<string, DeliveryScheduleWithProduct[]>();
  deliveries.forEach(d => { const list = groupedByDate.get(d.delivery_date) || []; list.push(d); groupedByDate.set(d.delivery_date, list); });
  const sortedDates = Array.from(groupedByDate.keys()).sort();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">納品一覧</h1>
        <Button className="text-base h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white" onClick={handlePrintList}>
          納品一覧表
        </Button>
      </div>

      <div className="bg-white rounded-lg border p-4 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">開始日</label>
          <Input type="date" className="w-44 h-10" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">終了日</label>
          <Input type="date" className="w-44 h-10" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">色</label>
          <select className="h-10 px-3 border rounded-md text-base" value={filterColor}
            onChange={e => setFilterColor(e.target.value)}>
            <option value="">すべて</option>
            {COLOR_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">状態</label>
          <select className="h-10 px-3 border rounded-md text-base" value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}>
            <option value="">すべて</option>
            <option value="pending">未納品</option>
            <option value="received">納品済み</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-lg">読み込み中...</div>
      ) : deliveries.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <p className="text-lg text-gray-500">納品予定はありません</p>
        </div>
      ) : (
        sortedDates.map(date => {
          const items = groupedByDate.get(date)!;
          const totalQty = items.reduce((s, i) => s + i.quantity, 0);
          const receivedCount = items.filter(i => i.is_received).length;
          return (
            <div key={date} className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-semibold">{formatDateWithDay(date)}</h2>
                <span className="text-gray-500">{items.length}商品 / {totalQty}個</span>
                {receivedCount === items.length ? (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">全て納品済み</span>
                ) : receivedCount > 0 ? (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">{receivedCount}/{items.length} 納品済み</span>
                ) : null}
              </div>
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">納品登録</th>
                      <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">納品日</th>
                      <th className="text-left px-4 py-2 font-semibold whitespace-nowrap">色</th>
                      <th className="text-left px-4 py-2 font-semibold whitespace-nowrap">商品名</th>
                      <th className="text-right px-4 py-2 font-semibold whitespace-nowrap">予定数</th>
                      <th className="text-left px-4 py-2 font-semibold whitespace-nowrap" style={{width:'40%'}}>備考</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-400 font-normal whitespace-nowrap">発注番号</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const colorStyle = getColorStyle(item.color_code);
                      const isEditingMemo = editMemoId === item.id;
                      const isEditingDate = editDateId === item.id;
                      const receivedDate = item.received_at ? item.received_at.split('T')[0] : null;
                      return (
                        <tr key={item.id}
                          className={`border-t hover:bg-gray-50/50 ${colorStyle.bgClass}`}
                          style={item.is_received ? { borderLeft: '4px solid #22c55e' } : {}}>
                          <td className="px-3 py-2 text-center">
                            {item.is_received ? (
                              <Button variant="outline" size="sm" className="text-xs h-8"
                                onClick={() => handleUnreceive(item.id)}>取消</Button>
                            ) : (
                              <Button size="sm" className="text-sm h-8"
                                onClick={() => handleReceive(item.id)}>納品登録</Button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            {item.is_received ? (
                              isEditingDate ? (
                                <div className="flex items-center gap-1">
                                  <Input type="date" className="w-32 h-8 text-xs" value={editDateText}
                                    onChange={e => setEditDateText(e.target.value)} />
                                  <Button size="sm" className="text-xs h-7 px-1.5 shrink-0"
                                    onClick={() => handleSaveReceivedDate(item.id)}>保存</Button>
                                </div>
                              ) : (
                                <span className="text-sm font-medium text-green-700 cursor-pointer hover:underline"
                                  onClick={() => { setEditDateId(item.id); setEditDateText(receivedDate || todayStr()); }}>
                                  {formatShortDate(receivedDate)}
                                </span>
                              )
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-sm ${colorStyle.bgClass} ${colorStyle.textClass}`}>
                              {item.color_label}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-medium whitespace-nowrap">{item.frame_size_name}（{item.size_label}）</td>
                          <td className="px-4 py-2 text-right font-medium whitespace-nowrap">{item.quantity}個</td>
                          <td className="px-4 py-2">
                            {isEditingMemo ? (
                              <div className="flex items-center gap-1">
                                <Input className="flex-1 h-8 text-sm" placeholder="備考を入力"
                                  value={editMemoText} onChange={e => setEditMemoText(e.target.value)} />
                                <Button size="sm" className="text-xs h-8 px-2 shrink-0"
                                  onClick={() => handleSaveMemo(item.id)}>保存</Button>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-600 cursor-pointer hover:text-blue-600"
                                onClick={() => { setEditMemoId(item.id); setEditMemoText(item.memo || ''); }}>
                                {item.memo || <span className="text-gray-300">クリックで入力</span>}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap">
                            <Link href={`/orders/${item.order_id}`} className="text-gray-400 hover:text-blue-600 hover:underline">
                              {item.order_number}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
