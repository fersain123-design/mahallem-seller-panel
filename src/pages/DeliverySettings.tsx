import React, { useEffect, useState } from 'react';
import { vendorAPI } from '../services/api.ts';

type DeliveryMode = 'seller' | 'platform';

type DeliverySettingsState = {
  deliveryMode: DeliveryMode;
  isActive: boolean;
  platformDeliveryEnabled: boolean;
  pendingDeliveryCoverage: 'SELF' | 'PLATFORM' | null;
  deliveryCoverageChangeRequestedAt: string | null;
  neighborhood: string | null;
  canEditDeliveryPricing: boolean;
  minimumOrderAmount: number | null;
  flatDeliveryFee: number | null;
  freeOverAmount: number | null;
  deliveryMinutes: number | null;
  missingPlatformNeighborhoodSetting: boolean;
};

const defaultState: DeliverySettingsState = {
  deliveryMode: 'seller',
  isActive: true,
  platformDeliveryEnabled: true,
  pendingDeliveryCoverage: null,
  deliveryCoverageChangeRequestedAt: null,
  neighborhood: null,
  canEditDeliveryPricing: true,
  minimumOrderAmount: null,
  flatDeliveryFee: null,
  freeOverAmount: null,
  deliveryMinutes: null,
  missingPlatformNeighborhoodSetting: false,
};

const formatDeliveryFeeLabel = (value: number | null) => {
  if (value == null) return '-';
  if (Number(value) === 0) return 'Ücretsiz';
  return `${value} TL`;
};

