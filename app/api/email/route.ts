import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { COMPANY_NAME, SUPPLIER_NAME, SUPPLIER_FAX, COMPANY_ADDRESS, COMPANY_TEL, COMPANY_FAX } from '@/lib/constants';

async function generatePdfHtml(orderId: number): Promise<string> {
  const { data: order } = await supabase.from('of_orders').select('*').eq('id', orderId).single();
  if (!order) throw new Error('発注書が見つかりません');

  const { data: items } = await supabase.from('of_order_items').select(`
    *, of_products!inner(name, size_label, color_label, frame_size_name, specs)
  `).eq('order_id', orderId).gt('quantity', 0).order('id');

  const { data: deliveries } = await supabase.from('of_delivery_schedules').select('*').eq('order_id', orderId).order('delivery_date');

  const deliveryMap = new Map<number, typeof deliveries>();
  (deliveries || []).forEach(d => {
    const list = deliveryMap.get(d.order_item_id) || [];
    list.push(d);
    deliveryMap.set(d.order_item_id, list);
  });

  const itemRows = (items || []).map((item, idx) => {
    const p = item.of_products;
    const itemDeliveries = deliveryMap.get(item.id) || [];
    const deliveryRows = itemDeliveries.map(ds =>
      `<tr><td colspan="6" style="padding-left:30px;font-size:10px;padding-top:1px;padding-bottom:1px">&rarr; ${ds.delivery_date} 納品: ${ds.quantity}個</td></tr>`
    ).join('');
    return `<tr>
      <td style="text-align:center;border:1px solid #ccc;padding:2px 4px;">${idx + 1}</td>
      <td style="border:1px solid #ccc;padding:2px 4px;">${p.color_label} ${p.frame_size_name}(${p.size_label})</td>
      <td style="border:1px solid #ccc;padding:2px 4px;font-size:10px">${p.specs || ''}</td>
      <td style="text-align:right;border:1px solid #ccc;padding:2px 4px;">${item.quantity}</td>
      <td style="text-align:right;border:1px solid #ccc;padding:2px 4px;">${item.unit_price.toLocaleString()}</td>
      <td style="text-align:right;border:1px solid #ccc;padding:2px 4px;">${item.subtotal.toLocaleString()}</td>
    </tr>${deliveryRows}`;
  }).join('');

  return `<html><head><meta charset="UTF-8"></head><body style="font-family:'MS Gothic',monospace;font-size:11px;margin:15px">
<h1 style="text-align:center;font-size:18px;margin:5px 0">注文書</h1>
<div style="display:flex;justify-content:space-between;margin:8px 0;font-size:11px">
<div><strong style="font-size:13px">${SUPPLIER_NAME} 御中</strong><br>(fax:${SUPPLIER_FAX})</div>
<div style="text-align:right"><strong>${COMPANY_NAME}</strong><br>${COMPANY_ADDRESS}<br>TEL.${COMPANY_TEL} FAX.${COMPANY_FAX}</div></div>
<div style="font-size:11px">発注番号: ${order.order_number} | 発注日: ${order.order_date}</div>
<table style="border-collapse:collapse;width:100%;margin:8px 0">
<thead><tr><th style="background:#e8e8e8;border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:11px">No.</th>
<th style="background:#e8e8e8;border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:11px">商品名</th>
<th style="background:#e8e8e8;border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:11px">商品仕様</th>
<th style="background:#e8e8e8;border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:11px">数量</th>
<th style="background:#e8e8e8;border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:11px">単価</th>
<th style="background:#e8e8e8;border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:11px">金額</th></tr></thead>
<tbody>${itemRows}</tbody></table>
<div style="text-align:right;margin-top:8px"><div>税抜小計: ¥${order.subtotal.toLocaleString()}</div>
<div>消費税(10%): ¥${order.tax_amount.toLocaleString()}</div>
<div style="font-size:16px;font-weight:bold;border-top:2px solid #000;padding-top:4px">税込合計: ¥${order.total_amount.toLocaleString()}</div></div>
</body></html>`;
}

export async function POST(request: Request) {
  const { orderId } = await request.json();

  // Get email settings from DB
  const { data: settings } = await supabase.from('of_settings').select('key, value');
  const settingsMap: Record<string, string> = {};
  (settings || []).forEach(s => { settingsMap[s.key] = s.value; });

  const smtpHost = settingsMap.smtp_host || 'smtp.happy-vision.co.jp';
  const smtpPort = parseInt(settingsMap.smtp_port || '587');
  const smtpUser = settingsMap.smtp_user || 'com@happy-vision.co.jp';
  const smtpPass = settingsMap.smtp_pass || '';
  const emailTo = settingsMap.email_to || '';
  const emailSubject = settingsMap.email_subject || '額の発注 ハッピービジョン';

  if (!emailTo) {
    return NextResponse.json({ error: '送信先メールアドレスが設定されていません。システム設定で設定してください。' }, { status: 400 });
  }
  if (!smtpPass) {
    return NextResponse.json({ error: 'SMTPパスワードが設定されていません。システム設定で設定してください。' }, { status: 400 });
  }

  try {
    // Get order number for subject
    const { data: order } = await supabase.from('of_orders').select('order_number').eq('id', orderId).single();
    const orderNumber = order?.order_number || '';

    // Generate HTML
    const html = await generatePdfHtml(orderId);

    // Create transporter
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false,
      ignoreTLS: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    // Send email with HTML attachment
    await transporter.sendMail({
      from: smtpUser,
      to: emailTo,
      subject: `${emailSubject} ${orderNumber}`,
      text: `${emailSubject}\n\n発注番号: ${orderNumber}\n\n添付の注文書をご確認ください。\n\n${COMPANY_NAME}`,
      attachments: [{
        filename: `${orderNumber}.html`,
        content: html,
        contentType: 'text/html',
      }],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json({
      error: `メール送信に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    }, { status: 500 });
  }
}
