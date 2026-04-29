import React from 'react';

export type ProductImageItem =
  | { id: string; kind: 'url'; url: string }
  | { id: string; kind: 'file'; file: File; previewUrl: string };

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const createId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

export const urlsToImageItems = (urls: string[] | undefined | null): ProductImageItem[] => {
  const list = Array.isArray(urls) ? urls : [];
  return list
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter((u) => u.length > 0)
    .map((url) => ({ id: createId(), kind: 'url' as const, url }));
};

interface ProductImagesFieldProps {
  items: ProductImageItem[];
  onChange: (next: ProductImageItem[]) => void;
  maxItems?: number;
  label?: string;
  helperText?: string;
}

const ProductImagesField: React.FC<ProductImagesFieldProps> = ({
  items,
  onChange,
  maxItems = 8,
  label = 'Ürün Fotoğrafları',
  helperText = 'PNG, JPG veya WEBP (maks. 5MB). Birden fazla fotoğraf ekleyebilirsiniz.',
}) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const itemsRef = React.useRef<ProductImageItem[]>(items);
  const [error, setError] = React.useState<string>('');
  const [urlDraft, setUrlDraft] = React.useState('');
  const [dragActive, setDragActive] = React.useState(false);

  const revokePreview = (item: ProductImageItem) => {
    if (item.kind === 'file') {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {
        // ignore
      }
    }
  };

  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  React.useEffect(() => {
    return () => {
      itemsRef.current.forEach(revokePreview);
    };
  }, []);

  const addFiles = (files: File[]) => {
    setError('');

    const remaining = Math.max(0, maxItems - items.length);
    if (remaining <= 0) {
      setError(`En fazla ${maxItems} fotoğraf ekleyebilirsiniz.`);
      return;
    }

    const next: ProductImageItem[] = [...items];

    for (const file of files.slice(0, remaining)) {
      if (!ACCEPTED_MIME.has(file.type)) {
        setError('Sadece PNG, JPG veya WEBP kabul edilir.');
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError('Dosya boyutu çok büyük (maks. 5MB).');
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      next.push({ id: createId(), kind: 'file', file, previewUrl });
    }

    onChange(next);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    addFiles(Array.from(fileList));
    e.target.value = '';
  };

  const removeById = (id: string) => {
    const item = items.find((x) => x.id === id);
    if (item) revokePreview(item);
    onChange(items.filter((x) => x.id !== id));
  };

  const makePrimary = (id: string) => {
    const idx = items.findIndex((x) => x.id === id);
    if (idx <= 0) return;
    const next = [...items];
    const [picked] = next.splice(idx, 1);
    next.unshift(picked);
    onChange(next);
  };

  const addUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    if (items.length >= maxItems) {
      setError(`En fazla ${maxItems} fotoğraf ekleyebilirsiniz.`);
      return;
    }

    onChange([...items, { id: createId(), kind: 'url', url }]);
    setUrlDraft('');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const fileList = e.dataTransfer.files;
    if (!fileList) return;
    addFiles(Array.from(fileList));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-text-primary">
          {label}
          <span className="text-text-secondary text-xs ml-2">({items.length}/{maxItems})</span>
        </label>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {items.map((item, index) => {
            const src = item.kind === 'file' ? item.previewUrl : item.url;
            return (
              <div key={item.id} className="relative group">
                <img
                  src={src}
                  alt={`Ürün görseli ${index + 1}`}
                  className="w-full h-24 object-contain bg-white p-1 rounded-lg border-2 border-primary/20"
                />

                <div className="absolute top-1 left-1 flex gap-1">
                  {index === 0 ? (
                    <span className="bg-primary text-white text-xs px-2 py-0.5 rounded">Ana</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => makePrimary(item.id)}
                      className="bg-white/90 hover:bg-white text-text-primary text-xs px-2 py-0.5 rounded border"
                    >
                      Ana yap
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeById(item.id)}
                  className="absolute top-1 right-1 bg-error text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Kaldır"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div
        className={`flex items-center justify-center w-full rounded-xl border-2 border-dashed transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-primary/30 bg-white'
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
        }}
        onDrop={onDrop}
      >
        <div className="w-full p-5 text-center">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-600 font-medium"
            disabled={items.length >= maxItems}
          >
            Fotoğraf Seç
          </button>
          <p className="mt-2 text-sm text-text-secondary">Sürükle-bırak da yapabilirsin.</p>
          <p className="text-xs text-text-secondary mt-1">{helperText}</p>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            onChange={onInputChange}
            className="hidden"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          placeholder="İstersen görsel URL ekle (opsiyonel)"
          className="flex-1 px-4 py-2 border border-gray-light rounded-lg focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          onClick={addUrl}
          className="px-4 py-2 border border-gray-light rounded-lg hover:bg-background text-text-primary"
          disabled={!urlDraft.trim() || items.length >= maxItems}
        >
          Ekle
        </button>
      </div>

      {error && <div className="text-sm text-error">{error}</div>}
    </div>
  );
};

export default ProductImagesField;
