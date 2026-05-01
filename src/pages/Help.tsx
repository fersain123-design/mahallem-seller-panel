import React, { useCallback, useState } from 'react';
import { supportAPI } from '../services/api.ts';
import { extractApiErrorMessage, showErrorToast, showSuccessToast } from '../lib/feedback.ts';

const PAYMENT_POLICY_MESSAGE =
  'Yeni ödeme sistemine geçiş sürecinde çekim talepleri en geç 14 gün içinde kayıtlı IBAN hesabınıza aktarılır. Durum adımları: Beklemede > İşleniyor > Ödendi.';

const paymentSupportSubject = encodeURIComponent('Ödeme Süreci Bilgilendirme Talebi');
const paymentSupportBody = encodeURIComponent(
  `Merhaba Mahallem Destek,\n\n${PAYMENT_POLICY_MESSAGE}\n\nMağaza Adı:\nTalep Detayı:\n\nTeşekkürler.`
);

const Help: React.FC = () => {
  const [supportTicket, setSupportTicket] = useState({ subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSupportTicket = useCallback(async () => {
    const subject = supportTicket.subject.trim();
    const message = supportTicket.message.trim();
    if (!subject || !message || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const convoRes = await supportAPI.getMyConversation();
      const conversationId = convoRes?.data?.data?.id;
      if (!conversationId) {
        showErrorToast('Yardim sohbeti baslatilamadi', 'Lutfen biraz sonra tekrar deneyin.');
        return;
      }

      const body = `Konu: ${subject}\n\n${message}`;
      await supportAPI.postMyMessage(conversationId, body);

      showSuccessToast('Mesajiniz iletildi', 'Destek ekibine gonderildi.');
      setSupportTicket({ subject: '', message: '' });
    } catch (e: any) {
      showErrorToast('Mesaj gonderilemedi', extractApiErrorMessage(e, 'Lutfen tekrar deneyin.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, supportTicket.message, supportTicket.subject]);

  const scrollToSupportForm = useCallback(() => {
    const el = document.getElementById('support-ticket');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="seller-page-title">Yardım Merkezi</h1>
        <p className="seller-page-subtitle mt-1">Size nasıl yardımcı olabiliriz?</p>
      </div>

      {/* Quick Contact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="seller-surface p-4">
          <div className="font-semibold mb-1 text-text-primary">Telefon Desteği</div>
          <div className="text-text-secondary text-sm mb-3">7/24 Canlı Destek</div>
          <a href="tel:+908501234567" className="text-sm font-medium text-primary underline">
            0850 123 45 67
          </a>
        </div>

        <div className="seller-surface p-4">
          <div className="font-semibold mb-1 text-text-primary">E-posta</div>
          <div className="text-text-secondary text-sm mb-3">Ödeme süreçleri için hazır şablon ile gönderim</div>
          <a
            href={`mailto:destek@mahallem.com?subject=${paymentSupportSubject}&body=${paymentSupportBody}`}
            className="text-sm text-primary font-medium underline"
          >
            destek@mahallem.com
          </a>
        </div>

        <div className="seller-surface p-4">
          <div className="font-semibold mb-1 text-text-primary">Yardım</div>
          <div className="text-text-secondary text-sm mb-3">Mesaj gönder</div>
          <button className="text-sm text-primary font-medium underline" onClick={scrollToSupportForm}>
            Mesaj Yaz
          </button>
        </div>
      </div>

      {/* Support Ticket */}
      <div id="support-ticket" className="bg-white rounded-xl border border-black/5 shadow-sm p-5">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Destek Talebi Oluştur</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Konu</label>
            <input
              type="text"
              value={supportTicket.subject}
              onChange={(e) => setSupportTicket({ ...supportTicket, subject: e.target.value })}
              placeholder="Sorun başlığını yazın"
              className="w-full px-4 py-2.5 bg-white border border-primary/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Mesaj</label>
            <textarea
              value={supportTicket.message}
              onChange={(e) => setSupportTicket({ ...supportTicket, message: e.target.value })}
              rows={5}
              placeholder="Sorununuzu detaylı anlatın..."
              className="w-full px-4 py-2.5 bg-white border border-primary/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSupportTicket}
              disabled={!supportTicket.subject || !supportTicket.message}
              className="px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all font-semibold"
            >
              {isSubmitting ? 'Gönderiliyor…' : 'Gönder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;
