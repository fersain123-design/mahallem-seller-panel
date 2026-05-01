import React from 'react';

type ConfirmActionModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  open,
  title = 'Ürünü silmek istiyor musun?',
  description = 'Bu işlem geri alınamaz.',
  confirmLabel = 'Sil',
  cancelLabel = 'Vazgeç',
  busy = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-xl border border-black/10 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-text-primary">{title}</h3>
        <p className="mt-2 text-sm text-text-secondary">{description}</p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className="seller-btn-outline px-4 py-2"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-error/90 disabled:opacity-60"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'İşleniyor...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmActionModal;
