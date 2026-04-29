import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { vendorAPI, authAPI } from '../services/api.ts';
import { API_BASE_URL } from '../services/api.ts';
import TrAddressSelect from '../components/TrAddressSelect';

const DOCUMENT_STATUS_META: Record<string, { label: string; detail: string; tone: string }> = {
  APPROVED: {
    label: 'Onaylandı',
    detail: 'Belgeniz admin tarafından onaylandı.',
    tone: 'bg-success/10 text-success border-success/20',
  },
  RESUBMIT_REQUIRED: {
    label: 'Tekrar Gönder',
    detail: 'Bu belge için yeniden yükleme isteniyor.',
    tone: 'bg-error/10 text-error border-error/20',
  },
  PENDING: {
    label: 'İnceleniyor',
    detail: 'Belgeniz admin incelemesinde.',
    tone: 'bg-warning/10 text-warning border-warning/20',
  },
};

const Profile: React.FC = () => {
  const { vendor, refreshVendor } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const vendorProfile = vendor?.vendorProfile || {};
  const registrationDateRaw =
    (vendor as any)?.created_at ||
    (vendor as any)?.createdAt ||
    (vendorProfile as any)?.created_at ||
    (vendorProfile as any)?.createdAt ||
    null;

  const registrationDateText = (() => {
    if (!registrationDateRaw) return '-';
    const date = new Date(String(registrationDateRaw));
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('tr-TR');
  })();

  const resolveBackendUrl = (url?: string | null) => {
    if (!url) return '';
    const u = String(url);
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
    return `${API_BASE_URL}/${u}`;
  };
  
  const [formData, setFormData] = useState({
    owner_name: vendor?.owner_name || '',
    phone: vendor?.phone || '',
    email: vendor?.email || '',
  });

  const [addressForm, setAddressForm] = useState({
    country: vendor?.vendorProfile?.country || 'Türkiye',
    city: vendor?.vendorProfile?.city || '',
    district: vendor?.vendorProfile?.district || '',
    neighborhood: vendor?.vendorProfile?.neighborhood || '',
    addressLine: vendor?.vendorProfile?.addressLine || '',
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [uploadingDocumentKey, setUploadingDocumentKey] = useState('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setFormData({
      owner_name: vendor?.owner_name || '',
      phone: vendor?.phone || '',
      email: vendor?.email || '',
    });

    setAddressForm({
      country: vendor?.vendorProfile?.country || 'Türkiye',
      city: vendor?.vendorProfile?.city || '',
      district: vendor?.vendorProfile?.district || '',
      neighborhood: vendor?.vendorProfile?.neighborhood || '',
      addressLine: vendor?.vendorProfile?.addressLine || '',
    });
  }, [vendor]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const computedAddress = [
        addressForm.addressLine,
        addressForm.neighborhood,
        addressForm.district,
        addressForm.city,
      ]
        .map((s) => String(s || '').trim())
        .filter(Boolean)
        .join(', ');

      await vendorAPI.updateProfile({
        address: computedAddress || undefined,
        country: addressForm.country || undefined,
        city: addressForm.city || undefined,
        district: addressForm.district || undefined,
        neighborhood: addressForm.neighborhood || undefined,
        addressLine: addressForm.addressLine || undefined,
      });
      await refreshVendor();
      setSuccess('Adres bilgileri başarıyla güncellendi');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.message || 'Adres bilgileri güncellenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('Yeni şifreler eşleşmiyor');
      return;
    }

    if (passwordData.new_password.length < 6) {
      setError('Yeni şifre en az 6 karakter olmalıdır');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword(passwordData.current_password, passwordData.new_password);
      setSuccess('Şifre başarıyla değiştirildi');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Şifre değiştirilemedi');
    } finally {
      setLoading(false);
    }
  };

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Dosya okunamadı'));
      reader.readAsDataURL(file);
    });

  const handleDocumentUpload = async (
    documentKey: string,
    profileField: 'taxSheetUrl' | 'residenceDocUrl' | 'idPhotoFrontUrl' | 'idPhotoBackUrl',
    uploadKind: 'taxSheet' | 'residence' | 'id_front' | 'id_back',
    file?: File | null
  ) => {
    if (!file) {
      return;
    }

    setUploadingDocumentKey(documentKey);
    setError('');
    setSuccess('');

    try {
      const contentBase64 = await readFileAsBase64(file);
      const uploadResponse =
        uploadKind === 'taxSheet'
          ? await vendorAPI.uploadTaxSheet({ filename: file.name, contentBase64 })
          : await vendorAPI.uploadDocument({ filename: file.name, contentBase64, type: uploadKind });

      const url = uploadResponse?.data?.data?.url || uploadResponse?.data?.url;
      if (!url) {
        throw new Error('Yüklenen belge URL bilgisi alınamadı');
      }

      await vendorAPI.updateProfile({ [profileField]: url });
      await refreshVendor();
      setSuccess(uploadKind === 'taxSheet' ? 'Vergi levhası güncellendi ve yeniden incelemeye gönderildi.' : 'Belge güncellendi ve yeniden incelemeye gönderildi.');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Belge yüklenemedi');
    } finally {
      setUploadingDocumentKey('');
      if (fileInputRefs.current[documentKey]) {
        fileInputRefs.current[documentKey].value = '';
      }
    }
  };

  const documentItems = [
    {
      key: 'taxSheet',
      label: 'Vergi Levhası',
      url: (vendorProfile as any)?.taxSheetUrl,
      status: String((vendorProfile as any)?.taxSheetReviewStatus || 'PENDING').toUpperCase(),
      note: String((vendorProfile as any)?.taxSheetReviewNote || '').trim(),
      profileField: 'taxSheetUrl' as const,
      uploadKind: 'taxSheet' as const,
      accept: '.pdf,.png,.jpg,.jpeg,.webp',
    },
    {
      key: 'residenceDoc',
      label: 'İkametgah Belgesi',
      url: (vendorProfile as any)?.residenceDocUrl,
      status: String((vendorProfile as any)?.residenceDocReviewStatus || 'PENDING').toUpperCase(),
      note: String((vendorProfile as any)?.residenceDocReviewNote || '').trim(),
      profileField: 'residenceDocUrl' as const,
      uploadKind: 'residence' as const,
      accept: '.pdf,.png,.jpg,.jpeg,.webp',
    },
    {
      key: 'idPhotoFront',
      label: 'Kimlik (Ön Yüz)',
      url: (vendorProfile as any)?.idPhotoFrontUrl,
      status: String((vendorProfile as any)?.idPhotoFrontReviewStatus || 'PENDING').toUpperCase(),
      note: String((vendorProfile as any)?.idPhotoFrontReviewNote || '').trim(),
      profileField: 'idPhotoFrontUrl' as const,
      uploadKind: 'id_front' as const,
      accept: '.png,.jpg,.jpeg,.webp,.pdf',
    },
    {
      key: 'idPhotoBack',
      label: 'Kimlik (Arka Yüz)',
      url: (vendorProfile as any)?.idPhotoBackUrl,
      status: String((vendorProfile as any)?.idPhotoBackReviewStatus || 'PENDING').toUpperCase(),
      note: String((vendorProfile as any)?.idPhotoBackReviewNote || '').trim(),
      profileField: 'idPhotoBackUrl' as const,
      uploadKind: 'id_back' as const,
      accept: '.png,.jpg,.jpeg,.webp,.pdf',
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <h1 className="seller-page-title">Ayarlar</h1>

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

      {/* Account Status */}
      <details className="seller-surface group" open={false}>
        <summary className="list-none cursor-pointer p-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Hesap Durumu</h2>
          <span className="text-text-secondary transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="px-6 pb-6">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-text-secondary">E-posta</span>
            <span className="font-medium">{vendor?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Hesap Durumu</span>
            <span
              className={`px-3 py-1 text-sm rounded-full ${
                vendor?.status === 'approved'
                  ? 'bg-success/10 text-success'
                  : vendor?.status === 'pending_review'
                  ? 'bg-warning/10 text-warning'
                  : 'bg-error/10 text-error'
              }`}
            >
              {vendor?.status === 'approved' && 'Onaylı'}
              {vendor?.status === 'pending_review' && 'İnceleniyor'}
              {vendor?.status === 'rejected' && 'Reddedildi'}
              {vendor?.status === 'suspended' && 'Askıda'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Kayıt Tarihi</span>
            <span className="font-medium">{registrationDateText}</span>
          </div>
        </div>
        </div>
      </details>

      {/* Profile Form */}
      <details className="seller-surface group" open={false}>
        <summary className="list-none cursor-pointer p-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Profil Bilgileri</h2>
          <span className="text-text-secondary transition-transform group-open:rotate-180">⌄</span>
        </summary>
      <div className="px-6 pb-6 space-y-4">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Ad Soyad</label>
            <input
              type="text"
              name="owner_name"
              value={formData.owner_name}
              readOnly
              className="seller-input bg-gray-50"
            />
            <p className="text-xs text-text-secondary mt-1">Yetkili kişi adı, kayıt sırasında belirlenir.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Telefon</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center gap-2 text-sm text-text-secondary">
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center w-7 h-5 rounded-md overflow-hidden"
                >
                  <svg width="28" height="20" viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Türkiye">
                    <rect width="28" height="20" rx="4" fill="#E30A17" />
                    <circle cx="11" cy="10" r="5.6" fill="#FFFFFF" />
                    <circle cx="12.6" cy="10" r="4.6" fill="#E30A17" />
                    <polygon
                      fill="#FFFFFF"
                      points="18,6.5 18.9,9.1 21.6,9.1 19.4,10.6 20.2,13.2 18,11.7 15.8,13.2 16.6,10.6 14.4,9.1 17.1,9.1"
                    />
                  </svg>
                </span>
                <span className="font-medium text-text-primary">+90</span>
              </div>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                readOnly
                className="seller-input bg-gray-50 pl-20"
              />
            </div>
            <p className="text-xs text-text-secondary mt-1">Telefon numarası, admin paneli ile senkron tutulur.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">E-posta</label>
          <input
            type="email"
            value={formData.email}
            readOnly
            className="seller-input bg-gray-50"
          />
        </div>

        <div className="pt-2 border-t border-black/10">
          <h3 className="text-base font-semibold text-text-primary mb-3">Şifre Değiştir</h3>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Mevcut Şifre</label>
              <input
                type="password"
                name="current_password"
                value={passwordData.current_password}
                onChange={handlePasswordChange}
                className="seller-input"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Yeni Şifre</label>
                <input
                  type="password"
                  name="new_password"
                  value={passwordData.new_password}
                  onChange={handlePasswordChange}
                  className="seller-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Yeni Şifre (Tekrar)</label>
                <input
                  type="password"
                  name="confirm_password"
                  value={passwordData.confirm_password}
                  onChange={handlePasswordChange}
                  className="seller-input"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="seller-btn-primary px-6 py-2"
              >
                Şifre Değiştir
              </button>
            </div>
          </form>
        </div>
      </div>
      </details>

      {/* Address Info */}
      <details className="seller-surface group" open={false}>
        <summary className="list-none cursor-pointer p-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Adres Bilgileri</h2>
          <span className="text-text-secondary transition-transform group-open:rotate-180">⌄</span>
        </summary>
      <form onSubmit={handleAddressSubmit} className="px-6 pb-6 space-y-4">
        <TrAddressSelect
          city={addressForm.city}
          district={addressForm.district}
          neighborhood={addressForm.neighborhood}
          disabled={loading}
          onChange={(next) => setAddressForm((p) => ({ ...p, ...next, country: 'Türkiye' }))}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Ülke</label>
            <input
              type="text"
              value={addressForm.country || 'Türkiye'}
              readOnly
              className="seller-input bg-gray-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Açık Adres</label>
          <textarea
            value={addressForm.addressLine}
            onChange={(e) => setAddressForm((p) => ({ ...p, addressLine: e.target.value }))}
            rows={3}
            placeholder="Cadde/Sokak, No, Kat, Daire, Tarifi..."
            className="seller-textarea"
          />
          {vendor?.vendorProfile?.address && (
            <p className="text-xs text-text-secondary mt-2">Mevcut: {vendor.vendorProfile.address}</p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="seller-btn-primary px-6 py-2"
          >
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
      </details>

      {/* Documents */}
      <details className="seller-surface group" open={false}>
        <summary className="list-none cursor-pointer p-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Belgeler</h2>
          <span className="text-text-secondary transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="px-6 pb-6">
        <div className="space-y-3">
          {documentItems.map((document) => {
            const u = document.url ? resolveBackendUrl(document.url) : '';
            const uploaded = Boolean(u);
            const statusMeta = DOCUMENT_STATUS_META[document.status] || DOCUMENT_STATUS_META.PENDING;
            const canResubmit = document.status === 'RESUBMIT_REQUIRED' || !uploaded;
            const buttonLabel = uploaded ? 'Tekrar Gönder' : 'Belge Yükle';
            const isUploading = uploadingDocumentKey === document.key;
            return (
              <div key={document.key} className="rounded-lg border border-black/5 bg-background p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-text-primary">{document.label}</p>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusMeta.tone}`}>
                        {uploaded ? statusMeta.label : 'Yüklenmedi'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-text-secondary">
                      {uploaded ? statusMeta.detail : 'Bu belge henüz sisteme yüklenmedi.'}
                    </p>
                    {document.note && (
                      <div className="mt-2 rounded-lg border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
                        <span className="font-semibold">Admin Notu:</span> {document.note}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {uploaded ? (
                      <a
                        href={u}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary-700"
                      >
                        Görüntüle
                      </a>
                    ) : (
                      <span className="text-xs text-text-secondary">-</span>
                    )}

                    <input
                      ref={(element) => {
                        fileInputRefs.current[document.key] = element;
                      }}
                      type="file"
                      accept={document.accept}
                      className="hidden"
                      onChange={(event) =>
                        handleDocumentUpload(
                          document.key,
                          document.profileField,
                          document.uploadKind,
                          event.target.files?.[0] || null
                        )
                      }
                    />

                    {canResubmit && (
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[document.key]?.click()}
                        disabled={Boolean(uploadingDocumentKey)}
                        className="seller-btn-primary px-4 py-2"
                      >
                        {isUploading ? 'Yükleniyor...' : buttonLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!documentItems.some((document) => Boolean(document.url)) && (
            <p className="text-text-secondary text-sm">Henüz belge yüklenmemiş</p>
          )}
        </div>
        </div>
      </details>

    </div>
  );
};

export default Profile;
