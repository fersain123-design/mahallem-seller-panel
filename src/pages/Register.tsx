import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient, { authAPI, vendorAPI } from '../services/api.ts';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Upload,
  FileText,
  Home,
  Building,
  MapPin,
  CreditCard,
  User,
  ShoppingCart,
  Donut,
  Beef,
  BookOpen,
  CupSoda,
  Sandwich,
  Pill,
  Droplet,
  Fish,
  Cake,
  Coffee,
  Shirt,
  Cookie,
  Sprout,
  Flower2,
  PawPrint,
  Flame,
  Store,
} from 'lucide-react';
import TrAddressSelect from '../components/TrAddressSelect';
import AuthQuotesPanel from '../components/auth/AuthQuotesPanel';
import AuthSplitLayout from '../components/auth/AuthSplitLayout';
import { getAuthErrorMessage } from '../lib/authErrorMessage';
import { BUSINESS_TYPES, filterBusinessTypes } from '../config/vendorTypes.tsx';

const COMBINED_BUSINESS_SUBTYPE_OPTIONS: Record<string, Array<{ id: string; name: string }>> = {
  market_manav: [
    { id: 'market', name: 'Market' },
    { id: 'manav', name: 'Manav' },
    { id: 'market_manav', name: 'Market & Manav' },
  ],
  firin_pastane: [
    { id: 'firin', name: 'Fırın' },
    { id: 'pastane', name: 'Pastane' },
    { id: 'firin_pastane', name: 'Fırın & Pastane' },
  ],
  kasap_sarkuteri: [
    { id: 'kasap', name: 'Kasap' },
    { id: 'sarkuteri', name: 'Şarküteri' },
    { id: 'kasap_sarkuteri', name: 'Kasap & Şarküteri' },
  ],
};

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [success, setSuccess] = useState(false);
  const [platformDeliveryEnabled, setPlatformDeliveryEnabled] = useState(true);
  const [businessTypeQuery, setBusinessTypeQuery] = useState('');
  const [acceptLegalTerms, setAcceptLegalTerms] = useState(false);

  const visibleBusinessTypes = filterBusinessTypes(businessTypeQuery);

  useEffect(() => {
    let active = true;

    const loadPlatformDeliveryFlag = async () => {
      try {
        const res = await apiClient.get('/api/settings');
        const enabled = Boolean(res?.data?.data?.platformDeliveryEnabled ?? false);
        if (!active) return;

        setPlatformDeliveryEnabled(enabled);
        if (!enabled) {
          setFormData((prev) => ({
            ...prev,
            delivery_coverage: 'SELF',
          }));
        }
      } catch {
        if (!active) return;
        setPlatformDeliveryEnabled(true);
      }
    };

    void loadPlatformDeliveryFlag();

    return () => {
      active = false;
    };
  }, []);

  const [formData, setFormData] = useState({
    owner_name: '',
    email: '',
    phone: '',
    password: '',
    password_confirm: '',
    store_name: '',
    business_type: '',
    business_subtype: '',
    delivery_coverage: 'SELF' as 'SELF' | 'PLATFORM',
    tax_number: '',
    tax_office: '',
    // Kimlik doğrulama
    tc_kimlik: '',
    birth_date: '',
    address: {
      province: '',      // İl ID
      province_name: '', // İl Adı
      district: '',      // İlçe ID
      district_name: '', // İlçe Adı
      neighborhood: '',  // Mahalle ID
      neighborhood_name: '', // Mahalle Adı
      full_address: '',
    },
  });

  const subTypeOptions = COMBINED_BUSINESS_SUBTYPE_OPTIONS[formData.business_type] || [];
  const resolvedBusinessTypeForSubmit =
    subTypeOptions.length > 0 ? formData.business_subtype || formData.business_type : formData.business_type;


  // Belge dosyaları
  const [taxSheetFile, setTaxSheetFile] = useState<File | null>(null);
  const [residenceDocFile, setResidenceDocFile] = useState<File | null>(null);
  const [idPhotoFrontFile, setIdPhotoFrontFile] = useState<File | null>(null);
  const [idPhotoBackFile, setIdPhotoBackFile] = useState<File | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: { ...prev.address, [addressField]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleTrAddressChange = (next: { city: string; district: string; neighborhood: string }) => {
    setFormData((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        // Register flow ultimately uses *_name fields; keep these as the source of truth.
        province: '',
        district: '',
        neighborhood: '',
        province_name: next.city,
        district_name: next.district,
        neighborhood_name: next.neighborhood,
      },
    }));
  };

  const handleTaxSheetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTaxSheetFile(e.target.files[0]);
    }
  };

  const handleResidenceDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResidenceDocFile(e.target.files[0]);
    }
  };

  const handleIdPhotoFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIdPhotoFrontFile(e.target.files[0]);
    }
  };

  const handleIdPhotoBackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIdPhotoBackFile(e.target.files[0]);
    }
  };

  const validateStep1 = () => {
    if (!formData.owner_name || !formData.email || !formData.password) {
      setError('Lütfen adınız, e-postanız ve şifrenizi girin');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return false;
    }
    if (formData.password !== formData.password_confirm) {
      setError('Şifreler eşleşmiyor');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Geçerli bir email adresi girin');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.store_name || !formData.business_type) {
      setError('Lütfen mağaza adı ve işletme türünü seçin');
      return false;
    }
    if (subTypeOptions.length > 0 && !formData.business_subtype) {
      setError('Lütfen alt işletme türünü seçin');
      return false;
    }
    if (!formData.tax_number || !formData.tax_office) {
      setError('Vergi numarası ve vergi dairesi ZORUNLUDUR');
      return false;
    }
    // Lokasyon listeleri eksik olabileceği için (özellikle mahalleler), ID yerine isimleri zorunlu tutuyoruz.
    if (!formData.address.province_name || !formData.address.district_name || !formData.address.neighborhood_name) {
      setError('Lütfen İl / İlçe / Mahalle bilgisini girin');
      return false;
    }
    if (!formData.address.full_address) {
      setError('Lütfen açık adres bilgisini girin');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    // Kimlik bilgileri kontrolü
    if (!formData.tc_kimlik || formData.tc_kimlik.length !== 11) {
      setError('Geçerli bir TC Kimlik Numarası giriniz (11 haneli)');
      return false;
    }
    if (!formData.birth_date) {
      setError('Doğum tarihi girilmesi ZORUNLUDUR');
      return false;
    }
    // Kimlik fotoğrafları kontrolü
    if (!idPhotoFrontFile) {
      setError('Kimlik ön yüz fotoğrafı yüklenmesi ZORUNLUDUR');
      return false;
    }
    if (!idPhotoBackFile) {
      setError('Kimlik arka yüz fotoğrafı yüklenmesi ZORUNLUDUR');
      return false;
    }
    // Vergi levhası kontrolü
    if (!taxSheetFile) {
      setError('Vergi levhası yüklenmesi ZORUNLUDUR');
      return false;
    }
    if (!residenceDocFile) {
      setError('İkamet belgesi yüklenmesi ZORUNLUDUR');
      return false;
    }
    if (!acceptLegalTerms) {
      setError('Başvuruyu tamamlamak için Kullanım Koşulları ve Satıcı Sözleşmesini kabul etmelisiniz.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setWarning('');

    if (!validateStep3()) return;

    setLoading(true);
    try {
      console.log('📝 Kayıt bilgileri gönderiliyor:', {
        name: formData.owner_name,
        email: formData.email,
        phone: formData.phone,
        role: 'VENDOR',
      });
      
      const registerRes = await authAPI.register({
        name: formData.owner_name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone?.trim() || undefined,
        role: 'VENDOR',
        businessType: resolvedBusinessTypeForSubmit,
        tcKimlik: formData.tc_kimlik,
        deliveryCoverage: formData.delivery_coverage,
      });

      console.log('✓ Kayıt başarılı, yanıt:', registerRes.data);

      const responseData = registerRes.data?.data || registerRes.data;
      let token: string | undefined = responseData?.accessToken;

      // Bazı ortamlarda register response farklı şekillenebiliyor; token yoksa login ile fallback yap.
      if (!token) {
        console.log('Token register yanıtında bulunamadı, login fallback\'i deneniyor...');
        const loginRes = await authAPI.login(formData.email, formData.password);
        const loginData = loginRes.data?.data || loginRes.data;
        token = loginData?.accessToken || loginData?.access_token;
        console.log('✓ Login başarılı, token alındı');
      }

      if (!token) {
        // Kullanıcı oluşturulmuş olabilir; başarı ekranına uyarı ile devam edeceğiz.
        console.warn('Token elde edilemedi, başarı ekranına uyarı ile gidiliyor');
        setWarning('Başvurunuz oluşturuldu ancak doğrulama oturumu başlatılamadı. Lütfen giriş yapıp profil ekranından belgeleri tekrar yükleyin.');
        setSuccess(true);
        setTimeout(() => navigate('/login'), 4000);
        return;
      }

      // Tam adres formatı: Mahalle, Açık Adres, İlçe/İl
      const address = [
        formData.address.neighborhood_name,
        formData.address.full_address,
        `${formData.address.district_name}/${formData.address.province_name}`,
      ]
        .filter(Boolean)
        .join(', ');

      const fileToBase64 = (file: File) =>
        new Promise<string>((resolve, reject) => {
          console.log(`📄 Dosya okunuyor: ${file.name} (${(file.size / 1024).toFixed(2)}KB)`);
          if (file.size > 10 * 1024 * 1024) {
            reject(new Error(`Dosya çok büyük (max 10MB): ${(file.size / 1024 / 1024).toFixed(2)}MB`));
            return;
          }
          const reader = new FileReader();
          reader.onerror = (evt) => {
            console.error('FileReader hatası:', evt.type, reader.error);
            reject(new Error(`FileReader hatası: ${reader.error?.message || 'Bilinmeyen hata'}`));
          };
          reader.onload = () => {
            const result = String(reader.result || '');
            console.log(`✓ Dosya başarıyla okundu: ${result.length} karakter`);
            resolve(result);
          };
          reader.readAsDataURL(file);
        });

      // Bu kısım admin panelinde eksiksiz görünmesi için kritik.
      localStorage.setItem('access_token', token);
      try {
        let taxSheetUrl = undefined as string | undefined;
        let residenceDocUrl = undefined as string | undefined;
        let idPhotoFrontUrl = undefined as string | undefined;
        let idPhotoBackUrl = undefined as string | undefined;

        if (idPhotoFrontFile) {
          try {
            console.log('🚀 Kimlik ön yüz yükleme başlıyor...');
            const contentBase64 = await fileToBase64(idPhotoFrontFile);
            console.log('📤 Backend\'e gönderiliyor...');
            const uploadRes = await vendorAPI.uploadDocument({
              filename: idPhotoFrontFile.name,
              contentBase64,
              type: 'id_front',
            });
            idPhotoFrontUrl = uploadRes.data?.data?.url || uploadRes.data?.url;
            console.log('✓ Kimlik ön yüz yüklendi:', idPhotoFrontUrl);
          } catch (err) {
            console.error('✗ Kimlik ön yüz yükleme hatası:', {
              message: (err as any)?.message,
              response: (err as any)?.response?.data,
              status: (err as any)?.response?.status,
              errorDetails: err,
            });
            throw err;
          }
        }

        if (idPhotoBackFile) {
          try {
            console.log('🚀 Kimlik arka yüz yükleme başlıyor...');
            const contentBase64 = await fileToBase64(idPhotoBackFile);
            console.log('📤 Backend\'e gönderiliyor...');
            const uploadRes = await vendorAPI.uploadDocument({
              filename: idPhotoBackFile.name,
              contentBase64,
              type: 'id_back',
            });
            idPhotoBackUrl = uploadRes.data?.data?.url || uploadRes.data?.url;
            console.log('✓ Kimlik arka yüz yüklendi:', idPhotoBackUrl);
          } catch (err) {
            console.error('✗ Kimlik arka yüz yükleme hatası:', {
              message: (err as any)?.message,
              response: (err as any)?.response?.data,
              status: (err as any)?.response?.status,
            });
            throw err;
          }
        }

        if (taxSheetFile) {
          try {
            console.log('🚀 Vergi müfettişliği belgesi yükleme başlıyor...');
            const contentBase64 = await fileToBase64(taxSheetFile);
            console.log('📤 Backend\'e gönderiliyor...');
            const uploadRes = await vendorAPI.uploadTaxSheet({
              filename: taxSheetFile.name,
              contentBase64,
            });
            taxSheetUrl = uploadRes.data?.data?.url || uploadRes.data?.url;
            console.log('✓ Vergi müfettişliği belgesi yüklendi:', taxSheetUrl);
          } catch (err) {
            console.error('✗ Vergi müfettişliği belgesi yükleme hatası:', {
              message: (err as any)?.message,
              response: (err as any)?.response?.data,
              status: (err as any)?.response?.status,
            });
            throw err;
          }
        }

        if (residenceDocFile) {
          try {
            console.log('🚀 İkamet belgesi yükleme başlıyor...');
            const contentBase64 = await fileToBase64(residenceDocFile);
            console.log('📤 Backend\'e gönderiliyor...');
            const uploadRes = await vendorAPI.uploadDocument({
              filename: residenceDocFile.name,
              contentBase64,
              type: 'residence',
            });
            residenceDocUrl = uploadRes.data?.data?.url || uploadRes.data?.url;
            console.log('✓ İkamet belgesi yüklendi:', residenceDocUrl);
          } catch (err) {
            console.error('✗ İkamet belgesi yükleme hatası:', {
              message: (err as any)?.message,
              response: (err as any)?.response?.data,
              status: (err as any)?.response?.status,
            });
            throw err;
          }
        }

        console.log('🔄 Profil güncelleniyor...');
        await vendorAPI.updateProfile({
          shopName: formData.store_name,
          address,
          country: 'Türkiye',
          city: formData.address.province_name,
          district: formData.address.district_name,
          neighborhood: formData.address.neighborhood_name,
          addressLine: formData.address.full_address,
          taxNumber: formData.tax_number,
          taxOffice: formData.tax_office,
          tcKimlik: formData.tc_kimlik,
          birthDate: formData.birth_date,
          taxSheetUrl,
          residenceDocUrl,
          idPhotoFrontUrl,
          idPhotoBackUrl,
        });
        console.log('✓ Profil güncellendi, tüm belgeler kaydedildi');
      } catch (enrichErr: any) {
        const msg = getAuthErrorMessage(enrichErr, 'Profil/belge bilgileri kaydedilemedi');
        console.error('Belge yükleme/profil güncelleme hatası:', enrichErr?.response?.data || enrichErr);
        setWarning(
          `Başvurunuz oluşturuldu fakat başvuru detayları kaydedilemedi. Lütfen giriş yapıp Profil ekranından tekrar deneyin. (Detay: ${msg})`
        );
      } finally {
        localStorage.removeItem('access_token');
      }

      setSuccess(true);
      setTimeout(() => navigate('/login'), 4000);
    } catch (err: any) {
      console.error('Kayıt hatası yakalandı:', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });

      setError(getAuthErrorMessage(err, 'Kayıt başarısız oldu'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen seller-auth-bg flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="seller-surface-solid p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-xl mb-5">
            <CheckCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-3">Başvurunuz Alındı!</h2>
          {warning && (
            <div className="rounded-xl border border-error/25 bg-error/5 p-4 mb-6 text-left">
              <p className="text-error font-semibold">Dikkat</p>
              <p className="text-error/90 text-sm mt-1">{warning}</p>
            </div>
          )}
          <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 mb-6">
            <p className="text-text-primary font-semibold mb-2">Doğrulama Süreci Başlatıldı</p>
            <p className="text-text-secondary text-sm">
              Belgeleriniz admin ekibi tarafından incelenecektir. Vergi levhanızdaki adres ile girdiğiniz adres karşılaştırılacak ve onaylanacaktır.
            </p>
          </div>
          <p className="text-text-secondary mb-2">Onay süreci 1-3 iş günü sürebilir.</p>
          <p className="text-text-secondary text-sm">Onaylandıktan sonra giriş yapabileceksiniz.</p>
          <p className="text-sm text-text-secondary mt-4">Giriş sayfasına yönlendiriliyorsunuz...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthSplitLayout left={<AuthQuotesPanel />}>
            {/* Progress */}
            <div className="mb-6 seller-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="seller-page-title">Başvuruyu tamamlayın</div>
                  <div className="seller-page-subtitle mt-1">Adım {step} / 3</div>
                </div>
                <div className="hidden sm:flex gap-2 text-xs">
                  <span className={`px-3 py-1 rounded-full border ${step >= 1 ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white text-text-secondary border-black/10'}`}>1. Hesap</span>
                  <span className={`px-3 py-1 rounded-full border ${step >= 2 ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white text-text-secondary border-black/10'}`}>2. İşletme</span>
                  <span className={`px-3 py-1 rounded-full border ${step >= 3 ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white text-text-secondary border-black/10'}`}>3. Belgeler</span>
                </div>
              </div>
              <div className="mt-4 h-2 rounded-full bg-white border border-black/5 overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-error/25 bg-error/5 p-4 text-error flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">{error}</div>
              </div>
            )}

            <form
              id="register-form"
              onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}
              className="seller-surface-solid p-6"
            >
              {/* Step 1: Account Info */}
              {step === 1 && (
                <div className="space-y-4">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Hesap Bilgileri</h3>
              
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Yetkili Kişi Adı Soyadı *</label>
                <input
                  type="text"
                  name="owner_name"
                  value={formData.owner_name}
                  onChange={handleChange}
                  className="seller-input"
                  placeholder="Ad Soyad"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">E-posta *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="seller-input"
                    placeholder="ornek@email.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Telefon</label>
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
                      onChange={handleChange}
                      className="seller-input pl-20"
                      placeholder="5XX XXX XX XX"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Şifre *</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="seller-input"
                    placeholder="En az 6 karakter"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Şifre Tekrar *</label>
                  <input
                    type="password"
                    name="password_confirm"
                    value={formData.password_confirm}
                    onChange={handleChange}
                    className="seller-input"
                    placeholder="Şifreyi tekrar girin"
                    required
                  />
                </div>
              </div>
                </div>
              )}

          {/* Step 2: Store & Address Info */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-text-primary mb-4">İşletme & Adres Bilgileri</h3>
              
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Mağaza/İşletme Adı *</label>
                <input
                  type="text"
                  name="store_name"
                  value={formData.store_name}
                  onChange={handleChange}
                  className="seller-input"
                  placeholder="İşletmenizin adını girin"
                  required
                />
              </div>
              
              {/* İşletme Türü Seçimi */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">İşletme Türü *</label>

                <div className="mb-3">
                  <input
                    type="text"
                    value={businessTypeQuery}
                    onChange={(e) => setBusinessTypeQuery(e.target.value)}
                    className="seller-input"
                    placeholder="İşletme türü ara (örn: Market, Kafe)"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {visibleBusinessTypes.map((type) => {
                    const selected = formData.business_type === type.id;
                    const Icon = type.icon as BusinessTypeIcon;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            business_type: type.id,
                            business_subtype:
                              COMBINED_BUSINESS_SUBTYPE_OPTIONS[type.id]?.length > 0 ? '' : prev.business_subtype,
                          }))
                        }
                        className={`relative p-3 rounded-xl border transition-all text-left bg-white/70 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                          selected
                            ? 'border-primary/40 ring-2 ring-primary/10 shadow-[0_12px_24px_rgba(10,106,64,0.14)]'
                            : 'border-black/10 hover:border-primary/25 hover:shadow-sm'
                        }`}
                      >
                        {selected && (
                          <span className="absolute top-2 right-2 text-primary">
                            <CheckCircle className="w-4 h-4" />
                          </span>
                        )}
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-lg border ${
                              type.tone || 'text-gray-700 bg-gray-50 border-gray-100'
                            } ${selected ? 'ring-1 ring-primary/30' : ''}`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div
                              className={`text-sm font-semibold leading-tight ${
                                selected ? 'text-primary' : 'text-text-primary'
                              }`}
                            >
                              {type.name}
                            </div>
                            <div className="text-xs text-text-secondary mt-0.5 truncate">
                              {type.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {subTypeOptions.length > 0 && (
                  <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="text-sm font-semibold text-text-primary mb-2">Alt İşletme Türü *</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {subTypeOptions.map((opt) => {
                        const selected = formData.business_subtype === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                business_subtype: prev.business_subtype === opt.id ? '' : opt.id,
                              }))
                            }
                            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                              selected
                                ? 'border-primary bg-primary text-white shadow-sm'
                                : 'border-black/10 bg-white text-text-primary hover:border-primary/30'
                            }`}
                          >
                            {opt.name}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                      <p className="text-xs font-medium text-amber-800">
                        Her ikisinin satışını yapıyorsanız birleşik seçeneği seçin.
                      </p>
                    </div>
                  </div>
                )}

                {businessTypeQuery.trim().length > 0 && visibleBusinessTypes.length === 0 && (
                  <div className="mt-3 text-sm text-text-secondary">
                    Aramanıza uygun işletme türü bulunamadı.
                  </div>
                )}
              </div>

              {/* Teslimat Seçeneği */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Teslimat Seçeneği *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {([
                    {
                      id: 'PLATFORM' as const,
                      label: 'Teslimat platform tarafından karşılanacak',
                      disabled: !platformDeliveryEnabled,
                    },
                    {
                      id: 'SELF' as const,
                      label: 'Teslimatı ben karşılayacağım',
                      disabled: false,
                    },
                  ] as const).map((opt) => {
                    const selected = formData.delivery_coverage === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, delivery_coverage: opt.id }));
                        }}
                        disabled={opt.disabled}
                        className={`relative p-3 rounded-xl border transition-all text-left bg-white/70 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                          selected
                            ? 'border-primary/40 ring-2 ring-primary/10 shadow-[0_12px_24px_rgba(10,106,64,0.14)]'
                            : opt.disabled
                              ? 'border-black/10 opacity-70 cursor-not-allowed'
                              : 'border-black/10 hover:border-primary/25 hover:shadow-sm'
                        }`}
                      >
                        {selected && (
                          <span className="absolute top-2 right-2 text-primary">
                            <CheckCircle className="w-4 h-4" />
                          </span>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-semibold leading-tight">
                            {opt.label}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!platformDeliveryEnabled && (
                  <div className="mt-2 text-xs text-amber-700">
                    Platform teslimat secenegi admin tarafinda gecici olarak kapatildi.
                  </div>
                )}
                <div className="mt-3 rounded-xl border border-black/10 bg-white/70 p-3 text-xs text-text-secondary">
                  {formData.delivery_coverage === 'PLATFORM'
                    ? 'Platform teslimatini secerseniz teslimat ucreti, minimum sepet, ucretsiz teslimat limiti ve teslimat suresi admin tarafinda mahalle bazli yonetilir.'
                    : 'Teslimati ben karsilayacagim seceneginde bu alanlari daha sonra Magazam ekranindan kendiniz yonetirsiniz.'}
                </div>
              </div>

              {/* Vergi Bilgileri */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Vergi Numarası *</label>
                  <input
                    type="text"
                    name="tax_number"
                    value={formData.tax_number}
                    onChange={handleChange}
                    className="seller-input"
                    placeholder="Vergi numaranızı girin"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Vergi Dairesi *</label>
                  <input
                    type="text"
                    name="tax_office"
                    value={formData.tax_office}
                    onChange={handleChange}
                    className="seller-input"
                    placeholder="Vergi dairenizi girin"
                    required
                  />
                </div>
              </div>

              {/* Adres - Uyarı ile birlikte */}
              <div className="rounded-xl border border-error/25 bg-error/5 p-3 mb-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-error text-sm">Adres Uyarısı</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Sadece <strong>vergi levhanızda yer alan adres</strong> kullanılabilir. 
                      Girdiğiniz adres, yüklediğiniz vergi levhası ile karşılaştırılarak admin tarafından doğrulanacaktır.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  İl / İlçe / Mahalle Seçimi *
                </label>
                <div className="seller-surface-solid p-4">
                  <TrAddressSelect
                    city={formData.address.province_name}
                    district={formData.address.district_name}
                    neighborhood={formData.address.neighborhood_name}
                    disabled={loading}
                    onChange={handleTrAddressChange}
                  />
                  <p className="mt-2 text-xs text-text-secondary">
                    Not: Bu seçim, Profil/Ayarlar ekranındaki adres seçimi ile aynıdır.
                  </p>
                </div>
              </div>

              {/* Seçilen Konum Özeti */}
              {formData.address.neighborhood_name && (
                <div className="rounded-xl border border-success/25 bg-success/5 p-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-success" />
                    <div>
                      <p className="font-semibold text-text-primary text-sm">Seçilen Konum</p>
                      <p className="text-xs text-text-secondary">
                        {formData.address.neighborhood_name}, {formData.address.district_name} / {formData.address.province_name}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Adres Uyarısı */}
              <div className="rounded-xl border border-error/25 bg-error/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-error mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-text-primary text-sm font-bold">ÖNEMLİ UYARI</p>
                    <p className="text-text-secondary text-sm mt-1">
                      Sadece <strong>vergi levhanızda yazılı olan adres</strong> kullanılabilir. 
                      Girdiğiniz adres, yüklediğiniz vergi levhasındaki adresle karşılaştırılacaktır.
                      Adreslerin eşleşmemesi durumunda başvurunuz reddedilecektir.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Açık Adres (Vergi Levhasındaki) *</label>
                <textarea
                  name="address.full_address"
                  value={formData.address.full_address}
                  onChange={handleChange}
                  rows={2}
                  className="seller-textarea"
                  placeholder="Sokak, Bina No, Daire No (Mahalle yukarıdan seçildi)"
                  required
                />
              </div>

            </div>
          )}

          {/* Step 3: Documents & Identity */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Kimlik Bilgileri & Belgeler</h3>
              
              <div className="rounded-xl border border-warning/25 bg-warning/10 p-3 mb-4">
                <p className="text-text-primary text-sm font-semibold">
                  Aşağıdaki bilgi ve belgelerin tamamı zorunludur. Eksik bilgi/belgeyle başvuru tamamlanamaz.
                </p>
              </div>

              {/* Kimlik Bilgileri */}
              <div className="seller-surface-muted p-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-primary" />
                  <h4 className="font-semibold text-text-primary">Kimlik Bilgileri</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">
                      TC Kimlik Numarası <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="tc_kimlik"
                      value={formData.tc_kimlik}
                      onChange={handleChange}
                      maxLength={11}
                      className="seller-input"
                      placeholder="11 haneli TC Kimlik No"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">
                      Doğum Tarihi <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="birth_date"
                      value={formData.birth_date}
                      onChange={handleChange}
                      className="seller-input"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Kimlik Fotoğrafları */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kimlik Ön Yüz */}
                <div className="rounded-xl border border-dashed border-black/15 bg-white/60 p-4 hover:border-primary/25 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-text-primary mb-1">
                        Kimlik Ön Yüz <span className="text-red-500">*</span>
                      </label>
                      <p className="text-xs text-text-secondary mb-2">
                        Kimliğinizin fotoğraflı ön yüzü
                      </p>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleIdPhotoFrontChange}
                        className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90"
                        required
                      />
                      {idPhotoFrontFile && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> {idPhotoFrontFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Kimlik Arka Yüz */}
                <div className="rounded-xl border border-dashed border-black/15 bg-white/60 p-4 hover:border-primary/25 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-text-primary mb-1">
                        Kimlik Arka Yüz <span className="text-red-500">*</span>
                      </label>
                      <p className="text-xs text-text-secondary mb-2">
                        Kimliğinizin arka yüzü
                      </p>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleIdPhotoBackChange}
                        className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90"
                        required
                      />
                      {idPhotoBackFile && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> {idPhotoBackFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Vergi Levhası */}
              <div className="rounded-xl border border-dashed border-black/15 bg-white/60 p-4 hover:border-primary/25 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-text-primary mb-1">
                      Vergi Levhası <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-text-secondary mb-2">
                      Güncel vergi levhanızı PDF, JPG veya PNG formatında yükleyin. 
                      Adres doğrulaması için bu belge kullanılacaktır.
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleTaxSheetChange}
                      className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:cursor-pointer hover:file:bg-primary-600"
                      required
                    />
                    {taxSheetFile && (
                      <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        {taxSheetFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* İkamet Belgesi */}
              <div className="rounded-xl border border-dashed border-black/15 bg-white/60 p-4 hover:border-primary/25 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Home className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-text-primary mb-1">
                      İkamet Belgesi <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-text-secondary mb-2">
                      E-Devlet üzerinden alınmış ikametgah belgesi veya nüfus müdürlüğünden alınmış belge. 
                      PDF, JPG veya PNG formatında yükleyin.
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleResidenceDocChange}
                      className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:cursor-pointer hover:file:bg-primary-600"
                      required
                    />
                    {residenceDocFile && (
                      <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        {residenceDocFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Özet */}
              <div className="seller-surface-muted p-4 mt-4">
                <h4 className="font-semibold text-text-primary mb-3">Başvuru Özeti</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-text-secondary">Mağaza:</span>
                    <span className="ml-2 font-medium">{formData.store_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">Yetkili:</span>
                    <span className="ml-2 font-medium">{formData.owner_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">Email:</span>
                    <span className="ml-2 font-medium">{formData.email || '-'}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">İşletme Türü:</span>
                    <span className="ml-2 font-medium">
                      {subTypeOptions.length > 0
                        ? `${BUSINESS_TYPES.find(t => t.id === formData.business_type)?.name || '-'} • ${subTypeOptions.find((s) => s.id === formData.business_subtype)?.name || '-'}`
                        : BUSINESS_TYPES.find(t => t.id === formData.business_type)?.name || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-secondary">Teslimat:</span>
                    <span className="ml-2 font-medium">
                      {formData.delivery_coverage === 'SELF'
                        ? 'Teslimatı ben karşılayacağım'
                        : 'Teslimat platform tarafından karşılanacak'}
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-black/10">
                  <span className="text-text-secondary text-sm">Adres:</span>
                  <p className="font-medium text-sm mt-1">
                    {formData.address.full_address},{' '}
                    {formData.address.district_name || formData.address.district}/{formData.address.province_name || formData.address.province}
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-black/10 flex gap-4">
                  <div className="flex items-center gap-1.5">
                    {taxSheetFile ? (
                      <CheckCircle className="w-4 h-4 text-success" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-error" />
                    )}
                    <span className="text-sm">Vergi Levhası</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {residenceDocFile ? (
                      <CheckCircle className="w-4 h-4 text-success" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-error" />
                    )}
                    <span className="text-sm">İkamet Belgesi</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-black/10 bg-white/80 p-4">
                <label className="inline-flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptLegalTerms}
                    onChange={(e) => setAcceptLegalTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-black/25"
                  />
                  <span className="text-sm text-text-secondary leading-6">
                    <a
                      href="/legal?section=kullanim-kosullari"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary font-semibold hover:underline"
                    >
                      Kullanim Kosullari
                    </a>{' '}
                    ve{' '}
                    <a
                      href="/legal?section=satici-sozlesmesi"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary font-semibold hover:underline"
                    >
                      Satici Sozlesmesini
                    </a>{' '}
                    okudum, kabul ediyorum.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6 gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="seller-btn-ghost flex-1"
              >
                Geri
              </button>
            )}
            <div className={step === 1 ? 'w-full' : 'flex-1'}>
              {step < 3 ? (
                <button
                  type="submit"
                  className="seller-btn-primary w-full"
                >
                  Devam
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || !taxSheetFile || !residenceDocFile || !acceptLegalTerms}
                  className="seller-btn-primary w-full"
                >
                  {loading ? 'Başvuru Gönderiliyor...' : 'Başvuruyu Tamamla'}
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Login Link */}
        <div className="mt-4 text-center">
          <p className="text-text-secondary text-sm">
            Zaten hesabınız var mı?{' '}
            <Link to="/login" className="text-primary hover:text-primary-600 font-semibold">
              Giriş Yap
            </Link>
          </p>
        </div>
    </AuthSplitLayout>
  );
};

export default Register;
