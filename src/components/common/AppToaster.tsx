import React, { useEffect, useState } from 'react';
import { APP_TOAST_EVENT_NAME } from '../../lib/feedback.ts';

type ToastKind = 'success' | 'error' | 'info';

type ToastItem = {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  durationMs: number;
};

type ToastEventDetail = {
  kind: ToastKind;
  title: string;
  message?: string;
  durationMs?: number;
};

const paletteByKind: Record<ToastKind, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
};

const AppToaster: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const customEvent = event as CustomEvent<ToastEventDetail>;
      const detail = customEvent.detail;
      if (!detail?.title) return;

      const next: ToastItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: detail.kind || 'info',
        title: detail.title,
        message: detail.message,
        durationMs: Number(detail.durationMs) > 0 ? Number(detail.durationMs) : 3800,
      };

      setToasts((current) => [...current.slice(-2), next]);
    };

    window.addEventListener(APP_TOAST_EVENT_NAME, onToast as EventListener);
    return () => window.removeEventListener(APP_TOAST_EVENT_NAME, onToast as EventListener);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, toast.durationMs)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${paletteByKind[toast.kind]}`}
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.message ? <p className="mt-1 text-sm opacity-90">{toast.message}</p> : null}
        </div>
      ))}
    </div>
  );
};

export default AppToaster;
