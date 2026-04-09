'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { COLOR_OPTIONS } from '@/lib/constants';
import type { Product } from '@/lib/types';
import { toast } from 'sonner';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showAddOther, setShowAddOther] = useState(false);
  const [newOther, setNewOther] = useState({ name: '', unit_price: 0, specs: '' });
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    const res = await fetch('/api/products?all=1');
    const data = await res.json();
    setProducts(data);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleSave = async () => {
    if (!editProduct) return;
    await fetch('/api/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editProduct),
    });
    toast.success('保存しました');
    setEditProduct(null);
    fetchProducts();
  };

  const handleAddOther = async () => {
    if (!newOther.name) { toast.warning('商品名を入力してください'); return; }
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOther),
    });
    toast.success('商品を追加しました');
    setShowAddOther(false);
    setNewOther({ name: '', unit_price: 0, specs: '' });
    fetchProducts();
  };

  const handleHideProduct = async (id: number, name: string) => {
    if (!confirm(`「${name}」を非表示にしますか？\n発注書や在庫登録に表示されなくなります。`)) return;
    await fetch('/api/products', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    toast.success('非表示にしました');
    fetchProducts();
  };

  const handleDeleteOther = async (id: number) => {
    await fetch('/api/products', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    toast.success('商品を削除しました');
    fetchProducts();
  };

  if (loading) return <div className="text-center py-12 text-lg">読み込み中...</div>;

  const frameProducts = products.filter(p => p.category === 'frame');
  const otherProducts = products.filter(p => p.category === 'other');

  const groupedByColor = COLOR_OPTIONS.map(color => ({
    ...color,
    products: frameProducts.filter(p => p.color_code === color.code),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">商品マスタ</h1>

      {/* Frame products by color */}
      {groupedByColor.map(group => (
        <div key={group.code} className="mb-8">
          <h2 className={`text-xl font-semibold mb-3 ${group.textClass}`}>{group.label}</h2>
          <div className={`rounded-lg border-2 ${group.borderClass} overflow-hidden`}>
            <table className="w-full">
              <thead>
                <tr className={group.headerBg}>
                  <th className="text-left px-4 py-3 font-semibold">サイズ</th>
                  <th className="text-left px-4 py-3 font-semibold">額サイズ</th>
                  <th className="text-right px-4 py-3 font-semibold">単価(税抜)</th>
                  <th className="text-left px-4 py-3 font-semibold">商品仕様</th>
                  <th className="text-center px-4 py-3 font-semibold">在庫下限値</th>
                  <th className="text-right px-4 py-3 font-semibold">補充数</th>
                  <th className="text-right px-4 py-3 font-semibold">入数/箱</th>
                  <th className="text-center px-4 py-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {group.products.map(product => (
                  <tr key={product.id} className={`border-t border-gray-200 hover:bg-gray-50 ${!product.is_active ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-3 font-medium">
                      {product.size_label}
                      {!product.is_active && <span className="ml-2 text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">非表示</span>}
                    </td>
                    <td className="px-4 py-3">{product.frame_size_name}</td>
                    <td className="px-4 py-3 text-right">{product.unit_price.toLocaleString()}円</td>
                    <td className="px-4 py-3 text-sm">{product.specs || '-'}</td>
                    <td className="px-4 py-3 text-center">{product.trigger_stock}個以下</td>
                    <td className="px-4 py-3 text-right font-medium">{product.order_quantity}個</td>
                    <td className="px-4 py-3 text-right">{product.pieces_per_box}</td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="outline" size="sm" className="text-base px-4 py-2"
                        onClick={() => setEditProduct({ ...product })}>編集</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Other products */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-semibold text-gray-700">その他</h2>
          <Button variant="outline" className="text-base h-10 px-4" onClick={() => setShowAddOther(true)}>
            + 商品を追加
          </Button>
        </div>
        <div className="rounded-lg border-2 border-gray-300 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left px-4 py-3 font-semibold">商品名</th>
                <th className="text-right px-4 py-3 font-semibold">単価(税抜)</th>
                <th className="text-left px-4 py-3 font-semibold">商品仕様</th>
                <th className="text-center px-4 py-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {otherProducts.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  その他の商品はまだ登録されていません
                </td></tr>
              ) : (
                otherProducts.map(product => (
                  <tr key={product.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{product.name}</td>
                    <td className="px-4 py-3 text-right">{product.unit_price.toLocaleString()}円</td>
                    <td className="px-4 py-3 text-sm">{product.specs || '-'}</td>
                    <td className="px-4 py-3 text-center space-x-2">
                      <Button variant="outline" size="sm" className="text-base"
                        onClick={() => setEditProduct({ ...product })}>編集</Button>
                      <Button variant="outline" size="sm" className="text-base text-red-600"
                        onClick={() => handleDeleteOther(product.id)}>削除</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editProduct} onOpenChange={() => setEditProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-xl">商品編集</DialogTitle></DialogHeader>
          {editProduct && (
            <div className="space-y-4">
              {editProduct.category === 'frame' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-base">サイズ</Label>
                    <Input className="text-base h-12 mt-1" value={editProduct.size_label}
                      onChange={e => setEditProduct({ ...editProduct, size_label: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-base">額サイズ</Label>
                    <Input className="text-base h-12 mt-1" value={editProduct.frame_size_name}
                      onChange={e => setEditProduct({ ...editProduct, frame_size_name: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-base">商品名</Label>
                  <Input className="text-base h-12 mt-1" value={editProduct.name}
                    onChange={e => setEditProduct({ ...editProduct, name: e.target.value })} />
                </div>
              )}
              <div>
                <Label className="text-base">単価(税抜)</Label>
                <Input type="number" className="text-base h-12 mt-1" value={editProduct.unit_price}
                  onChange={e => setEditProduct({ ...editProduct, unit_price: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-base">商品仕様</Label>
                <Input className="text-base h-12 mt-1" placeholder="例: 額:ガラス マット:オフホワイト"
                  value={editProduct.specs || ''}
                  onChange={e => setEditProduct({ ...editProduct, specs: e.target.value })} />
              </div>
              {editProduct.category === 'frame' ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-base">在庫下限値</Label>
                    <Input type="number" className="text-base h-12 mt-1" value={editProduct.trigger_stock}
                      onChange={e => setEditProduct({ ...editProduct, trigger_stock: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label className="text-base">補充数</Label>
                    <Input type="number" className="text-base h-12 mt-1" value={editProduct.order_quantity}
                      onChange={e => setEditProduct({ ...editProduct, order_quantity: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label className="text-base">入数/箱</Label>
                    <Input type="number" className="text-base h-12 mt-1" value={editProduct.pieces_per_box}
                      onChange={e => setEditProduct({ ...editProduct, pieces_per_box: parseInt(e.target.value) || 1 })} />
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-base">入数/箱</Label>
                  <Input type="number" className="text-base h-12 mt-1" value={editProduct.pieces_per_box}
                    onChange={e => setEditProduct({ ...editProduct, pieces_per_box: parseInt(e.target.value) || 1 })} />
                </div>
              )}
            </div>
          )}
          {editProduct && (
            <div className="border-t pt-3 mt-2">
              {editProduct.is_active ? (
                <Button variant="outline" size="sm" className="text-sm text-gray-400 hover:text-red-500"
                  onClick={() => { handleHideProduct(editProduct.id, editProduct.size_label || editProduct.name); setEditProduct(null); }}>
                  この商品を非表示にする
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="text-sm text-blue-600"
                  onClick={async () => {
                    await fetch('/api/products', {
                      method: 'PUT', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...editProduct, is_active: 1 }),
                    });
                    toast.success('再表示しました');
                    setEditProduct(null);
                    fetchProducts();
                  }}>
                  この商品を再表示する
                </Button>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="text-base h-12 px-6" onClick={() => setEditProduct(null)}>キャンセル</Button>
            <Button className="text-base h-12 px-6" onClick={handleSave}>保存する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add other product dialog */}
      <Dialog open={showAddOther} onOpenChange={setShowAddOther}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-xl">その他の商品を追加</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-base">商品名</Label>
              <Input className="text-base h-12 mt-1" placeholder="例: ガラス(インチ)"
                value={newOther.name} onChange={e => setNewOther({ ...newOther, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-base">単価(税抜)</Label>
              <Input type="number" className="text-base h-12 mt-1" value={newOther.unit_price}
                onChange={e => setNewOther({ ...newOther, unit_price: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-base">商品仕様</Label>
              <Input className="text-base h-12 mt-1" value={newOther.specs}
                onChange={e => setNewOther({ ...newOther, specs: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="text-base h-12 px-6" onClick={() => setShowAddOther(false)}>キャンセル</Button>
            <Button className="text-base h-12 px-6" onClick={handleAddOther}>追加する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
