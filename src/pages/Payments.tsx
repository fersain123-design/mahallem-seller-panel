import React, { useEffect, useMemo, useState } from 'react';
import { vendorAPI } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Wallet,
  Clock,
  TrendingUp,
  CreditCard,
  ArrowUpRight,
  AlertCircle,
  Landmark,
  BadgeCheck,
  ShieldCheck,
  CalendarDays,
  RefreshCcw,
} from 'lucide-react';
import { extractApiErrorMessage, showErrorToast, showSuccessToast } from '../lib/feedback.ts';

type PayoutStatus = 'PAID' | 'PROCESSING' | 'PENDING' | 'CANCELLED' | string;

const CURRENCY_FORMATTER = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const QUICK_WITHDRAW_AMOUNTS = [500, 1000, 2500, 5000];
const PAYOUT_POLICY_SHORT = 'Çekim talepleri yeni sistem geçişinde en geç 14 gün içinde kayıtlı IBAN hesabınıza aktarılır.';

const getStatusLabel = (status?: PayoutStatus) => {
  if (status === 'PAID') return 'Ödendi';
  if (status === 'PROCESSING') return 'İşleniyor';
  if (status === 'CANCELLED') return 'İptal';
  return 'Beklemede';
};

const getStatusClassName = (status?: PayoutStatus) => {
  if (status === 'PAID') return 'bg-success/10 text-success border border-success/20';
  if (status === 'PROCESSING') return 'bg-warning/10 text-warning border border-warning/20';
  if (status === 'CANCELLED') return 'bg-error/10 text-error border border-error/20';
  return 'bg-primary/10 text-primary border border-primary/20';
};

const formatMoney = (value: number) => `₺${CURRENCY_FORMATTER.format(Number(value || 0))}`;

