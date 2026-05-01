import React, { useEffect, useMemo, useState } from 'react';
import apiClient, { productsAPI } from '../../services/api.ts';
import { Product } from '../../types/index.ts';
import ConfirmActionModal from '../common/ConfirmActionModal.tsx';
import { extractApiErrorMessage, showErrorToast, showSuccessToast } from '../../lib/feedback.ts';

type DiscountCampaignStatus = 'pending' | 'active' | 'expired' | 'passive';

type DiscountCampaign = {
  id: string;
  scope: 'all' | 'selected';
  discountType: 'percentage' | 'fixed';
  discountAmount: number;
  startDate: string;
  endDate: string;
  selectedProducts: string[];
  status: DiscountCampaignStatus;
  createdAt: string;
};

type DiscountForm = {
  scope: 'all' | 'selected';
  discountType: 'percentage' | 'fixed';
  discountAmount: string;
  startDate: string;
  endDate: string;
  selectedProducts: string[];
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

const defaultForm = (): DiscountForm => ({
  scope: 'all',
  discountType: 'percentage',
  discountAmount: '',
  startDate: getNowInput(),
  endDate: getAfterDaysInput(7),
  selectedProducts: [],
});

const statusMeta = (status: DiscountCampaignStatus) => {
  if (status === 'active') return { label: 'Aktif', className: 'bg-green-100 text-green-700' };
  if (status === 'pending') return { label: 'Planlandı', className: 'bg-yellow-100 text-yellow-700' };
  if (status === 'expired') return { label: 'Süresi Bitti', className: 'bg-gray-100 text-gray-700' };
  return { label: 'Pasif', className: 'bg-slate-100 text-slate-700' };
};

const normalizeCampaigns = (payload: any): DiscountCampaign[] => {
  const list = payload?.data?.data || payload?.data || payload;
  if (!Array.isArray(list)) return [];

  return list
    .map<DiscountCampaign>((item: any) => {
      const scope: DiscountCampaign['scope'] =
        String(item?.scope || 'all').toLowerCase() === 'selected' ? 'selected' : 'all';
      const discountType: DiscountCampaign['discountType'] =
        String(item?.discountType || 'percentage').toLowerCase() === 'fixed' ? 'fixed' : 'percentage';
      const statusRaw = String(item?.status || 'pending').toLowerCase();
      const status: DiscountCampaign['status'] =
        statusRaw === 'active' || statusRaw === 'expired' || statusRaw === 'passive'
          ? statusRaw
          : 'pending';

      let selectedProducts: string[] = [];
      if (Array.isArray(item?.selectedProducts)) {
        selectedProducts = item.selectedProducts.map((x: any) => String(x));
      } else if (typeof item?.selectedProducts === 'string') {
        try {
          const parsed = JSON.parse(item.selectedProducts);
          if (Array.isArray(parsed)) {
            selectedProducts = parsed.map((x: any) => String(x));
          }
        } catch {
          selectedProducts = [];
        }
      }

      return {
        id: String(item?.id || ''),
        scope,
        discountType,
        discountAmount: toMoney(item?.discountAmount),
        startDate: String(item?.startDate || ''),
        endDate: String(item?.endDate || ''),
        selectedProducts,
        status,
        createdAt: String(item?.createdAt || ''),
      };
    })
    .filter((item) => Boolean(item.id));
};

const ProductDiscountSection: React.FC = () => {
  const [campaigns, setCampaigns] = useState<DiscountCampaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearchInput, setProductSearchInput] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [form, setForm] = useState<DiscountForm>(defaultForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteDiscountId, setPendingDeleteDiscountId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const productsById = useMemo(() => {
    return products.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, Product>);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = productSearchQuery.trim().toLocaleLowerCase('tr-TR');
    if (!q) return products;

    return products.filter((product) => {
      const name = String(product?.name || '').toLocaleLowerCase('tr-TR');
      return name.includes(q);
    });
  }, [products, productSearchQuery]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');
      const [campaignRes, productsRes] = await Promise.all([
        apiClient.get('/api/vendor/campaigns'),
        productsAPI.getAll(),
      ]);

      setCampaigns(normalizeCampaigns(campaignRes));

      const productList = productsRes?.data?.data?.products || [];
      setProducts(Array.isArray(productList) ? productList : []);
    } catch (err: any) {
      setCampaigns([]);
      setProducts([]);
      setError(err?.response?.data?.message || 'İndirim verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const resetForm = () => {
    setForm(defaultForm());
    setProductSearchInput('');
    setProductSearchQuery('');
    setEditingId(null);
  };

  const applyProductSearch = () => {
    setProductSearchQuery(productSearchInput.trim());
  };

  const toggleProduct = (id: string) => {
    setForm((prev) => {
      const exists = prev.selectedProducts.includes(id);
      return {
        ...prev,
        selectedProducts: exists
          ? prev.selectedProducts.filter((x) => x !== id)
          : [...prev.selectedProducts, id],
      };
    });
  };

  const startEdit = (campaign: DiscountCampaign) => {
    setEditingId(campaign.id);
    setForm({
      scope: campaign.scope,
      discountType: campaign.discountType,
      discountAmount: String(campaign.discountAmount),
      startDate: toInputDateTime(campaign.startDate),
      endDate: toInputDateTime(campaign.endDate),
      selectedProducts: campaign.selectedProducts,
    });
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateForm = () => {
    const amount = Number(form.discountAmount);
    const startDate = new Date(form.startDate);
    const endDate = new Date(form.endDate);

    if (!Number.isFinite(amount) || amount <= 0) {
      return 'İndirim tutarı 0’dan büyük olmalı.';
    }

    if (form.discountType === 'percentage' && amount > 100) {
      return 'Yüzde indirim 100’den büyük olamaz.';
    }

    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      return 'Başlangıç ve bitiş tarihi geçerli olmalı.';
    }

    if (endDate.getTime() <= startDate.getTime()) {
      return 'Bitiş tarihi başlangıçtan sonra olmalı.';
    }

    if (form.scope === 'selected' && form.selectedProducts.length === 0) {
      return 'Seçili ürünler için en az 1 ürün seçmelisiniz.';
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
      scope: form.scope,
      discountType: form.discountType,
      discountAmount: Number(form.discountAmount),
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      selectedProducts: form.scope === 'selected' ? form.selectedProducts : [],
    };

    try {
      setSaving(true);
      if (editingId) {
        await apiClient.put(`/api/vendor/campaigns/${editingId}`, payload);
        setSuccess('Ürün indirimi güncellendi.');
      } else {
        await apiClient.post('/api/vendor/campaigns', payload);
        setSuccess('Ürün indirimi oluşturuldu.');
      }

      resetForm();
      await fetchAll();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'İndirim kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCampaign = async (id: string) => {
    setPendingDeleteDiscountId(id);
  };

  const confirmDeleteCampaign = async () => {
    if (!pendingDeleteDiscountId) return;

    try {
      await apiClient.delete(`/api/vendor/campaigns/${pendingDeleteDiscountId}`);
      setSuccess('İndirim silindi.');
      showSuccessToast('Indirim silindi');
      await fetchAll();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      const message = extractApiErrorMessage(err, 'Indirim silinemedi.');
      setError(message);
      showErrorToast('Indirim silinemedi', message);
    } finally {
      setPendingDeleteDiscountId(null);
    }
  };

  return (
    <div className="space-y-5">
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

      <form onSubmit={handleSubmit} className="seller-surface p-6">
        <h3 className="text-lg font-bold text-text-primary mb-5">
          {editingId ? 'İndirimi Düzenle' : 'Yeni Ürün İndirimi'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-text-primary mb-2">Kapsam</label>
            <select
              value={form.scope}
              onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value as 'all' | 'selected' }))}
              className="seller-input"
            >
              <option value="all">Tüm Ürünler</option>
              <option value="selected">Seçili Ürünler</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-text-primary mb-2">İndirim Tipi</label>
            <select
              value={form.discountType}
              onChange={(e) => setForm((prev) => ({ ...prev, discountType: e.target.value as 'percentage' | 'fixed' }))}
              className="seller-input"
            >
              <option value="percentage">Yüzde (%)</option>
              <option value="fixed">Sabit Tutar (TL)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-text-primary mb-2">
              {form.discountType === 'percentage' ? 'İndirim Oranı (%)' : 'İndirim Tutarı (TL)'}
            </label>
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={form.discountAmount}
              onChange={(e) => setForm((prev) => ({ ...prev, discountAmount: e.target.value }))}
              className="seller-input"
              placeholder={form.discountType === 'percentage' ? 'Örn: 15' : 'Örn: 25'}
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
        </div>

        {form.scope === 'selected' && (
          <div className="mt-5">
            <label className="block text-sm font-bold text-text-primary mb-2">Ürün Seçimi</label>
            <div className="mb-3 flex gap-2">
              <input
                type="text"
                value={productSearchInput}
                onChange={(e) => setProductSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyProductSearch();
                  }
                }}
                className="seller-input"
                placeholder="Ürün adı ile ara"
              />
              <button
                type="button"
                onClick={applyProductSearch}
                className="inline-flex items-center justify-center rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/15"
              >
                Ara
              </button>
            </div>
            <div className="rounded-xl border border-black/10 bg-white/70 p-3 max-h-56 overflow-y-auto space-y-2">
              {products.length === 0 ? (
                <p className="text-sm text-text-secondary">Seçilebilir ürün bulunamadı.</p>
              ) : filteredProducts.length === 0 ? (
                <p className="text-sm text-text-secondary">Aramanıza uygun ürün bulunamadı.</p>
              ) : (
                filteredProducts.map((product) => (
                  <label key={product.id} className="flex items-center gap-2 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={form.selectedProducts.includes(product.id)}
                      onChange={() => toggleProduct(product.id)}
                    />
                    <span>{product.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-5 border-t mt-5">
          <button type="button" onClick={resetForm} className="seller-btn-ghost px-5 py-2">
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
          <button type="submit" disabled={saving} className="seller-btn-primary px-5 py-2 font-bold">
            {saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'İndirim Oluştur'}
          </button>
        </div>
      </form>

      <div className="seller-surface p-5">
        <h3 className="text-lg font-bold text-text-primary mb-4">İndirim Listesi</h3>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-text-secondary">Yükleniyor...</div>
        ) : campaigns.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-text-secondary">İndirim bulunamadı</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((campaign) => {
              const meta = statusMeta(campaign.status);
              const selectedNames = campaign.selectedProducts
                .map((id) => productsById[id]?.name)
                .filter(Boolean);

              return (
                <div key={campaign.id} className="rounded-xl border border-black/10 bg-white/70 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <span className="inline-flex items-center rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">
                      {campaign.discountType === 'percentage'
                        ? `%${campaign.discountAmount} İndirim`
                        : `${campaign.discountAmount} TL İndirim`}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${meta.className}`}>
                      {meta.label}
                    </span>
                  </div>

                  <p className="text-sm text-text-secondary">
                    Kapsam: {campaign.scope === 'all' ? 'Tüm Ürünler' : `Seçili Ürünler (${campaign.selectedProducts.length})`}
                  </p>

                  {campaign.scope === 'selected' && (
                    <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                      {selectedNames.length > 0 ? selectedNames.join(', ') : 'Seçili ürün bilgisi yok'}
                    </p>
                  )}

                  <div className="text-xs text-text-secondary space-y-1 mt-3">
                    <p>Başlangıç: {toDateTimeLocalText(campaign.startDate)}</p>
                    <p>Bitiş: {toDateTimeLocalText(campaign.endDate)}</p>
                  </div>

                  <div className="flex gap-2 pt-3 border-t mt-3">
                    <button onClick={() => startEdit(campaign)} className="seller-btn-outline flex-1">
                      Düzenle
                    </button>
                    <button
                      onClick={() => void deleteCampaign(campaign.id)}
                      className="inline-flex flex-1 items-center justify-center rounded-xl border border-error/25 bg-error/5 px-4 py-2.5 text-sm font-semibold text-error hover:bg-error/10"
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
      <ConfirmActionModal
        open={Boolean(pendingDeleteDiscountId)}
        title="Ürünü silmek istiyor musun?"
        description="Bu işlem geri alınamaz."
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        onCancel={() => setPendingDeleteDiscountId(null)}
        onConfirm={() => void confirmDeleteCampaign()}
      />
    </div>
  );
};

export default ProductDiscountSection;
