import React, { useEffect, useMemo, useState } from 'react';
import { supportAPI } from '../services/api.ts';

type SupportSenderRole = 'CUSTOMER' | 'VENDOR' | 'ADMIN';

interface SupportMessage {
  id: string;
  senderRole: SupportSenderRole;
  body: string;
  createdAt: string;
}

const Messages: React.FC = () => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supportAPI.getMyConversation();
      const convo = res?.data?.data || res?.data;
      setConversationId(convo?.id || null);
      setMessages(Array.isArray(convo?.messages) ? convo.messages : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Mesajlar yüklenemedi');
      setConversationId(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const unreadCount = useMemo(() => 0, []);

  const handleSend = async () => {
    const body = replyText.trim();
    if (!body || !conversationId || sending) return;
    setSending(true);
    try {
      await supportAPI.postMyMessage(conversationId, body);
      setReplyText('');
      await refresh();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Mesaj gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="seller-page-title">Mesajlar</h1>
          <p className="seller-page-subtitle mt-1">Admin destek ekibiyle görüşmeler</p>
        </div>
        {unreadCount > 0 && (
          <span className="px-4 py-2 bg-error text-white rounded-full font-semibold">
            {unreadCount} Okunmamış
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-error/25 bg-error/5 p-4 text-error">
          {error}
        </div>
      )}

      {/* Conversation */}
      <div className="seller-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Destek Konuşması</h3>
          <button
            onClick={refresh}
            className="seller-btn-ghost"
          >
            Yenile
          </button>
        </div>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto seller-surface-muted p-4">
          {loading ? (
            <div className="text-text-secondary">Yükleniyor...</div>
          ) : messages.length === 0 ? (
            <div className="text-text-secondary">Henüz mesaj yok</div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.senderRole === 'ADMIN' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl p-3 text-sm border border-black/5 ${
                    m.senderRole === 'ADMIN'
                      ? 'bg-white text-text-primary'
                      : 'bg-primary text-white'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  <div className={`mt-1 text-[11px] ${m.senderRole === 'ADMIN' ? 'text-text-secondary' : 'text-white/80'}`}>
                    {new Date(m.createdAt).toLocaleString('tr-TR')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-text-primary mb-2">Mesaj Yaz</label>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={4}
            placeholder="Admin desteğe mesajınızı yazın..."
            className="seller-textarea"
          />
          <div className="flex justify-end mt-4">
            <button
              onClick={handleSend}
              disabled={!replyText.trim() || !conversationId || sending}
              className="seller-btn-primary px-5 py-2.5"
            >
              {sending ? 'Gönderiliyor...' : 'Mesaj Gönder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messages;
