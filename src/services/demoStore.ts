type DemoProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  min_stock_threshold: number;
  status: 'active' | 'inactive';
  description?: string;
  images?: string[];
};

type DemoOrder = {
  id: string;
  order_number?: string;
  customer_info: {
    name: string;
    phone: string;
    address?: string;
  };
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  total: number;
  status: 'pending' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';
  payment_status: 'paid' | 'pending';
  created_at: string;
};

const KEY_PRODUCTS = 'demo_products_v1';
const KEY_ORDERS = 'demo_orders_v1';

const uid = () => {
  // small, deterministic-enough id for demo purposes
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
};

const safeParse = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const demoStore = {
  ensureSeeded() {
    if (safeParse<DemoProduct[]>(localStorage.getItem(KEY_PRODUCTS)) == null) {
      const seededProducts: DemoProduct[] = [
        {
          id: 'p_demo_1',
          name: 'Ürün #1',
          category: 'Gıda',
          price: 24.9,
          unit: 'adet',
          stock: 18,
          min_stock_threshold: 10,
          status: 'active',
          description: 'Örnek ürün açıklaması',
          images: ['/logo.png'],
        },
        {
          id: 'p_demo_2',
          name: 'Ürün #2',
          category: 'İçecek',
          price: 39.5,
          unit: 'adet',
          stock: 7,
          min_stock_threshold: 12,
          status: 'active',
          description: 'Örnek ürün açıklaması',
          images: ['/logo.png'],
        },
        {
          id: 'p_demo_3',
          name: 'Ürün #3',
          category: 'Ev & Yaşam',
          price: 29.9,
          unit: 'adet',
          stock: 22,
          min_stock_threshold: 8,
          status: 'active',
          description: 'Örnek ürün açıklaması',
          images: ['/logo.png'],
        },
      ];
      localStorage.setItem(KEY_PRODUCTS, JSON.stringify(seededProducts));
    }

    if (safeParse<DemoOrder[]>(localStorage.getItem(KEY_ORDERS)) == null) {
      const seededOrders: DemoOrder[] = [
        {
          id: 'o_demo_1',
          order_number: 'SP-0001',
          customer_info: {
            name: 'Demo Müşteri',
            phone: '0555 000 00 00',
            address: 'İstanbul',
          },
          items: [
            {
              product_id: 'p_demo_1',
              product_name: 'Ürün #1',
              quantity: 2,
              unit_price: 24.9,
              total: 49.8,
            },
            {
              product_id: 'p_demo_2',
              product_name: 'Ürün #2',
              quantity: 1,
              unit_price: 39.5,
              total: 39.5,
            },
          ],
          total: 89.3,
          status: 'pending',
          payment_status: 'paid',
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        },
      ];
      localStorage.setItem(KEY_ORDERS, JSON.stringify(seededOrders));
    }
  },

  getProducts(): DemoProduct[] {
    this.ensureSeeded();
    return safeParse<DemoProduct[]>(localStorage.getItem(KEY_PRODUCTS)) || [];
  },

  setProducts(products: DemoProduct[]) {
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
  },

  createProduct(input: Omit<DemoProduct, 'id'>): DemoProduct {
    const products = this.getProducts();
    const product: DemoProduct = { ...input, id: `p_${uid()}` };
    this.setProducts([product, ...products]);
    return product;
  },

  updateProduct(id: string, patch: Partial<DemoProduct>): DemoProduct | null {
    const products = this.getProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const updated = { ...products[idx], ...patch, id };
    products[idx] = updated;
    this.setProducts(products);
    return updated;
  },

  deleteProduct(id: string): boolean {
    const products = this.getProducts();
    const next = products.filter((p) => p.id !== id);
    this.setProducts(next);
    return next.length !== products.length;
  },

  getOrders(): DemoOrder[] {
    this.ensureSeeded();
    return safeParse<DemoOrder[]>(localStorage.getItem(KEY_ORDERS)) || [];
  },

  setOrders(orders: DemoOrder[]) {
    localStorage.setItem(KEY_ORDERS, JSON.stringify(orders));
  },

  getOrder(id: string): DemoOrder | null {
    return this.getOrders().find((o) => o.id === id) || null;
  },

  updateOrderStatus(id: string, status: DemoOrder['status']): DemoOrder | null {
    const orders = this.getOrders();
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    const updated = { ...orders[idx], status };
    orders[idx] = updated;
    this.setOrders(orders);
    return updated;
  },
};

export type { DemoProduct, DemoOrder };
