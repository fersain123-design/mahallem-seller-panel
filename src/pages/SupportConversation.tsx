import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { vendorSupportAPI } from '../services/api.ts';
import { emitSidebarBadgesUpdated, markConversationSeen } from '../lib/sidebarBadgeState.ts';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error('REACT_APP_API_BASE_URL TANIMLI DEGIL! Render env ekle.');
}

type SupportMessage = {
  id: string;
  senderRole: 'CUSTOMER' | 'VENDOR';
  body: string;
  imageUrl?: string | null;
  createdAt: string;
  readAt?: string | null;
};

type SupportConversationDetail = {
  id: string;
  status?: string;
  orderId?: string | null;
  supportCategory?: string | null;
  escalatedToAdmin?: boolean;
  customer?: { id: string; name: string | null; email?: string | null };
  vendorProfile?: { id: string; shopName: string | null };
  messages: SupportMessage[];
};

const normalizeUrl = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${String(API_BASE_URL).replace(/\/+$/, '')}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

const SupportConversation: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const conversationId = useMemo(() => String(id || ''), [id]);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState<SupportConversationDetail | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isEscalating, setIsEscalating] = useState(false);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const refresh = async () => {
    if (!conversationId) return;
    setError('');
    try {
      const res = await vendorSupportAPI.getConversationById(conversationId);
      const convo = (res.data?.data || res.data) as SupportConversationDetail;
      setConversation(convo);
      await vendorSupportAPI.markRead(conversationId);
      markConversationSeen('support', conversationId, convo.messages);
      emitSidebarBadgesUpdated();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Destek görüşmesi yüklenemedi');
      setConversation(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [conversationId]);

  useEffect(() => {
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [conversationId]);

  useEffect(() => {
    if (conversation?.messages?.length) scrollToBottom();
  }, [conversation?.messages?.length]);

  const uploadImage = async () => {
    if (!selectedFile) return '';
    const formData = new FormData();
    formData.append('file', selectedFile);
    const response = await vendorSupportAPI.uploadImage(formData);
    return normalizeUrl(response.data?.data?.url || response.data?.url);
  };

  const onSend = async () => {
    if ((!text.trim() && !selectedFile) || !conversationId || sending) return;
    setSending(true);
    setError('');
    try {
      const imageUrl = await uploadImage();
      await vendorSupportAPI.postMessage(conversationId, { body: text.trim(), imageUrl });
      setText('');
      setSelectedFile(null);
      await refresh();
      scrollToBottom();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Mesaj gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  const escalateToAdmin = async () => {
    if (!conversationId || isEscalating) return;
    setIsEscalating(true);
    try {
      await vendorSupportAPI.escalateToAdmin(conversationId, 'Satıcı çözüm sağlayamadı, platform desteğine aktarıldı.');
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Admin desteğine aktarılamadı');
    } finally {
      setIsEscalating(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button className="seller-btn-ghost" onClick={() => navigate('/support-messages')}>
            ← Geri
          </button>
          <div>
            <h1 className="seller-page-title">{conversation?.customer?.name || 'Destek görüşmesi'}</h1>
            <p className="seller-page-subtitle mt-1">
              Sipariş: {conversation?.orderId ? conversation.orderId.slice(-6).toUpperCase() : '—'}
              {conversation?.escalatedToAdmin ? ' • Admine aktarıldı' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="seller-btn-ghost" onClick={refresh} disabled={loading}>Yenile</button>
          <button className="seller-btn-primary px-4 py-2" onClick={escalateToAdmin} disabled={!!conversation?.escalatedToAdmin || isEscalating}>
            {conversation?.escalatedToAdmin ? 'Platforma Aktarıldı' : isEscalating ? 'Aktarılıyor…' : 'Platform desteğine aktar'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-error/25 bg-error/5 p-4 text-error">{error}</div>}

      <div className="seller-surface p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 text-text-secondary">Yükleniyor…</div>
        ) : !conversation ? (
          <div className="p-6 text-text-secondary">Görüşme bulunamadı.</div>
        ) : (
          <>
            <div ref={bodyRef} className="p-4 max-h-[58vh] overflow-y-auto bg-white/40">
              <div className="space-y-3">
                {conversation.messages?.length ? (
                  conversation.messages.map((message) => {
                    const isMine = message.senderRole === 'VENDOR';
                    return (
                      <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[82%] rounded-xl px-4 py-3 text-sm border border-black/5 ${isMine ? 'bg-primary text-white' : 'bg-white text-text-primary'}`}>
                          {message.body ? <div className="whitespace-pre-wrap">{message.body}</div> : null}
                          {message.imageUrl ? <img src={normalizeUrl(message.imageUrl)} alt="Destek" className="mt-2 rounded-lg max-h-56 object-cover" /> : null}
                          <div className={`mt-2 text-[11px] ${isMine ? 'text-white/80' : 'text-text-secondary'}`}>
                            {new Date(message.createdAt).toLocaleString('tr-TR')}
                            {isMine && message.readAt ? ' • Görüldü' : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-text-secondary">Henüz mesaj yok.</div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-black/5 bg-white space-y-3">
              <label className="block text-sm font-medium text-text-primary">Mesaj Yaz</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="Müşteriye çözüm mesajınızı yazın…"
                className="seller-textarea"
                disabled={conversation.status === 'CLOSED'}
              />
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} disabled={conversation.status === 'CLOSED'} />
                <button
                  onClick={onSend}
                  disabled={conversation.status === 'CLOSED' || (!text.trim() && !selectedFile) || sending}
                  className="seller-btn-primary px-5 py-2.5"
                >
                  {sending ? 'Gönderiliyor…' : 'Gönder'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SupportConversation;