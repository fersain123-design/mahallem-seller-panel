import React from 'react';
import { useNavigate } from 'react-router-dom';

type Props = {
  variant: 'login' | 'register';
  ctaScrollTargetId?: string;
  className?: string;
};

type Card = {
  icon: string;
  title: string;
  body: string;
  tags?: string;
};

const QUOTE_CARD: Card = {
  icon: '🏪',
  title: 'Burası bir platform değil,',
  body: 'Burası mahallenin kendi sistemi,\nkazanan tek kişi değil, mahallenin\nESNAFIDIR...',
  tags: 'Yerel esnafı güçlendiren satıcı deneyimi.',
};

const OnboardingPanel: React.FC<Props> = ({ variant, ctaScrollTargetId, className }) => {
  const navigate = useNavigate();

  const handleCta = () => {
    if (variant === 'login') {
      navigate('/register');
      return;
    }

    if (!ctaScrollTargetId) return;
    const el = document.getElementById(ctaScrollTargetId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={`seller-onboard-panel ${className || ''}`.trim()}>
      <div className="mb-5 flex items-center gap-4">
        <div className="seller-logo-box seller-logo-box-tight h-14 w-14">
          <img src="/logo.png" alt="MAHALLEM" className="seller-logo-img" />
        </div>
        <div className="min-w-0">
          <div className="text-xs tracking-[0.24em] text-text-secondary">MAHALLEM</div>
          <div className="text-lg font-semibold text-text-primary">Satıcı Başvurusu</div>
          <div className="text-sm text-text-secondary">3 adımda tamamlayın</div>
        </div>
      </div>

      <div className="grid gap-3">
        {variant === 'register' && (
          <div className="seller-surface-muted p-4 seller-fade-up" style={{ animationDelay: '40ms' }}>
            <div className="flex items-start gap-3">
              <div className="seller-onboard-icon" aria-hidden="true">
                <span>⚠️</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text-primary">Belgeler zorunlu</div>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                  Başvuru için <span className="font-semibold text-text-primary">vergi levhası</span> ve <span className="font-semibold text-text-primary">ikamet belgesi</span> yüklemelisiniz.
                </p>
                <div className="mt-2 text-xs text-text-secondary">Onay süreci 1–3 iş günü sürebilir.</div>
              </div>
            </div>
          </div>
        )}

        <div className="seller-onboard-card seller-fade-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-start gap-4">
            <div className="seller-onboard-icon" aria-hidden="true">
              <span className="seller-icon-breathe">{QUOTE_CARD.icon}</span>
            </div>
            <div className="min-w-0">
              <div className="text-xs tracking-[0.24em] text-text-secondary">MAHALLEM</div>
              <div className="mt-1 text-sm font-semibold text-text-primary">{QUOTE_CARD.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary whitespace-pre-line">{QUOTE_CARD.body}</p>
              {QUOTE_CARD.tags && <div className="mt-3 text-xs text-text-secondary/80">{QUOTE_CARD.tags}</div>}
            </div>
          </div>
        </div>
      </div>

      {variant === 'login' && (
        <button type="button" onClick={handleCta} className="seller-btn-outline mt-5 w-full">
          Satıcı başvurusu oluştur
        </button>
      )}
    </div>
  );
};

export default OnboardingPanel;
