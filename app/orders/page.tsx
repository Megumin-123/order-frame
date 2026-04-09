'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ORDER_STATUS } from '@/lib/constants';
import type { Order } from '@/lib/types';
import { toast } from 'sonner';

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Order | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Order | null>(null);

  const fetchOrders = () => {
    fetch('/api/orders').then(r => r.json()).then(data => {
      setOrders(data);
      setLoading(false);
    });
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleAutoCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoFromStock: true }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(`発注書 ${result.orderNumber} を作成しました`);
        router.push(`/orders/${result.orderId}`);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('エラーが発生しました');
    }
    setCreating(false);
  };

  const handleDelete = async (order: Order) => {
    await fetch(`/api/orders/${order.id}`, { method: 'DELETE' });
    toast.success('発注書を削除しました');
    setConfirmDelete(null);
    fetchOrders();
  };

  const handleCancelOrder = async (order: Order) => {
    await fetch(`/api/orders/${order.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'draft' }),
    });
    toast.success('発注確定を取り消しました（下書きに戻しました）');
    setConfirmCancel(null);
    fetchOrders();
  };

  if (loading) return <div className="text-center py-12 text-lg">読み込み中...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">発注書一覧</h1>
        <Button className="text-base h-12 px-6" onClick={handleAutoCreate} disabled={creating}>
          {creating ? '作成中...' : '現在庫から発注書を作成'}
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <p className="text-lg text-gray-500">発注書はまだありません</p>
          <p className="text-gray-400 mt-2">在庫登録後、「現在庫から発注書を作成」で自動作成できます</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold">発注番号</th>
                <th className="text-left px-4 py-3 font-semibold">発注日</th>
                <th className="text-center px-4 py-3 font-semibold">ステータス</th>
                <th className="text-right px-4 py-3 font-semibold">税込合計</th>
                <th className="text-center px-4 py-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const status = ORDER_STATUS[order.status as keyof typeof ORDER_STATUS] || ORDER_STATUS.draft;
                return (
                  <tr key={order.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{order.order_date}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {order.total_amount.toLocaleString()}円
                    </td>
                    <td className="px-4 py-3 text-center space-x-2">
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="outline" size="sm" className="text-base">
                          {order.status === 'draft' ? '編集' : '詳細'}
                        </Button>
                      </Link>
                      {order.status === 'submitted' && (
                        <Button variant="outline" size="sm" className="text-base text-orange-600"
                          onClick={() => setConfirmCancel(order)}>
                          確定取消
                        </Button>
                      )}
                      {(order.status === 'draft' || order.status === 'submitted') && (
                        <Button variant="outline" size="sm" className="text-base text-red-600"
                          onClick={() => setConfirmDelete(order)}>
                          削除
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">発注書を削除しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-base">
            発注書 <strong>{confirmDelete?.order_number}</strong> を削除します。この操作は取り消せません。
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="text-base h-12 px-6" onClick={() => setConfirmDelete(null)}>
              いいえ
            </Button>
            <Button className="text-base h-12 px-6 bg-red-600 hover:bg-red-700"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}>
              はい、削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <Dialog open={!!confirmCancel} onOpenChange={() => setConfirmCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">発注確定を取り消しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-base">
            発注書 <strong>{confirmCancel?.order_number}</strong> を下書きに戻します。
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="text-base h-12 px-6" onClick={() => setConfirmCancel(null)}>
              いいえ
            </Button>
            <Button className="text-base h-12 px-6 bg-orange-600 hover:bg-orange-700"
              onClick={() => confirmCancel && handleCancelOrder(confirmCancel)}>
              はい、取り消す
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
