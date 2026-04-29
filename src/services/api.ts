import axios, { AxiosInstance } from 'axios';
import { demoStore } from './demoStore.ts';

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error('REACT_APP_API_BASE_URL eksik!');
}

const DEMO_MODE = process.env.REACT_APP_DEMO_MODE === 'true';

const toAbsoluteAssetUrl = (maybePath?: string) => {
  const raw = String(maybePath || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const normalizedBase = String(API_BASE_URL || '').replace(/\/+$/, '').replace(/\/api$/i, '');
  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
  return `${normalizedBase}${normalizedPath}`;
};

const demoVendor = () => {
  const raw = localStorage.getItem('user');
  if (raw) {
    try {
      const u = JSON.parse(raw);
      if (u && u.role === 'vendor') return u;
    } catch {
      // ignore
    }
  }

  return {
    id: 'vendor_demo_1',
    email: 'demo@mahallem.local',
    owner_name: 'Demo Satıcı',
    store_name: 'Demo Mağaza',
    role: 'vendor',
    status: 'approved',
    phone: '0555 111 11 11',
    address: {
      province: 'İstanbul',
      district: 'Kadıköy',
      full_address: 'Demo Mah. Demo Sk. No:1',
    },
    created_at: new Date().toISOString(),
    documents: {
      tax_sheet_url: '/uploads/demo_tax_sheet.pdf',
    },
    payment_info: {
      account_holder_name: 'Demo Satıcı',
      bank_name: 'Demo Bank',
      iban: 'TR00 0000 0000 0000 0000 0000 00',
    },
  };
};

const makeResponse = (config: any, data: any, status = 200) => {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'ERROR',
    headers: {},
    config,
    request: {},
  };
};

const parseJsonBody = (data: any) => {
  if (!data) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data;
};

