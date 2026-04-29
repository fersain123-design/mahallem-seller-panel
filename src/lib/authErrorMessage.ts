const normalizeText = (value: unknown) => String(value || '').trim();

const mapKnownMessage = (rawMessage: string) => {
  const msg = normalizeText(rawMessage);
  const lower = msg.toLowerCase();

  if (!msg) return '';

  if (lower.includes('network error') || lower.includes('timeout') || lower.includes('econnaborted')) {
    return 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
  }

  if (lower.includes('invalid credentials')) {
    return 'Giriş bilgileri hatalı. E-posta/telefon ve şifrenizi kontrol edin.';
  }

  if (lower.includes('askıya alınmıştır') || lower.includes('account suspended') || lower.includes('[suspended]')) {
    return 'Hesabınız kötüye kullandığınız için askıya alınmıştır size bir e-posta gönderdik.';
  }

  if (lower.includes('email already registered')) {
    return 'Bu e-posta ile zaten kayıtlı bir hesap var. Giriş yapabilir veya şifrenizi sıfırlayabilirsiniz.';
  }

  if (lower.includes('invalid phone number')) {
    return 'Telefon numarası geçersiz. Lütfen geçerli bir telefon numarası girin.';
  }

  if (lower.includes('password must be at least 6')) {
    return 'Şifre en az 6 karakter olmalıdır.';
  }

  if (lower.includes('passwords do not match')) {
    return 'Şifreler eşleşmiyor.';
  }

  if (lower.includes('google ile giriş yapın')) {
    return 'Bu hesap Google ile oluşturulmuş. Lütfen Google ile giriş yapın.';
  }

  if (lower.includes('telefon numarası birden fazla hesaba bağlı')) {
    return 'Bu telefon numarası birden fazla hesaba bağlı. Lütfen destek ile iletişime geçin.';
  }

  if (lower.includes('bu telefon numarası ile kayıtlı kullanıcı bulunamadı')) {
    return 'Bu telefon numarasıyla kayıtlı kullanıcı bulunamadı.';
  }

  if (lower.includes('çok fazla hatalı deneme')) {
    return 'Çok fazla hatalı deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.';
  }

  return msg;
};

const mapStatusFallback = (status: number | undefined, fallback: string) => {
  if (status === 401) return 'Giriş bilgileri hatalı. Lütfen bilgilerinizi kontrol edin.';
  if (status === 404) return 'Kayıt bulunamadı. Bilgilerinizi kontrol edip tekrar deneyin.';
  if (status === 409) return 'Bu bilgi başka bir hesapla çakışıyor. Lütfen farklı bilgi deneyin.';
  if (status === 423) return 'Çok fazla hatalı deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.';
  if (status === 429) return 'Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.';
  return fallback;
};

export const getAuthErrorMessage = (error: any, fallback = 'İşlem şu anda gerçekleştirilemiyor. Lütfen tekrar deneyin.') => {
  const status = error?.response?.status as number | undefined;
  const responseData = error?.response?.data;
  const validationErrors = responseData?.errors;

  if (Array.isArray(validationErrors) && validationErrors.length > 0) {
    return validationErrors
      .map((item: any) => mapKnownMessage(item?.message || item))
      .filter(Boolean)
      .join(', ');
  }

  const candidates = [
    responseData?.message,
    responseData?.detail,
    error?.message,
  ];

  for (const candidate of candidates) {
    const mapped = mapKnownMessage(candidate || '');
    if (mapped) return mapped;
  }

  return mapStatusFallback(status, fallback);
};
