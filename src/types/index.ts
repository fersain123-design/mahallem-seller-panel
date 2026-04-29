export interface Vendor {
  id: string;
  email: string;
  owner_name: string;
  phone: string;
  store_name: string;
  store_type?: string;
  store_description?: string;
  tax_number?: string;
  tax_office?: string;
  company_type?: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'suspended';
  rejection_reason?: string;
  logo_url?: string;
  cover_image_url?: string;
  address: {
    province: string;
    district: string;
    full_address: string;
    postal_code?: string;
  };
  working_hours?: any;
  documents?: {
    tax_sheet_url?: string;
    trade_registry_url?: string;
    signature_circular_url?: string;
  };
  payment_info?: {
    account_holder_name?: string;
    bank_name?: string;
    iban?: string;
  };
  created_at: string;
}

export interface Product {
  id: string;
  vendor_id: string;
  category_id?: string;
  sub_category_id?: string;
  sub_category_name?: string;
  name: string;
  category: string;
  category_icon?: string;
  category_image?: string;
  price: number;
  discount_price?: number;
  unit: string;
  stock: number;
  min_stock_threshold?: number;
  status: 'active' | 'inactive';
  approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string;
  processing_status?: 'processing' | 'ready' | 'failed';
  processing_error_message?: string;
  description?: string;
  image_url?: string;
  images?: string[];
  created_at: string;
}

export interface Order {
  id: string;
  vendor_id: string;
  order_type?: 'delivery' | 'pickup';
  delivery_time_slot?: string;
  payment_method?: 'cash_on_delivery' | 'online';
  order_number?: string;
  customer_info?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  items: Array<{
    product_id: string;
    name: string;
    unit: string;
    product_description?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  subtotal: number;
  applied_product_discount_total?: number;
  applied_product_discount_label?: string;
  applied_product_discount_type?: 'PERCENTAGE' | 'FIXED' | 'MIXED' | string;
  campaign_discount?: number;
  campaign_label?: string;
  seller_campaign_id?: string;
  delivery_fee: number;
  total: number;
  payment_status: 'paid' | 'pending' | 'failed';
  status: 'pending' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';
  cancel_reason?: string;
  cancel_other_description?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  status_history?: Array<{
    status: string;
    changed_at: string;
    note?: string;
  }>;
  notes?: string;
  created_at: string;
}

export interface DashboardStats {
  today: { orders: number; revenue: number };
  week: { orders: number; revenue: number };
  month: { orders: number; revenue: number };
  pending: { orders: number };
  products: { total: number; active: number; low_stock: number };
  recent_orders: Order[];
  chart_data: Array<{ date: string; orders: number; revenue: number }>;
}
