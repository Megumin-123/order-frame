export const TAX_RATE = 0.10;

export const SIZE_OPTIONS = [
  { code: 'SS', label: 'ミニサイズ', frameName: 'SS' },
  { code: 'S', label: 'Sサイズ', frameName: 'インチ' },
  { code: 'M', label: 'Mサイズ', frameName: '太子' },
  { code: 'M_PLUS', label: 'Mプラス', frameName: '四切' },
  { code: 'L', label: 'Lサイズ', frameName: '大衣' },
  { code: 'LL', label: 'LLサイズ', frameName: 'F10' },
] as const;

export const COLOR_OPTIONS = [
  { code: 'YELLOW_OAK', label: '黄オーク', bgClass: 'bg-amber-100', borderClass: 'border-amber-400', textClass: 'text-amber-900', headerBg: 'bg-amber-200' },
  { code: 'BROWN', label: 'ブラウン', bgClass: 'bg-brown-light', borderClass: 'border-brown', textClass: 'text-brown-dark', headerBg: 'bg-brown-header' },
  { code: 'WHITE', label: 'ホワイト', bgClass: 'bg-blue-50', borderClass: 'border-blue-300', textClass: 'text-blue-900', headerBg: 'bg-blue-100' },
] as const;

export const ORDER_STATUS = {
  draft: { label: '下書き', color: 'bg-gray-100 text-gray-800' },
  submitted: { label: '発注済み', color: 'bg-blue-100 text-blue-800' },
  partially_delivered: { label: '一部納品', color: 'bg-yellow-100 text-yellow-800' },
  delivered: { label: '納品完了', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'キャンセル', color: 'bg-red-100 text-red-800' },
} as const;

export const SUPPLIER_NAME = '寺下額縁株式会社';
export const SUPPLIER_FAX = '087-888-3306';
export const COMPANY_NAME = '有限会社ハッピービジョン';
export const COMPANY_ADDRESS = '香川県三豊市高瀬町下勝間２７７６－３';
export const COMPANY_TEL = '0875-73-3281';
export const COMPANY_FAX = '0875-73-3282';
