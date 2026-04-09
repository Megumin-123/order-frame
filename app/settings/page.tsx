'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [deliveryLeadDays, setDeliveryLeadDays] = useState('21');
  const [mdbPath, setMdbPath] = useState('C:\\Users\\smili\\Documents\\system\\sysdata.mdb');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data.delivery_lead_days) setDeliveryLeadDays(data.delivery_lead_days);
      if (data.mdb_path) setMdbPath(data.mdb_path);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_lead_days: deliveryLeadDays, mdb_path: mdbPath }),
    });
    toast.success('設定を保存しました');
    setSaving(false);
  };

  const handleTestLine = async () => {
    setTestSending(true);
    try {
      const res = await fetch('/api/line/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: -1, testMessage: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('テストメッセージを送信しました');
      } else {
        toast.error(data.error || 'LINE送信に失敗しました');
      }
    } catch {
      toast.error('通信エラーが発生しました');
    }
    setTestSending(false);
  };

  if (loading) return <div className="text-center py-12 text-lg">読み込み中...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">設定</h1>

      <div className="bg-white rounded-lg border p-6 max-w-lg mb-6">
        <h2 className="text-lg font-semibold mb-4">発注設定</h2>

        <div className="space-y-4">
          <div>
            <Label className="text-base">発注日から納品までの日数</Label>
            <p className="text-sm text-gray-500 mb-2">
              発注書作成時に、この日数を元に納品希望日が自動設定されます
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className="w-24 h-12 text-center text-base"
                value={deliveryLeadDays}
                onChange={e => setDeliveryLeadDays(e.target.value)}
              />
              <span className="text-base">日後</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Label className="text-base">受注データベースのパス（MDBファイル）</Label>
          <p className="text-sm text-gray-500 mb-2">
            注文実績の計算に使用します（ローカルのみ動作）
          </p>
          <Input
            className="text-base h-12"
            value={mdbPath}
            onChange={e => setMdbPath(e.target.value)}
            placeholder="C:\Users\...\sysdata.mdb"
          />
        </div>

        <div className="mt-6">
          <Button className="text-base h-12 px-8" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存する'}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6 max-w-lg">
        <h2 className="text-lg font-semibold mb-4">LINE連携</h2>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">
              発注書の承認依頼をLINEで送信する機能です。
            </p>
            <p className="text-sm text-gray-500 mb-1">設定手順:</p>
            <ol className="text-sm text-gray-500 list-decimal ml-5 space-y-1 mb-4">
              <li>LINE Developersでチャネルを作成</li>
              <li>Messaging APIのチャネルアクセストークンを取得</li>
              <li><code className="bg-gray-100 px-1 rounded">.env.local</code> に以下を設定:
                <div className="bg-gray-50 p-2 rounded mt-1 text-xs">
                  LINE_CHANNEL_ACCESS_TOKEN=取得したトークン<br/>
                  LINE_TARGET_GROUP_ID=送信先グループID
                </div>
              </li>
              <li>サーバーを再起動</li>
            </ol>
          </div>

          <div>
            <Button variant="outline" className="text-base h-10 px-6"
              onClick={handleTestLine} disabled={testSending}>
              {testSending ? '送信中...' : 'テストメッセージを送信'}
            </Button>
            <p className="text-xs text-gray-400 mt-2">
              設定が正しいか確認するためのテスト送信です
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
