export interface Product {
  id: number;
  name: string;
  category: string;
  size_code: string;
  size_label: string;
  color_code: string;
  color_label: string;
  frame_size_name: string;
  unit_price: number;
  specs: string | null;
  pieces_per_box: number;
  classification_code: string | null;
  trigger_stock: number;
  order_quantity: number;
  auto_order: number;
  sort_order: number;
  is_active: number;
}

export interface StockCheck {
  id: number;
  checked_at: string;
  memo: string | null;
}

export interface StockCheckItem {
  id: number;
  stock_check_id: number;
  product_id: number;
  current_stock: number;
  avg_daily_20d: number | null;
  avg_monthly: number | null;
  needs_order: number;
  suggested_quantity: number;
}

export interface StockCheckItemWithProduct extends StockCheckItem {
  product_name: string;
  size_label: string;
  color_label: string;
  color_code: string;
  frame_size_name: string;
  unit_price: number;
  specs: string | null;
  trigger_stock: number;
  order_quantity: number;
}

export interface Order {
  id: number;
  order_number: string;
  order_date: string;
  supplier_name: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  stock_check_id: number | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  memo: string | null;
}

export interface OrderItemWithProduct extends OrderItem {
  product_name: string;
  size_label: string;
  color_label: string;
  color_code: string;
  frame_size_name: string;
  specs: string | null;
  delivery_schedules: DeliverySchedule[];
}

export interface DeliverySchedule {
  id: number;
  order_item_id: number;
  order_id: number;
  product_id: number;
  delivery_date: string;
  quantity: number;
  is_received: number;
  received_at: string | null;
  received_quantity: number | null;
  memo: string | null;
}

export interface DeliveryScheduleWithProduct extends DeliverySchedule {
  product_name: string;
  size_label: string;
  color_label: string;
  color_code: string;
  frame_size_name: string;
  order_number: string;
  order_date: string;
}

export interface OrderWithItems extends Order {
  items: OrderItemWithProduct[];
}
