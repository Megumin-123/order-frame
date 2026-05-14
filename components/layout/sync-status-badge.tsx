'use client';

import { useEffect, useState } from 'react';

// サイドバー下部に表示する「受注データ最終同期」バッジ。
// 山本さんPC の sync-order-stats.ts が UPSERT した最後の成功時刻を表示し、
// 古くなりすぎたら警告色で目立たせる。
//
// 5分間隔で自動再取得 (画面を開きっぱなしでも更新される)。
export function SyncStatusBadge() {
  const [info, setInfo] = useState<{ lastSyncAt: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/sync-status', { cache: 'no-store' });
        if (!cancelled && res.ok) setInfo(await res.json());
      } catch {
        /* ネットワーク不調等は無視 (古い値を表示し続ける) */
      }
    };
    fetchStatus();
    const t = setInterval(fetchStatus, 5 * 60 * 1000); // 5分ごとに再取得
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!info) {
    return <p className="text-center text-xs text-gray-400">同期状況: 取得中...</p>;
  }
  if (!info.lastSyncAt) {
    return <p className="text-center text-xs text-gray-500">同期記録なし</p>;
  }

  const lastSync = new Date(info.lastSyncAt);
  const ageDays = (Date.now() - lastSync.getTime()) / (24 * 3600 * 1000);
  const ymd = formatDate(lastSync);

  // 色分け: 7日未満=緑(最新)、7-14日=黄(警告)、14日以上=赤(危険)
  let colorClass: string;
  let ageLabel: string;
  if (ageDays < 1) {
    colorClass = 'text-green-700 bg-green-50 border-green-200';
    ageLabel = '今日';
  } else if (ageDays < 7) {
    colorClass = 'text-green-700 bg-green-50 border-green-200';
    ageLabel = `${Math.floor(ageDays)}日前`;
  } else if (ageDays < 14) {
    colorClass = 'text-yellow-800 bg-yellow-50 border-yellow-300';
    ageLabel = `${Math.floor(ageDays)}日前`;
  } else {
    colorClass = 'text-red-800 bg-red-50 border-red-300';
    ageLabel = `${Math.floor(ageDays)}日前 ⚠`;
  }

  return (
    <div className={`text-center text-xs px-2 py-2 rounded border ${colorClass}`}>
      <div className="text-[11px] opacity-75">受注データ最終同期</div>
      <div className="font-bold mt-0.5">{ymd}</div>
      <div className="text-[11px]">{ageLabel}</div>
    </div>
  );
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
