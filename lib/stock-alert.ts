// 在庫登録時に「安全在庫を下回った商品」を LINE / メールで通知するヘルパー。
//
// 在庫チェック API (`POST /api/stock-check`) が POST 完了直後に呼び出す。
// 通知の失敗は在庫登録そのものを失敗させてはいけないので、エラーは
// 投げずに結果オブジェクトで返す。
import nodemailer from 'nodemailer';
import { supabase } from '@/lib/supabase';
import { sendLinePushMessage } from '@/lib/line';
import { COMPANY_NAME, COMPANY_TEL, COMPANY_FAX } from '@/lib/constants';

export interface StockAlertItem {
  productName: string;
  colorLabel: string;
  frameSizeName: string;
  sizeLabel: string;
  currentStock: number;
  pendingDelivery: number;
  triggerStock: number;
  suggestedQuantity: number;
}

export interface StockAlertResult {
  lineSent: boolean;
  lineError?: string;
  emailSent: boolean;
  emailError?: string;
}

/**
 * 通知本文（LINE / メール 共通）を組み立てる。
 */
function buildAlertText(items: StockAlertItem[]): { subject: string; body: string } {
  const now = new Date();
  const ts = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 色ごとにグループ化
  const byColor = new Map<string, StockAlertItem[]>();
  for (const it of items) {
    const arr = byColor.get(it.colorLabel) || [];
    arr.push(it);
    byColor.set(it.colorLabel, arr);
  }

  const lines: string[] = [];
  lines.push('⚠️ 在庫アラート');
  lines.push('');
  lines.push(`${ts} の在庫登録の結果、安全在庫を下回った商品があります。`);
  lines.push('');

  for (const [color, list] of byColor) {
    lines.push(`■ ${color}`);
    for (const it of list) {
      const effective = it.currentStock + it.pendingDelivery;
      const stockText = it.pendingDelivery > 0
        ? `在庫 ${it.currentStock}個 + 納品予定 ${it.pendingDelivery}個 = ${effective}個`
        : `在庫 ${it.currentStock}個`;
      lines.push(`・${it.frameSizeName}（${it.sizeLabel}） ${stockText} / 安全在庫 ${it.triggerStock}個`);
    }
    lines.push('');
  }

  lines.push(`合計 ${items.length} 商品が安全在庫を下回りました。`);
  lines.push('発注書を作成してください。');

  const body = lines.join('\n');
  const subject = `【在庫アラート】${items.length}商品が安全在庫を下回りました`;
  return { subject, body };
}

/**
 * 安全在庫を下回った商品リストを LINE とメールに通知する。
 * - 失敗してもエラーを throw しない（呼び出し元の在庫登録を止めないため）
 * - LINE / メールのどちらか片方しか動かない環境でも、できる方だけ送る
 */
export async function sendStockAlert(items: StockAlertItem[]): Promise<StockAlertResult> {
  if (items.length === 0) {
    return { lineSent: false, emailSent: false };
  }

  const { subject, body } = buildAlertText(items);

  // LINE 送信
  let lineSent = false;
  let lineError: string | undefined;
  try {
    const result = await sendLinePushMessage(body);
    lineSent = result.success;
    if (!result.success) lineError = result.error;
  } catch (e) {
    lineError = e instanceof Error ? e.message : String(e);
  }

  // メール送信（of_settings の SMTP 設定を利用）
  let emailSent = false;
  let emailError: string | undefined;
  try {
    const { data: settings } = await supabase.from('of_settings').select('key, value');
    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: { key: string; value: string }) => { settingsMap[s.key] = s.value; });

    const smtpHost = settingsMap.smtp_host || 'smtp.happy-vision.co.jp';
    const smtpPort = parseInt(settingsMap.smtp_port || '587');
    const smtpUser = settingsMap.smtp_user || 'com@happy-vision.co.jp';
    const smtpPass = settingsMap.smtp_pass || '';
    const emailTo = settingsMap.email_to || '';
    const emailSignature = settingsMap.email_signature || `${COMPANY_NAME}\nTEL.${COMPANY_TEL} FAX.${COMPANY_FAX}`;

    if (!smtpPass) {
      emailError = 'SMTPパスワード未設定';
    } else if (!emailTo) {
      emailError = '送信先メールアドレス未設定';
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: false,
        ignoreTLS: true,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: smtpUser,
        to: emailTo,
        subject,
        text: `${body}\n\n--\n${emailSignature}`,
      });
      emailSent = true;
    }
  } catch (e) {
    emailError = e instanceof Error ? e.message : String(e);
  }

  return { lineSent, emailSent, lineError, emailError };
}
