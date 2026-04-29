import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { vendorAPI } from '../services/api.ts';

const DELIVERY_COVERAGE_LABELS: Record<'SELF' | 'PLATFORM', string> = {
  SELF: 'Teslimatı ben karşılayacağım',
  PLATFORM: 'Teslimat platform tarafından karşılanacak',
};

const DeliveryCourier: React.FC = () => {
  const { vendor, refreshVendor } = useAuth();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const vendorProfile = vendor?.vendorProfile || {};

  const normalizeDeliveryCoverage = (value: any): 'SELF' | 'PLATFORM' =>
    String(value).toUpperCase() === 'SELF' ? 'SELF' : 'PLATFORM';

  const activeDeliveryCoverage = normalizeDeliveryCoverage((vendorProfile as any)?.deliveryCoverage);
  const pendingDeliveryCoverageRaw = (vendorProfile as any)?.pendingDeliveryCoverage;
  const pendingDeliveryCoverage = pendingDeliveryCoverageRaw
    ? normalizeDeliveryCoverage(pendingDeliveryCoverageRaw)
    : null;

  const [deliveryCoverageConfirmOpen, setDeliveryCoverageConfirmOpen] = useState(false);
  const [requestedDeliveryCoverage, setRequestedDeliveryCoverage] = useState<'SELF' | 'PLATFORM' | null>(null);

  const closeDeliveryCoverageConfirm = () => {
    setDeliveryCoverageConfirmOpen(false);
    setRequestedDeliveryCoverage(null);
  };

  const openDeliveryCoverageConfirm = (next: 'SELF' | 'PLATFORM') => {
    setRequestedDeliveryCoverage(next);
    setDeliveryCoverageConfirmOpen(true);
  };

  const submitDeliveryCoverageChangeRequest = async (requested: 'SELF' | 'PLATFORM') => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await vendorAPI.requestDeliveryCoverageChange(requested);
      await refreshVendor();
      setSuccess('Teslimat seçeneği değişikliği talebiniz oluşturuldu');
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          'Teslimat seçeneği değişikliği talebi oluşturulamadı'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeliveryCoverageChange = async () => {
    if (!requestedDeliveryCoverage) return;
    await submitDeliveryCoverageChangeRequest(requestedDeliveryCoverage);
    closeDeliveryCoverageConfirm();
  };

  return (
    <div className="space-y-6 pb-8">
      <h1 className="seller-page-title">Teslimat/Kurye</h1>

      {success && (
        <div className="rounded-xl border border-success/25 bg-success/5 p-4 text-success">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-error/25 bg-error/5 p-4 text-error">
          {error}
        </div>
      )}

      <div className="seller-surface p-6 space-y-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-text-secondary">Aktif teslimat seçeneği</span>
            <span className="font-semibold text-text-primary">
              {DELIVERY_COVERAGE_LABELS[activeDeliveryCoverage]}
            </span>
          </div>

          {pendingDeliveryCoverage ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-text-secondary">Talep edilen yeni seçenek</span>
                <span className="font-semibold text-text-primary">
                  {DELIVERY_COVERAGE_LABELS[pendingDeliveryCoverage]}
                </span>
              </div>

              <div className="rounded-xl border border-warning/25 bg-warning/10 p-4">
                <p className="text-text-primary font-semibold mb-1">Bilgilendirme</p>
                <p className="text-text-secondary text-sm">
                  Onay süreci tamamlanana kadar mevcut teslimat seçeneğiniz geçerliliğini korumaya devam eder.
                </p>
              </div>
            </>
          ) : (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  { id: 'PLATFORM' as const, label: DELIVERY_COVERAGE_LABELS.PLATFORM },
                  { id: 'SELF' as const, label: DELIVERY_COVERAGE_LABELS.SELF },
                ] as const).map((opt) => {
                  const selected = activeDeliveryCoverage === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={loading || selected}
                      onClick={() => openDeliveryCoverageConfirm(opt.id)}
                      className={`relative p-3 rounded-xl border transition-all text-left bg-white/70 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                        selected
                          ? 'border-primary/40 ring-2 ring-primary/10 shadow-[0_12px_24px_rgba(10,106,64,0.14)]'
                          : 'border-black/10 hover:border-primary/25 hover:shadow-sm'
                      } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      <div className="text-sm font-semibold leading-tight">{opt.label}</div>
                      {selected ? (
                        <div className="mt-1 text-xs text-text-secondary">Mevcut seçeneğiniz</div>
                      ) : (
                        <div className="mt-1 text-xs text-text-secondary">Değişiklik talebi oluştur</div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-text-secondary mt-2">
                Seçenek değişikliği talebi admin onayına gönderilir. Onay süreci tamamlanana kadar mevcut seçeneğiniz geçerlidir.
              </p>
            </div>
          )}
        </div>
      </div>

      {deliveryCoverageConfirmOpen && requestedDeliveryCoverage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-black/10 shadow-sm max-w-lg w-full p-5">
            <h3 className="text-lg font-semibold text-text-primary">Teslimat Seçeneği Değişikliği</h3>
            <p className="text-sm text-text-secondary mt-2">
              <span className="font-semibold text-text-primary">
                {DELIVERY_COVERAGE_LABELS[requestedDeliveryCoverage]}
              </span>{' '}
              seçeneğine geçiş talebi oluşturulacak.
            </p>
            <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 mt-4">
              <p className="text-text-primary font-semibold mb-1">Onay Süreci</p>
              <p className="text-text-secondary text-sm">
                Bu değişiklik admin onayı sonrası aktif olur. Onay süreci tamamlanana kadar mevcut teslimat seçeneğiniz geçerliliğini korur.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-end mt-6">
              <button
                type="button"
                className="seller-btn-outline px-6 py-2"
                disabled={loading}
                onClick={closeDeliveryCoverageConfirm}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="seller-btn-primary px-6 py-2"
                disabled={loading}
                onClick={handleConfirmDeliveryCoverageChange}
              >
                {loading ? 'Gönderiliyor...' : 'Onayla ve Gönder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryCourier;
