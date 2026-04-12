'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [deliveryLeadDays, setDeliveryLeadDays] = useState('21');
  const [safetyStockDays, setSafetyStockDays] = useState('28');
  const [targetStockDays, setTargetStockDays] = useState('35');
  const [weeklyLimit, setWeeklyLimit] = useState('150');
  const [mdbPath, setMdbPath] = useState('C:\\Users\\smili\\Documents\\system\\sysdata.mdb');
  const [smtpHost, setSmtpHost] = useState('smtp.happy-vision.co.jp');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('com@happy-vision.co.jp');
  const [smtpPass, setSmtpPass] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('額の発注 ハッピービジョン');
  const [emailSignature, setEmailSignature] = useState('有限会社ハッピービジョン\nTEL.0875-73-3281 FAX.0875-73-3282');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data.delivery_lead_days) setDeliveryLeadDays(data.delivery_lead_days);
      if (data.safety_stock_days) setSafetyStockDays(data.safety_stock_days);
      if (data.target_stock_days) setTargetStockDays(data.target_stock_days);
      if (data.weekly_limit) setWeeklyLimit(data.weekly_limit);
      if (data.mdb_path) setMdbPath(data.mdb_path);
      if (data.smtp_host) setSmtpHost(data.smtp_host);
      if (data.smtp_port) setSmtpPort(data.smtp_port);
      if (data.smtp_user) setSmtpUser(data.smtp_user);
      if (data.smtp_pass) setSmtpPass(data.smtp_pass);
      if (data.email_to) setEmailTo(data.email_to);
      if (data.email_subject) setEmailSubject(data.email_subject);
      if (data.email_signature) setEmailSignature(data.email_signature);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delivery_lead_days: deliveryLeadDays,
        safety_stock_days: safetyStockDays, target_stock_days: targetStockDays,
        weekly_limit: weeklyLimit, mdb_path: mdbPath,
        smtp_host: smtpHost, smtp_port: smtpPort, smtp_user: smtpUser, smtp_pass: smtpPass,
        email_to: emailTo, email_subject: emailSubject, email_signature: emailSignature,
      }),
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
          <Label className="text-base font-semibold">自動提案パラメータ</Label>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div>
              <Label className="text-sm">安全在庫日数</Label>
              <div className="flex items-center gap-1">
                <Input type="number" className="w-20 h-10 text-center" value={safetyStockDays}
                  onChange={e => setSafetyStockDays(e.target.value)} />
                <span className="text-sm">日</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">この日数以下で発注推奨</p>
            </div>
            <div>
              <Label className="text-sm">目標在庫日数</Label>
              <div className="flex items-center gap-1">
                <Input type="number" className="w-20 h-10 text-center" value={targetStockDays}
                  onChange={e => setTargetStockDays(e.target.value)} />
                <span className="text-sm">日</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">この日数分を確保するよう発注</p>
            </div>
            <div>
              <Label className="text-sm">週間上限</Label>
              <div className="flex items-center gap-1">
                <Input type="number" className="w-20 h-10 text-center" value={weeklyLimit}
                  onChange={e => setWeeklyLimit(e.target.value)} />
                <span className="text-sm">個</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">週あたりの納品上限</p>
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

      <div className="bg-white rounded-lg border p-6 max-w-lg mb-6">
        <h2 className="text-lg font-semibold mb-4">メール送信設定</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-base">SMTPサーバー</Label>
              <Input className="text-base h-10 mt-1" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} />
            </div>
            <div>
              <Label className="text-base">ポート</Label>
              <Input className="text-base h-10 mt-1" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-base">送信元メールアドレス</Label>
              <Input className="text-base h-10 mt-1" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} />
            </div>
            <div>
              <Label className="text-base">パスワード</Label>
              <Input type="password" className="text-base h-10 mt-1" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-base">送信先メールアドレス</Label>
            <Input className="text-base h-10 mt-1" value={emailTo} onChange={e => setEmailTo(e.target.value)}
              placeholder="例: order@example.com" />
          </div>
          <div>
            <Label className="text-base">メール件名</Label>
            <Input className="text-base h-10 mt-1" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
          </div>
          <div>
            <Label className="text-base">メール署名</Label>
            <textarea className="w-full mt-1 p-3 border rounded-md text-base h-24 resize-y"
              value={emailSignature} onChange={e => setEmailSignature(e.target.value)} />
          </div>
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
