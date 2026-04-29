import React, { useState, useEffect, useMemo } from 'react';
import { dashboardAPI } from '../services/api.ts';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { 
  ShoppingCart, Package,
  Eye, RotateCcw, Download, FileText, Calendar
} from 'lucide-react';

const CHART_GREEN = 'var(--seller-brand-green)';
const CHART_ORANGE = 'var(--seller-accent-orange)';
const CHART_NEUTRAL = '#8E8478';
const CHART_GRID = '#E6E1DA';
const CHART_TICK = '#7A746C';

const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | '90days'>('30days');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getStats();
      setStats(response.data.data);
    } catch (err) {
      console.error('Stats fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Chart data from API or defaults
  const chartData = stats?.chart_data || [
    { date: '17/01', orders: 0, revenue: 0 },
    { date: '18/01', orders: 0, revenue: 0 },
    { date: '19/01', orders: 0, revenue: 0 },
    { date: '20/01', orders: 0, revenue: 0 },
    { date: '21/01', orders: 0, revenue: 0 },
    { date: '22/01', orders: 0, revenue: 0 },
    { date: '23/01', orders: 0, revenue: 0 },
  ];

  // Performance metrics from real data
  const todayOrders = stats?.today?.orders || 0;
  const weekOrders = stats?.week?.orders || 0;
  const monthOrders = stats?.month?.orders || 0;
  const todayRevenue = stats?.today?.revenue || 0;
  const weekRevenue = stats?.week?.revenue || 0;
  const monthRevenue = stats?.month?.revenue || 0;
  const totalProducts = stats?.products?.total || 0;
  const activeProducts = stats?.products?.active || 0;

  const selectedRange = useMemo(() => {
    if (timeRange === '7days') {
      return {
        key: '7days' as const,
        label: 'Son 7 Gün',
        orders: weekOrders,
        revenue: weekRevenue,
      };
    }

    if (timeRange === '90days') {
      return {
        key: '90days' as const,
        label: 'Son 90 Gün',
        orders: monthOrders,
        revenue: monthRevenue,
      };
    }

    return {
      key: '30days' as const,
      label: 'Son 30 Gün',
      orders: monthOrders,
      revenue: monthRevenue,
    };
  }, [timeRange, weekOrders, weekRevenue, monthOrders, monthRevenue]);

  const avgOrderValue = selectedRange.orders > 0 ? (selectedRange.revenue / selectedRange.orders) : 0;
  const activeProductRate = totalProducts > 0 ? (activeProducts / totalProducts) * 100 : 0;
  const ordersPerActiveProduct = activeProducts > 0 ? (selectedRange.orders / activeProducts) : 0;

  const metrics = [
    { 
      label: 'Ortalama Sipariş Tutarı', 
      value: `₺${avgOrderValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`, 
      detail: `${selectedRange.label} bazında`,
      icon: ShoppingCart,
      color: 'emerald'
    },
    { 
      label: 'Aktif Ürün Oranı', 
      value: `${activeProductRate.toFixed(0)}%`,
      detail: `${activeProducts}/${totalProducts} ürün aktif`,
      icon: Package,
      color: 'blue'
    },
    { 
      label: `${selectedRange.label} Sipariş`,
      value: selectedRange.orders.toLocaleString('tr-TR'),
      detail: 'Canlı sipariş verisi',
      icon: Eye,
      color: 'purple'
    },
    { 
      label: 'Aktif Ürün Başına Sipariş',
      value: ordersPerActiveProduct.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      detail: `${selectedRange.label} bazında`,
      icon: RotateCcw,
      color: 'amber'
    },
  ];

  // Pie chart data - revenue distribution by period
  const pieData = [
    { name: 'Bugün', value: todayRevenue, color: CHART_GREEN },
    { name: 'Bu Hafta', value: weekRevenue - todayRevenue, color: CHART_ORANGE },
    { name: 'Bu Ay', value: monthRevenue - weekRevenue, color: CHART_NEUTRAL },
  ].filter(d => d.value > 0);

  const getColorClass = (color: string) => {
    const colors: Record<string, string> = {
      emerald: 'bg-emerald-100 text-emerald-600',
      blue: 'bg-emerald-100 text-emerald-600',
      purple: 'bg-amber-100 text-amber-600',
      amber: 'bg-amber-100 text-amber-600',
    };
    return colors[color] || colors.emerald;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-text-secondary font-medium">Analitik yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="seller-page-title">Analitik</h1>
          <p className="seller-page-subtitle mt-1">Satış performansınızı detaylı inceleyin</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 seller-surface-solid rounded-xl px-3 py-2">
            <Calendar className="w-4 h-4 text-text-secondary" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="bg-transparent border-0 text-sm font-medium text-text-primary focus:ring-0 pr-6"
            >
              <option value="7days">Son 7 Gün</option>
              <option value="30days">Son 30 Gün</option>
              <option value="90days">Son 90 Gün</option>
            </select>
          </div>
          {timeRange === '90days' && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
              Şu an 30 günlük veri mevcut
            </span>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((metric, index) => (
          <div key={index} className="seller-surface-solid p-4">
            <div className="flex items-center mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${getColorClass(metric.color)}`}>
                <metric.icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-sm text-text-secondary mb-1">{metric.label}</p>
            <p className="text-xl font-bold text-text-primary">{metric.value}</p>
            <p className="text-xs text-text-secondary mt-1">{metric.detail}</p>
          </div>
        ))}
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <p className="text-text-secondary text-sm mb-1">Bugünkü Net Gelir</p>
          <p className="text-xl font-bold text-text-primary">₺{todayRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
          <p className="text-text-secondary text-xs mt-2">{todayOrders} sipariş</p>
        </div>
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <p className="text-text-secondary text-sm mb-1">Haftalık Net Gelir</p>
          <p className="text-xl font-bold text-text-primary">₺{weekRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
          <p className="text-text-secondary text-xs mt-2">{weekOrders} sipariş</p>
        </div>
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <p className="text-text-secondary text-sm mb-1">Aylık Net Gelir</p>
          <p className="text-xl font-bold text-text-primary">₺{monthRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
          <p className="text-text-secondary text-xs mt-2">{monthOrders} sipariş</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 seller-surface overflow-hidden">
          <div className="p-4 border-b border-black/5">
            <h3 className="font-semibold text-text-primary">Gelir Trendi</h3>
            <p className="text-sm text-text-secondary">Son 7 günlük gelir grafiği</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_GREEN} stopOpacity={0.24}/>
                    <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke={CHART_TICK} />
                <YAxis tick={{ fontSize: 11 }} stroke={CHART_TICK} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--seller-neutral-0)',
                    border: '1px solid var(--seller-neutral-200)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value: number) => [`₺${value.toLocaleString('tr-TR')}`, 'Net Gelir']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke={CHART_GREEN}
                  strokeWidth={2}
                  fill="url(#revenueGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Distribution */}
        <div className="seller-surface overflow-hidden">
          <div className="p-4 border-b border-black/5">
            <h3 className="font-semibold text-text-primary">Gelir Dağılımı</h3>
            <p className="text-sm text-text-secondary">Periyoda göre dağılım</p>
          </div>
          <div className="p-4">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `₺${value.toLocaleString('tr-TR')}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[190px] flex items-center justify-center text-text-secondary">
                Henüz veri yok
              </div>
            )}
            <div className="space-y-2 mt-4">
              {pieData.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-text-secondary">{item.name}</span>
                  </div>
                  <span className="font-medium text-text-primary">₺{item.value.toLocaleString('tr-TR')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Order Trend Chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-text-primary">Sipariş Trendi</h3>
          <p className="text-sm text-text-secondary">Son 7 günlük sipariş grafiği</p>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke={CHART_TICK} />
              <YAxis tick={{ fontSize: 11 }} stroke={CHART_TICK} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--seller-neutral-0)',
                  border: '1px solid var(--seller-neutral-200)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Bar dataKey="orders" fill={CHART_ORANGE} radius={[6, 6, 0, 0]} name="Sipariş" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Product Stats */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-text-primary">Ürün İstatistikleri</h3>
          <p className="text-sm text-text-secondary">Mağazanızdaki ürün durumu</p>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xl font-bold text-text-primary">{totalProducts}</p>
              <p className="text-xs text-text-secondary mt-1">Toplam Ürün</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <p className="text-xl font-bold text-emerald-600">{activeProducts}</p>
              <p className="text-xs text-text-secondary mt-1">Aktif Ürün</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <p className="text-xl font-bold text-amber-600">{stats?.products?.low_stock || 0}</p>
              <p className="text-xs text-text-secondary mt-1">Düşük Stok</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-xl font-bold text-amber-600">{monthOrders}</p>
              <p className="text-xs text-text-secondary mt-1">Aylık Satış</p>
            </div>
          </div>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex justify-end gap-3">
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-text-primary rounded-lg hover:bg-gray-50 transition-all font-medium text-sm">
          <Download className="w-4 h-4" />
          Excel İndir
        </button>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-all font-semibold text-sm">
          <FileText className="w-4 h-4" />
          PDF Rapor
        </button>
      </div>
    </div>
  );
};

export default Analytics;
