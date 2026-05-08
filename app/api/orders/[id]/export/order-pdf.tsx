// 発注書 PDF コンポーネント (@react-pdf/renderer)
// route.ts から renderToBuffer で呼び出して PDF Buffer を生成する。
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import {
  SUPPLIER_NAME, SUPPLIER_FAX, COMPANY_NAME, COMPANY_ADDRESS, COMPANY_TEL, COMPANY_FAX,
} from '@/lib/constants';

/**
 * 日本語フォントを登録する。
 *
 * Vercel のサーバーレス関数からはファイルシステムよりも
 * public/ 配下のファイルを HTTP fetch するほうが確実に動くため、
 * 自身のオリジン URL からフォントを取得する。
 *
 * - `baseUrl` は呼び出し側 (API ルート) で `request.url` から決定し渡す
 * - 起動後の最初の1回のみ取得し、以降はキャッシュしたバッファを再利用
 */
let fontRegistered = false;
export async function ensureFontRegistered(baseUrl: string): Promise<void> {
  if (fontRegistered) return;
  const fontUrl = new URL('/fonts/SawarabiGothic-Regular.ttf', baseUrl).toString();
  const res = await fetch(fontUrl);
  if (!res.ok) {
    throw new Error(`日本語フォントの取得に失敗しました (${res.status}): ${fontUrl}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  Font.register({
    family: 'SawarabiGothic',
    src: Buffer.from(arrayBuffer) as unknown as string,
  });
  // 行末の禁則回避: 日本語折り返しの単語境界を緩める
  Font.registerHyphenationCallback((word) => Array.from(word));
  fontRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'SawarabiGothic',
    fontSize: 10,
    padding: 24,
    color: '#111',
  },
  title: { fontSize: 18, textAlign: 'center', marginBottom: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  supplierBox: { fontSize: 11 },
  supplierName: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
  selfBox: { fontSize: 10, textAlign: 'right' },
  selfName: { fontWeight: 700, marginBottom: 2 },
  metaLine: { fontSize: 10, marginBottom: 8 },
  table: { borderTop: '1pt solid #888', borderLeft: '1pt solid #888' },
  tr: { flexDirection: 'row' },
  th: {
    padding: 4,
    backgroundColor: '#e8e8e8',
    borderRight: '1pt solid #888',
    borderBottom: '1pt solid #888',
    fontWeight: 700,
    fontSize: 10,
    textAlign: 'center',
  },
  td: {
    padding: 4,
    borderRight: '1pt solid #888',
    borderBottom: '1pt solid #888',
    fontSize: 10,
  },
  colNo:    { width: '6%',  textAlign: 'center' },
  colName:  { width: '34%' },
  colSpec:  { width: '28%' },
  colQty:   { width: '10%', textAlign: 'right' },
  colPrice: { width: '10%', textAlign: 'right' },
  colSub:   { width: '12%', textAlign: 'right' },
  deliveryRow: {
    width: '100%',
    paddingLeft: 24,
    paddingTop: 1,
    paddingBottom: 1,
    fontSize: 9,
    color: '#333',
    borderRight: '1pt solid #888',
    borderBottom: '1pt solid #888',
  },
  totals: { marginTop: 12, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', marginBottom: 2 },
  totalLabel: { width: 110, textAlign: 'right', paddingRight: 8 },
  totalValue: { width: 100, textAlign: 'right' },
  grandTotalRow: {
    flexDirection: 'row',
    marginTop: 4,
    paddingTop: 4,
    borderTop: '2pt solid #000',
    fontSize: 14,
    fontWeight: 700,
  },
  grandLabel: { width: 110, textAlign: 'right', paddingRight: 8 },
  grandValue: { width: 100, textAlign: 'right' },
});

interface DeliverySchedule { delivery_date: string; quantity: number; }
interface MappedItem {
  id: number;
  product_name: string;
  size_label: string;
  color_label: string;
  frame_size_name: string;
  specs: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}
interface OrderRow {
  order_number: string;
  order_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
}

export interface OrderPdfProps {
  order: OrderRow;
  items: MappedItem[];
  deliveryMap: Record<number, DeliverySchedule[]>;
}

export function OrderPdf({ order, items, deliveryMap }: OrderPdfProps) {
  // ensureFontRegistered は呼び出し元 (route.tsx) で await 済みの想定。
  const fmt = (n: number) => n.toLocaleString('ja-JP');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>注文書</Text>

        <View style={styles.headerRow}>
          <View style={styles.supplierBox}>
            <Text style={styles.supplierName}>{SUPPLIER_NAME} 御中</Text>
            <Text>(fax:{SUPPLIER_FAX})</Text>
          </View>
          <View style={styles.selfBox}>
            <Text style={styles.selfName}>{COMPANY_NAME}</Text>
            <Text>{COMPANY_ADDRESS}</Text>
            <Text>TEL.{COMPANY_TEL} FAX.{COMPANY_FAX}</Text>
          </View>
        </View>

        <Text style={styles.metaLine}>
          発注番号: {order.order_number}　|　発注日: {order.order_date}
        </Text>
        <Text style={styles.metaLine}>下記の通り注文させていただきます。</Text>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, styles.colNo]}>No.</Text>
            <Text style={[styles.th, styles.colName]}>商品名</Text>
            <Text style={[styles.th, styles.colSpec]}>商品仕様</Text>
            <Text style={[styles.th, styles.colQty]}>数量</Text>
            <Text style={[styles.th, styles.colPrice]}>単価</Text>
            <Text style={[styles.th, styles.colSub]}>金額</Text>
          </View>
          {items.map((item, idx) => {
            const deliveries = deliveryMap[item.id] || [];
            return (
              <React.Fragment key={item.id}>
                <View style={styles.tr}>
                  <Text style={[styles.td, styles.colNo]}>{idx + 1}</Text>
                  <Text style={[styles.td, styles.colName]}>
                    {item.color_label} {item.frame_size_name}({item.size_label})
                  </Text>
                  <Text style={[styles.td, styles.colSpec]}>{item.specs || ''}</Text>
                  <Text style={[styles.td, styles.colQty]}>{fmt(item.quantity)}</Text>
                  <Text style={[styles.td, styles.colPrice]}>{fmt(item.unit_price)}</Text>
                  <Text style={[styles.td, styles.colSub]}>{fmt(item.subtotal)}</Text>
                </View>
                {deliveries.map((d, di) => (
                  <View key={di} style={styles.tr}>
                    <Text style={styles.deliveryRow}>
                      → {d.delivery_date} 納品: {d.quantity}個
                    </Text>
                  </View>
                ))}
              </React.Fragment>
            );
          })}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>税抜小計:</Text>
            <Text style={styles.totalValue}>¥{fmt(order.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>消費税(10%):</Text>
            <Text style={styles.totalValue}>¥{fmt(order.tax_amount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandLabel}>税込合計:</Text>
            <Text style={styles.grandValue}>¥{fmt(order.total_amount)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
