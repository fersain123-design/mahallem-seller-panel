import React, { useEffect, useMemo, useState } from 'react';
import { ordersAPI, supportAPI } from '../services/api.ts';
import { Order } from '../types/index.ts';
import { useSellerSearch } from '../context/SellerSearchContext.tsx';
import ConfirmActionModal from '../components/common/ConfirmActionModal.tsx';
import { extractApiErrorMessage, showErrorToast, showSuccessToast } from '../lib/feedback.ts';

const getAuthSnapshot = () => {
  const token = String(localStorage.getItem('access_token') || '').trim();
  const rawUser = localStorage.getItem('user');

  if (!rawUser) {
    return { token, sellerId: '' };
  }

  try {
    const parsed: any = JSON.parse(rawUser);
    const sellerId = String(
      parsed?.vendorProfile?.id || parsed?.vendor_profile?.id || parsed?.id || ''
    ).trim();
    return { token, sellerId };
  } catch {
    return { token, sellerId: '' };
  }
};

const getOrdersLoadErrorMessage = (err: any) => {
  const status = Number(err?.response?.status || 0);
  const detail = String(
    err?.response?.data?.message || err?.response?.data?.detail || ''
  ).trim();

  if (status === 401 || status === 403) {
    return 'Oturumunuz gecersiz veya suresi dolmus. Lutfen tekrar giris yapin.';
  }

  if (!status) {
    return 'Siparisler yuklenmedi. Sunucuya baglanti kurulamadi.';
  }

  if (detail) {
    return `Siparisler yuklenmedi. ${detail}`;
  }

  return 'Siparisler yuklenmedi.';
};