const handleDemoRequest = (config: any) => {
  const method = (config?.method || 'get').toLowerCase();
  const url = config?.url || '';
  const body = parseJsonBody(config?.data) || {};

  const demoStorefrontKey = 'demo_storefront';
  const getDemoStorefront = () => {
    const raw = localStorage.getItem(demoStorefrontKey);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    return {
      vendorProfileId: 'vendor_profile_demo_1',
      shopName: 'Demo Mağaza',
      storeAbout: 'Demo mağaza açıklaması.',
      openingTime: '09:00',
      closingTime: '21:00',
      preparationMinutes: 15,
      storeCoverImageUrl: '/logo.png',
      storeImages: [{ id: 'demo_img_1', imageUrl: '/logo.png', createdAt: new Date().toISOString() }],
    };
  };
  const setDemoStorefront = (val: any) => localStorage.setItem(demoStorefrontKey, JSON.stringify(val));

  const demoVendorConvosKey = 'demo_vendor_convos';
  const getDemoVendorConvos = () => {
    const raw = localStorage.getItem(demoVendorConvosKey);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    const seed = [
      {
        id: 'demo_convo_1',
        vendorProfileId: 'vendor_profile_demo_1',
        customerId: 'customer_demo_1',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        customer: { id: 'customer_demo_1', name: 'Demo Müşteri' },
        vendorProfile: { id: 'vendor_profile_demo_1', shopName: 'Demo Mağaza', storeCoverImageUrl: '/logo.png' },
        messages: [
          {
            id: 'demo_msg_1',
            conversationId: 'demo_convo_1',
            senderRole: 'CUSTOMER',
            body: 'Merhaba, bugün açık mısınız?',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ];
    localStorage.setItem(demoVendorConvosKey, JSON.stringify(seed));
    return seed;
  };
  const setDemoVendorConvos = (val: any) => localStorage.setItem(demoVendorConvosKey, JSON.stringify(val));

  // Auth
  if (method === 'post' && url === '/api/auth/login') {
    const { email, password } = body;
    if (email !== 'demo@mahallem.local' || password !== 'demo1234') {
      return makeResponse(config, { detail: 'Demo giriş bilgileri hatalı' }, 401);
    }
    const vendor = demoVendor();
    const userData = { ...vendor, role: 'vendor', status: 'approved' };
    localStorage.setItem('access_token', 'demo_access_token');
    localStorage.setItem('user', JSON.stringify(userData));
    return makeResponse(config, { success: true, data: { access_token: 'demo_access_token', vendor } }, 200);
  }

  if (method === 'post' && url === '/api/auth/register') {
    // Simulate register success; in real backend this would create vendor in pending_review
    const vendor = { ...demoVendor(), email: body?.email || 'demo@mahallem.local', status: 'pending_review' };
    return makeResponse(config, { success: true, data: { vendor } }, 200);
  }

  if (method === 'get' && url === '/api/auth/me') {
    const vendor = demoVendor();
    return makeResponse(config, { success: true, data: { vendor } }, 200);
  }

  // Dashboard
  if (method === 'get' && url === '/api/vendor/dashboard') {
    const orders = demoStore.getOrders();
    const products = demoStore.getProducts();
    const now = new Date();
    const todayStr = now.toDateString();
    const todayOrders = orders.filter((o) => new Date(o.created_at).toDateString() === todayStr);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'preparing' || o.status === 'on_the_way');
    const lowStock = products.filter((p: any) => (p.stock ?? 0) <= 5).length;

    return makeResponse(
      config,
      {
        success: true,
        data: {
          today: { orders: todayOrders.length, revenue: todayRevenue },
          pending: { orders: pendingOrders.length },
          products: {
            total: products.length,
            active: products.filter((p: any) => p.status === 'active').length,
            low_stock: lowStock,
          },
          week: { orders: orders.length, revenue: orders.reduce((s, o) => s + (o.total || 0), 0) },
          month: { orders: orders.length, revenue: orders.reduce((s, o) => s + (o.total || 0), 0) },
          chart_data: [],
          recent_orders: orders,
        },
      },
      200
    );
  }

  // Public settings
  if (method === 'get' && url === '/api/settings') {
    return makeResponse(config, { success: true, data: { commissionRate: 10 } }, 200);
  }

  // Products
  if (url === '/api/vendor/products/lookup-barcode' && method === 'post') {
    const barcode = String(body?.barcode || '').replace(/\s+/g, '').trim();
    if (!barcode) {
      return makeResponse(config, { success: false, message: 'Barkod gerekli' }, 400);
    }

    if (barcode === '8690570542100') {
      return makeResponse(
        config,
        {
          success: true,
          data: {
            found: true,
            source: 'open_food_facts',
            normalizedBarcode: barcode,
            lookupStatus: 'found',
            alreadyExistsInVendorStore: false,
            productId: null,
            product: {
              barcode,
              name: 'Tam Yagli Sut',
              brand: 'Demo Marka',
              imageUrl: '/logo.png',
              quantity: '1L',
              category: 'Sut Urunleri',
              suggestedCategory: 'Sut Urunleri',
              categoryConfidence: 0.87,
              matchedKeywords: ['sut'],
              categoryMappingSource: 'local-category-mapper',
              source: 'barcode_api',
              barcodeLookupStatus: 'found',
            },
          },
        },
        200
      );
    }

    return makeResponse(
      config,
      {
        success: true,
        data: {
          found: false,
          source: 'open_food_facts',
          normalizedBarcode: barcode,
          lookupStatus: 'not_found',
          alreadyExistsInVendorStore: false,
          productId: null,
          product: null,
        },
      },
      200
    );
  }

  if (url === '/api/vendor/products' && method === 'get') {
    return makeResponse(config, { success: true, data: { products: demoStore.getProducts() } }, 200);
  }
  if (url === '/api/vendor/products' && method === 'post') {
    const created = demoStore.createProduct({
      name: body?.name || 'Yeni Ürün',
      category: body?.category || 'Gıda',
      price: Number(body?.price ?? 0),
      unit: body?.unit || 'adet',
      stock: Number(body?.stock ?? 0),
      min_stock_threshold: Number(body?.min_stock_threshold ?? 10),
      status: body?.status || 'active',
      description: body?.description,
      images: body?.images || [],
    });
    return makeResponse(config, { success: true, data: { product: created } }, 200);
  }

  const productReviewsMatch = url.match(/^\/api\/vendor\/products\/([^/?#]+)\/reviews$/);
  if (productReviewsMatch && method === 'get') {
    const productId = productReviewsMatch[1];
    const products = demoStore.getProducts();
    const product = products.find((p: any) => String(p.id) === String(productId));
    const key = `demo_reviews_${productId}`;
    const raw = localStorage.getItem(key);
    const seeded = [
      {
        id: `demo_review_${productId}_1`,
        productId,
        productName: product?.name || 'Ürün',
        comment: 'Ürün çok taze ve hızlı geldi, teşekkürler.',
        rating: 5,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        vendorReply: null,
        customer: { id: 'demo_customer_1', name: 'Ayşe K.' },
      },
      {
        id: `demo_review_${productId}_2`,
        productId,
        productName: product?.name || 'Ürün',
        comment: 'Lezzeti iyi ama paketleme biraz daha iyi olabilir.',
        rating: 4,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        vendorReply: 'Geri bildiriminiz için teşekkür ederiz, paketleme sürecimizi iyileştiriyoruz.',
        customer: { id: 'demo_customer_2', name: 'Mehmet T.' },
      },
    ];
    const reviews = (() => {
      if (!raw) return seeded;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : seeded;
      } catch {
        return seeded;
      }
    })();
    localStorage.setItem(key, JSON.stringify(reviews));
    return makeResponse(config, { success: true, data: reviews }, 200);
  }

  const reviewReplyMatch = url.match(/^\/api\/vendor\/products\/([^/?#]+)\/reviews\/([^/?#]+)\/reply$/);
  if (reviewReplyMatch && method === 'post') {
    const productId = reviewReplyMatch[1];
    const reviewId = reviewReplyMatch[2];
    const key = `demo_reviews_${productId}`;
    const raw = localStorage.getItem(key);
    let reviews: any[] = [];
    try {
      reviews = raw ? JSON.parse(raw) : [];
    } catch {
      reviews = [];
    }
    const updated = reviews.map((r: any) =>
      String(r?.id) === String(reviewId)
        ? { ...r, vendorReply: String(body?.reply || '').trim() || null }
        : r
    );
    localStorage.setItem(key, JSON.stringify(updated));
    const item = updated.find((r: any) => String(r?.id) === String(reviewId));
    return makeResponse(config, { success: true, data: item || null }, 200);
  }

  const sellerRatingsSummaryMatch = url.match(/^\/api\/vendors\/([^/?#]+)\/ratings\/summary$/);
  if (sellerRatingsSummaryMatch && method === 'get') {
    const vendorId = sellerRatingsSummaryMatch[1];
    const key = `demo_seller_ratings_${vendorId}`;
    const raw = localStorage.getItem(key);
    let rows: any[] = [];
    try {
      rows = raw ? JSON.parse(raw) : [];
    } catch {
      rows = [];
    }
    const rated = rows.filter((x: any) => typeof x?.rating === 'number');
    const count = rated.length;
    const sum = rated.reduce((acc: number, x: any) => acc + Number(x?.rating || 0), 0);
    const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
    return makeResponse(config, { success: true, data: { seller_id: vendorId, rating: avg, rating_count: count } }, 200);
  }

  const sellerRatingsMatch = url.match(/^\/api\/vendors\/([^/?#]+)\/ratings(\?.*)?$/);
  if (sellerRatingsMatch && method === 'get') {
    const vendorId = sellerRatingsMatch[1];
    const key = `demo_seller_ratings_${vendorId}`;
    const raw = localStorage.getItem(key);
    let rows: any[] = [];
    try {
      rows = raw ? JSON.parse(raw) : [];
    } catch {
      rows = [];
    }
    return makeResponse(
      config,
      {
        success: true,
        data: {
          summary: {
            seller_id: vendorId,
            rating:
              rows.length > 0
                ? Math.round((rows.reduce((acc: number, x: any) => acc + Number(x?.rating || 0), 0) / rows.length) * 10) / 10
                : 0,
            rating_count: rows.length,
          },
          comments: rows,
          pagination: {
            page: 1,
            limit: rows.length || 20,
            total: rows.length,
            has_more: false,
          },
        },
      },
      200
    );
  }

  const productIdMatch = url.match(/^\/api\/vendor\/products\/([^/?#]+)$/);
  if (productIdMatch && method === 'put') {
    const id = productIdMatch[1];
    const updated = demoStore.updateProduct(id, body);
    return makeResponse(config, { success: true, data: { product: updated } }, 200);
  }
  if (productIdMatch && method === 'delete') {
    const id = productIdMatch[1];
    demoStore.deleteProduct(id);
    return makeResponse(config, { success: true }, 200);
  }

  // Uploads
  if (url === '/api/vendor/upload-image' && method === 'post') {
    return makeResponse(config, { url: '/logo.png', image_url: '/logo.png' }, 200);
  }
  if (url === '/api/vendor/upload-images' && method === 'post') {
    return makeResponse(config, { urls: ['/logo.png'] }, 200);
  }

  // Orders
  if (url === '/api/vendor/orders' && method === 'get') {
    return makeResponse(config, { success: true, data: { orders: demoStore.getOrders() } }, 200);
  }

  const orderIdMatch = url.match(/^\/api\/vendor\/orders\/([^/?#]+)$/);
  if (orderIdMatch && method === 'get') {
    const order = demoStore.getOrder(orderIdMatch[1]);
    return makeResponse(config, { success: true, data: { order } }, 200);
  }

  const orderStatusMatch = url.match(/^\/api\/vendor\/orders\/([^/?#]+)\/status$/);
  if (orderStatusMatch && method === 'put') {
    const updated = demoStore.updateOrderStatus(orderStatusMatch[1], body?.status);
    return makeResponse(config, { success: true, data: { order: updated } }, 200);
  }

  // Profile
  if (url === '/api/vendor/profile' && method === 'get') {
    return makeResponse(config, { success: true, data: { vendor: demoVendor() } }, 200);
  }
  if (url === '/api/vendor/profile' && method === 'put') {
    const current = demoVendor();
    const merged = { ...current, ...body };
    localStorage.setItem('user', JSON.stringify(merged));
    return makeResponse(config, { success: true, data: { vendor: merged } }, 200);
  }

  // Storefront
  if (url === '/api/vendor/storefront' && method === 'get') {
    return makeResponse(config, { success: true, data: getDemoStorefront() }, 200);
  }
  if (url === '/api/vendor/storefront' && method === 'put') {
    const current = getDemoStorefront();
    const merged = { ...current, ...body };
    setDemoStorefront(merged);
    return makeResponse(config, { success: true, data: merged }, 200);
  }
  if (url === '/api/vendor/storefront/images' && method === 'post') {
    const current = getDemoStorefront();
    const id = `demo_img_${Date.now()}`;
    const created = { id, imageUrl: '/logo.png', createdAt: new Date().toISOString() };
    const storeImages = Array.isArray(current.storeImages) ? [created, ...current.storeImages] : [created];
    const next = {
      ...current,
      storeImages,
      storeCoverImageUrl: current.storeCoverImageUrl || created.imageUrl,
    };
    setDemoStorefront(next);
    return makeResponse(config, { success: true, data: created }, 201);
  }
  const storefrontDeleteMatch = url.match(/^\/api\/vendor\/storefront\/images\/([^/?#]+)$/);
  if (storefrontDeleteMatch && method === 'delete') {
    const id = storefrontDeleteMatch[1];
    const current = getDemoStorefront();
    const storeImages = Array.isArray(current.storeImages)
      ? current.storeImages.filter((x: any) => x?.id !== id)
      : [];
    const next = {
      ...current,
      storeImages,
      storeCoverImageUrl:
        current.storeCoverImageUrl && current.storeCoverImageUrl === '/logo.png' && storeImages.length === 0
          ? null
          : current.storeCoverImageUrl,
    };
    setDemoStorefront(next);
    return makeResponse(config, { success: true, data: { id } }, 200);
  }

  // Vendor chat (customer->vendor)
  if (url === '/api/chat/conversations/vendor' && method === 'get') {
    const list = getDemoVendorConvos().map((c: any) => ({
      ...c,
      messages: Array.isArray(c.messages) ? c.messages.slice(-1) : [],
    }));
    return makeResponse(config, { success: true, data: list }, 200);
  }
  const convoMatch = url.match(/^\/api\/chat\/conversations\/([^/?#]+)$/);
  if (convoMatch && method === 'get') {
    const list = getDemoVendorConvos();
    const found = list.find((c: any) => c?.id === convoMatch[1]);
    if (!found) return makeResponse(config, { success: false, message: 'Conversation not found' }, 404);
    return makeResponse(config, { success: true, data: found }, 200);
  }
  const postMsgMatch = url.match(/^\/api\/chat\/conversations\/([^/?#]+)\/messages$/);
  if (postMsgMatch && method === 'post') {
    const list = getDemoVendorConvos();
    const idx = list.findIndex((c: any) => c?.id === postMsgMatch[1]);
    if (idx < 0) return makeResponse(config, { success: false, message: 'Conversation not found' }, 404);
    const msg = {
      id: `demo_msg_${Date.now()}`,
      conversationId: postMsgMatch[1],
      senderRole: 'VENDOR',
      body: String(body?.body || '...'),
      createdAt: new Date().toISOString(),
    };
    const next = [...list];
    next[idx] = {
      ...next[idx],
      updatedAt: new Date().toISOString(),
      messages: Array.isArray(next[idx].messages) ? [...next[idx].messages, msg] : [msg],
    };
    setDemoVendorConvos(next);
    return makeResponse(config, { success: true, data: msg }, 201);
  }

  // Default: return a generic successful response to avoid hard crashes
  return makeResponse(config, { success: true, data: {} }, 200);
};

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const PRODUCT_IMAGE_UPLOAD_TIMEOUT_MS = Number(process.env.REACT_APP_PRODUCT_IMAGE_UPLOAD_TIMEOUT_MS || 120000);

const extractUploadedImageUrl = (payload: any): string | null => {
  const d = payload?.data ?? payload;
  const candidates = [
    d?.url,
    d?.image_url,
    d?.imageUrl,
    d?.imageURL,
    d?.data?.url,
    d?.data?.image_url,
    d?.data?.imageUrl,
  ];
  const url = candidates.find((x) => typeof x === 'string' && x.trim().length > 0);
  return url ? String(url).trim() : null;
};

const mapApiOrderStatusToUi = (status?: string) => {
  switch (status) {
    case 'PENDING':
      return 'pending';
    case 'PREPARING':
      return 'preparing';
    case 'ON_THE_WAY':
      return 'on_the_way';
    case 'DELIVERED':
      return 'delivered';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'pending';
  }
};

const mapUiOrderStatusToApi = (status: string) => {
  switch (status) {
    case 'pending':
      return 'PENDING';
    case 'preparing':
      return 'PREPARING';
    case 'on_the_way':
      return 'ON_THE_WAY';
    case 'delivered':
      return 'DELIVERED';
    case 'cancelled':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
};

const mapApiPaymentStatusToUi = (status?: string) => {
  switch (status) {
    case 'PAID':
      return 'paid';
    case 'FAILED':
      return 'failed';
    case 'REFUNDED':
      return 'failed';
    case 'PENDING':
    default:
      return 'pending';
  }
};

const mapApiPaymentMethodToUi = (method?: string): Order['payment_method'] => {
  switch (String(method || '').toUpperCase()) {
    case 'TEST_CARD':
      return 'online';
    case 'CASH_ON_DELIVERY':
    default:
      return 'cash_on_delivery';
  }
};

const toUiProduct = (p: any): Product => {
  const images = Array.isArray(p?.images)
    ? p.images
        .map((im: any) => {
          if (typeof im === 'string') return toAbsoluteAssetUrl(im.trim());
          if (im && typeof im.imageUrl === 'string') return toAbsoluteAssetUrl(im.imageUrl.trim());
          if (im && typeof im.url === 'string') return toAbsoluteAssetUrl(im.url.trim());
          return '';
        })
        .filter((u: string) => u.length > 0)
    : [];
  const imageUrl =
    images[0] ||
    toAbsoluteAssetUrl(String(p?.imageUrl || '').trim()) ||
    toAbsoluteAssetUrl(String(p?.image_url || '').trim()) ||
    undefined;
  const normalizedImages = Array.from(new Set([imageUrl, ...images].filter(Boolean)));

  const normalizedProcessing = String(
    p?.processingStatus || p?.processing_status || p?.imageProcessingStatus || ''
  )
    .trim()
    .toUpperCase();
  const normalizedApproval = String(p?.approvalStatus || '').trim().toUpperCase();

  const hasAnyImage = images.length > 0 || Boolean(imageUrl);
  const processingStatus: 'processing' | 'ready' | 'failed' =
    normalizedProcessing === 'PROCESSING' ||
    normalizedProcessing === 'PENDING' ||
    normalizedProcessing === 'IN_PROGRESS'
      ? 'processing'
      : normalizedProcessing === 'FAILED' || normalizedProcessing === 'ERROR'
        ? 'failed'
        : normalizedProcessing === 'DONE' ||
            normalizedProcessing === 'COMPLETED' ||
            normalizedProcessing === 'READY' ||
            normalizedProcessing === 'SUCCESS'
          ? 'ready'
          : normalizedApproval === 'REJECTED'
            ? 'failed'
            : normalizedApproval === 'PENDING' && !hasAnyImage
              ? 'processing'
              : 'ready';

  return {
    id: p.id,
    vendor_id: p.vendorId,
    category_id: p?.category?.id || p?.categoryId || '',
    sub_category_id: p?.subCategory?.id || p?.subCategoryId || '',
    sub_category_name: p?.subCategory?.name || p?.subCategoryName || '',
    name: p.name,
    category: p?.category?.name || p?.categoryName || '',
    category_icon: p?.category?.icon || undefined,
    category_image: p?.category?.image || undefined,
    price: Number(p.price || 0),
    unit: p.unit,
    stock: Number(p.stock || 0),
    status: p?.isActive ? 'active' : 'inactive',
    approval_status: (p?.approvalStatus || (p?.isActive ? 'APPROVED' : 'PENDING')) as any,
    rejection_reason:
      typeof p?.rejectionReason === 'string' && p.rejectionReason.trim().length > 0
        ? p.rejectionReason.trim()
        : typeof p?.rejection_reason === 'string' && p.rejection_reason.trim().length > 0
          ? p.rejection_reason.trim()
          : undefined,
    processing_status: processingStatus,
    processing_error_message:
      typeof p?.processingErrorMessage === 'string' && p.processingErrorMessage.trim().length > 0
        ? p.processingErrorMessage
        : undefined,
    description: p?.description || undefined,
    image_url: imageUrl,
    images: normalizedImages,
    created_at: p?.createdAt || new Date().toISOString(),
  };
};

const toUiOrder = (o: any): Order => {
  const items = Array.isArray(o?.items) ? o.items : [];
  const subtotal = items.reduce((sum: number, it: any) => sum + Number(it?.subtotal || 0), 0);
  const orderType = String(o?.orderType || '').trim().toUpperCase() === 'PICKUP' ? 'pickup' : 'delivery';
  const shipping = o?.shippingAddress;
  const address = shipping
    ? [shipping.addressLine, shipping.neighborhood, shipping.district, shipping.city]
        .filter(Boolean)
        .join(', ')
    : '';

  const orderCode = String(o?.orderCode || o?.order_code || '').trim().toUpperCase() || String(o?.id || '').slice(-6).toUpperCase();

  return {
    id: o.id,
    vendor_id: items?.[0]?.vendorId || '',
    order_type: orderType,
    delivery_time_slot:
      typeof o?.deliveryTimeSlot === 'string' && o.deliveryTimeSlot.trim().length > 0
        ? o.deliveryTimeSlot.trim()
        : typeof o?.delivery_time_slot === 'string' && o.delivery_time_slot.trim().length > 0
          ? o.delivery_time_slot.trim()
          : undefined,
            payment_method: mapApiPaymentMethodToUi(o?.paymentMethod),
    order_number: orderCode,
    customer_info: {
      name: o?.customer?.name || 'Müşteri',
      phone: o?.customer?.phone || '',
      email: o?.customer?.email || undefined,
      address: orderType === 'pickup' ? '' : address,
    },
    items: items.map((it: any) => ({
      product_id: it.productId,
      name: it?.product?.name || 'Ürün',
      unit: it?.product?.unit || '',
      product_description: typeof it?.product?.description === 'string' ? it.product.description : undefined,
      quantity: Number(it?.quantity || 0),
      unit_price: Number(it?.unitPrice || 0),
      total_price: Number(it?.subtotal || 0),
    })),
    subtotal,
    applied_product_discount_total: Number(o?.appliedProductDiscountTotal || 0),
    applied_product_discount_label:
      typeof o?.appliedProductDiscountLabel === 'string' && o.appliedProductDiscountLabel.trim().length > 0
        ? o.appliedProductDiscountLabel
        : undefined,
    applied_product_discount_type:
      typeof o?.appliedProductDiscountType === 'string' && o.appliedProductDiscountType.trim().length > 0
        ? o.appliedProductDiscountType
        : undefined,
    campaign_discount: Number(o?.campaignDiscount || 0),
    campaign_label:
      typeof o?.campaignLabel === 'string' && o.campaignLabel.trim().length > 0
        ? o.campaignLabel
        : undefined,
    seller_campaign_id:
      typeof o?.sellerCampaignId === 'string' && o.sellerCampaignId.trim().length > 0
        ? o.sellerCampaignId
        : undefined,
    delivery_fee: Number(o?.deliveryFee || 0),
    total: Number(o?.totalPrice || subtotal),
    payment_status: mapApiPaymentStatusToUi(o?.paymentStatus) as any,
    status: mapApiOrderStatusToUi(o?.status) as any,
    cancel_reason: typeof o?.cancelReason === 'string' ? o.cancelReason : undefined,
    cancel_other_description:
      typeof o?.cancelOtherDescription === 'string' ? o.cancelOtherDescription : undefined,
    cancelled_at: typeof o?.cancelledAt === 'string' ? o.cancelledAt : undefined,
    cancelled_by: typeof o?.cancelledBy === 'string' ? o.cancelledBy : undefined,
    notes:
      typeof o?.notes === 'string' && o.notes.trim().length > 0
        ? o.notes.trim()
        : typeof o?.note === 'string' && o.note.trim().length > 0
          ? o.note.trim()
          : undefined,
    created_at: o?.createdAt || new Date().toISOString(),
  };
};

// Request interceptor - add auth token to all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401/403 errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // DEMO_MODE fallback: if backend is unreachable (network error), serve mock responses.
    if (DEMO_MODE && !error.response && error.config) {
      try {
        const mock = handleDemoRequest(error.config);
        // If mock chose to simulate an auth failure, keep the 401 behavior consistent.
        if (mock.status === 401 || mock.status === 403) {
          return Promise.reject({ ...error, response: mock });
        }
        return Promise.resolve(mock as any);
      } catch {
        // fall through to original handling
      }
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      // Clear auth data
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      
      // Redirect to login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API - Using existing backend endpoints
export const authAPI = {
  login: (email: string, password: string) => {
    console.log('API_BASE_URL:', API_BASE_URL);
    return apiClient.post('/api/auth/login', { email, password });
  },

  forgotPassword: (phone: string) =>
    apiClient.post('/api/auth/forgot-password', { phone }),

  verifyOtp: (phone: string, otpCode: string) =>
    apiClient.post('/api/auth/verify-otp', { phone, otpCode }),

  resetPassword: (phone: string, resetToken: string, newPassword: string, confirmPassword: string) =>
    apiClient.post('/api/auth/reset-password', {
      phone,
      resetToken,
      newPassword,
      confirmPassword,
    }),
  
  register: (data: any) =>
    apiClient.post('/api/auth/register', data),
  
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    return Promise.resolve();
  },
  
  getMe: () => 
    apiClient.get('/api/auth/me'),
  
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.put('/api/vendor/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),
};

// Vendor API
export const vendorAPI = {
  getProfile: () => 
    apiClient.get('/api/vendor/profile'),
  
  updateProfile: (data: any) => 
    apiClient.put('/api/vendor/profile', data),

  requestDeliveryCoverageChange: (deliveryCoverage: 'SELF' | 'PLATFORM') =>
    apiClient.post('/api/vendor/delivery-coverage/change-request', { deliveryCoverage }),

  getDeliverySettings: () =>
    apiClient.get('/api/vendor/delivery-settings'),

  updateDeliverySettings: (data: {
    deliveryMode?: 'seller' | 'platform';
    minimumOrderAmount?: number | null;
    flatDeliveryFee?: number | null;
    freeOverAmount?: number | null;
    isActive?: boolean;
  }) => apiClient.put('/api/vendor/delivery-settings', data),

  getBankAccount: () =>
    apiClient.get('/api/vendor/bank-account'),

  updateBankAccount: (data: { iban: string; bankName: string }) =>
    apiClient.put('/api/vendor/bank-account', data),

  uploadTaxSheet: (payload: { filename: string; contentBase64: string }) =>
    apiClient.post('/api/vendor/upload-tax-sheet', payload),

  uploadDocument: (payload: { filename: string; contentBase64: string; type: string }) =>
    apiClient.post('/api/vendor/upload-document', payload),

  getNotifications: (params?: { limit?: number }) =>
    apiClient.get('/api/vendor/notifications', { params }),

  markNotificationAsRead: (id: string) =>
    apiClient.put(`/api/vendor/notifications/${id}/read`),

  getPayouts: (params?: { status?: string; page?: number; limit?: number }) =>
    apiClient.get('/api/vendor/payouts', { params }),

  createPayoutRequest: (amount: number) =>
    apiClient.post('/api/vendor/payouts/request', { amount }),

  getPayoutById: (id: string) =>
    apiClient.get(`/api/vendor/payouts/${id}`),

  // Storefront (Mahallem Mağazam)
  getStorefront: () => apiClient.get('/api/vendor/storefront'),
  updateStorefront: (data: any) => apiClient.put('/api/vendor/storefront', data),
  uploadStorefrontImage: (formData: FormData) =>
    apiClient.post('/api/vendor/storefront/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteStorefrontImage: (id: string) => apiClient.delete(`/api/vendor/storefront/images/${id}`),

  getCategories: () => apiClient.get('/api/vendor/categories'),
  createCategory: (data: { name: string; icon: string; image: string; description?: string }) =>
    apiClient.post('/api/vendor/categories', data),
  updateCategory: (id: string, data: { name?: string; icon?: string; image?: string; description?: string; isActive?: boolean }) =>
    apiClient.put(`/api/vendor/categories/${id}`, data),
  deleteCategory: (id: string) => apiClient.delete(`/api/vendor/categories/${id}`),
};

// Support (Help) API - shared inbox for admins
export const supportAPI = {
  createConversation: (payload: { category?: string; subject?: string; initialMessage?: string; orderId?: string; vendorProfileId?: string }) =>
    apiClient.post('/api/support/conversations', payload),
  getMyConversation: () => apiClient.get('/api/support/conversations/me'),
  postMyMessage: (conversationId: string, body: string) =>
    apiClient.post(`/api/support/conversations/${conversationId}/messages`, { body }),
};

export const vendorSupportAPI = {
  listConversations: () => apiClient.get('/api/chat/support-conversations/vendor'),
  getConversationById: (id: string) => apiClient.get(`/api/chat/conversations/${id}`),
  postMessage: (conversationId: string, payload: { body?: string; imageUrl?: string }) =>
    apiClient.post(`/api/chat/conversations/${conversationId}/messages`, payload),
  markRead: (conversationId: string) => apiClient.post(`/api/chat/conversations/${conversationId}/read`),
  closeConversation: (conversationId: string) => apiClient.post(`/api/chat/conversations/${conversationId}/close`),
  escalateToAdmin: (conversationId: string, note?: string) =>
    apiClient.post(`/api/chat/conversations/${conversationId}/escalate`, { note }),
  uploadImage: (formData: FormData) =>
    apiClient.post('/api/chat/uploads/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

const normalizeProductImageUrls = (images: any): string[] => {
  if (!Array.isArray(images)) return [];

  return Array.from(
    new Set(
      images
        .map((x: any) => (typeof x === 'string' ? x.trim() : ''))
        .filter((x: string) => x.length > 0)
    )
  );
};

const BARCODE_LOOKUP_CLIENT_TTL_MS = 60 * 1000;
const barcodeLookupCache = new Map<string, { at: number; response: any }>();
const barcodeLookupInFlight = new Map<string, Promise<any>>();

// Products API
export const productsAPI = {
  getAll: async (params?: any) => {
    try {
      const response = await apiClient.get('/api/vendor/products', { params });
      const result = response.data?.data || response.data;
      const products = Array.isArray(result?.products) ? result.products : [];
      const mapped = products.map(toUiProduct);
      return {
        ...response,
        data: { ...response.data, data: { ...result, products: mapped } },
      };
    } catch (error: any) {
      console.error('[API] Products fetch error:', error.response?.status, error.message);
      return { data: { data: { products: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } } } };
    }
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/api/vendor/products/${id}`);
    const product = response.data?.data;
    return {
      ...response,
      data: { ...response.data, data: toUiProduct(product) },
    };
  },

  lookupBarcode: async (barcode: string) => {
    const normalizedBarcode = String(barcode || '').replace(/\s+/g, '').trim();
    console.log('[BARCODE] normalized barcode:', normalizedBarcode);

    const cached = barcodeLookupCache.get(normalizedBarcode);
    if (cached && Date.now() - cached.at <= BARCODE_LOOKUP_CLIENT_TTL_MS) {
      return cached.response;
    }

    const inFlight = barcodeLookupInFlight.get(normalizedBarcode);
    if (inFlight) {
      return inFlight;
    }

    const requestPromise = (async () => {
      try {
        const response = await apiClient.post(
          '/api/vendor/products/lookup-barcode',
          {
            barcode: normalizedBarcode,
          },
          {
            timeout: 10000,
          }
        );

        const isFound = Boolean(response?.data?.data?.found);
        if (isFound) {
          barcodeLookupCache.set(normalizedBarcode, { at: Date.now(), response });
        }

        console.log('[BARCODE] external API lookup:', response?.data);
        return response;
      } catch (error: any) {
        console.log('[BARCODE] external API lookup:', {
          barcode: normalizedBarcode,
          status: 'error',
          message: String(error?.response?.data?.message || error?.message || 'Unknown barcode api error'),
        });
        throw error;
      } finally {
        barcodeLookupInFlight.delete(normalizedBarcode);
      }
    })();

    barcodeLookupInFlight.set(normalizedBarcode, requestPromise);

    return requestPromise;
  },

  getSmartSuggestions: async (params: {
    categoryId: string;
    subCategoryId?: string;
    limit?: number;
  }) => {
    const response = await apiClient.get('/api/vendor/products/smart-suggestions', {
      params: {
        categoryId: String(params.categoryId || '').trim(),
        ...(params.subCategoryId ? { subCategoryId: String(params.subCategoryId).trim() } : {}),
        ...(params.limit ? { limit: Math.min(12, Math.max(1, Number(params.limit || 6))) } : {}),
      },
    });

    const list = Array.isArray(response?.data?.data) ? response.data.data : [];
    return {
      ...response,
      data: {
        ...response.data,
        data: list,
      },
    };
  },

  create: async (data: any) => {
    const images = normalizeProductImageUrls(data?.images);
    const payload = {
      name: data?.name,
      ...(data?.categoryId ? { categoryId: String(data.categoryId) } : {}),
      ...(data?.subCategoryId ? { subCategoryId: String(data.subCategoryId) } : {}),
      ...(data?.subCategoryName ? { subCategoryName: String(data.subCategoryName) } : {}),
      categoryName: data?.category || 'Diğer',
      price: Number(data?.price || 0),
      stock: Number(data?.stock || 0),
      unit: data?.unit || 'adet',
      ...(data?.barcode ? { barcode: String(data.barcode).trim() } : {}),
      description: data?.description,
      images,
      status: data?.status || 'active',
      ...(data?.submissionSource ? { submissionSource: data.submissionSource } : {}),
      ...(Array.isArray(data?.imageJobs) ? { imageJobs: data.imageJobs } : {}),
    };
    const response = await apiClient.post('/api/vendor/products', payload);
    const createdProduct = response.data?.data?.product ?? response.data?.data;
    return {
      ...response,
      data: { ...response.data, data: toUiProduct(createdProduct) },
    };
  },

  update: async (id: string, data: any) => {
    const images = normalizeProductImageUrls(data?.images);
    const payload = {
      name: data?.name,
      ...(data?.categoryId ? { categoryId: String(data.categoryId) } : {}),
      ...(data?.subCategoryId ? { subCategoryId: String(data.subCategoryId) } : {}),
      ...(data?.subCategoryName ? { subCategoryName: String(data.subCategoryName) } : {}),
      categoryName: data?.category || 'Diğer',
      price: Number(data?.price || 0),
      stock: Number(data?.stock || 0),
      unit: data?.unit || 'adet',
      ...(data?.barcode ? { barcode: String(data.barcode).trim() } : {}),
      description: data?.description,
      images,
      status: data?.status || 'active',
      ...(data?.submissionSource ? { submissionSource: data.submissionSource } : {}),
    };
    const response = await apiClient.put(`/api/vendor/products/${id}`, payload);
    const updatedProduct = response.data?.data?.product ?? response.data?.data;
    return {
      ...response,
      data: { ...response.data, data: toUiProduct(updatedProduct) },
    };
  },

  delete: (id: string) => apiClient.delete(`/api/vendor/products/${id}`),
  
  // Image upload
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/vendor/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: PRODUCT_IMAGE_UPLOAD_TIMEOUT_MS,
    });
  },

  uploadImageBase64: async (file: File) => {
    const contentBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes('base64,') ? String(result.split('base64,').pop() || '') : result;
        if (!base64) {
          reject(new Error('Base64 donusumu basarisiz'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Dosya okunamadi'));
      reader.readAsDataURL(file);
    });

    return apiClient.post(
      '/api/vendor/upload-image',
      {
        filename: file.name,
        contentBase64,
      },
      {
        timeout: PRODUCT_IMAGE_UPLOAD_TIMEOUT_MS,
      }
    );
  },

  uploadImageUrl: async (file: File) => {
    const buildUploadErrorMessage = (err: any): string | null => {
      const status = Number(err?.response?.status || 0);
      const errorCode = String(err?.code || '').toUpperCase();
      const message = String(err?.response?.data?.message || '').trim();
      const details = err?.response?.data?.details;

      if (errorCode === 'ECONNABORTED' || String(err?.message || '').toLowerCase().includes('timeout')) {
        return 'Gorsel yukleme zaman asimina ugradi. Lutfen tekrar deneyin.';
      }

      if (status === 422 && details && typeof details === 'object') {
        const width = Number(details?.width || 0);
        const height = Number(details?.height || 0);
        const minWidth = Number(details?.minWidth || 0);
        const minHeight = Number(details?.minHeight || 0);
        if (width > 0 && height > 0 && minWidth > 0 && minHeight > 0) {
          return `Gorsel kalitesi dusuk (${width}x${height}). En az ${minWidth}x${minHeight} piksel yukleyin.`;
        }
      }

      if (message) {
        return message;
      }

      return null;
    };

    try {
      const response = await productsAPI.uploadImage(file);
      const uploadedUrl = extractUploadedImageUrl(response);
      if (uploadedUrl) {
        return String(uploadedUrl);
      }
      throw new Error('Backend upload response does not contain image url');
    } catch (error) {
      console.warn('[productsAPI] multipart upload failed, trying base64 backend upload', error);
      const primaryErrorMessage = buildUploadErrorMessage(error);

      try {
        const fallbackJsonResponse = await productsAPI.uploadImageBase64(file);
        const fallbackJsonUrl = extractUploadedImageUrl(fallbackJsonResponse);
        if (fallbackJsonUrl) {
          return String(fallbackJsonUrl);
        }
      } catch (base64FallbackError) {
        console.warn('[productsAPI] base64 backend upload failed', base64FallbackError);
        const fallbackErrorMessage = buildUploadErrorMessage(base64FallbackError);
        throw new Error(
          fallbackErrorMessage ||
            primaryErrorMessage ||
            'Gorsel yuklenemedi: Lutfen tekrar deneyin veya backend image cleaner servisini kontrol edin.'
        );
      }

      throw new Error(
        primaryErrorMessage ||
          'Gorsel yuklenemedi: Lutfen tekrar deneyin veya backend image cleaner servisini kontrol edin.'
      );
    }
  },
  
  // Bulk image upload helper (backend only exposes single-image endpoint)
  uploadImages: async (files: File[]) => {
    const urls = await Promise.all(files.map((file) => productsAPI.uploadImageUrl(file)));
    return { data: { urls } };
  },
};

export const reviewsAPI = {
  getByProduct: (productId: string) =>
    apiClient.get(`/api/vendor/products/${productId}/reviews`),

  reply: (productId: string, reviewId: string, reply: string) =>
    apiClient.post(`/api/vendor/products/${productId}/reviews/${reviewId}/reply`, {
      reply,
    }),

  getSellerSummary: (vendorId: string) =>
    apiClient.get(`/api/vendors/${vendorId}/ratings/summary`),

  getSellerRatings: (vendorId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`/api/vendors/${vendorId}/ratings`, { params }),
};

// Orders API
export const ordersAPI = {
  getAll: async (params?: any) => {
    const apiParams = { ...(params || {}) };
    if (apiParams.status) {
      apiParams.status = mapUiOrderStatusToApi(String(apiParams.status));
    }

    const response = await apiClient.get('/api/vendor/orders', { params: apiParams });
    const result = response.data?.data;
    const orders = Array.isArray(result?.orders) ? result.orders : [];
    const mapped = orders.map(toUiOrder);
    return {
      ...response,
      data: { ...response.data, data: { ...result, orders: mapped } },
    };
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/api/vendor/orders/${id}`);
    const order = response.data?.data;
    return {
      ...response,
      data: { ...response.data, data: { order: toUiOrder(order) } },
    };
  },

  getOne: async (id: string) => {
    const response = await apiClient.get(`/api/vendor/orders/${id}`);
    const order = response.data?.data;
    return {
      ...response,
      data: { ...response.data, data: { order: toUiOrder(order) } },
    };
  },

  updateStatus: (id: string, status: string, note?: string, reasonTitle?: string) =>
    apiClient.put(`/api/vendor/orders/${id}/status`, {
      status: mapUiOrderStatusToApi(status),
      note,
      reasonTitle,
    }),
};

// Settings API
export const settingsAPI = {
  getPublic: () => apiClient.get('/api/settings'),
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => apiClient.get('/api/vendor/dashboard'),
};

// Multi-Channel API
export const multiChannelAPI = {
  getChannels: () => 
    apiClient.get('/api/vendor/channels'),
  
  activateChannel: (channelId: string, data: any) => 
    apiClient.post(`/api/vendor/channels/${channelId}/activate`, data),
  
  deactivateChannel: (channelId: string) => 
    apiClient.post(`/api/vendor/channels/${channelId}/deactivate`),
};

// Inventory/Smart Stock API
export const inventoryAPI = {
  getAlerts: () => 
    apiClient.get('/api/vendor/inventory/alerts'),
  
  getPredictions: () => 
    apiClient.get('/api/vendor/inventory/predictions'),
  
  getTrends: () => 
    apiClient.get('/api/vendor/inventory/trends'),
};

export default apiClient;
