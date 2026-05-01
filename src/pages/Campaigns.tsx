import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../services/api.ts';
import ProductDiscountSection from '../components/campaigns/ProductDiscountSection.tsx';
import ConfirmActionModal from '../components/common/ConfirmActionModal.tsx';
import { extractApiErrorMessage, showErrorToast, showSuccessToast } from '../lib/feedback.ts';

type CampaignStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'EXPIRED' | 'PASSIVE';

type SellerCampaign = {
  id: string;
  minBasketAmount: number;
  discountAmount: number;
  startDate: string;
  endDate: string;
  usageLimit: number | null;
  usageCount: number;
  status: CampaignStatus;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  minBasketAmount: string;
  discountAmount: string;
  startDate: string;
  endDate: string;
  usageLimit: string;
};

const CAMPAIGN_RULES = {
  minBasketAmountMin: 200,
  discountAmountMin: 20,
  maxDiscountRatio: 0.4,
  minDurationHours: 24,
  maxDurationDays: 30,
};

const toInputDateTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const toDateTimeLocalText = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getNowInput = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
};

const getAfterDaysInput = (days: number) => {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const toMoney = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};

const defaultFormState = (): FormState => ({
  minBasketAmount: '',
  discountAmount: '',
  startDate: getNowInput(),
  endDate: getAfterDaysInput(7),
  usageLimit: '',
});

const statusMeta = (status: CampaignStatus) => {
  if (status === 'ACTIVE') return { label: 'Aktif', className: 'bg-green-100 text-green-700' };
  if (status === 'PENDING') return { label: 'Onay Bekliyor', className: 'bg-yellow-100 text-yellow-700' };
  if (status === 'REJECTED') return { label: 'Reddedildi', className: 'bg-red-100 text-red-700' };
  if (status === 'EXPIRED') return { label: 'Süresi Bitti', className: 'bg-gray-100 text-gray-700' };
  return { label: 'Pasif', className: 'bg-slate-100 text-slate-700' };
};

const getRemainingDaysText = (endDate: string) => {
  const t = new Date(endDate).getTime();
  if (!Number.isFinite(t)) return 'Tarih yok';
  const diffMs = t - Date.now();
  if (diffMs <= 0) return 'Süresi doldu';
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (days === 1) return '1 gün kaldı';
  return `${days} gün kaldı`;
};

const normalizeList = (payload: any): SellerCampaign[] => {
  const list = payload?.data?.data || payload?.data || payload;
  if (!Array.isArray(list)) return [];

  return list
    .map((item: any) => ({
      id: String(item?.id || ''),
      minBasketAmount: toMoney(item?.minBasketAmount),
      discountAmount: toMoney(item?.discountAmount),
      startDate: String(item?.startDate || ''),
      endDate: String(item?.endDate || ''),
      usageLimit: item?.usageLimit == null ? null : Number(item.usageLimit),
      usageCount: Number(item?.usageCount || 0),
      status: String(item?.status || 'PENDING').toUpperCase() as CampaignStatus,
      rejectReason: item?.rejectReason ? String(item.rejectReason) : null,
      createdAt: String(item?.createdAt || ''),
      updatedAt: String(item?.updatedAt || ''),
    }))
    .filter((item) => Boolean(item.id));
};