const formatCurrency = (amount: number) =>
  `₺${Number(amount || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDeliveryFee = (amount: number) => {
  const fee = Number(amount || 0);
  if (fee === 0) return 'Ücretsiz';
  return formatCurrency(fee);
};

const formatNumber = (value: number, maxFractionDigits = 2) => {
  const safeValue = Number(value || 0);
  if (!Number.isFinite(safeValue)) {
    return '0';
  }

  if (Number.isInteger(safeValue)) {
    return safeValue.toString();
  }

  return safeValue.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
};

const META_MARKER_START = '[MAHALLEM_PRODUCT_META_V1]';
const META_MARKER_END = '[/MAHALLEM_PRODUCT_META_V1]';

const normalizeUnitLabel = (raw: string) => {
  const normalized = String(raw || '').trim().toLocaleLowerCase('tr-TR');
  if (['g', 'gr', 'gram'].includes(normalized)) return 'gr';
  if (['kg', 'kilogram', 'kilo'].includes(normalized)) return 'kg';
  if (['lt', 'l', 'litre', 'liter'].includes(normalized)) return 'lt';
  if (['ml', 'mililitre', 'milliliter'].includes(normalized)) return 'ml';
  if (['paket', 'pk'].includes(normalized)) return 'paket';
  if (['koli', 'kol'].includes(normalized)) return 'koli';
  if (['adet', 'ad', 'pcs', 'piece', 'unit'].includes(normalized)) return 'adet';
  return normalized || 'adet';
};

const unitToBaseFactor = (unit: string) => {
  if (unit === 'kg') return 1000;
  if (unit === 'gr') return 1;
  if (unit === 'lt') return 1000;
  if (unit === 'ml') return 1;
  return null;
};

const baseToPreferredUnit = (baseAmount: number, preferredUnit: string) => {
  if (preferredUnit === 'kg') {
    if (baseAmount >= 1000) {
      return { amount: baseAmount / 1000, unit: 'kg' };
    }
    return { amount: baseAmount, unit: 'gr' };
  }

  if (preferredUnit === 'gr') {
    if (baseAmount >= 1000) {
      return { amount: baseAmount / 1000, unit: 'kg' };
    }
    return { amount: baseAmount, unit: 'gr' };
  }

  if (preferredUnit === 'lt') {
    if (baseAmount >= 1000) {
      return { amount: baseAmount / 1000, unit: 'lt' };
    }
    return { amount: baseAmount, unit: 'ml' };
  }

  if (preferredUnit === 'ml') {
    if (baseAmount >= 1000) {
      return { amount: baseAmount / 1000, unit: 'lt' };
    }
    return { amount: baseAmount, unit: 'ml' };
  }

  return { amount: baseAmount, unit: preferredUnit };
};

const parseMetaNetWeight = (description?: string) => {
  const raw = String(description || '');
  const start = raw.indexOf(META_MARKER_START);
  const end = raw.indexOf(META_MARKER_END);

  if (start < 0 || end <= start) {
    return null;
  }

  const chunk = raw.slice(start + META_MARKER_START.length, end).trim();
  if (!chunk) {
    return null;
  }

  try {
    const parsed: any = JSON.parse(chunk);
    const amount = Number(parsed?.netWeightValue);
    const unit = normalizeUnitLabel(String(parsed?.netWeightUnit || ''));

    if (!Number.isFinite(amount) || amount <= 0 || !unit) {
      return null;
    }

    return { amount, unit };
  } catch {
    return null;
  }
};

const extractInlineAmountAndUnit = (raw: string) => {
  const source = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!source) return null;

  const match = source.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilogram|kilo|gr|g|gram|lt|l|litre|liter|ml|mililitre|milliliter|adet|ad|paket|pk|koli|kol)\b/i);
  if (!match) return null;

  const amount = Number(String(match[1] || '').replace(',', '.'));
  const unit = normalizeUnitLabel(match[2] || '');

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return { amount, unit };
};

const formatSingleAmount = (amount: number, unit: string) => {
  const normalizedUnit = normalizeUnitLabel(unit);
  const digits = normalizedUnit === 'kg' || normalizedUnit === 'lt' ? 3 : 2;
  return `${formatNumber(amount, digits)} ${normalizedUnit}`;
};

const getItemCount = (item: Order['items'][number]) => {
  const quantity = Number(item?.quantity || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 1;
  }
  return quantity;
};

const resolvePerItemAmount = (item: Order['items'][number]) => {
  const fromMeta = parseMetaNetWeight(item?.product_description);
  if (fromMeta) {
    return fromMeta;
  }

  const fromUnit = extractInlineAmountAndUnit(item?.unit || '');
  if (fromUnit) {
    return fromUnit;
  }

  const fromName = extractInlineAmountAndUnit(item?.name || '');
  if (fromName) {
    return fromName;
  }

  const normalizedUnit = normalizeUnitLabel(item?.unit || 'adet');
  if (normalizedUnit === 'adet') {
    return { amount: 1, unit: 'adet' };
  }

  return null;
};

const formatOrderItemAmount = (item: Order['items'][number]) => {
  const safeQuantity = getItemCount(item);
  const perItem = resolvePerItemAmount(item);

  if (perItem) {
    const perText = formatSingleAmount(perItem.amount, perItem.unit);
    if (safeQuantity <= 1) {
      return {
        main: perText,
        total: null as string | null,
      };
    }

    const factor = unitToBaseFactor(perItem.unit);
    if (factor) {
      const totalInBase = perItem.amount * safeQuantity * factor;
      const converted = baseToPreferredUnit(totalInBase, normalizeUnitLabel(perItem.unit));
      return {
        main: `${perText} x ${formatNumber(safeQuantity, 0)}`,
        total: `Toplam: ${formatSingleAmount(converted.amount, converted.unit)}`,
      };
    }

    return {
      main: `${perText} x ${formatNumber(safeQuantity, 0)}`,
      total: `Toplam: ${formatSingleAmount(perItem.amount * safeQuantity, perItem.unit)}`,
    };
  }

  const rawUnit = String(item?.unit || 'adet').trim();
  const normalizedUnit = normalizeUnitLabel(rawUnit);
  return {
    main: `${formatNumber(safeQuantity, 0)} ${normalizedUnit}`,
    total: null as string | null,
  };
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'border-warning/50 bg-warning/10 text-warning';
    case 'preparing':
      return 'border-sky-300 bg-sky-50 text-sky-700';
    case 'on_the_way':
      return 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700';
    case 'delivered':
      return 'border-success/40 bg-success/10 text-success';
    case 'cancelled':
      return 'border-error/40 bg-error/10 text-error';
    default:
      return 'border-black/10 bg-white text-text-primary';
  }
};

const getStatusBarColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-warning';
    case 'preparing':
      return 'bg-sky-500';
    case 'on_the_way':
      return 'bg-fuchsia-500';
    case 'delivered':
      return 'bg-success';
    case 'cancelled':
      return 'bg-error';
    default:
      return 'bg-black/10';
  }
};

const getStatusText = (status: string, orderType?: Order['order_type']) => {
  switch (status) {
    case 'pending':
      return 'Yeni Sipariş';
    case 'preparing':
      return 'Hazırlanıyor';
    case 'on_the_way':
      return orderType === 'pickup' ? 'Hazır' : 'Yolda';
    case 'delivered':
      return 'Teslim Edildi';
    case 'cancelled':
      return 'İptal';
    default:
      return status;
  }
};

const getNextStatuses = (currentStatus: string): Order['status'][] => {
  switch (currentStatus) {
    case 'pending':
      return ['preparing', 'cancelled'];
    case 'preparing':
      return ['on_the_way', 'cancelled'];
    case 'on_the_way':
      return ['delivered', 'cancelled'];
    default:
      return [];
  }
};

const getPrimaryAction = (order: Order) => {
  const status = order.status;
  switch (status) {
    case 'pending':
      return { label: 'Hazırlanıyor', nextStatus: 'preparing' as const, className: 'bg-primary text-white hover:bg-primary-600' };
    case 'preparing':
      return {
        label: order.order_type === 'pickup' ? 'Hazır' : 'Yolda',
        nextStatus: 'on_the_way' as const,
        className: 'bg-sky-600 text-white hover:bg-sky-700',
      };
    case 'on_the_way':
      return { label: 'Teslim Edildi', nextStatus: 'delivered' as const, className: 'bg-success text-white hover:bg-success/90' };
    default:
      return null;
  }
};

const getPaymentMethodText = (paymentMethod?: Order['payment_method']) => {
  return paymentMethod === 'online' ? 'Online' : 'Kapıda';
};

const getPaymentBadge = (order: Order) => {
  const isOnline = order.payment_method === 'online';

  if (isOnline) {
    const isPaid = order.payment_status === 'paid';
    return {
      text: `Ödeme: Online ${isPaid ? 'Tamamlandı' : 'Tamamlanmadı'}`,
      className: isPaid
        ? 'border-success/30 bg-success text-white'
        : 'border-red-600 bg-red-600 text-white',
    };
  }

  return {
    text: 'Ödeme: Kapıda',
    className: 'border-red-600 bg-red-600 text-white',
  };
};

const getDeliveryText = (order: Order) => {
  if (order.order_type === 'pickup') {
    return 'Gel Al';
  }

  const slot = String(order.delivery_time_slot || '').trim();
  return slot || 'Planlanmadı';
};

const hasScheduledDelivery = (order: Order) => {
  if (order.order_type === 'pickup') {
    return false;
  }

  return String(order.delivery_time_slot || '').trim().length > 0;
};

const getCancelReasonLabel = (key?: string) => {
  switch (String(key || '').toUpperCase()) {
    case 'LATE_PREPARATION':
      return 'Geç hazırlanıyor';
    case 'WRONG_PRODUCT_OR_ORDER':
      return 'Yanlış ürün - yanlış sipariş';
    case 'PRICE_TOO_HIGH':
      return 'Fiyat pahalı';
    case 'WRONG_ADDRESS':
      return 'Adres yanlış';
    case 'CHANGED_MIND':
      return 'Fikrim değişti';
    case 'OTHER':
      return 'Diğer';
    default:
      return key ? String(key) : '-';
  }
};

const MIN_CANCEL_NOTE_LENGTH = 20;
const MIN_RETURN_NOTE_LENGTH = 20;

type OrderFilter = 'all' | 'active' | 'completed' | 'cancelled';

const ORDER_FILTERS: Array<{ key: OrderFilter; label: string }> = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Hazırlanan Siparişler' },
  { key: 'completed', label: 'Tamamlanan Siparişler' },
  { key: 'cancelled', label: 'İptal Edilen Siparişler' },
];

const matchesOrderFilter = (order: Order, filter: OrderFilter) => {
  switch (filter) {
    case 'active':
      return order.status === 'pending' || order.status === 'preparing' || order.status === 'on_the_way';
    case 'completed':
      return order.status === 'delivered';
    case 'cancelled':
      return order.status === 'cancelled';
    default:
      return true;
  }
};

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [cancelTargetOrder, setCancelTargetOrder] = useState<Order | null>(null);
  const [cancelReasonTitle, setCancelReasonTitle] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [returnTargetOrder, setReturnTargetOrder] = useState<Order | null>(null);
  const [returnReasonTitle, setReturnReasonTitle] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnError, setReturnError] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all');
  const [deliverConfirmOrder, setDeliverConfirmOrder] = useState<Order | null>(null);
  const { query: searchQuery } = useSellerSearch();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      setError('');

      const { token, sellerId } = getAuthSnapshot();
      if (!token) {
        setOrders([]);
        setError('Oturum bilgisi bulunamadi. Lutfen tekrar giris yapin.');
        return;
      }

      if (!sellerId) {
        setOrders([]);
        setError('Satici bilgisi eksik. Lutfen cikis yapip tekrar giris yapin.');
        return;
      }

      const response = await ordersAPI.getAll();
      const payload = response?.data?.data;
      const responseOrders = Array.isArray(payload?.orders) ? payload.orders : [];
      const countCandidates = [
        payload?.totalOrders,
        payload?.total,
        payload?.count,
        payload?.pagination?.total,
      ];
      const reportedTotal = countCandidates.find(
        (value) => Number.isFinite(Number(value)) && Number(value) >= 0
      );

      if (Number(reportedTotal) === 0 || responseOrders.length === 0) {
        setOrders([]);
        return;
      }

      setOrders(responseOrders);
    } catch (err: any) {
      setError(getOrdersLoadErrorMessage(err));
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  const applyOptimisticStatus = (list: Order[], orderId: string, newStatus: Order['status']) => {
    const changedAt = new Date().toISOString();

    return list.map((order) => {
      if (order.id !== orderId) {
        return order;
      }

      return {
        ...order,
        status: newStatus,
        cancelled_at: newStatus === 'cancelled' ? changedAt : order.cancelled_at,
        cancelled_by: newStatus === 'cancelled' ? 'VENDOR' : order.cancelled_by,
        cancel_reason: newStatus === 'cancelled' ? order.cancel_reason || 'OTHER' : order.cancel_reason,
      };
    });
  };

  const handleStatusUpdate = async (orderId: string, newStatus: Order['status'], note?: string, reasonTitle?: string) => {
    const previousOrders = orders;
    const previousSelectedOrder = selectedOrder;

    try {
      setUpdatingOrderId(orderId);
      setOrders((currentOrders) => applyOptimisticStatus(currentOrders, orderId, newStatus));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((currentSelected) => {
          if (!currentSelected) {
            return currentSelected;
          }

          return applyOptimisticStatus([currentSelected], orderId, newStatus)[0] || currentSelected;
        });
      }

      await ordersAPI.updateStatus(orderId, newStatus, note, reasonTitle);
      window.dispatchEvent(new Event('seller-orders-updated'));

      setStatusNote('');
      void fetchOrders({ silent: true });
      if (selectedOrder && selectedOrder.id === orderId) {
        const response = await ordersAPI.getOne(orderId);
        setSelectedOrder(response.data.data.order);
      }
    } catch (err: any) {
      setOrders(previousOrders);
      setSelectedOrder(previousSelectedOrder);
      showErrorToast('Siparis durumu guncellenemedi', extractApiErrorMessage(err, 'Lutfen tekrar deneyin.'));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('tr-TR');
    return orders.filter((order) => {
      if (!matchesOrderFilter(order, activeFilter)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const orderNumber = String(order.order_number || order.id.slice(-6).toUpperCase()).toLocaleLowerCase('tr-TR');
      const customerName = String(order.customer_info?.name || '').toLocaleLowerCase('tr-TR');
      const customerPhone = String(order.customer_info?.phone || '').toLocaleLowerCase('tr-TR');
      const customerAddress = String(order.customer_info?.address || '').toLocaleLowerCase('tr-TR');
      const itemsText = Array.isArray(order.items)
        ? order.items.map((item) => String(item?.name || '')).join(' ').toLocaleLowerCase('tr-TR')
        : '';

      return (
        orderNumber.includes(query) ||
        customerName.includes(query) ||
        customerPhone.includes(query) ||
        customerAddress.includes(query) ||
        itemsText.includes(query)
      );
    });
  }, [activeFilter, orders, searchQuery]);

  const confirmTransition = async (order: Order, nextStatus: Order['status']) => {
    const note = selectedOrder?.id === order.id ? (statusNote || '').trim() : '';

    if (nextStatus === 'cancelled') {
      setCancelError('');
      setCancelReasonTitle('');
      setCancelReason(selectedOrder?.id === order.id ? (statusNote || '').trim() : '');
      setCancelTargetOrder(order);
      return;
    }

    if (nextStatus === 'delivered') {
      setDeliverConfirmOrder(order);
      return;
    }

    await handleStatusUpdate(order.id, nextStatus, note || undefined);
  };

  const submitCancel = async () => {
    if (!cancelTargetOrder) return;

    const note = cancelReason.trim();
    if (note.length < MIN_CANCEL_NOTE_LENGTH) {
      setCancelError(`İptal nedeni en az ${MIN_CANCEL_NOTE_LENGTH} karakter olmalıdır.`);
      return;
    }

    setCancelError('');
    const reasonTitle = cancelReasonTitle.trim();
    await handleStatusUpdate(cancelTargetOrder.id, 'cancelled', note, reasonTitle || undefined);
    if (selectedOrder?.id === cancelTargetOrder.id) {
      setStatusNote(note);
    }
    setCancelTargetOrder(null);
    setCancelReasonTitle('');
    setCancelReason('');
  };

  const submitReturnRequest = async () => {
    if (!returnTargetOrder) return;

    const note = returnReason.trim();
    if (note.length < MIN_RETURN_NOTE_LENGTH) {
      setReturnError(`İade nedeni en az ${MIN_RETURN_NOTE_LENGTH} karakter olmalıdır.`);
      return;
    }

    try {
      setUpdatingOrderId(returnTargetOrder.id);
      setReturnError('');

      await supportAPI.createConversation({
        category: 'PAYMENT',
        subject: returnReasonTitle.trim() ? `İade talebi | ${returnReasonTitle.trim()}` : 'İade talebi',
        orderId: returnTargetOrder.id,
        initialMessage: `İade talebi - Sipariş #${returnTargetOrder.order_number || returnTargetOrder.id.slice(-6).toUpperCase()}\n\n${note}`,
      });

      setReturnTargetOrder(null);
      setReturnReasonTitle('');
      setReturnReason('');
      showSuccessToast('Iade talebi alindi', 'Destek ekibine iletildi.');
    } catch (err: any) {
      setReturnError(extractApiErrorMessage(err, 'Iade talebi gonderilemedi'));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-text-secondary">Siparişler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="seller-page-title">Sipariş Yönetimi</h1>
          <p className="seller-page-subtitle mt-1">Siparişleri hızlıca görüntüleyin ve yönetin.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ORDER_FILTERS.map((filter) => {
              const isActive = activeFilter === filter.key;

              return (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-primary text-white hover:bg-primary-600'
                      : 'border border-black/10 bg-white text-text-primary hover:bg-background'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="seller-surface-solid rounded-xl px-4 py-2.5 text-sm">
            <span className="text-text-secondary">Sipariş:</span>{' '}
            <span className="font-bold text-text-primary">{filteredOrders.length}</span>
          </div>
          <button
            onClick={() => {
              void fetchOrders();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-black/10 rounded-lg hover:bg-gray-50 hover:border-black/15 transition-all text-sm font-semibold text-text-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Yenile</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {error ? (
          <div className="seller-surface p-4 border border-error/40 bg-error/5 text-error">{error}</div>
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map((order) => {
            const primaryAction = getPrimaryAction(order);
            const canCancel = getNextStatuses(order.status).includes('cancelled');
            const isBusy = updatingOrderId === order.id;
            const scheduledDelivery = hasScheduledDelivery(order);
            const hasDirections = order.order_type !== 'pickup' && Boolean(order.customer_info.address);
            const paymentBadge = getPaymentBadge(order);

            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-lg border border-black/8 bg-white"
              >
                <div className={`h-1 w-full ${getStatusBarColor(order.status)}`}></div>
                <div className="p-3 lg:p-3.5">
                  <div className="space-y-2.5">
                    <div className="relative flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-primary">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Siparis No</div>
                            <div className="text-base font-bold text-text-primary">
                              #{order.order_number || order.id.slice(-6).toUpperCase()}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Ad Soyad</div>
                            <div className="font-medium text-text-primary">{order.customer_info.name}</div>
                          </div>
                          {order.customer_info.phone ? (
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Tel No</div>
                              <a
                                href={`tel:${order.customer_info.phone}`}
                                className="text-text-secondary hover:text-primary"
                              >
                                {order.customer_info.phone}
                              </a>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <span className={`hidden sm:inline-flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border px-4 py-1.5 text-xs font-bold ${paymentBadge.className}`}>
                        {paymentBadge.text}
                      </span>

                      <span className={`inline-flex self-start rounded-full border px-2 py-1 text-[10px] font-bold ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status, order.order_type)}
                      </span>
                    </div>

                    <div className="flex justify-center sm:hidden">
                      <span className={`inline-flex rounded-full border px-4 py-1.5 text-xs font-bold ${paymentBadge.className}`}>
                        {paymentBadge.text}
                      </span>
                    </div>

                    <div className="rounded-md bg-background/70 px-3 py-2.5">
                      <ul className="space-y-1">
                        {order.items.map((item, index) => {
                          const amountView = formatOrderItemAmount(item);
                          const count = getItemCount(item);

                          return (
                            <li key={`${order.id}-${item.product_id}-${index}`} className="flex items-start justify-between gap-3 text-sm leading-5">
                              <span className="font-semibold text-text-primary">{formatNumber(count, 0)}x {item.name}</span>
                              <span className="text-right text-xs text-text-secondary whitespace-nowrap">
                                <span>{amountView.main}</span>
                                {amountView.total ? <span className="block text-[11px] text-text-primary">{amountView.total}</span> : null}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="text-text-primary font-semibold">Toplam: {formatCurrency(order.total)}</div>
                      <div className={`font-semibold ${scheduledDelivery ? 'text-error' : 'text-text-primary'}`}>
                        Teslimat: {getDeliveryText(order)}
                      </div>
                    </div>

                    {order.notes ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        <span className="font-semibold">Müşteri Notu:</span> {order.notes}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {primaryAction ? (
                        <button
                          disabled={isBusy}
                          onClick={() => confirmTransition(order, primaryAction.nextStatus)}
                          className={`rounded-md px-3 py-2 text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${primaryAction.className}`}
                        >
                          {isBusy ? 'Guncelleniyor...' : primaryAction.label}
                        </button>
                      ) : (
                        <div className="rounded-md border border-dashed border-black/10 px-3 py-2 text-center text-xs font-medium text-text-secondary">
                          Aksiyon yok
                        </div>
                      )}

                      <button
                        disabled={isBusy || !canCancel}
                        onClick={() => void confirmTransition(order, 'cancelled')}
                        className="rounded-md px-3 py-2 text-sm font-bold bg-error text-white hover:bg-error/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Iptal
                      </button>

                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="rounded-md px-3 py-2 text-sm font-bold border border-black/10 bg-white text-text-primary hover:bg-background transition-colors"
                      >
                        Detay
                      </button>

                      <button
                        disabled={!hasDirections}
                        onClick={() => {
                          const address = encodeURIComponent(order.customer_info.address);
                          window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
                        }}
                        className="rounded-md px-3 py-2 text-sm font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#0a5c36' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#07462b';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#0a5c36';
                        }}
                      >
                        Yol Tarifi Al
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-black/10 bg-background/50 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-text-primary">Henüz sipariş bulunamadı.</p>
            <p className="mt-1 text-sm text-text-secondary">Yeni siparişler geldiğinde burada görüntülenecek.</p>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Sipariş Detayı</h2>
              <button onClick={() => setSelectedOrder(null)} className="text-text-secondary hover:text-text-primary">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex justify-center -mt-1">
                <span className={`inline-flex rounded-full border px-4 py-1.5 text-xs font-bold ${getPaymentBadge(selectedOrder).className}`}>
                  {getPaymentBadge(selectedOrder).text}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-text-secondary">Sipariş No</p>
                  <p className="font-medium">#{selectedOrder.order_number || selectedOrder.id.slice(-6).toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Tarih</p>
                  <p className="font-medium">{new Date(selectedOrder.created_at).toLocaleString('tr-TR')}</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Sipariş Tipi</p>
                  <p className="font-medium">{selectedOrder.order_type === 'pickup' ? 'Gel Al' : 'Teslimat'}</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Ödeme</p>
                  <p className="font-medium">{getPaymentBadge(selectedOrder).text}</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Durum</p>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${getStatusColor(selectedOrder.status)}`}>
                      {getStatusText(selectedOrder.status, selectedOrder.order_type)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Tahmini Teslimat</p>
                  <p className="font-semibold text-text-primary">{getDeliveryText(selectedOrder)}</p>
                </div>
                {selectedOrder.notes ? (
                  <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <span className="font-semibold">Müşteri Notu:</span> {selectedOrder.notes}
                  </div>
                ) : null}
              </div>

              <div>
                <h3 className="font-semibold text-text-primary mb-3">Müşteri Bilgileri</h3>
                <div className="bg-background rounded-lg p-4 space-y-3">
                  <p>
                    <span className="text-text-secondary">Ad:</span>{' '}
                    <span className="font-medium">{selectedOrder.customer_info.name}</span>
                  </p>
                  <p>
                    <span className="text-text-secondary">Telefon:</span>{' '}
                    {selectedOrder.customer_info.phone ? (
                      <a
                        href={`tel:${selectedOrder.customer_info.phone}`}
                        className="font-medium text-primary hover:text-primary-600 underline"
                      >
                        {selectedOrder.customer_info.phone}
                      </a>
                    ) : (
                      <span className="font-medium">-</span>
                    )}
                  </p>
                  {selectedOrder.order_type === 'pickup' ? (
                    <div className="bg-primary/10 text-primary rounded-lg px-3 py-2 font-semibold">Müşteri Gel Alacak</div>
                  ) : (
                    <div>
                      <p className="text-text-secondary mb-2">Teslimat Adresi:</p>
                      <p className="font-medium mb-3">{selectedOrder.customer_info.address || '-'}</p>

                      <button
                        onClick={() => {
                          const address = encodeURIComponent(selectedOrder.customer_info.address);
                          window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
                        }}
                        disabled={!selectedOrder.customer_info.address}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-600 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Yol Tarifi Al
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-text-primary mb-3">Ürünler</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-background">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-text-secondary">Ürün</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-text-secondary">Miktar</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-text-secondary">Birim Fiyat</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-text-secondary">Toplam</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedOrder.items.map((item, index) => {
                        const amountView = formatOrderItemAmount(item);
                        const count = getItemCount(item);

                        return (
                          <tr key={index}>
                            <td className="px-4 py-3 text-sm">{formatNumber(count, 0)}x {item.name}</td>
                            <td className="px-4 py-3 text-sm">
                              <div>{amountView.main}</div>
                              {amountView.total ? <div className="text-xs text-text-secondary">{amountView.total}</div> : null}
                            </td>
                            <td className="px-4 py-3 text-sm">{formatCurrency(item.unit_price)}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(item.total_price)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Ara Toplam</span>
                    <span className="font-medium">{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  {Number(selectedOrder.applied_product_discount_total || 0) > 0 && (
                    <div className="flex justify-between text-success">
                      <span>
                        Uygulanan Ürün İndirimi
                        {selectedOrder.applied_product_discount_label ? ` (${selectedOrder.applied_product_discount_label})` : ''}
                      </span>
                      <span className="font-semibold">-{formatCurrency(Number(selectedOrder.applied_product_discount_total || 0))}</span>
                    </div>
                  )}
                  {Number(selectedOrder.campaign_discount || 0) > 0 && (
                    <div className="flex justify-between text-success">
                      <span>
                        Uygulanan Kampanya İndirimi
                        {selectedOrder.campaign_label ? ` (${selectedOrder.campaign_label})` : ''}
                      </span>
                      <span className="font-semibold">-{formatCurrency(Number(selectedOrder.campaign_discount || 0))}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Teslimat Ücreti</span>
                    <span className="font-medium">{formatDeliveryFee(selectedOrder.delivery_fee)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Genel Toplam</span>
                    <span className="text-primary">{formatCurrency(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-text-primary mb-3">Sipariş Durumu</h3>
                <div className="bg-background rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-text-secondary">Mevcut durum:</span>
                    <span className={`px-3 py-1 text-sm rounded-full border font-semibold ${getStatusColor(selectedOrder.status)}`}>
                      {getStatusText(selectedOrder.status)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Not (opsiyonel)</label>
                    <input
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Kurye notu / iptal nedeni vb."
                      className="w-full px-4 py-2 border border-gray-light rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[selectedOrder.status, ...getNextStatuses(selectedOrder.status)].map((value) => {
                      const isBusy = updatingOrderId === selectedOrder.id;
                      const isCancel = value === 'cancelled';
                      const isCurrent = selectedOrder.status === value;

                      return (
                        <button
                          key={value}
                          disabled={isBusy || isCurrent}
                          onClick={() => {
                            if (isCancel) {
                              setCancelError('');
                              setCancelReasonTitle('');
                              setCancelReason((statusNote || '').trim());
                              setCancelTargetOrder(selectedOrder);
                              return;
                            }
                            void confirmTransition(selectedOrder, value);
                          }}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isCurrent
                              ? 'bg-white text-text-secondary border border-black/10'
                              : isCancel
                                ? 'bg-error text-white hover:bg-error/90'
                                : 'bg-primary text-white hover:bg-primary-600'
                          }`}
                        >
                          {isBusy && !isCurrent ? 'Güncelleniyor…' : getStatusText(value, selectedOrder.order_type)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {Array.isArray(selectedOrder.status_history) && selectedOrder.status_history.length > 0 && (
                <div>
                  <h3 className="font-semibold text-text-primary mb-3">Durum Geçmişi</h3>
                  <div className="bg-background rounded-lg p-4 space-y-2">
                    {selectedOrder.status_history
                      .slice()
                      .reverse()
                      .map((h, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-3">
                          <div className="text-sm">
                            <div className="font-semibold text-text-primary">{getStatusText(String(h.status), selectedOrder.order_type)}</div>
                            {h.note ? <div className="text-text-secondary">{h.note}</div> : null}
                          </div>
                          <div className="text-xs text-text-secondary whitespace-nowrap">
                            {new Date(h.changed_at).toLocaleString('tr-TR')}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {selectedOrder.status === 'cancelled' && (
                <div>
                  <h3 className="font-semibold text-text-primary mb-3">İptal Bilgisi</h3>
                  <div className="bg-background rounded-lg p-4 space-y-2">
                    <div className="text-sm text-text-secondary">
                      <span className="font-semibold text-text-primary">Sebep:</span>{' '}
                      {getCancelReasonLabel((selectedOrder as any).cancel_reason)}
                    </div>
                    {(selectedOrder as any).cancel_other_description ? (
                      <div className="text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">Açıklama:</span>{' '}
                        {(selectedOrder as any).cancel_other_description}
                      </div>
                    ) : null}
                    {(selectedOrder as any).cancelled_at ? (
                      <div className="text-xs text-text-secondary">
                        {new Date((selectedOrder as any).cancelled_at).toLocaleString('tr-TR')}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {(selectedOrder.status === 'delivered' || selectedOrder.status === 'cancelled') && (
                <div className="bg-background rounded-lg p-4 text-center">
                  <p className="text-text-secondary">
                    {selectedOrder.status === 'cancelled' ? 'Bu sipariş iptal edilmiştir.' : 'Bu sipariş tamamlanmıştır.'}
                  </p>
                </div>
              )}

              {selectedOrder.status === 'delivered' && (
                <div className="border-t pt-4">
                  <button
                    onClick={() => {
                      setReturnError('');
                      setReturnReasonTitle('');
                      setReturnReason((statusNote || '').trim());
                      setReturnTargetOrder(selectedOrder);
                    }}
                    className="w-full rounded-lg bg-error px-4 py-2.5 text-sm font-bold text-white hover:bg-error/90 transition-colors"
                  >
                    İade Talebi Oluştur
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {cancelTargetOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg max-w-xl w-full overflow-hidden">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Sipariş İptal</h2>
              <button
                onClick={() => {
                  if (updatingOrderId) return;
                  setCancelTargetOrder(null);
                }}
                className="text-text-secondary hover:text-text-primary disabled:opacity-40"
                disabled={Boolean(updatingOrderId)}
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-lg bg-background/70 px-3 py-2 text-sm text-text-primary">
                <span className="text-text-secondary">Sipariş:</span>{' '}
                <span className="font-semibold">#{cancelTargetOrder.order_number || cancelTargetOrder.id.slice(-6).toUpperCase()}</span>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Sebep Başlığı</label>
                <input
                  value={cancelReasonTitle}
                  onChange={(e) => setCancelReasonTitle(e.target.value)}
                  placeholder="Kısa başlık yazın (opsiyonel)"
                  className="w-full rounded-lg border border-gray-light px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">İptal Nedeni (Zorunlu)</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={5}
                  placeholder="Siparişi neden iptal ettiğinizi açıkça yazın..."
                  className="w-full rounded-lg border border-gray-light px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="mt-2 text-xs flex items-center justify-between">
                  <span className={cancelReason.trim().length >= MIN_CANCEL_NOTE_LENGTH ? 'text-success font-semibold' : 'text-text-secondary'}>
                    En az {MIN_CANCEL_NOTE_LENGTH} karakter zorunlu
                  </span>
                  <span className={cancelReason.trim().length >= MIN_CANCEL_NOTE_LENGTH ? 'text-success font-semibold' : 'text-text-secondary'}>
                    {Math.max(0, MIN_CANCEL_NOTE_LENGTH - cancelReason.trim().length)} karakter kaldı
                  </span>
                </div>
              </div>

              {cancelError ? (
                <div className="rounded-lg border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">{cancelError}</div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void submitCancel()}
                  disabled={Boolean(updatingOrderId) || cancelReason.trim().length < MIN_CANCEL_NOTE_LENGTH}
                  className="rounded-lg bg-error px-4 py-2 text-sm font-bold text-white hover:bg-error/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {updatingOrderId === cancelTargetOrder.id ? 'İptal ediliyor...' : 'Siparişi İptal Et'}
                </button>
                <button
                  onClick={() => setCancelTargetOrder(null)}
                  disabled={Boolean(updatingOrderId)}
                  className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-text-primary hover:bg-background disabled:opacity-50"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {returnTargetOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg max-w-xl w-full overflow-hidden">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">İade Talebi</h2>
              <button
                onClick={() => {
                  if (updatingOrderId) return;
                  setReturnTargetOrder(null);
                }}
                className="text-text-secondary hover:text-text-primary disabled:opacity-40"
                disabled={Boolean(updatingOrderId)}
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-lg bg-background/70 px-3 py-2 text-sm text-text-primary">
                <span className="text-text-secondary">Sipariş:</span>{' '}
                <span className="font-semibold">#{returnTargetOrder.order_number || returnTargetOrder.id.slice(-6).toUpperCase()}</span>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Sebep Başlığı</label>
                <input
                  value={returnReasonTitle}
                  onChange={(e) => setReturnReasonTitle(e.target.value)}
                  placeholder="Kısa başlık yazın (opsiyonel)"
                  className="w-full rounded-lg border border-gray-light px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">İade Nedeni (Zorunlu)</label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={5}
                  placeholder="İade talebinin nedenini açıkça yazın..."
                  className="w-full rounded-lg border border-gray-light px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="mt-2 text-xs flex items-center justify-between">
                  <span className={returnReason.trim().length >= MIN_RETURN_NOTE_LENGTH ? 'text-success font-semibold' : 'text-text-secondary'}>
                    En az {MIN_RETURN_NOTE_LENGTH} karakter zorunlu
                  </span>
                  <span className={returnReason.trim().length >= MIN_RETURN_NOTE_LENGTH ? 'text-success font-semibold' : 'text-text-secondary'}>
                    {Math.max(0, MIN_RETURN_NOTE_LENGTH - returnReason.trim().length)} karakter kaldı
                  </span>
                </div>
              </div>

              {returnError ? (
                <div className="rounded-lg border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">{returnError}</div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void submitReturnRequest()}
                  disabled={Boolean(updatingOrderId) || returnReason.trim().length < MIN_RETURN_NOTE_LENGTH}
                  className="rounded-lg bg-error px-4 py-2 text-sm font-bold text-white hover:bg-error/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {updatingOrderId === returnTargetOrder.id ? 'Gönderiliyor...' : 'İade Talebi Gönder'}
                </button>
                <button
                  onClick={() => setReturnTargetOrder(null)}
                  disabled={Boolean(updatingOrderId)}
                  className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-text-primary hover:bg-background disabled:opacity-50"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmActionModal
        open={Boolean(deliverConfirmOrder)}
        title="Siparisi teslim edildi olarak isaretlemek istiyor musun?"
        description="Bu islem sonrasinda siparis tamamlanmis olarak gorunecek."
        confirmLabel="Evet, teslim edildi"
        cancelLabel="Vazgeç"
        busy={Boolean(updatingOrderId && deliverConfirmOrder?.id === updatingOrderId)}
        onCancel={() => {
          if (updatingOrderId) return;
          setDeliverConfirmOrder(null);
        }}
        onConfirm={() => {
          if (!deliverConfirmOrder) return;
          const note = selectedOrder?.id === deliverConfirmOrder.id ? (statusNote || '').trim() : '';
          void handleStatusUpdate(deliverConfirmOrder.id, 'delivered', note || undefined);
          setDeliverConfirmOrder(null);
        }}
      />
    </div>
  );
};

export default Orders;
