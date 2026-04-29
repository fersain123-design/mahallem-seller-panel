import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { vendorSupportAPI } from '../services/api.ts';

type SupportInboxConversation = {
  id: string;
  updatedAt: string;
  orderId?: string | null;
  supportCategory?: string | null;
  escalatedToAdmin?: boolean;
  customer?: { id: string; name: string | null; email?: string | null };
  messages?: Array<{ id: string; body: string; imageUrl?: string | null; createdAt: string }>;
};

const SupportInbox: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<SupportInboxConversation[]>([]);

  const refresh = async () => {
    setError('');
    try {
      const res = await vendorSupportAPI.listConversations();
      const list = (res.data?.data || res.data || []) as SupportInboxConversation[];
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Destek mesajları yüklenemedi');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, []);

  const count = useMemo(() => items.length, [items.length]);

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="seller-page-title">Destek Mesajları</h1>
          <p className="seller-page-subtitle mt-1">Sipariş kaynaklı müşteri destek görüşmeleri</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">{count} aktif destek</span>
          <button onClick={refresh} className="seller-btn-ghost" disabled={loading}>
            Yenile
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-error/25 bg-error/5 p-4 text-error">{error}</div>}

      <div className="seller-surface p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 text-text-secondary">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-text-secondary">Henüz destek görüşmesi yok.</div>
        ) : (
          <div className="divide-y divide-black/5">
            {items.map((item) => {
              const last = Array.isArray(item.messages) && item.messages.length ? item.messages[0] : null;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/support-messages/${item.id}`)}
                  className="w-full text-left p-4 hover:bg-white/70 transition flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-text-primary truncate">
                      {item.customer?.name || 'Müşteri'}
                    </div>
                    <div className="text-xs text-text-secondary mt-1">
                      Sipariş: {item.orderId ? item.orderId.slice(-6).toUpperCase() : '—'}
                      {item.escalatedToAdmin ? ' • Admine aktarıldı' : ''}
                    </div>
                    <div className="text-sm text-text-secondary mt-2 truncate">
                      {last?.body || (last?.imageUrl ? 'Görsel gönderildi' : 'Mesaj yok')}
                    </div>
                  </div>

                  <div className="text-xs text-text-secondary whitespace-nowrap">
                    {new Date(item.updatedAt).toLocaleString('tr-TR')}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportInbox;