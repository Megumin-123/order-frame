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
  const [showSummary, setShowSummary] = useState(false);
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const [summaryMonth, setSummaryMonth] = useState(new Date().getMonth() + 1);
  const [summaryData, setSummaryData] = useState<{
    dates: string[]; matrix: Record<string, Record<string, Record<string, number>>>;
    sizeOrder: string[]; sizeLabels: Record<string, string>; colorOrder: string[];
  } | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [editDateText, setEditDateText] = useState('');
  const [editReceiveId, setEditReceiveId] = useState<number | null>(null);
  const [editReceiveQty, setEditReceiveQty] = useState(0);

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

  const handleStartReceive = (id: number, qty: number) => {
    setEditReceiveId(id);
    setEditReceiveQty(qty); // デフォルトは予定数
  };

  const handleConfirmReceive = async () => {
    if (editReceiveId === null) return;
    const delivery = deliveries.find(d => d.id === editReceiveId);
    if (!delivery) return;

    if (editReceiveQty === 0) {
      // 0の場合は未納品に戻す
      await fetch(`/api/deliveries/${editReceiveId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReceived: false, receivedQuantity: null }),
      });
      toast.success('納品登録を取り消しました');
      setDeliveries(prev => prev.map(d =>
        d.id === editReceiveId ? { ...d, is_received: 0, received_at: null, received_quantity: null } : d
      ));
    } else {
      const isFullReceive = editReceiveQty >= delivery.quantity;
      await fetch(`/api/deliveries/${editReceiveId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isReceived: isFullReceive, receivedAt: todayStr(),
          receivedQuantity: editReceiveQty,
        }),
      });
      toast.success(isFullReceive ? '納品を登録しました' : `${editReceiveQty}個を納品登録しました（残${delivery.quantity - editReceiveQty}個）`);
      setDeliveries(prev => prev.map(d =>
        d.id === editReceiveId ? {
          ...d,
          is_received: isFullReceive ? 1 : 0,
          received_at: todayStr(),
          received_quantity: editReceiveQty,
        } : d
      ));
    }
    setEditReceiveId(null);
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

  const handleLoadSummary = async () => {
    setLoadingSummary(true);
    const res = await fetch(`/api/deliveries/summary?year=${summaryYear}&month=${summaryMonth}`);
    const data = await res.json();
    setSummaryData(data);
    setShowSummary(true);
    setLoadingSummary(false);
  };

  const handleExportSummary = () => {
    window.open(`/api/deliveries/summary/export?year=${summaryYear}&month=${summaryMonth}`, '_blank');
  };

  const handlePrintSummary = () => {
    if (!summaryData) return;
    const weekdays = ['日','月','火','水','木','金','土'];
    const colorLabels: Record<string, string> = { YELLOW_OAK: '黄オーク', BROWN: 'ブラウン', WHITE: 'ホワイト' };
    const colorBgs: Record<string, string> = { YELLOW_OAK: '#fef3c7', BROWN: '#dbc8a8', WHITE: '#e0f2fe' };

    let dateHeaders = '';
    let colorHeaders = '<td style="border:1px solid #999;padding:4px;font-weight:bold">種類</td>';
    summaryData.dates.forEach(date => {
      const parts = date.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      dateHeaders += `<td colspan="3" style="border:1px solid #999;padding:4px;text-align:center;font-weight:bold">${parseInt(parts[1])}/${parseInt(parts[2])}(${weekdays[d.getDay()]})</td>`;
      summaryData.colorOrder.forEach(color => {
        colorHeaders += `<td style="border:1px solid #999;padding:3px;text-align:center;font-size:10px;font-weight:bold;background:${colorBgs[color]}">${colorLabels[color]}</td>`;
      });
    });
    dateHeaders += `<td colspan="3" style="border:1px solid #999;padding:4px;text-align:center;font-weight:bold">${summaryMonth}月合計</td>`;
    summaryData.colorOrder.forEach(color => {
      colorHeaders += `<td style="border:1px solid #999;padding:3px;text-align:center;font-size:10px;font-weight:bold;background:${colorBgs[color]}">${colorLabels[color]}</td>`;
    });

    let bodyRows = '';
    summaryData.sizeOrder.forEach(size => {
      let cells = `<td style="border:1px solid #999;padding:4px;font-weight:bold">${summaryData.sizeLabels[size]}</td>`;
      summaryData.dates.forEach(date => {
        summaryData.colorOrder.forEach(color => {
          const v = summaryData.matrix[size]?.[color]?.[date] || 0;
          cells += `<td style="border:1px solid #999;padding:3px;text-align:center">${v || ''}</td>`;
        });
      });
      summaryData.colorOrder.forEach(color => {
        const total = summaryData.dates.reduce((s, date) => s + (summaryData.matrix[size]?.[color]?.[date] || 0), 0);
        cells += `<td style="border:1px solid #999;padding:3px;text-align:center;background:#f5f5f5;font-weight:bold">${total || ''}</td>`;
      });
      bodyRows += `<tr>${cells}</tr>`;
    });

    // Total row
    let totalCells = '<td style="border:1px solid #999;padding:4px;font-weight:bold;background:#e8e8e8">合計</td>';
    summaryData.dates.forEach(date => {
      summaryData.colorOrder.forEach(color => {
        const total = summaryData.sizeOrder.reduce((s, size) => s + (summaryData.matrix[size]?.[color]?.[date] || 0), 0);
        totalCells += `<td style="border:1px solid #999;padding:3px;text-align:center;background:#e8e8e8;font-weight:bold">${total || ''}</td>`;
      });
    });
    summaryData.colorOrder.forEach(color => {
      const gt = summaryData.sizeOrder.reduce((s, size) => s + summaryData.dates.reduce((s2, date) => s2 + (summaryData.matrix[size]?.[color]?.[date] || 0), 0), 0);
      totalCells += `<td style="border:1px solid #999;padding:3px;text-align:center;background:#e8e8e8;font-weight:bold">${gt || ''}</td>`;
    });

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>納品早見表</title>
<style>body{font-family:'MS Gothic',sans-serif;margin:20px;font-size:12px}table{border-collapse:collapse}
@media print{@page{size:landscape}body{margin:5mm}}</style></head>
<body><h2 style="text-align:center">納品日別納品早見表 ${summaryYear}年${summaryMonth}月</h2>
<table><thead><tr><td style="border:1px solid #999;padding:4px;font-weight:bold">納品日</td>${dateHeaders}</tr>
<tr>${colorHeaders}</tr></thead><tbody>${bodyRows}<tr>${totalCells}</tr></tbody></table>
<script>window.print();</script></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

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
        <div className="flex gap-2">
          <Button className="text-base h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white" onClick={handlePrintList}>
            納品一覧表
          </Button>
          <div className="flex items-center gap-1">
            <select className="h-10 px-2 border rounded text-base" value={`${summaryYear}-${summaryMonth}`}
              onChange={e => { const [y, m] = e.target.value.split('-'); setSummaryYear(parseInt(y)); setSummaryMonth(parseInt(m)); }}>
              {Array.from({ length: 12 }, (_, i) => {
                const d = new Date(); d.setMonth(d.getMonth() - 3 + i);
                const y = d.getFullYear(); const m = d.getMonth() + 1;
                return <option key={`${y}-${m}`} value={`${y}-${m}`}>{y}年{m}月</option>;
              })}
            </select>
            <Button className="text-base h-10 px-4 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleLoadSummary} disabled={loadingSummary}>
              {loadingSummary ? '読込中...' : '納品早見表'}
            </Button>
          </div>
        </div>
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

      {/* 早見表 */}
      {showSummary && summaryData && (
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold">納品早見表 {summaryYear}年{summaryMonth}月</h2>
            <div className="flex gap-2">
              <Button variant="outline" className="text-sm h-9 px-4" onClick={handlePrintSummary}>印刷</Button>
              <Button variant="outline" className="text-sm h-9 px-4" onClick={handleExportSummary}>Excel</Button>
              <Button variant="ghost" className="text-sm h-9 px-3 text-gray-400" onClick={() => setShowSummary(false)}>閉じる</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-left whitespace-nowrap">納品日</th>
                  {summaryData.dates.map(date => {
                    const parts = date.split('-');
                    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    return (
                      <th key={date} colSpan={3} className="border border-gray-300 px-2 py-1 bg-gray-100 text-center whitespace-nowrap">
                        {parseInt(parts[1])}/{parseInt(parts[2])}({WEEKDAYS[d.getDay()]})
                      </th>
                    );
                  })}
                  <th colSpan={3} className="border border-gray-300 px-2 py-1 bg-gray-200 text-center whitespace-nowrap font-bold">{summaryMonth}月合計</th>
                </tr>
                <tr>
                  <th className="border border-gray-300 px-2 py-1 bg-gray-100">種類</th>
                  {[...summaryData.dates, 'total'].map((_, di) =>
                    summaryData!.colorOrder.map(color => {
                      const labels: Record<string, string> = { YELLOW_OAK: '黄ｵｰｸ', BROWN: 'ﾌﾞﾗｳﾝ', WHITE: 'ﾎﾜｲﾄ' };
                      const bgs: Record<string, string> = { YELLOW_OAK: 'bg-amber-100', BROWN: 'bg-brown-light', WHITE: 'bg-blue-50' };
                      return <th key={`${di}-${color}`} className={`border border-gray-300 px-1 py-1 text-center text-xs ${bgs[color]}`}>{labels[color]}</th>;
                    })
                  )}
                </tr>
              </thead>
              <tbody>
                {summaryData.sizeOrder.map(size => (
                  <tr key={size}>
                    <td className="border border-gray-300 px-2 py-1 font-medium whitespace-nowrap">{summaryData!.sizeLabels[size]}</td>
                    {summaryData!.dates.map(date =>
                      summaryData!.colorOrder.map(color => {
                        const v = summaryData!.matrix[size]?.[color]?.[date] || 0;
                        return <td key={`${date}-${color}`} className="border border-gray-300 px-2 py-1 text-center">{v || ''}</td>;
                      })
                    )}
                    {summaryData!.colorOrder.map(color => {
                      const total = summaryData!.dates.reduce((s, date) => s + (summaryData!.matrix[size]?.[color]?.[date] || 0), 0);
                      return <td key={`total-${color}`} className="border border-gray-300 px-2 py-1 text-center bg-gray-50 font-bold">{total || ''}</td>;
                    })}
                  </tr>
                ))}
                <tr className="bg-gray-100">
                  <td className="border border-gray-300 px-2 py-1 font-bold">合計</td>
                  {summaryData.dates.map(date =>
                    summaryData!.colorOrder.map(color => {
                      const total = summaryData!.sizeOrder.reduce((s, size) => s + (summaryData!.matrix[size]?.[color]?.[date] || 0), 0);
                      return <td key={`${date}-${color}-total`} className="border border-gray-300 px-2 py-1 text-center font-bold">{total || ''}</td>;
                    })
                  )}
                  {summaryData.colorOrder.map(color => {
                    const gt = summaryData!.sizeOrder.reduce((s, size) => s + summaryData!.dates.reduce((s2, date) => s2 + (summaryData!.matrix[size]?.[color]?.[date] || 0), 0), 0);
                    return <td key={`gt-${color}`} className="border border-gray-300 px-2 py-1 text-center font-bold bg-gray-200">{gt || ''}</td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                <h2 className="text-xl font-semibold">
                  {formatDateWithDay(date)}
                  {date === todayStr() && receivedCount < items.length && <span className="ml-2 px-2 py-0.5 bg-green-500 text-white rounded text-xs font-bold">本日</span>}
                  {date < todayStr() && receivedCount < items.length && <span className="ml-2 px-2 py-0.5 bg-red-500 text-white rounded text-xs font-bold">遅延</span>}
                </h2>
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
                      <th className="text-right px-4 py-2 font-semibold whitespace-nowrap">納品数</th>
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
                            {editReceiveId === item.id ? (
                              <div className="flex flex-col gap-1 items-center">
                                <div className="flex items-center gap-1">
                                  <Input type="number" className="w-16 h-8 text-sm text-center" value={editReceiveQty}
                                    onChange={e => setEditReceiveQty(parseInt(e.target.value) || 0)} />
                                  <Button size="sm" className="text-xs h-8 px-2" onClick={handleConfirmReceive}>確定</Button>
                                </div>
                                <Button variant="ghost" size="sm" className="text-xs h-6 text-gray-400"
                                  onClick={() => setEditReceiveId(null)}>キャンセル</Button>
                              </div>
                            ) : (
                              <Button size="sm" className="text-sm h-8"
                                onClick={() => handleStartReceive(item.id, item.received_quantity ?? item.quantity)}>納品登録</Button>
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
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            {item.received_quantity != null ? (
                              <span className={item.received_quantity < item.quantity ? 'text-red-600 font-bold' : 'font-medium'}>
                                {item.received_quantity}個
                                {item.received_quantity < item.quantity && <span className="text-xs ml-1">（残{item.quantity - item.received_quantity}）</span>}
                              </span>
                            ) : <span className="text-gray-300">-</span>}
                          </td>
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