const Campaigns: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DISCOUNT' | 'CAMPAIGN'>('DISCOUNT');
  const [campaigns, setCampaigns] = useState<SellerCampaign[]>([]);
  const [form, setForm] = useState<FormState>(defaultFormState());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | CampaignStatus>('ALL');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingDeleteCampaignId, setPendingDeleteCampaignId] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/vendor/seller-campaigns');
      setCampaigns(normalizeList(response));
    } catch (err: any) {
      setCampaigns([]);
      setError(err?.response?.data?.message || 'Kampanyalar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCampaigns();
  }, []);

  const visibleCampaigns = useMemo(() => {
    if (statusFilter === 'ALL') return campaigns;
    return campaigns.filter((c) => c.status === statusFilter);
  }, [campaigns, statusFilter]);

  const stats = useMemo(() => {
    const activeCount = campaigns.filter((c) => c.status === 'ACTIVE').length;
    const pendingCount = campaigns.filter((c) => c.status === 'PENDING').length;
    const rejectedCount = campaigns.filter((c) => c.status === 'REJECTED').length;
    const expiringSoonCount = campaigns.filter((c) => {
      if (c.status !== 'ACTIVE') return false;
      const diffMs = new Date(c.endDate).getTime() - Date.now();
      const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
      return days >= 0 && days <= 3;
    }).length;

    return {
      total: campaigns.length,
      activeCount,
      pendingCount,
      rejectedCount,
      expiringSoonCount,
    };
  }, [campaigns]);

  const activeCampaign = useMemo(
    () => campaigns.find((c) => c.status === 'ACTIVE') || null,
    [campaigns]
  );

  const resetForm = () => {
    setForm(defaultFormState());
    setEditingId(null);
  };

  const startEdit = (campaign: SellerCampaign) => {
    setEditingId(campaign.id);
    setForm({
      minBasketAmount: String(campaign.minBasketAmount),
      discountAmount: String(campaign.discountAmount),
      startDate: toInputDateTime(campaign.startDate),
      endDate: toInputDateTime(campaign.endDate),
      usageLimit: campaign.usageLimit == null ? '' : String(campaign.usageLimit),
    });
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateForm = () => {
    const minBasketAmount = toMoney(form.minBasketAmount);
    const discountAmount = toMoney(form.discountAmount);
    const usageLimit = form.usageLimit.trim() ? Number(form.usageLimit) : null;
    const startDate = new Date(form.startDate);
    const endDate = new Date(form.endDate);

    if (!Number.isFinite(minBasketAmount) || minBasketAmount < CAMPAIGN_RULES.minBasketAmountMin) {
      return `Kampanya min sepet en az ${CAMPAIGN_RULES.minBasketAmountMin} TL olmalı.`;
    }

    if (!Number.isFinite(discountAmount) || discountAmount < CAMPAIGN_RULES.discountAmountMin) {
      return `İndirim en az ${CAMPAIGN_RULES.discountAmountMin} TL olmalı.`;
    }

    if (discountAmount / minBasketAmount > CAMPAIGN_RULES.maxDiscountRatio) {
      return 'İndirim oranı min sepetin %40\'ını geçemez.';
    }

    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      return 'Başlangıç ve bitiş tarihi geçerli olmalı.';
    }

    const durationMs = endDate.getTime() - startDate.getTime();
    if (durationMs < CAMPAIGN_RULES.minDurationHours * 60 * 60 * 1000) {
      return 'Kampanya süresi en az 24 saat olmalı.';
    }

    if (durationMs > CAMPAIGN_RULES.maxDurationDays * 24 * 60 * 60 * 1000) {
      return 'Kampanya süresi en fazla 30 gün olabilir.';
    }

    if (usageLimit != null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) {
      return 'Kullanım limiti pozitif tam sayı olmalı.';
    }

    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      minBasketAmount: toMoney(form.minBasketAmount),
      discountAmount: toMoney(form.discountAmount),
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      usageLimit: form.usageLimit.trim() ? Number(form.usageLimit) : null,
    };

    try {
      setSaving(true);
      if (editingId) {
        await apiClient.put(`/api/vendor/seller-campaigns/${editingId}`, payload);
        setSuccess('Kampanya güncellendi ve tekrar onaya gönderildi.');
      } else {
        await apiClient.post('/api/vendor/seller-campaigns', payload);
        setSuccess('Kampanya oluşturuldu ve admin onayına gönderildi.');
      }

      resetForm();
      await fetchCampaigns();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Kampanya kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCampaign = async (id: string) => {
    setPendingDeleteCampaignId(id);
  };

  const confirmDeleteCampaign = async () => {
    if (!pendingDeleteCampaignId) return;

    try {
      await apiClient.delete(`/api/vendor/seller-campaigns/${pendingDeleteCampaignId}`);
      setSuccess('Kampanya silindi.');
      showSuccessToast('Kampanya silindi');
      await fetchCampaigns();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      const message = extractApiErrorMessage(err, 'Kampanya silinemedi.');
      setError(message);
      showErrorToast('Kampanya silinemedi', message);
    } finally {
      setPendingDeleteCampaignId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="seller-page-title">İndirimler/Kampanyalar</h1>
        <p className="seller-page-subtitle mt-2">İndirim veya kampanya yönetimini üstteki sekmelerden seçin.</p>
      </div>

      <div className="seller-surface p-3">
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('DISCOUNT')}
            className={activeTab === 'DISCOUNT' ? 'seller-btn-primary px-5 py-2' : 'seller-btn-ghost px-5 py-2'}
          >
            İndirim
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CAMPAIGN')}
            className={activeTab === 'CAMPAIGN' ? 'seller-btn-primary px-5 py-2' : 'seller-btn-ghost px-5 py-2'}
          >
            Kampanya
          </button>
        </div>
      </div>

      {activeTab === 'DISCOUNT' ? (
        <ProductDiscountSection />
      ) : (
        <>

      {error && (
        <div className="rounded-xl border border-error/25 bg-error/5 p-4">
          <p className="text-error font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-success/25 bg-success/5 p-4">
          <p className="text-success font-medium">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary">Toplam</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{stats.total}</p>
        </div>
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary">Aktif</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.activeCount}</p>
        </div>
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary">Onay Bekleyen</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pendingCount}</p>
        </div>
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary">Reddedilen</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.rejectedCount}</p>
        </div>
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary">3 Gün İçinde Bitecek</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{stats.expiringSoonCount}</p>
        </div>
      </div>

      {activeCampaign && (
        <div className="seller-surface-muted p-4">
          <h3 className="text-sm font-bold text-text-primary mb-1">Aktif Kampanya</h3>
          <p className="text-sm text-text-secondary">
            {toMoney(activeCampaign.minBasketAmount)} TL üzeri {toMoney(activeCampaign.discountAmount)} TL indirim • {getRemainingDaysText(activeCampaign.endDate)}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="seller-surface p-6">
        <h3 className="text-lg font-bold text-text-primary mb-5">
          {editingId ? 'Kampanyayı Düzenle' : 'Yeni Sepet Kampanyası'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-text-primary mb-2">Kampanya Min Sepet (TL)</label>
            <input
              type="number"
              min={CAMPAIGN_RULES.minBasketAmountMin}
              step="0.01"
              value={form.minBasketAmount}
              onChange={(e) => setForm((prev) => ({ ...prev, minBasketAmount: e.target.value }))}
              className="seller-input"
              placeholder="Örn: 400"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-text-primary mb-2">İndirim Tutarı (TL)</label>
            <input
              type="number"
              min={CAMPAIGN_RULES.discountAmountMin}
              step="0.01"
              value={form.discountAmount}
              onChange={(e) => setForm((prev) => ({ ...prev, discountAmount: e.target.value }))}
              className="seller-input"
              placeholder="Örn: 50"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-text-primary mb-2">Başlangıç</label>
            <input
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
              className="seller-input"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-text-primary mb-2">Bitiş</label>
            <input
              type="datetime-local"
              value={form.endDate}
              onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              className="seller-input"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-text-primary mb-2">Kullanım Limiti (opsiyonel)</label>
            <input
              type="number"
              min={1}
              step={1}
              value={form.usageLimit}
              onChange={(e) => setForm((prev) => ({ ...prev, usageLimit: e.target.value }))}
              className="seller-input"
              placeholder="Boş bırak = limitsiz"
            />
          </div>
        </div>

        <div className="mt-5 seller-surface-muted p-4">
          <p className="text-xs text-text-secondary">
            Kurallar: Min sepet ≥ {CAMPAIGN_RULES.minBasketAmountMin} TL • İndirim ≥ {CAMPAIGN_RULES.discountAmountMin} TL • Oran ≤ %40 • Süre 24 saat - 30 gün
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-5 border-t mt-5">
          <button
            type="button"
            onClick={resetForm}
            className="seller-btn-ghost px-5 py-2"
          >
            Temizle
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center rounded-xl border border-error/25 bg-error/5 px-5 py-2 text-sm font-semibold text-error hover:bg-error/10"
            >
              İptal
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="seller-btn-primary px-5 py-2 font-bold"
          >
            {saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Kampanya Oluştur'}
          </button>
        </div>
      </form>

      <div className="seller-surface p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold text-text-primary">Kampanya Listesi</h3>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | CampaignStatus)}
            className="seller-input w-full lg:w-64"
          >
            <option value="ALL">Tüm Durumlar</option>
            <option value="PENDING">Onay Bekleyen</option>
            <option value="ACTIVE">Aktif</option>
            <option value="REJECTED">Reddedilen</option>
            <option value="EXPIRED">Süresi Biten</option>
            <option value="PASSIVE">Pasif</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-text-secondary">Yükleniyor...</div>
        ) : visibleCampaigns.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-text-secondary">Kampanya bulunamadı</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleCampaigns.map((campaign) => {
              const meta = statusMeta(campaign.status);
              return (
                <div key={campaign.id} className="rounded-xl border border-black/10 bg-white/70 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <span className="inline-flex items-center rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">
                      {campaign.discountAmount} TL Sepette
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${meta.className}`}>
                      {meta.label}
                    </span>
                  </div>

                  <p className="text-sm text-text-secondary">{campaign.minBasketAmount} TL üzeri sepet</p>
                  <p className="text-xs text-text-secondary mt-1">{getRemainingDaysText(campaign.endDate)}</p>
                  <p className="text-xs text-text-secondary mt-1">
                    Kullanım: {campaign.usageCount}
                    {campaign.usageLimit != null ? ` / ${campaign.usageLimit}` : ' / Limitsiz'}
                  </p>

                  <div className="text-xs text-text-secondary space-y-1 mt-3">
                    <p>Başlangıç: {toDateTimeLocalText(campaign.startDate)}</p>
                    <p>Bitiş: {toDateTimeLocalText(campaign.endDate)}</p>
                  </div>

                  {campaign.rejectReason ? (
                    <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">
                      Red nedeni: {campaign.rejectReason}
                    </div>
                  ) : null}

                  <div className="flex gap-2 pt-3 border-t mt-3">
                    <button
                      onClick={() => startEdit(campaign)}
                      disabled={campaign.status === 'ACTIVE'}
                      className="seller-btn-outline flex-1 disabled:opacity-50"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => void deleteCampaign(campaign.id)}
                      disabled={campaign.status === 'ACTIVE'}
                      className="inline-flex flex-1 items-center justify-center rounded-xl border border-error/25 bg-error/5 px-4 py-2.5 text-sm font-semibold text-error hover:bg-error/10 disabled:opacity-50"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}

      <ConfirmActionModal
        open={Boolean(pendingDeleteCampaignId)}
        title="Ürünü silmek istiyor musun?"
        description="Bu işlem geri alınamaz."
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        onCancel={() => setPendingDeleteCampaignId(null)}
        onConfirm={() => void confirmDeleteCampaign()}
      />
    </div>
  );
};

export default Campaigns;
