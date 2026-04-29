import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  LEGAL_SECTION_BY_ID,
  LEGAL_SECTIONS,
  type LegalSectionId,
} from '../data/legalContent.ts';

const DEFAULT_SECTION: LegalSectionId = 'kullanim-kosullari';

const isLegalSectionId = (value: string | null): value is LegalSectionId => {
  if (!value) return false;
  return value in LEGAL_SECTION_BY_ID;
};

const Legal: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialSection = isLegalSectionId(searchParams.get('section'))
    ? (searchParams.get('section') as LegalSectionId)
    : DEFAULT_SECTION;

  const [activeSection, setActiveSection] = useState<LegalSectionId>(initialSection);
  const selectedSection = useMemo(() => LEGAL_SECTION_BY_ID[activeSection], [activeSection]);

  return (
    <div className="min-h-screen seller-auth-bg py-6 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="seller-surface-solid p-4 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="seller-btn-ghost inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Geri
            </button>
            <h1 className="text-lg md:text-xl font-bold text-text-primary">Yasal Metinler</h1>
            <div className="w-16" />
          </div>

          <div className="rounded-xl border border-black/10 bg-white/70 p-4 mb-4">
            <p className="text-sm text-text-secondary">
              Asagidaki butonlardan ilgili metni secerek detaylari inceleyebilirsiniz.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {LEGAL_SECTIONS.map((section) => {
              const active = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-all ${
                    active
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-primary border-primary/30 hover:border-primary/50'
                  }`}
                >
                  {section.buttonLabel}
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-4 md:p-5">
            <h2 className="text-lg font-bold text-text-primary mb-3">{selectedSection.title}</h2>
            <div className="space-y-1">
              {selectedSection.content.map((line, index) => {
                if (!line.trim()) {
                  return <div key={`sp-${index}`} className="h-2" />;
                }

                const isHeading = /^\d+\./.test(line);
                const isBullet = line.startsWith('- ');

                return (
                  <p
                    key={`ln-${index}`}
                    className={`text-sm leading-6 ${
                      isHeading
                        ? 'font-semibold text-text-primary mt-1'
                        : isBullet
                          ? 'text-text-secondary pl-2'
                          : 'text-text-secondary'
                    }`}
                  >
                    {line}
                  </p>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Legal;
