type ToastKind = 'success' | 'error' | 'info';

type AppToastDetail = {
  kind: ToastKind;
  title: string;
  message?: string;
  durationMs?: number;
};

const TOAST_EVENT_NAME = 'seller-app-toast';

const LOCALHOST_PATTERN = /(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?\/?[^\s]*/gi;
const PRIVATE_IP_PATTERN = /(https?:\/\/)?(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?\/?[^\s]*/gi;
const HTTP_STATUS_PATTERN = /(?:http\s*)?status\s*[:=-]?\s*\d{3}/gi;
const RAW_CODE_PATTERN = /\b(?:HTTP\s*)?\d{3}\b/gi;

export const sanitizeUserMessage = (raw: unknown, fallback: string) => {
  const source = String(raw || '').trim();
  if (!source) return fallback;

  const withoutUrls = source
    .replace(LOCALHOST_PATTERN, '')
    .replace(PRIVATE_IP_PATTERN, '')
    .replace(HTTP_STATUS_PATTERN, '')
    .replace(RAW_CODE_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const normalized = withoutUrls.toLocaleLowerCase('tr-TR');
  if (!withoutUrls) return fallback;

  if (normalized.includes('network error') || normalized.includes('failed to fetch')) {
    return 'Sunucuya baglanilamadi. Lutfen tekrar deneyin.';
  }

  if (normalized.includes('request failed')) {
    return fallback;
  }

  return withoutUrls;
};

export const extractApiErrorMessage = (error: any, fallback: string) => {
  const primary =
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    error?.message ||
    '';
  return sanitizeUserMessage(primary, fallback);
};

export const pushToast = (detail: AppToastDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT_NAME, { detail }));
};

export const showSuccessToast = (title: string, message?: string) => {
  pushToast({ kind: 'success', title, message });
};

export const showErrorToast = (title: string, message?: string) => {
  pushToast({ kind: 'error', title, message });
};

export const showInfoToast = (title: string, message?: string) => {
  pushToast({ kind: 'info', title, message });
};

export const APP_TOAST_EVENT_NAME = TOAST_EVENT_NAME;
