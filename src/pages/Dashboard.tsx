import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../services/api.ts';
import { DashboardStats } from '../types/index.ts';
import { 
  Package, ShoppingCart,
  AlertTriangle, RefreshCw, ArrowRight,
  Wallet, Star
} from 'lucide-react';

const REFRESH_INTERVAL_MS = 30000;

const formatCurrency = (value: number) =>
  `₺${Number(value || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getOrderCustomerLabel = (order: DashboardStats['recent_orders'][number]) => {
  const customerName = String(order?.customer_info?.name || '').trim();
  if (customerName) return customerName;

  const fallbackPhone = String(order?.customer_info?.phone || '').trim();
  if (fallbackPhone) return fallbackPhone;

  return 'Müşteri bilgisi yok';
};

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    void fetchStats();

    const intervalId = window.setInterval(() => {
      void fetchStats(true);
    }, REFRESH_INTERVAL_MS);

    const handleWindowFocus = () => {
      void fetchStats(true);
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const fetchStats = async (silent = false) => {
    try {
      setRefreshing(true);
      const response = await dashboardAPI.getStats();
      setStats(response.data.data);
      setError('');
      setLastUpdatedAt(new Date());
    } catch (err: any) {
      setError(err.response?.data?.detail || 'İstatistikler yüklenemedi');
    } finally {
      if (!silent) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-text-secondary font-medium">Kontrol Paneli yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Bir Hata Oluştu</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchStats}
            className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const todayRevenue = stats.today?.revenue || 0;
  const weekRevenue = stats.week?.revenue || 0;
  const monthRevenue = stats.month?.revenue || 0;
  const todayOrders = stats.today?.orders || 0;
  const weekOrders = stats.week?.orders || 0;
  const monthOrders = stats.month?.orders || 0;
  const pendingOrders = stats.pending?.orders || 0;
  const lowStockCount = stats.products?.low_stock || 0;
  const activeProducts = stats.products?.active || 0;
  const totalProducts = stats.products?.total || 0;
  const recentOrders = stats.recent_orders || [];

  const preparingCount = recentOrders.filter((o) => o.status === 'preparing').length;
  const onTheWayCount = recentOrders.filter((o) => o.status === 'on_the_way').length;
  const deliveredCount = recentOrders.filter((o) => o.status === 'delivered').length;
  const cancelledCount = recentOrders.filter((o) => o.status === 'cancelled').length;

  const todayAvgBasket = todayOrders > 0 ? todayRevenue / todayOrders : 0;
  const activeProductRate = totalProducts > 0 ? Math.round((activeProducts / totalProducts) * 100) : 0;
  const lowStockRate = totalProducts > 0 ? Math.round((lowStockCount / totalProducts) * 100) : 0;
  const recentOrderCompletionRate =
    recentOrders.length > 0 ? Math.round((deliveredCount / recentOrders.length) * 100) : 0;
  const pendingPressure = todayOrders > 0 ? Math.round((pendingOrders / todayOrders) * 100) : 0;
  const weekDailyOrderAvg = weekOrders > 0 ? weekOrders / 7 : 0;
  const weekDailyRevenueAvg = weekRevenue > 0 ? weekRevenue / 7 : 0;
  const orderMomentumPct =
    weekDailyOrderAvg > 0 ? Math.round(((todayOrders - weekDailyOrderAvg) / weekDailyOrderAvg) * 100) : 0;
  const revenueMomentumPct =
    weekDailyRevenueAvg > 0 ? Math.round(((todayRevenue - weekDailyRevenueAvg) / weekDailyRevenueAvg) * 100) : 0;

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="seller-page-title">Kontrol Paneli</h1>
        </div>
        <button
          onClick={() => void fetchStats()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium text-text-primary disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Yenile</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <p className="text-text-secondary text-sm font-medium">Bugünkü Net Gelir</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{formatCurrency(todayRevenue)}</p>
        </div>

        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <p className="text-text-secondary text-sm font-medium">Bugünkü Siparişler</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{todayOrders}</p>
        </div>

        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-700">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <p className="text-text-secondary text-sm font-medium">Günlük Ortalama Sepet</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{formatCurrency(todayAvgBasket)}</p>
        </div>

        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center text-violet-700">
              <Star className="w-5 h-5" />
            </div>
          </div>
          <p className="text-text-secondary text-sm font-medium">Son Sipariş Tamamlanma</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">%{recentOrderCompletionRate}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-text-primary">Operasyon Omurgası</h3>
            <p className="text-sm text-text-secondary mt-1">
              Satıcı panelinin kritik karar alanları: sipariş akışı, gelir verimliliği, ürün sağlığı ve teslimat başarısı.
            </p>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-4">
              <p className="text-sm font-semibold text-amber-800">1. Sipariş Akışı</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-text-secondary">Bekleyen</p>
                  <p className="text-xl font-bold text-text-primary">{pendingOrders}</p>
                </div>
                <div>
                  <p className="text-text-secondary">Hazırlanan</p>
                  <p className="text-xl font-bold text-text-primary">{preparingCount}</p>
                </div>
                <div>
                  <p className="text-text-secondary">Yolda</p>
                  <p className="text-xl font-bold text-text-primary">{onTheWayCount}</p>
                </div>
                <div>
                  <p className="text-text-secondary">Baskı</p>
                  <p className="text-xl font-bold text-text-primary">%{pendingPressure}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-sm font-semibold text-emerald-800">2. Gelir Verimliliği</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Bugünkü Gelir</span>
                  <span className="font-bold text-text-primary">{formatCurrency(todayRevenue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Ortalama Sepet</span>
                  <span className="font-bold text-text-primary">{formatCurrency(todayAvgBasket)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Aylık Gelir</span>
                  <span className="font-bold text-text-primary">{formatCurrency(monthRevenue)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
              <p className="text-sm font-semibold text-blue-800">3. Ürün Sağlığı</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Aktif / Toplam</span>
                  <span className="font-bold text-text-primary">{activeProducts}/{totalProducts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Aktiflik Oranı</span>
                  <span className="font-bold text-text-primary">%{activeProductRate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Düşük Stok Riski</span>
                  <span className="font-bold text-text-primary">{lowStockCount} (%{lowStockRate})</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-violet-50 border border-violet-100 p-4">
              <p className="text-sm font-semibold text-violet-800">4. Hizmet Güveni</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Teslim Edilen (son siparişler)</span>
                  <span className="font-bold text-text-primary">{deliveredCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">İptal (son siparişler)</span>
                  <span className="font-bold text-text-primary">{cancelledCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Tamamlanma Oranı</span>
                  <span className="font-bold text-text-primary">%{recentOrderCompletionRate}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-text-primary">Hızlı İşlemler</h3>
          </div>
          <div className="p-3 space-y-2">
            <Link
              to="/orders"
              className="flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center text-white">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Siparişleri Gör</p>
                  <p className="text-xs text-text-secondary">{pendingOrders} bekliyor</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-blue-500 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/products"
              className="flex items-center justify-between p-3 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Ürünleri Yönet</p>
                  <p className="text-xs text-text-secondary">{totalProducts} ürün</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-emerald-500 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/campaigns"
              className="flex items-center justify-between p-3 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center text-white">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Ürün İndirimleri</p>
                  <p className="text-xs text-text-secondary">İndirim oluştur</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-amber-500 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/analytics"
              className="flex items-center justify-between p-3 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center text-white">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Analitiği İncele</p>
                  <p className="text-xs text-text-secondary">Detaylı raporlar</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-amber-500 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-text-primary">Haftalık ve Aylık Trend</h3>
            <p className="text-sm text-text-secondary">Tekrarsız tempo görünümü: günlük performansın haftalık ortalamaya göre konumu</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-secondary">Sipariş temposu (bugün vs hafta ort.)</p>
                <p className={`text-sm font-bold ${orderMomentumPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {orderMomentumPct >= 0 ? '+' : ''}%{orderMomentumPct}
                </p>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Bugün: {todayOrders} | Haftalık günlük ort.: {weekDailyOrderAvg.toFixed(1)}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-secondary">Gelir temposu (bugün vs hafta ort.)</p>
                <p className={`text-sm font-bold ${revenueMomentumPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {revenueMomentumPct >= 0 ? '+' : ''}%{revenueMomentumPct}
                </p>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Bugün: {formatCurrency(todayRevenue)} | Haftalık günlük ort.: {formatCurrency(weekDailyRevenueAvg)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-blue-50 p-3 text-center">
                <p className="text-lg font-bold text-blue-700">{weekOrders}</p>
                <p className="text-xs text-text-secondary mt-1">Haftalık Sipariş</p>
                <p className="text-xs text-text-secondary mt-0.5">{formatCurrency(weekRevenue)}</p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-3 text-center">
                <p className="text-lg font-bold text-indigo-700">{monthOrders}</p>
                <p className="text-xs text-text-secondary mt-1">Aylık Sipariş</p>
                <p className="text-xs text-text-secondary mt-0.5">{formatCurrency(monthRevenue)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-text-primary">Operasyon Öncelikleri</h3>
            <p className="text-sm text-text-secondary">Tekrar eden özet yerine bugün müdahale etmeniz gereken alanlar</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-amber-800">Sipariş kuyruğu</p>
                <span className="text-sm font-bold text-text-primary">{pendingOrders} bekleyen</span>
              </div>
              <p className="text-xs text-text-secondary mt-1">Bekleyen siparişlerin bugünkü siparişlere oranı: %{pendingPressure}</p>
              <Link to="/orders" className="text-xs text-amber-700 hover:underline mt-2 inline-block">Sipariş akışını aç →</Link>
            </div>

            <div className="rounded-lg border border-red-100 bg-red-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-red-800">Stok riski</p>
                <span className="text-sm font-bold text-text-primary">{lowStockCount} ürün</span>
              </div>
              <p className="text-xs text-text-secondary mt-1">Düşük stok oranı: %{lowStockRate} | Aktiflik oranı: %{activeProductRate}</p>
              <Link to="/products" className="text-xs text-red-700 hover:underline mt-2 inline-block">Stokları düzenle →</Link>
            </div>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-emerald-800">Servis kalitesi</p>
                <span className="text-sm font-bold text-text-primary">%{recentOrderCompletionRate} tamamlanma</span>
              </div>
              <p className="text-xs text-text-secondary mt-1">Son siparişlerde teslim: {deliveredCount} | iptal: {cancelledCount}</p>
              <Link to="/analytics" className="text-xs text-emerald-700 hover:underline mt-2 inline-block">Detaylı performans analizi →</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-text-primary">Son Siparişler</h3>
            <p className="text-sm text-text-secondary">En son gelen siparişleriniz</p>
          </div>
          <Link 
            to="/orders" 
            className="text-sm font-medium text-primary hover:text-primary-600 flex items-center gap-1"
          >
            Tümünü Gör
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        {stats.recent_orders && stats.recent_orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Sipariş</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Müşteri</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Tutar</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Durum</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.recent_orders.slice(0, 5).map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-text-primary">
                        #{order.order_number || order.id.slice(-6).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-text-primary">{getOrderCustomerLabel(order)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-text-primary">
                        {formatCurrency(order.total || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        order.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-700'
                          : order.status === 'cancelled'
                          ? 'bg-red-100 text-red-700'
                          : order.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : order.status === 'preparing'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {order.status === 'pending' && 'Beklemede'}
                        {order.status === 'preparing' && 'Hazırlanıyor'}
                        {order.status === 'on_the_way' && 'Yolda'}
                        {order.status === 'delivered' && 'Teslim Edildi'}
                        {order.status === 'cancelled' && 'İptal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-sm">
                      {new Date(order.created_at).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-text-secondary font-medium">Henüz sipariş bulunmuyor</p>
            <p className="text-sm text-text-secondary mt-1">Siparişler burada görünecek</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
