import React, { useEffect, useState } from 'react';
import { API_BASE_URL, vendorAPI } from '../services/api.ts';
import ConfirmActionModal from '../components/common/ConfirmActionModal.tsx';
import { extractApiErrorMessage, showErrorToast, showSuccessToast } from '../lib/feedback.ts';

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  market_manav: 'Market & Manav',
  market: 'Market',
  manav: 'Manav',
  firin_pastane: 'Fırın & Pastane',
  firin: 'Fırın',
  pastane: 'Pastane',
  kasap_sarkuteri: 'Kasap & Şarküteri',
  kasap: 'Kasap',
  bufe: 'Atıştırmalık Büfesi',
  sarkuteri: 'Şarküteri',
  su_bayi: 'Su Bayi',
  su_bayii: 'Su Bayii',
  balikci: 'Balıkçı',
  tatlici: 'Tatlıcı',
  kafe_kahve_icecek: 'Kafe (Kahve & İçecek)',
  kafe: 'Kafe',
  ev_gunluk_ihtiyac: 'Ev & Günlük İhtiyaç',
  kuruyemis: 'Kuruyemiş',
  aktar: 'Aktar',
  cicekci: 'Çiçekçi',
  petshop: 'Petshop',
  diger: 'Diğer',
};

const getBusinessTypeLabel = (value?: string | null) => {
  const key = String(value || '').trim();
  if (!key) return '';
  return (
    BUSINESS_TYPE_LABELS[key] ||
    key
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (ch) => ch.toLocaleUpperCase('tr-TR'))
  );
};

type StoreImage = {
  id: string;
  imageUrl: string;
  createdAt?: string;
};

type StorefrontData = {
  vendorProfileId: string;
  shopName?: string | null;
  businessType?: string | null;
  address?: string | null;
  storeAbout?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  storeOpenOverride?: boolean | null;
  storeCoverImageUrl?: string | null;
  storeLogoImageUrl?: string | null;
  preparationMinutes?: number | null;
  deliveryMinutes?: number | null;
  deliveryMaxMinutes?: number | null;
  deliveryCoverage?: 'SELF' | 'PLATFORM' | null;
  deliveryMode?: 'seller' | 'platform' | null;
  flatDeliveryFee?: number | null;
  minimumOrderAmount?: number | null;
  freeOverAmount?: number | null;
  canEditDeliveryPricing?: boolean;
  deliverySource?: 'SELLER' | 'PLATFORM_NEIGHBORHOOD' | string | null;
  pendingDeliveryCoverage?: 'SELF' | 'PLATFORM' | null;
  deliveryCoverageChangeRequestedAt?: string | null;
  neighborhood?: string | null;
  missingPlatformNeighborhoodSetting?: boolean;
  platformNeighborhoodSetting?: {
    id: string;
    neighborhood: string;
    neighborhoodKey: string;
    minimumOrderAmount: number;
    deliveryFee: number;
    freeOverAmount: number | null;
    deliveryMinutes: number;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  registeredAt?: string | null;
  storeImages: StoreImage[];
};

const resolveUrl = (base: string, url?: string | null) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
};

const parseTimeToMinutes = (timeText?: string | null): number | null => {
  const m = String(timeText || '').trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
};

const computeOpenByHours = (openingTime?: string | null, closingTime?: string | null): boolean | null => {
  const openText = String(openingTime || '09:00').trim();
  const closeText = String(closingTime || '21:00').trim();
  const openMin = parseTimeToMinutes(openText);
  const closeMin = parseTimeToMinutes(closeText);
  if (openMin == null || closeMin == null) return null;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (closeMin < openMin) {
    return nowMin >= openMin || nowMin < closeMin;
  }
  return nowMin >= openMin && nowMin < closeMin;
};

