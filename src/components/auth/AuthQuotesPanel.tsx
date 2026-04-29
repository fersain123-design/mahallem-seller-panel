import React, { useEffect, useMemo, useState } from 'react';

type QuoteBlock = {
  heading?: string;
  body: string;
};

type Props = {
  className?: string;
};

const QUOTES: QuoteBlock[] = [
  {
    body: '“Burası bir platform değil.\nMahallenin kendi sistemi.\nKazanan tek kişi değil,\nmahallenin esnafı.”',
  },
  {
    heading: 'Mahallende öndesin',
    body: '“Yakınındaki müşteriler\nseni önce görür.\nSipariş tanıdık sokaklardan gelir.”',
  },
  {
    body: '“Büyük–küçük ayrımı yok.\nHerkes eşit görünür.”',
  },
  {
    body: '“Kazanç dışarı gitmez.\nMahallede kalır,\nmahalleyi büyütür.”',
  },
  {
    heading: 'Bu iş güven işi',
    body: '“Tanımadığın yerden değil,\nbildiğin insandan.\nSamimi, gerçek, mahalle alışverişi.”',
  },
  {
    heading: 'Mahallende yerini al',
    body: '“Bugün katıl,\nyarın herkes seni tanısın.”',
  },
];

const AuthQuotesPanel: React.FC<Props> = ({ className }) => {
  // Show 2 quotes; rotate every 12 seconds.
  const quotes = useMemo(() => QUOTES, []);
  const [startIndex, setStartIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState<number | null>(null);

  const len = quotes.length;
  const currentPair = useMemo(
    () => [quotes[startIndex % len], quotes[(startIndex + 1) % len]],
    [quotes, startIndex, len]
  );

  const nextPair = useMemo(() => {
    if (nextIndex === null) return null;
    return [quotes[nextIndex % len], quotes[(nextIndex + 1) % len]];
  }, [quotes, nextIndex, len]);

  useEffect(() => {
    if (len < 3) return;

    const t = setInterval(() => {
      setNextIndex((prev) => {
        if (prev !== null) return prev; // already animating
        return (startIndex + 1) % len;
      });
    }, 12000);

    return () => clearInterval(t);
  }, [len, startIndex]);

  useEffect(() => {
    if (nextIndex === null) return;

    const timeout = setTimeout(() => {
      setStartIndex(nextIndex);
      setNextIndex(null);
    }, 520);

    return () => clearTimeout(timeout);
  }, [nextIndex]);

  const renderPair = (pair: QuoteBlock[]) => (
    <div className="seller-quote-pair">
      {pair.map((q, idx) => (
        <div key={idx} className="seller-onboard-card">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold tracking-wide text-primary">{q.heading || 'Mahallem'}</div>
                <p className="mt-2 text-[15px] leading-relaxed text-text-primary/90 whitespace-pre-line">{q.body}</p>
              </div>
              <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-white/70 text-lg">
                “
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={`seller-onboard-panel ${className || ''}`.trim()}>
      <div className="flex items-center gap-4">
        <div className="seller-logo-box seller-logo-box-tight h-14 w-14 -translate-x-px">
          <img src="/logo.png" alt="MAHALLEM" className="seller-logo-img" />
        </div>
        <div className="min-w-0">
          <div className="text-xs tracking-[0.24em] text-text-secondary">SATICI PANELİ</div>
          <div className="text-3xl font-extrabold tracking-tight text-primary leading-tight">Mahallem</div>
          <div className="mt-1 text-sm text-text-secondary">Mahallende satışa başla. Yakınındaki müşteri seni önce görür.</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full border border-black/5 bg-white/70 px-3 py-1 text-xs text-text-secondary">
          Yerel
        </span>
        <span className="inline-flex items-center rounded-full border border-black/5 bg-white/70 px-3 py-1 text-xs text-text-secondary">
          Güven
        </span>
        <span className="inline-flex items-center rounded-full border border-black/5 bg-white/70 px-3 py-1 text-xs text-text-secondary">
          Eşit görünürlük
        </span>
      </div>

      <div className="mt-6 seller-quote-viewport" aria-label="Sözler">
        <div className={nextIndex !== null ? 'seller-quote-slide seller-quote-slide-out-right' : 'seller-quote-slide'}>
          {renderPair(currentPair)}
        </div>

        {nextPair && (
          <div className="seller-quote-slide seller-quote-slide-in-from-left" aria-hidden="true">
            {renderPair(nextPair)}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthQuotesPanel;
