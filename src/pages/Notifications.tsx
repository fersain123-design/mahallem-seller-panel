import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, Info, RefreshCw } from 'lucide-react';
import { vendorAPI } from '../services/api.ts';

type VendorNotification = {
  id: string;
  title?: string;
  message?: string;
  isRead?: boolean;
  createdAt?: string;
};

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await vendorAPI.getNotifications({ limit: 100 });
      const list = response?.data?.data || response?.data || [];
      setNotifications(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || 'Bildirimler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  const markAsRead = async (notificationId: string) => {
    try {
      await vendorAPI.markNotificationAsRead(notificationId);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? { ...notification, isRead: true } : notification,
        ),
      );
    } catch {
      // Non-blocking on page interaction.
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="seller-page-title">Bildirimler</h1>
          <p className="seller-page-subtitle mt-1">Hesabınıza gelen tüm bildirimler burada listelenir.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            {unreadCount} yeni bildirim
          </div>
          <button
            type="button"
            onClick={() => void loadNotifications()}
            disabled={loading}
            className="seller-btn-ghost inline-flex items-center gap-2 px-4 py-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Yükleniyor...' : 'Yenile'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-error/25 bg-error/5 p-4 text-error">
          {error}
        </div>
      )}

      {loading && notifications.length === 0 ? (
        <div className="seller-surface p-5 text-sm text-text-secondary">Bildirimler yükleniyor...</div>
      ) : notifications.length === 0 ? (
        <div className="seller-surface p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bell className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-text-primary">Henüz bildirim yok</h2>
          <p className="mt-2 text-sm text-text-secondary">Yeni onaylar, belge notları ve sistem mesajları burada görünecek.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const unread = !notification.isRead;
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => {
                  if (unread) {
                    void markAsRead(notification.id);
                  }
                }}
                className={`seller-surface w-full p-5 text-left transition-colors hover:bg-background/80 ${
                  unread ? 'border border-primary/15 bg-primary/5' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${unread ? 'bg-white text-primary' : 'bg-background text-text-secondary'}`}>
                      {String(notification.title || '').includes('İhlal') ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : (
                        <Info className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-text-primary">{notification.title || 'Bildirim'}</p>
                        {unread && (
                          <span className="inline-flex rounded-full bg-error px-2 py-0.5 text-[11px] font-semibold text-white">
                            Yeni
                          </span>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
                        {notification.message || 'Mesaj bulunmuyor.'}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-text-secondary">
                    {notification.createdAt ? new Date(notification.createdAt).toLocaleString('tr-TR') : '-'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;