const Storefront: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [data, setData] = useState<StorefrontData | null>(null);
  const [pendingDeleteImageId, setPendingDeleteImageId] = useState<string | null>(null);

  const apiBase = API_BASE_URL;

  const refresh = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const [storefrontRes, profileRes] = await Promise.all([
        vendorAPI.getStorefront(),
        vendorAPI.getProfile(),
      ]);
      const payload = storefrontRes?.data?.data || storefrontRes?.data;
      const profilePayload = profileRes?.data?.data || profileRes?.data;
      setData({
        ...(payload as StorefrontData),
        deliveryMode: (payload as any)?.deliveryMode || null,
        canEditDeliveryPricing: Boolean((payload as any)?.canEditDeliveryPricing ?? true),
        deliverySource: (payload as any)?.deliverySource || null,
        pendingDeliveryCoverage: (payload as any)?.pendingDeliveryCoverage || null,
        deliveryCoverageChangeRequestedAt: (payload as any)?.deliveryCoverageChangeRequestedAt || null,
        neighborhood: (payload as any)?.neighborhood || (profilePayload as any)?.neighborhood || null,
        missingPlatformNeighborhoodSetting: Boolean((payload as any)?.missingPlatformNeighborhoodSetting ?? false),
        platformNeighborhoodSetting: (payload as any)?.platformNeighborhoodSetting || null,
        deliveryCoverage: (profilePayload as any)?.deliveryCoverage || 'PLATFORM',
        flatDeliveryFee:
          typeof (payload as any)?.flatDeliveryFee === 'number'
            ? (payload as any).flatDeliveryFee
            : typeof (profilePayload as any)?.flatDeliveryFee === 'number'
              ? (profilePayload as any).flatDeliveryFee
              : null,
        freeOverAmount:
          typeof (payload as any)?.freeOverAmount === 'number'
            ? (payload as any).freeOverAmount
            : typeof (profilePayload as any)?.freeOverAmount === 'number'
              ? (profilePayload as any).freeOverAmount
              : null,
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Mağaza bilgileri yüklenemedi');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleSave = async () => {
    if (!data) return;
    if (
      typeof data.deliveryMinutes === 'number' &&
      typeof data.deliveryMaxMinutes === 'number' &&
      data.deliveryMaxMinutes < data.deliveryMinutes
    ) {
      setError('Teslimat maksimum dakika, minimum dakikadan kucuk olamaz');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload: Record<string, unknown> = {
        storeAbout: data.storeAbout || null,
        openingTime: data.openingTime || null,
        closingTime: data.closingTime || null,
        storeOpenOverride: typeof data.storeOpenOverride === 'boolean' ? data.storeOpenOverride : null,
        storeCoverImageUrl: data.storeCoverImageUrl || null,
        storeLogoImageUrl: data.storeLogoImageUrl || null,
        // Preparation time is vendor-managed in all delivery modes.
        preparationMinutes: typeof data.preparationMinutes === 'number' ? data.preparationMinutes : null,
      };

      if (data.canEditDeliveryPricing !== false) {
        payload.deliveryMinutes = typeof data.deliveryMinutes === 'number' ? data.deliveryMinutes : null;
        payload.deliveryMaxMinutes = typeof data.deliveryMaxMinutes === 'number' ? data.deliveryMaxMinutes : null;
        payload.flatDeliveryFee = typeof data.flatDeliveryFee === 'number' ? data.flatDeliveryFee : null;
        payload.minimumOrderAmount = typeof data.minimumOrderAmount === 'number' ? data.minimumOrderAmount : null;
        payload.freeOverAmount = typeof data.freeOverAmount === 'number' ? data.freeOverAmount : null;
      }

      await vendorAPI.updateStorefront(payload);
      await refresh();
      setSuccess('Mağaza vitrini güncellendi');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const form = new FormData();
      form.append('file', file);
      await vendorAPI.uploadStorefrontImage(form);
      await refresh();
      setSuccess('Fotoğraf eklendi');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Fotoğraf yüklenemedi');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (id: string) => {
    setPendingDeleteImageId(id);
  };

  const confirmDeleteImage = async () => {
    if (!pendingDeleteImageId) return;

    setError('');
    setSuccess('');
    try {
      await vendorAPI.deleteStorefrontImage(pendingDeleteImageId);
      await refresh();
      setSuccess('Fotoğraf silindi');
      showSuccessToast('Fotograf silindi');
    } catch (e: any) {
      const message = extractApiErrorMessage(e, 'Fotograf silinemedi');
      setError(message);
      showErrorToast('Fotograf silinemedi', message);
    } finally {
      setPendingDeleteImageId(null);
    }
  };

  const handleSetCover = (imageUrl: string) => {
    if (!data) return;
    setData({ ...data, storeCoverImageUrl: imageUrl });
    setSuccess('');
  };

  const handleSetLogo = (imageUrl: string) => {
    if (!data) return;
    setData({ ...data, storeLogoImageUrl: imageUrl });
    setSuccess('');
  };

  const coverage = String(data?.deliveryCoverage || 'PLATFORM').toUpperCase();
  const isPlatformCoverage = coverage === 'PLATFORM';
  const canEditDeliveryPricing = Boolean(data?.canEditDeliveryPricing ?? !isPlatformCoverage);
  const scheduleOpenState = data ? computeOpenByHours(data.openingTime, data.closingTime) : null;
  const currentOpenState =
    typeof data?.storeOpenOverride === 'boolean' ? data.storeOpenOverride : scheduleOpenState;
  const pendingCoverageLabel =
    data?.pendingDeliveryCoverage === 'PLATFORM'
      ? 'Platform teslimatına gecis onayi bekleniyor'
      : data?.pendingDeliveryCoverage === 'SELF'
        ? 'Satici teslimatina gecis onayi bekleniyor'
        : '';

  const handleStoreOpenOverride = async (override: boolean | null) => {
    if (!data || saving || loading || uploading) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await vendorAPI.updateStorefront({ storeOpenOverride: override });
      await refresh();
      setSuccess(
        override === true
          ? 'Mağaza manuel olarak açık duruma alındı'
          : override === false
            ? 'Mağaza manuel olarak kapalı duruma alındı'
            : 'Mağaza saat akışına geri alındı'
      );
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Mağaza durumu güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="seller-page-title">Mağazam</h1>
          <p className="seller-page-subtitle mt-1">Müşterilerin göreceği vitrin bilgileri</p>
        </div>

        <div className="flex gap-2">
          <button onClick={refresh} className="seller-btn-ghost" disabled={loading || saving || uploading}>
            Yenile
          </button>
          <button onClick={handleSave} className="seller-btn-primary" disabled={loading || saving || uploading || !data}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>

      {success && <div className="rounded-xl border border-success/25 bg-success/5 p-4 text-success">{success}</div>}
      {error && <div className="rounded-xl border border-error/25 bg-error/5 p-4 text-error">{error}</div>}

      {loading ? (
        <div className="seller-surface p-6 text-text-secondary">Yükleniyor…</div>
      ) : !data ? (
        <div className="seller-surface p-6 text-text-secondary">Mağaza bilgisi bulunamadı.</div>
      ) : (
        <>
          <div className="seller-surface p-5 space-y-4">
            <div className="rounded-xl border border-black/10 bg-white p-4 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Teslimat Modeli</p>
                  <p className="text-sm text-text-secondary">
                    {isPlatformCoverage ? 'Teslimat platform tarafindan karsilaniyor' : 'Teslimati satici karsiliyor'}
                  </p>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${canEditDeliveryPricing ? 'bg-success/10 text-success' : 'bg-amber-100 text-amber-700'}`}>
                  {canEditDeliveryPricing ? 'Duzenlenebilir' : 'Salt okunur'}
                </div>
              </div>

              {data?.neighborhood ? (
                <p className="text-xs text-text-secondary">Mahalle: {data.neighborhood}</p>
              ) : null}

              {data?.deliverySource === 'PLATFORM_NEIGHBORHOOD' ? (
                <p className="text-xs text-text-secondary">
                  Bu alanlar admin panelindeki mahalle bazli teslimat ayarindan gelmektedir.
                </p>
              ) : (
                <p className="text-xs text-text-secondary">
                  Bu alanlari su anda satici panelinden yonetebilirsiniz.
                </p>
              )}

              {pendingCoverageLabel ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {pendingCoverageLabel}
                </div>
              ) : null}

              {data?.missingPlatformNeighborhoodSetting ? (
                <div className="rounded-lg border border-error/25 bg-error/5 px-3 py-2 text-xs text-error">
                  Bu mahalle icin admin panelinde platform teslimat ayari tanimlanmamis. Platform modundaki degerler admin tanimi yapilana kadar kullanilamaz.
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-text-primary">Mağaza Görselleri</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl overflow-hidden border border-black/5 bg-white">
                  <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
                    <span className="text-sm font-semibold text-text-primary">Kapak Fotoğrafı</span>
                    {data.storeCoverImageUrl ? (
                      <button className="seller-btn-ghost" onClick={() => setData({ ...data, storeCoverImageUrl: null })}>
                        Kaldır
                      </button>
                    ) : null}
                  </div>
                  {data.storeCoverImageUrl ? (
                    <img src={resolveUrl(apiBase, data.storeCoverImageUrl)} alt="Kapak" className="w-full h-52 object-cover" />
                  ) : (
                    <div className="h-52 flex items-center justify-center text-sm text-text-secondary bg-white/60">Kapak fotoğrafı seçilmedi</div>
                  )}
                </div>

                <div className="rounded-xl overflow-hidden border border-black/5 bg-white">
                  <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
                    <span className="text-sm font-semibold text-text-primary">Logo Fotoğrafı</span>
                    {data.storeLogoImageUrl ? (
                      <button className="seller-btn-ghost" onClick={() => setData({ ...data, storeLogoImageUrl: null })}>
                        Kaldır
                      </button>
                    ) : null}
                  </div>
                  {data.storeLogoImageUrl ? (
                    <img src={resolveUrl(apiBase, data.storeLogoImageUrl)} alt="Logo" className="w-full h-52 object-cover" />
                  ) : (
                    <div className="h-52 flex items-center justify-center text-sm text-text-secondary bg-white/60">Logo fotoğrafı seçilmedi</div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 rounded-xl border border-black/10 bg-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Mağaza Durumu</p>
                    <p className={`text-sm ${currentOpenState === false ? 'text-error' : 'text-success'}`}>
                      {currentOpenState === false ? 'Kapalı' : 'Açık'}
                      {typeof data.storeOpenOverride === 'boolean'
                        ? ' (Manuel)'
                        : ' (Saat Akışı)'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleStoreOpenOverride(true)}
                      disabled={saving || loading || uploading}
                      className="seller-btn-primary px-3 py-2"
                    >
                      Açık
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStoreOpenOverride(false)}
                      disabled={saving || loading || uploading}
                      className="seller-btn-ghost px-3 py-2"
                    >
                      Kapalı
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStoreOpenOverride(null)}
                      disabled={saving || loading || uploading}
                      className="seller-btn-ghost px-3 py-2"
                    >
                      Saat Akışı
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Hazırlık Dk</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={typeof data.preparationMinutes === 'number' ? String(data.preparationMinutes) : ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const num = raw === '' ? null : Number(raw);
                    const nextVal = Number.isFinite(num) ? Math.min(120, Math.max(1, Number(num))) : null;
                    setData({ ...data, preparationMinutes: nextVal });
                  }}
                  placeholder="Örn: 15"
                  className="seller-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Teslimat Dk (Aralık)</label>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                  <input
                    type="number"
                    min={1}
                    max={240}
                    disabled={!canEditDeliveryPricing}
                    value={typeof data.deliveryMinutes === 'number' ? String(data.deliveryMinutes) : ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const num = raw === '' ? null : Number(raw);
                      const nextMin = Number.isFinite(num) ? Math.min(240, Math.max(1, Number(num))) : null;
                      setData({ ...data, deliveryMinutes: nextMin });
                    }}
                    onBlur={() => {
                      const minVal = typeof data.deliveryMinutes === 'number' ? data.deliveryMinutes : null;
                      const maxVal = typeof data.deliveryMaxMinutes === 'number' ? data.deliveryMaxMinutes : null;
                      if (minVal != null && maxVal != null && maxVal < minVal) {
                        setData({ ...data, deliveryMaxMinutes: minVal });
                      }
                    }}
                    placeholder="Örn: 15"
                    className={`seller-input ${!canEditDeliveryPricing ? 'bg-gray-50 text-text-secondary cursor-not-allowed' : ''}`}
                  />
                  <span className="text-sm font-semibold text-text-secondary">-</span>
                  <input
                    type="number"
                    min={1}
                    max={240}
                    disabled={!canEditDeliveryPricing}
                    value={typeof data.deliveryMaxMinutes === 'number' ? String(data.deliveryMaxMinutes) : ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const num = raw === '' ? null : Number(raw);
                      const nextMax = Number.isFinite(num) ? Math.min(240, Math.max(1, Number(num))) : null;
                      setData({ ...data, deliveryMaxMinutes: nextMax });
                    }}
                    onBlur={() => {
                      const minVal = typeof data.deliveryMinutes === 'number' ? data.deliveryMinutes : null;
                      const maxVal = typeof data.deliveryMaxMinutes === 'number' ? data.deliveryMaxMinutes : null;
                      if (minVal != null && maxVal != null && maxVal < minVal) {
                        setData({ ...data, deliveryMaxMinutes: minVal });
                      }
                    }}
                    placeholder="Örn: 25"
                    className={`seller-input ${!canEditDeliveryPricing ? 'bg-gray-50 text-text-secondary cursor-not-allowed' : ''}`}
                  />
                </div>
                <p className="mt-1 text-xs text-text-secondary">Ornek: 15-25 dk</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Teslimat Ücreti (TL)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!canEditDeliveryPricing}
                  value={typeof data.flatDeliveryFee === 'number' ? String(data.flatDeliveryFee) : ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const num = raw === '' ? null : Number(raw);
                    const nextFee = Number.isFinite(num) ? num : null;
                    setData({
                      ...data,
                      flatDeliveryFee: nextFee,
                      freeOverAmount:
                        nextFee !== null && nextFee <= 0
                          ? null
                          : data.freeOverAmount,
                    });
                  }}
                  placeholder="Örn: 25"
                  className={`seller-input ${!canEditDeliveryPricing ? 'bg-gray-50 text-text-secondary cursor-not-allowed' : ''}`}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!canEditDeliveryPricing}
                    className="seller-btn-ghost px-3 py-2"
                    onClick={() => setData({ ...data, flatDeliveryFee: 0 })}
                  >
                    Ücretsiz Teslimat (0 TL)
                  </button>
                  <button
                    type="button"
                    disabled={!canEditDeliveryPricing}
                    className="seller-btn-ghost px-3 py-2"
                    onClick={() => setData({ ...data, flatDeliveryFee: null })}
                  >
                    Ücreti Temizle
                  </button>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  Ücretsiz teslimat için bu alanı 0 TL yapabilirsiniz.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Minimum Sipariş (TL)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!canEditDeliveryPricing}
                  value={typeof data.minimumOrderAmount === 'number' ? String(data.minimumOrderAmount) : ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const num = raw === '' ? null : Number(raw);
                    setData({ ...data, minimumOrderAmount: Number.isFinite(num) ? num : null });
                  }}
                  placeholder="Örn: 150"
                  className={`seller-input ${!canEditDeliveryPricing ? 'bg-gray-50 text-text-secondary cursor-not-allowed' : ''}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Ücretsiz Teslimat Limiti (TL)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!canEditDeliveryPricing || Number(data.flatDeliveryFee ?? 0) <= 0}
                  value={typeof data.freeOverAmount === 'number' ? String(data.freeOverAmount) : ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const num = raw === '' ? null : Number(raw);
                    setData({ ...data, freeOverAmount: Number.isFinite(num) ? num : null });
                  }}
                  placeholder="Örn: 250"
                  className={`seller-input ${(!canEditDeliveryPricing || Number(data.flatDeliveryFee ?? 0) <= 0) ? 'bg-gray-50 text-text-secondary cursor-not-allowed' : ''}`}
                />
                {Number(data.flatDeliveryFee ?? 0) <= 0 ? (
                  <p className="mt-1 text-xs text-text-secondary">
                    Teslimat ücreti 0 TL iken bu alan devre dışıdır.
                  </p>
                ) : null}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-primary mb-2">İşletme Türü</label>
                <input
                  type="text"
                  value={getBusinessTypeLabel(data.businessType)}
                  readOnly
                  disabled
                  className="seller-input bg-gray-50 text-text-secondary cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-text-secondary">Bu alan kayıt sonrası değiştirilemez.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Açılış Saati</label>
                <input type="time" value={data.openingTime || ''} onChange={(e) => setData({ ...data, openingTime: e.target.value })} className="seller-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Kapanış Saati</label>
                <input type="time" value={data.closingTime || ''} onChange={(e) => setData({ ...data, closingTime: e.target.value })} className="seller-input" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Mağaza Hakkında</label>
              <textarea
                value={data.storeAbout || ''}
                onChange={(e) => setData({ ...data, storeAbout: e.target.value })}
                rows={5}
                placeholder="Müşterilere kısa bir açıklama yazın…"
                className="seller-textarea"
              />
            </div>
          </div>

          <div className="seller-surface p-5 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Fotoğraflar</h3>
                <p className="text-sm text-text-secondary">Galeriyi yönet, kapak fotoğrafını seç.</p>
              </div>

              <div className="flex items-center gap-3">
                <label className={`seller-btn-ghost cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                  {uploading ? 'Yükleniyor…' : 'Fotoğraf Ekle'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      e.target.value = '';
                      handleFileChange(f);
                    }}
                  />
                </label>
              </div>
            </div>

            {data.storeImages?.length ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.storeImages.map((img) => {
                  const isCover = !!data.storeCoverImageUrl && data.storeCoverImageUrl === img.imageUrl;
                  const isLogo = !!data.storeLogoImageUrl && data.storeLogoImageUrl === img.imageUrl;
                  return (
                    <div key={img.id} className="rounded-xl overflow-hidden border border-black/5 bg-white">
                      <div className="relative">
                        <img src={resolveUrl(apiBase, img.imageUrl)} alt="Mağaza" className="w-full h-28 object-cover" />
                        {isCover && <span className="absolute top-2 left-2 text-[11px] font-semibold bg-primary text-white px-2 py-1 rounded-full">Kapak</span>}
                        {isLogo && <span className="absolute top-2 right-2 text-[11px] font-semibold bg-text-primary text-white px-2 py-1 rounded-full">Logo</span>}
                      </div>
                      <div className="p-3 space-y-2">
                        <button className="seller-btn-ghost w-full px-3 py-2" onClick={() => handleSetCover(img.imageUrl)} title="Kapak yap">Kapak Yap</button>
                        <button className="seller-btn-ghost w-full px-3 py-2" onClick={() => handleSetLogo(img.imageUrl)} title="Logo yap">Logo Yap</button>
                        <button className="seller-btn-ghost w-full px-3 py-2 text-error" onClick={() => handleDeleteImage(img.id)} title="Sil">Sil</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-black/10 bg-white/60 p-5 text-text-secondary">Henüz fotoğraf yok.</div>
            )}

            <div className="text-xs text-text-secondary">Not: Kapak seçimini yaptıktan sonra Kaydet’e basmayı unutma.</div>
          </div>
        </>
      )}

      <ConfirmActionModal
        open={Boolean(pendingDeleteImageId)}
        title="Ürünü silmek istiyor musun?"
        description="Bu işlem geri alınamaz."
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        onCancel={() => setPendingDeleteImageId(null)}
        onConfirm={() => void confirmDeleteImage()}
      />
    </div>
  );
};

export default Storefront;