const formatDate = (value?: string) =>
  new Date(value || Date.now()).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const Payments: React.FC = () => {
  const { vendor, refreshVendor } = useAuth();
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    availableAmount: 0,
    pendingAmount: 0,
    paidAmount: 0,
    totalNetEarnings: 0,
    totalCommissionAmount: 0,
    totalGrossSales: 0,
    commissionRate: 0,
  });
  const [paymentData, setPaymentData] = useState({
    account_holder_name: vendor?.owner_name || vendor?.full_name || vendor?.name || '',
    bank_name: vendor?.vendorProfile?.bankName || '',
    iban: vendor?.vendorProfile?.iban || '',
  });

  const vendorProfile = vendor?.vendorProfile || {};
  const ibanStatus = String((vendorProfile as any)?.ibanStatus || 'CHANGE_OPEN');
  const iban = String(vendor?.vendorProfile?.iban || '').trim();
  const bankName = String(vendor?.vendorProfile?.bankName || '').trim();
  const existingIban = String((vendorProfile as any)?.iban || '').trim();
  const canEditIban = ibanStatus === 'CHANGE_OPEN' && !existingIban;
  const hasPaymentInfo = Boolean(iban);

  const getIbanStatusPill = () => {
    const configs: Record<string, { cls: string; label: string }> = {
      WAITING_APPROVAL: { cls: 'bg-error/10 text-error', label: 'IBAN BEKLENİYOR' },
      CHANGE_OPEN: { cls: 'bg-warning/10 text-warning', label: 'DEĞİŞİKLİK İÇİN AÇILDI' },
      COMPLETED: { cls: 'bg-success/10 text-success', label: 'İŞLEM TAMAMLANDI' },
    };
    const config = configs[ibanStatus] || configs.CHANGE_OPEN;
    return <span className={`px-3 py-1 text-xs rounded-full ${config.cls}`}>{config.label}</span>;
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await vendorAPI.getPayouts({ limit: 50 });
      const payload = res?.data?.data || res?.data;
      const list = payload?.payouts || [];
      setPayouts(Array.isArray(list) ? list : []);
      setSummary({
        availableAmount: Number(payload?.summary?.availableAmount || 0),
        pendingAmount: Number(payload?.summary?.pendingAmount || 0),
        paidAmount: Number(payload?.summary?.paidAmount || 0),
        totalNetEarnings: Number(payload?.summary?.totalNetEarnings || 0),
        totalCommissionAmount: Number(payload?.summary?.totalCommissionAmount || 0),
        totalGrossSales: Number(payload?.summary?.totalGrossSales || 0),
        commissionRate: Number(payload?.summary?.commissionRate || 0),
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Ödemeler yüklenemedi');
      setPayouts([]);
      setSummary({
        availableAmount: 0,
        pendingAmount: 0,
        paidAmount: 0,
        totalNetEarnings: 0,
        totalCommissionAmount: 0,
        totalGrossSales: 0,
        commissionRate: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    setPaymentData({
      account_holder_name: vendor?.owner_name || vendor?.full_name || vendor?.name || '',
      bank_name: vendor?.vendorProfile?.bankName || '',
      iban: vendor?.vendorProfile?.iban || '',
    });
  }, [vendor]);

  const balance = useMemo(() => {
    return {
      available: Number(summary.availableAmount || 0),
      pending: Number(summary.pendingAmount || 0),
      total: Number(summary.totalNetEarnings || 0),
    };
  }, [summary]);

  const withdrawableAmount = useMemo(() => {
    const value = Number(balance.available || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [balance.available]);

  const payoutStats = useMemo(() => {
    const processingCount = payouts.filter((p) => p?.status === 'PROCESSING').length;
    const pendingCount = payouts.filter((p) => p?.status === 'PENDING').length;
    const paidCount = payouts.filter((p) => p?.status === 'PAID').length;
    const lastPaid = payouts.find((p) => p?.status === 'PAID');

    return {
      processingCount,
      pendingCount,
      paidCount,
      lastPaidDate: lastPaid?.createdAt || lastPaid?.periodEnd || null,
    };
  }, [payouts]);

  const payoutTimeline = [
    {
      title: 'Sipariş Tamamlanır',
      desc: 'Sipariş teslim ve iade kontrol süreci tamamlanır.',
      icon: BadgeCheck,
    },
    {
      title: 'Ödeme Döngüsüne Girer',
      desc: 'Kazançlarınız haftalık döngüde muhasebe kontrolüne alınır.',
      icon: CalendarDays,
    },
    {
      title: 'Banka Transferi',
      desc: 'Onay sonrası tutar IBAN hesabınıza aktarılır.',
      icon: Landmark,
    },
  ];

  const safeWithdrawAmount = Number(withdrawAmount);
  const canSubmitWithdraw =
    Number.isFinite(safeWithdrawAmount) &&
    safeWithdrawAmount >= 500 &&
    safeWithdrawAmount <= withdrawableAmount;

  const handlePaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPaymentData((current) => ({ ...current, [e.target.name]: e.target.value }));
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentSaving(true);
    setPaymentError(null);
    setPaymentSuccess(null);

    try {
      await vendorAPI.updateBankAccount({
        iban: paymentData.iban,
        bankName: paymentData.bank_name,
      });
      await refreshVendor();
      setPaymentSuccess('Ödeme bilgileri başarıyla güncellendi');
    } catch (err: any) {
      setPaymentError(err.response?.data?.detail || err.response?.data?.message || 'Ödeme bilgileri güncellenemedi');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || Number.isNaN(amount) || amount < 500) return;

    if (amount > withdrawableAmount) {
      showErrorToast('Gecersiz cekim tutari', 'Cekim tutari cekilebilir tutari asamaz.');
      return;
    }

    if (!iban) {
      showErrorToast('IBAN gerekli', 'Para cekmek icin once bu sayfada IBAN bilgilerinizi kaydedin.');
      return;
    }

    try {
      await vendorAPI.createPayoutRequest(Number(amount.toFixed(2)));

      showSuccessToast('Cekim talebi alindi', PAYOUT_POLICY_SHORT);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      await refresh();
    } catch (err: any) {
      showErrorToast('Cekim talebi gonderilemedi', extractApiErrorMessage(err, 'Lutfen tekrar deneyin.'));
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <h1 className="seller-page-title">Ödemeler</h1>
          <p className="seller-page-subtitle mt-1">Kazançlarınızı takip edin, ödeme döngüsünü yönetin ve çekim talebi oluşturun</p>
        </div>
        <button
          onClick={refresh}
          className="seller-btn-outline inline-flex items-center gap-2 px-4 py-2"
        >
          <RefreshCcw className="w-4 h-4" />
          Yenile
        </button>
      </div>

      {/* Premium Communication */}
      <div className="seller-surface-muted p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-text-primary">Ödeme Güvence Mesajı</h3>
            <p className="text-sm text-text-secondary leading-6">
              Satıcı ödeme sistemimiz yeni dönemde kademeli olarak devreye alınmaktadır. İlk çekim taleplerinizde ödeme süresi
              <span className="font-semibold text-text-primary"> en geç 14 gün </span>
              içinde tamamlanır ve onaylanan tutar doğrudan kayıtlı IBAN hesabınıza aktarılır.
            </p>
            <p className="text-sm text-text-secondary leading-6">
              Bu süreçte durumunuz “Beklemede → İşleniyor → Ödendi” adımlarıyla şeffaf şekilde takip edilir; talep kaybı yaşanmaması için her çekim sistemde kayıt altına alınır.
            </p>
          </div>
        </div>
      </div>

      <div className="seller-surface p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-text-primary">Ödeme Bilgileri</h3>
            <p className="text-sm text-text-secondary mt-1">IBAN ve banka hesabınızı bu alandan yönetin.</p>
          </div>
          <span className="text-xs text-text-secondary bg-accent/10 px-3 py-1 rounded-full">
            Para Çekme İçin
          </span>
        </div>

        {paymentSuccess && (
          <div className="rounded-xl border border-success/25 bg-success/5 p-4 text-success mb-4">
            {paymentSuccess}
          </div>
        )}

        {paymentError && (
          <div className="rounded-xl border border-error/25 bg-error/5 p-4 text-error mb-4">
            {paymentError}
          </div>
        )}

        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">IBAN Durumu</p>
            {getIbanStatusPill()}
          </div>

          <div className="bg-accent/5 border-l-4 border-accent p-4 rounded-lg space-y-2">
            <p className="text-sm text-text-primary">
              <strong>Bilgilendirme:</strong> IBAN yalnızca 1 kez gönderilebilir. IBAN değişikliği için admin ile iletişime geçmeniz gerekir.
            </p>
            <p className="text-xs text-text-secondary">
              Admin “Değişiklik İçin Aç” işlemi yapmadan IBAN güncelleme veya silme yapılamaz.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Hesap Sahibinin Adı Soyadı *
            </label>
            <input
              type="text"
              name="account_holder_name"
              value={paymentData.account_holder_name}
              placeholder="Ahmet Yılmaz"
              readOnly
              className="seller-input bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Banka Adı *
            </label>
            <input
              type="text"
              name="bank_name"
              value={paymentData.bank_name}
              onChange={handlePaymentChange}
              placeholder="Ziraat Bankası, İş Bankası, Garanti BBVA vb."
              disabled={!canEditIban}
              className={`seller-input ${canEditIban ? '' : 'bg-gray-50'}`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              IBAN *
            </label>
            <input
              type="text"
              name="iban"
              value={paymentData.iban}
              onChange={handlePaymentChange}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              maxLength={32}
              disabled={!canEditIban}
              className={`seller-input font-mono ${canEditIban ? '' : 'bg-gray-50'}`}
            />
            <p className="text-xs text-text-secondary mt-1">
              IBAN numaranızı boşluksuz veya boşluklu girebilirsiniz.
            </p>
          </div>

          {(vendorProfile as any)?.iban && (
            <div className="bg-success/5 border border-success/20 rounded-xl p-4">
              <p className="text-sm font-semibold text-success mb-2">✓ Kayıtlı IBAN Bilgileri</p>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-text-secondary">Hesap Sahibi:</span>{' '}
                  <span className="font-medium">{paymentData.account_holder_name || '-'}</span>
                </p>
                <p>
                  <span className="text-text-secondary">Banka:</span>{' '}
                  <span className="font-medium">{(vendorProfile as any)?.bankName || '-'}</span>
                </p>
                <p>
                  <span className="text-text-secondary">IBAN:</span>{' '}
                  <span className="font-mono font-medium">{(vendorProfile as any)?.iban}</span>
                </p>
              </div>
            </div>
          )}

          {!canEditIban && (
            <div className="rounded-xl border border-black/10 bg-gray-50 p-4">
              <p className="text-sm text-text-primary">IBAN alanı şu an düzenlemeye kapalıdır.</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={paymentSaving || !canEditIban}
              className="seller-btn-primary px-5 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {paymentSaving ? 'Kaydediliyor...' : 'IBAN Bilgilerini Kaydet'}
            </button>
          </div>
        </form>
      </div>

      {/* Payment Readiness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="seller-surface p-4">
          <div className="flex items-center gap-3 mb-2">
            <Landmark className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-text-primary">Ödeme Hesabı Durumu</h3>
          </div>
          {hasPaymentInfo ? (
            <div className="space-y-1 text-sm">
              <p className="text-text-secondary">Banka: <span className="font-semibold text-text-primary">{bankName || 'Banka bilgisi eklendi'}</span></p>
              <p className="text-text-secondary">IBAN: <span className="font-semibold text-text-primary">{iban}</span></p>
              <p className="text-success font-medium">Çekim için hazırsınız.</p>
            </div>
          ) : (
            <p className="text-sm text-warning">Çekim başlatmak için bu sayfada IBAN bilginizi tamamlayın.</p>
          )}
        </div>

        <div className="seller-surface p-4">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-text-primary">Ödeme Akış Özeti</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="seller-surface-muted p-2 text-center">
              <p className="text-text-secondary">Beklemede</p>
              <p className="font-bold text-text-primary">{payoutStats.pendingCount}</p>
            </div>
            <div className="seller-surface-muted p-2 text-center">
              <p className="text-text-secondary">İşleniyor</p>
              <p className="font-bold text-text-primary">{payoutStats.processingCount}</p>
            </div>
            <div className="seller-surface-muted p-2 text-center">
              <p className="text-text-secondary">Ödendi</p>
              <p className="font-bold text-text-primary">{payoutStats.paidCount}</p>
            </div>
          </div>
          {payoutStats.lastPaidDate && (
            <p className="text-xs text-text-secondary mt-2">Son başarılı ödeme: {formatDate(String(payoutStats.lastPaidDate))}</p>
          )}
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="seller-surface p-4">
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-success/15 rounded-lg flex items-center justify-center text-success">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-1">Kullanılabilir Bakiye</p>
            <p className="text-2xl font-bold text-text-primary mb-3">{formatMoney(balance.available)}</p>
            <p className="text-sm text-text-secondary">Teslim edilen ve henüz çekilmemiş net bakiyeniz</p>
          </div>
        </div>

        <div className="seller-surface p-4">
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-primary/15 rounded-lg flex items-center justify-center text-primary">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-1">Çekilebilir Tutar</p>
            <p className="text-2xl font-bold text-text-primary mb-3">{formatMoney(withdrawableAmount)}</p>
            <p className="text-sm text-text-secondary mb-3">Anında çekim talebine uygun tutar</p>
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="w-full seller-btn-primary py-2 font-semibold flex items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4" />
              Para Çek
            </button>
          </div>
        </div>

        <div className="seller-surface p-4">
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-warning/15 rounded-lg flex items-center justify-center text-warning">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-1">Bekleyen Ödemeler</p>
            <p className="text-2xl font-bold text-text-primary mb-3">{formatMoney(balance.pending)}</p>
            <p className="text-sm text-text-secondary">Kontrol sonrası ödeme döngüsüne alınır</p>
          </div>
        </div>

        <div className="seller-surface p-4">
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-primary/15 rounded-lg flex items-center justify-center text-primary">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-1">Toplam Net Kazanç</p>
            <p className="text-2xl font-bold text-text-primary mb-3">{formatMoney(balance.total)}</p>
            <p className="text-sm text-text-secondary">Kesilen komisyon: {formatMoney(summary.totalCommissionAmount)}</p>
          </div>
        </div>
      </div>

      <div className="seller-surface-muted p-4 rounded-xl border border-black/5">
        <p className="text-sm text-text-secondary">
          Aktif komisyon oranı: <span className="font-semibold text-text-primary">%{Number(summary.commissionRate || 0).toFixed(2)}</span>
        </p>
        <p className="text-sm text-text-secondary mt-1">
          Toplam brüt satış: <span className="font-semibold text-text-primary">{formatMoney(summary.totalGrossSales)}</span>
        </p>
      </div>

      {/* Payout Process Timeline */}
      <div className="seller-surface p-4">
        <h3 className="font-semibold text-text-primary mb-3">Ödeme Süreci</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {payoutTimeline.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="seller-surface-muted p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                </div>
                <p className="text-xs text-text-secondary leading-5">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-error/25 bg-error/5 p-4 text-error">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Payment History */}
      <div className="seller-surface overflow-hidden">
        <div className="p-4 border-b border-black/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Ödeme Geçmişi</h3>
              <p className="text-sm text-text-secondary">Tüm çekim ve ödeme hareketleriniz</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Tarih</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Tutar</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Yöntem</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                      <span className="text-text-secondary">Yükleniyor...</span>
                    </div>
                  </td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <CreditCard className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-text-secondary font-medium">Henüz ödeme kaydı yok</p>
                      <p className="text-sm text-text-secondary mt-1">Ödemeler burada görünecek</p>
                    </div>
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-text-primary">
                      {formatDate(p?.createdAt || p?.periodEnd || p?.periodStart)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-success">
                        {formatMoney(Number(p?.amount || 0))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">IBAN Transfer</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${getStatusClassName(p?.status)}`}>
                        {getStatusLabel(p?.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="seller-surface-solid max-w-md w-full p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-text-primary">Para Çekme Talebi</h3>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-text-secondary hover:text-text-primary transition-colors"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="seller-surface-muted p-3">
                <p className="text-sm text-text-secondary mb-1">Kullanılabilir Bakiye</p>
                <p className="text-xl font-bold text-success">{formatMoney(balance.available)}</p>
                <p className="text-xs text-text-secondary mt-1">Çekilebilir Tutar: <span className="font-semibold text-text-primary">{formatMoney(withdrawableAmount)}</span></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Çekim Tutarı (₺)
                </label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Minimum ₺500"
                  className="seller-input"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {QUICK_WITHDRAW_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setWithdrawAmount(String(amount))}
                      className="seller-btn-outline px-3 py-1.5 text-xs"
                    >
                      {formatMoney(amount)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-3 seller-surface-muted p-3">
                <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-sm text-text-secondary space-y-1">
                  <p>Minimum çekim tutarı ₺500'dir.</p>
                  <p>Yeni sistem geçişinde ilk ödeme süreci en geç 14 gün içinde tamamlanır.</p>
                  <p>Durum değişiklikleri ödeme geçmişinde anlık görünür.</p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 seller-btn-ghost px-4 py-2.5 font-medium"
                >
                  İptal
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={!canSubmitWithdraw || !hasPaymentInfo}
                  className="flex-1 seller-btn-primary px-4 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed font-semibold"
                >
                  Talebi Oluştur
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