const DeliverySettings: React.FC = () => {
  const [state, setState] = useState<DeliverySettingsState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await vendorAPI.getDeliverySettings();
      const data = res?.data?.data || {};
      setState({
        deliveryMode: String(data?.deliveryMode || 'seller').toLowerCase() === 'platform' ? 'platform' : 'seller',
        isActive: Boolean(data?.isActive ?? true),
        platformDeliveryEnabled: Boolean(data?.platformDeliveryEnabled ?? false),
        pendingDeliveryCoverage: data?.pendingDeliveryCoverage || null,
        deliveryCoverageChangeRequestedAt: data?.deliveryCoverageChangeRequestedAt || null,
        neighborhood: data?.neighborhood || null,
        canEditDeliveryPricing: Boolean(data?.canEditDeliveryPricing ?? true),
        minimumOrderAmount: typeof data?.minimumOrderAmount === 'number' ? data.minimumOrderAmount : null,
        flatDeliveryFee: typeof data?.flatDeliveryFee === 'number' ? data.flatDeliveryFee : null,
        freeOverAmount: typeof data?.freeOverAmount === 'number' ? data.freeOverAmount : null,
        deliveryMinutes: typeof data?.deliveryMinutes === 'number' ? data.deliveryMinutes : null,
        missingPlatformNeighborhoodSetting: Boolean(data?.missingPlatformNeighborhoodSetting ?? false),
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Teslimat ayarları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        isActive: state.isActive,
      };

      await vendorAPI.updateDeliverySettings(payload);
      await load();
      setMessage('Teslimat ayarları güncellendi');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Teslimat ayarları güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const requestModeChange = async (next: 'SELF' | 'PLATFORM') => {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      await vendorAPI.requestDeliveryCoverageChange(next);
      await load();
      setMessage('Teslimat modeli degisim talebi admin onayina gonderildi');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Teslimat modeli talebi gonderilemedi');
    } finally {
      setSaving(false);
    }
  };

  const pendingLabel =
    state.pendingDeliveryCoverage === 'PLATFORM'
      ? 'Platform teslimatina gecis onayi bekleniyor'
      : state.pendingDeliveryCoverage === 'SELF'
        ? 'Satici teslimatina gecis onayi bekleniyor'
        : '';

  if (loading) {
    return (
      <div className="space-y-6 pb-8">
        <h1 className="seller-page-title">Teslimat Ayarları</h1>
        <div className="seller-surface p-6">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <h1 className="seller-page-title">Teslimat Ayarları</h1>

      {message ? (
        <div className="rounded-xl border border-success/25 bg-success/5 p-4 text-success">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-error/25 bg-error/5 p-4 text-error">{error}</div>
      ) : null}

      <div className="seller-surface p-6 space-y-6">
        <div>
          <p className="text-sm text-text-secondary mb-2">Aktif Teslimat Modeli</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`rounded-xl border p-4 bg-white/70 flex gap-3 items-start ${state.deliveryMode === 'seller' ? 'border-success/30 bg-success/5' : 'border-black/10'}`}>
              <div>
                <p className="font-semibold text-text-primary">Ben (Satıcı)</p>
                <p className="text-xs text-text-secondary">Minimum sepet, teslimat ucreti, ucretsiz limit ve teslimat dk satici tarafindan yonetilir.</p>
              </div>
            </div>

            <div className={`rounded-xl border p-4 bg-white/70 flex gap-3 items-start ${state.deliveryMode === 'platform' ? 'border-amber-300 bg-amber-50' : 'border-black/10'}`}>
              <div>
                <p className="font-semibold text-text-primary">Platform</p>
                <p className="text-xs text-text-secondary">Teslimat degerleri admin tarafindan mahalle bazli yonetilir.</p>
              </div>
            </div>
          </div>
        </div>

        {state.neighborhood ? (
          <div className="rounded-xl border border-black/10 bg-white p-4 text-sm text-text-secondary">
            Mahalle: <span className="font-semibold text-text-primary">{state.neighborhood}</span>
          </div>
        ) : null}

        {pendingLabel ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {pendingLabel}
          </div>
        ) : null}

        {state.missingPlatformNeighborhoodSetting ? (
          <div className="rounded-xl border border-error/25 bg-error/5 p-4 text-sm text-error">
            Bu mahalle icin admin tarafinda platform teslimat ayari tanimli degil. Platform teslimati kullanilsa bile degerler admin tanimlayana kadar eksik kalir.
          </div>
        ) : null}

        {!state.platformDeliveryEnabled ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Platform teslimat secenegi admin tarafinda pasif. Platforma gecis basvurusu gonderilemez.
          </div>
        ) : null}

        <div className="rounded-xl border border-black/10 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-text-primary">Efektif Teslimat Degerleri</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-text-secondary">
            <div>Minimum sepet: <span className="font-semibold text-text-primary">{state.minimumOrderAmount ?? '-'} TL</span></div>
            <div>Teslimat ucreti: <span className="font-semibold text-text-primary">{formatDeliveryFeeLabel(state.flatDeliveryFee)}</span></div>
            <div>Ucretsiz teslimat limiti: <span className="font-semibold text-text-primary">{state.freeOverAmount ?? '-'} TL</span></div>
            <div>Teslimat suresi: <span className="font-semibold text-text-primary">{state.deliveryMinutes ?? '-'} dk</span></div>
          </div>
          <p className="text-xs text-text-secondary">
            {state.canEditDeliveryPricing
              ? 'Bu alanlar su anda satici tarafindan yonetilmektedir.'
              : 'Bu alanlar su anda admin tarafindan mahalle bazli yonetilmektedir ve satici tarafinda degistirilemez.'}
          </p>
        </div>

        {!state.pendingDeliveryCoverage ? (
          <div className="flex flex-wrap gap-3">
            {state.deliveryMode === 'seller' ? (
              <button
                type="button"
                disabled={saving || !state.platformDeliveryEnabled}
                className="seller-btn-primary px-6 py-2"
                onClick={() => requestModeChange('PLATFORM')}
              >
                {saving
                  ? 'Gonderiliyor...'
                  : !state.platformDeliveryEnabled
                    ? 'Platform secenegi pasif'
                    : 'Platform teslimatina gecis basvurusu yap'}
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                className="seller-btn-ghost px-6 py-2"
                onClick={() => requestModeChange('SELF')}
              >
                {saving ? 'Gonderiliyor...' : 'Satici teslimatina donus basvurusu yap'}
              </button>
            )}
          </div>
        ) : null}

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.isActive}
            onChange={(e) => setState((s) => ({ ...s, isActive: e.target.checked }))}
          />
          <span className="text-sm text-text-primary">Mağaza teslimata açık</span>
        </label>

        <button
          type="button"
          disabled={saving}
          className="seller-btn-primary px-6 py-2"
          onClick={onSave}
        >
          {saving ? 'Kaydediliyor...' : 'Teslimat acikligini kaydet'}
        </button>
      </div>
    </div>
  );
};

export default DeliverySettings;
