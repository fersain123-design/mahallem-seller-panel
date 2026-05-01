import React, { useMemo, useState, useEffect } from 'react';
import { productsAPI } from '../services/api.ts';
import { Product } from '../types/index.ts';
import ProductImagesField, { ProductImageItem, urlsToImageItems } from '../components/products/ProductImagesField.tsx';
import ConfirmActionModal from '../components/common/ConfirmActionModal.tsx';
import { extractApiErrorMessage, showErrorToast, showSuccessToast } from '../lib/feedback.ts';

const SPECIAL_CATEGORY_NAME = 'Özel Ürünler';
const LOW_STOCK_LEVEL = 5;
const MIN_DESCRIPTION_LENGTH = 10;
const UNIT_TYPE_PRESETS = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli'];
const FEATURES_TITLE = 'Ozellikler:';

const normalizeTrText = (value: string) =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');

const splitDescriptionAndFeatures = (rawValue?: string) => {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    return { description: '', features: [] as string[] };
  }

  const lines = raw.split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => String(line || '').trim().toLocaleLowerCase('tr-TR') === FEATURES_TITLE.toLocaleLowerCase('tr-TR'));

  if (markerIndex === -1) {
    return { description: raw, features: [] as string[] };
  }

  const description = lines.slice(0, markerIndex).join('\n').trim();
  const features = lines
    .slice(markerIndex + 1)
    .map((line) => String(line || '').replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);

  return { description, features };
};

const composeDescriptionWithFeatures = (descriptionValue: string, featureRows: string[]) => {
  const description = String(descriptionValue || '').trim();
  const features = Array.from(new Set(featureRows.map((line) => String(line || '').trim()).filter(Boolean)));

  if (features.length === 0) return description;

  const featureLines = features.map((line) => `- ${line}`).join('\n');
  return `${description}\n\n${FEATURES_TITLE}\n${featureLines}`.trim();
};

type FormErrors = {
  name?: string;
  price?: string;
  unitAmount?: string;
  unit?: string;
  stock?: string;
  description?: string;
  images?: string;
};

const ProductsAdvanced: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formNotice, setFormNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: SPECIAL_CATEGORY_NAME,
    price: '',
    unitAmount: '1',
    unit: 'adet',
    stock: '0',
    status: 'inactive',
    description: '',
  });

  const [images, setImages] = useState<ProductImageItem[]>([]);
  const [featureRows, setFeatureRows] = useState<string[]>(['']);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<Product | null>(null);

  const getApprovalStatus = (product: Product) => {
    const normalized = String(product.approval_status || '').toUpperCase();
    if (normalized === 'APPROVED' || normalized === 'REJECTED' || normalized === 'PENDING') {
      return normalized;
    }
    return product.status === 'active' ? 'APPROVED' : 'PENDING';
  };

  const fetchProducts = async (options?: { background?: boolean }) => {
    const useBackgroundRefresh = Boolean(options?.background) && products.length > 0;
    try {
      if (useBackgroundRefresh) {
        setListRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await productsAPI.getAll();
      const productsData = response.data.data?.products || [];
      const normalizedSpecialCategory = normalizeTrText(SPECIAL_CATEGORY_NAME);
      const specialProducts = Array.isArray(productsData)
        ? productsData.filter(
            (product) => {
              const categoryName = normalizeTrText(String(product?.category || ''));
              const approvalStatus = String(product?.approval_status || '').toUpperCase();
              return categoryName === normalizedSpecialCategory || approvalStatus === 'PENDING';
            }
          )
        : [];
      setProducts(specialProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
      setFormNotice({ type: 'error', text: 'Ürünler yüklenirken bir hata oluştu.' });
    } finally {
      if (useBackgroundRefresh) {
        setListRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const approvalStatus = getApprovalStatus(product);
      if (statusFilter !== 'all' && approvalStatus.toLowerCase() !== statusFilter) return false;
      if (!q) return true;
      return (
        String(product.name || '').toLowerCase().includes(q) ||
        String(product.category || '').toLowerCase().includes(q)
      );
    });
  }, [products, query, statusFilter]);

  const unitTypeOptions = useMemo(() => {
    const currentUnit = String(formData.unit || '').trim().toLocaleLowerCase('tr-TR');
    if (!currentUnit || UNIT_TYPE_PRESETS.includes(currentUnit)) {
      return UNIT_TYPE_PRESETS;
    }
    return [...UNIT_TYPE_PRESETS, currentUnit];
  }, [formData.unit]);

  const stats = useMemo(() => {
    const active = products.filter((p) => p.status === 'active').length;
    const inactive = products.filter((p) => p.status !== 'active').length;
    const pending = products.filter((p) => getApprovalStatus(p) === 'PENDING').length;
    const approved = products.filter((p) => getApprovalStatus(p) === 'APPROVED').length;
    const rejected = products.filter((p) => getApprovalStatus(p) === 'REJECTED').length;
    const lowStock = products.filter((p) => Number(p.stock || 0) <= LOW_STOCK_LEVEL).length;
    return {
      total: products.length,
      active,
      inactive,
      pending,
      approved,
      rejected,
      lowStock,
    };
  }, [products]);

  const resetForm = () => {
    setFormData({
      name: '',
      category: SPECIAL_CATEGORY_NAME,
      price: '',
      unitAmount: '1',
      unit: 'adet',
      stock: '0',
      status: 'inactive',
      description: '',
    });
    setImages([]);
    setFeatureRows(['']);
    setEditingProduct(null);
    setFormErrors({});
  };

  const beginCreate = () => {
    resetForm();
    setFormData((prev) => ({
      ...prev,
      unitAmount: String(prev.unitAmount || '1').trim() || '1',
      unit: String(prev.unit || 'adet').trim() || 'adet',
      stock: String(prev.stock || '0').trim() || '0',
    }));
    setFormNotice(null);
    setShowModal(true);
  };

  const beginEdit = (product: Product) => {
    const rawUnit = String(product.unit || '').trim();
    const unitMatch = rawUnit.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
    const parsedUnitAmount = unitMatch?.[1] || '1';
    const parsedUnitName = (unitMatch?.[2] || rawUnit || 'adet').trim();
    const parsedDescription = splitDescriptionAndFeatures(product.description || '');

    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      category: product.category || SPECIAL_CATEGORY_NAME,
      price: String(product.price ?? ''),
      unitAmount: parsedUnitAmount,
      unit: parsedUnitName,
      stock: String(product.stock ?? ''),
      status: product.status || 'inactive',
      description: parsedDescription.description,
    });
    setFeatureRows([...parsedDescription.features, '']);
    setImages(urlsToImageItems(product.images || []));
    setFormErrors({});
    setFormNotice(null);
    setShowModal(true);
  };

  const updateFeatureRow = (index: number, value: string) => {
    setFeatureRows((prev) => {
      const next = [...prev];
      next[index] = value;

      const compact = next.filter((row, idx) => String(row || '').trim().length > 0 || idx === next.length - 1);
      const lastFilled = String(compact[compact.length - 1] || '').trim().length > 0;
      if (lastFilled) compact.push('');

      return compact.length > 0 ? compact : [''];
    });
  };

  const removeFeatureRow = (index: number) => {
    setFeatureRows((prev) => {
      if (prev.length <= 1) return [''];
      const next = prev.filter((_, idx) => idx !== index);
      if (next.length === 0) return [''];
      const lastFilled = String(next[next.length - 1] || '').trim().length > 0;
      if (lastFilled) next.push('');
      return next;
    });
  };

  const handleDelete = async (product: Product) => {
    if (!product?.id) return;
    setPendingDeleteProduct(product);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteProduct?.id) return;

    try {
      await productsAPI.delete(pendingDeleteProduct.id);
      setFormNotice({ type: 'success', text: 'Ürün başarıyla silindi.' });
      showSuccessToast('Urun silindi');
      await fetchProducts();
    } catch (err: any) {
      const message = extractApiErrorMessage(err, 'Silme islemi basarisiz');
      setFormNotice({ type: 'error', text: message });
      showErrorToast('Urun silinemedi', message);
    } finally {
      setPendingDeleteProduct(null);
    }
  };

  const validateForm = () => {
    const errors: FormErrors = {};
    const name = formData.name.trim();
    const unitAmountValue = Number(String(formData.unitAmount).replace(',', '.'));
    const unit = formData.unit.trim();
    const description = formData.description.trim();
    const priceValue = Number(String(formData.price).replace(',', '.'));
    const stockValue = Number(String(formData.stock).replace(',', '.'));
    const normalizedName = name.toLocaleLowerCase('tr-TR');
    const duplicateName = products.some((product) => {
      if (editingProduct && product.id === editingProduct.id) return false;
      return String(product.name || '').trim().toLocaleLowerCase('tr-TR') === normalizedName;
    });

    if (!name || name.length < 3) errors.name = 'Ürün adı en az 3 karakter olmalı.';
    else if (duplicateName) errors.name = 'Bu isimde ürün zaten var. Lütfen farklı bir ürün adı girin.';
    if (!Number.isFinite(priceValue) || priceValue <= 0) errors.price = 'Fiyat 0’dan büyük olmalı.';
    if (!Number.isFinite(unitAmountValue) || unitAmountValue <= 0) errors.unitAmount = 'Birim sayısı 0’dan büyük olmalı.';
    if (!unit || unit.length < 2) errors.unit = 'Birim alanı zorunludur.';
    if (!Number.isFinite(stockValue) || stockValue < 0) errors.stock = 'Stok 0 veya daha büyük olmalı.';
    if (!description || description.length < MIN_DESCRIPTION_LENGTH) {
      errors.description = `Açıklama en az ${MIN_DESCRIPTION_LENGTH} karakter olmalı.`;
    }
    if (images.length === 0) errors.images = 'En az 1 ürün görseli yükleyin.';

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    try {
      const errors = validateForm();
      setFormErrors(errors);
      setFormNotice(null);

      if (Object.keys(errors).length > 0) {
        setFormNotice({ type: 'error', text: 'Lütfen zorunlu alanları doğru şekilde doldurun.' });
        return;
      }

      setSaving(true);

      const parseNumberInput = (value: string, fallback: number) => {
        const raw = String(value ?? '').trim();
        if (!raw) return fallback;
        const normalized = raw.replace(',', '.');
        const num = Number(normalized);
        return Number.isFinite(num) ? num : fallback;
      };

      const priceValue = parseNumberInput(formData.price, NaN);
      const unitAmountValue = parseNumberInput(formData.unitAmount, NaN);
      const stockValue = parseNumberInput(formData.stock, NaN);

      const uploadedImageUrls: string[] = [];
      for (const item of images) {
        if (item.kind === 'url') {
          uploadedImageUrls.push(item.url);
        } else {
          const url = await productsAPI.uploadImageUrl(item.file);
          uploadedImageUrls.push(url);
        }
      }

      const payload = {
        name: formData.name,
        category: SPECIAL_CATEGORY_NAME,
        price: priceValue,
        unit: `${unitAmountValue} ${formData.unit}`.trim(),
        stock: Math.trunc(stockValue),
        status: editingProduct ? formData.status : 'inactive',
        description: composeDescriptionWithFeatures(formData.description, featureRows),
        images: uploadedImageUrls,
        submissionSource: 'ADVANCED',
      };

      if (editingProduct) {
        const response = await productsAPI.update(editingProduct.id, payload);
        const updatedProduct = response?.data?.data as Product | undefined;
        if (updatedProduct?.id) {
          setProducts((prev) => prev.map((item) => (item.id === updatedProduct.id ? updatedProduct : item)));
        }
        setFormNotice({ type: 'success', text: 'Ürün başarıyla güncellendi.' });
      } else {
        const response = await productsAPI.create(payload);
        const createdProduct = response?.data?.data as Product | undefined;
        if (createdProduct?.id) {
          setProducts((prev) => [createdProduct, ...prev.filter((item) => item.id !== createdProduct.id)]);
        }
        setFormNotice({ type: 'success', text: 'Ürün kaydedildi ve admin onayına gönderildi.' });
      }

      setShowModal(false);
      resetForm();
      void fetchProducts({ background: true });
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.response?.data?.message || 'İşlem başarısız oldu';
      const normalized = String(message || '').toLocaleLowerCase('tr-TR');
      if (
        normalized.includes('zaten var') ||
        normalized.includes('already exists') ||
        normalized.includes('unique') ||
        normalized.includes('p2002')
      ) {
        setFormErrors((prev) => ({ ...prev, name: 'Bu isimde ürün zaten var. Lütfen farklı bir ürün adı girin.' }));
      }
      setFormNotice({
        type: 'error',
        text: message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      {formNotice && (
        <div className={`seller-surface p-3 text-sm ${formNotice.type === 'success' ? 'text-success' : 'text-error'}`}>
          {formNotice.text}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="seller-page-title">Özel Ürünler Yönetimi</h1>
          <p className="seller-page-subtitle mt-1">Profesyonel ürün kartları, filtreleme ve hızlı düzenleme</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchProducts({ background: true })}
            disabled={listRefreshing || loading || saving}
            className="seller-btn-outline px-4 py-2 disabled:opacity-60"
          >
            Yenile
          </button>
          <button
            onClick={beginCreate}
            className="px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-600 transition-all font-semibold"
          >
            Yeni Ürün
          </button>
        </div>
      </div>

      {listRefreshing && products.length > 0 && (
        <div className="seller-surface p-3 text-sm text-text-secondary flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          Ürünler güncelleniyor...
        </div>
      )}

      <div className="seller-surface-muted p-4">
        <p className="text-sm text-text-primary">Bu alan mağazanıza özel hazırlanmış ürünler içindir.</p>
        <p className="text-sm text-text-primary mt-1">Standart ürünler yerine farklı veya geliştirilmiş ürünler ekleyebilirsiniz.</p>
        <p className="text-sm text-text-secondary mt-2">Örnek: Çilek buketi, özel meyve paketi, hediye sepeti gibi ürünler.</p>
        <p className="text-sm text-text-primary mt-2">Eklenen ürünler yönetici onayından sonra müşterilere gösterilir.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary mb-1">Toplam Ürün</p>
          <p className="text-xl font-bold text-text-primary">{stats.total}</p>
        </div>
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary mb-1">Onay Bekleyen</p>
          <p className="text-xl font-bold text-warning">{stats.pending}</p>
        </div>
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary mb-1">Onaylı</p>
          <p className="text-xl font-bold text-success">{stats.approved}</p>
        </div>
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary mb-1">Reddedildi</p>
          <p className="text-xl font-bold text-error">{stats.rejected}</p>
        </div>
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary mb-1">Aktif</p>
          <p className="text-xl font-bold text-success">{stats.active}</p>
        </div>
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary mb-1">Pasif</p>
          <p className="text-xl font-bold text-text-primary">{stats.inactive}</p>
        </div>
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary mb-1">Düşük Stok</p>
          <p className="text-xl font-bold text-error">{stats.lowStock}</p>
        </div>
      </div>

      <div className="seller-surface p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="seller-input"
            placeholder="Ürün adı veya kategori ara"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'approved' | 'rejected')}
            className="seller-input"
          >
            <option value="all">Tüm Moderasyon Durumları</option>
            <option value="pending">Onay Bekleyen</option>
            <option value="approved">Onaylı</option>
            <option value="rejected">Reddedildi</option>
          </select>
          <div className="seller-surface-muted px-3 py-2.5 text-sm text-text-secondary flex items-center">
            {filteredProducts.length} ürün listeleniyor
          </div>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="seller-surface p-10 text-center text-text-secondary">
          Ürün bulunamadı.
        </div>
      ) : (
        <div className="relative">
          {listRefreshing && products.length > 0 && (
            <div className="absolute inset-0 bg-white/50 z-10 pointer-events-none flex items-center justify-center rounded-xl">
              <div className="inline-flex items-center gap-2 text-sm text-text-secondary bg-white/90 px-3 py-2 rounded-lg border border-black/10">
                <span className="inline-block h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                Güncelleniyor...
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => {
            const isLowStock = Number(product.stock || 0) <= LOW_STOCK_LEVEL;
            const isOutOfStock = Number(product.stock || 0) <= 0;
            const approvalStatus = getApprovalStatus(product);
            return (
              <div key={product.id} className="seller-surface p-0 overflow-hidden">
                <div className="relative h-44 bg-white">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt="" className="w-full h-full object-contain p-3" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-text-secondary">Görsel Yok</div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-2">
                    <span className={`px-2 py-1 text-[11px] rounded-full font-semibold ${product.status === 'active' ? 'bg-success/10 text-success' : 'bg-gray-100 text-text-secondary'}`}>
                      {product.status === 'active' ? 'Aktif' : 'Pasif'}
                    </span>
                    <span className={`px-2 py-1 text-[11px] rounded-full font-semibold ${approvalStatus === 'APPROVED' ? 'bg-success/10 text-success' : approvalStatus === 'REJECTED' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'}`}>
                      {approvalStatus === 'APPROVED' ? 'Onaylı' : approvalStatus === 'REJECTED' ? 'Reddedildi' : 'Onay Bekliyor'}
                    </span>
                    {isLowStock && (
                      <span className="px-2 py-1 text-[11px] rounded-full font-semibold bg-error/10 text-error">
                        Düşük Stok
                      </span>
                    )}
                    {isOutOfStock && (
                      <span className="px-2 py-1 text-[11px] rounded-full font-semibold bg-error/15 text-error">
                        Stok Bitti
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-text-primary text-base truncate">{product.name}</h3>
                  <p className="text-xs text-text-secondary mt-1 truncate">{product.category || 'Kategori Yok'}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">₺{Number(product.price || 0).toFixed(2)}</span>
                    <span className={`text-sm font-medium ${isOutOfStock || isLowStock ? 'text-error' : 'text-text-secondary'}`}>
                      Stok: {product.stock}
                    </span>
                  </div>

                  {approvalStatus === 'REJECTED' && product.rejection_reason && (
                    <div className="mt-2 rounded-md bg-error/5 border border-error/20 px-2 py-1.5 text-xs text-error">
                      Red nedeni: {product.rejection_reason}
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => beginEdit(product)}
                      className="flex-1 px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 text-sm font-medium"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      className="px-3 py-2 bg-error/10 text-error rounded-lg hover:bg-error/20 text-sm font-medium"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-black/10 shadow-sm">
            <div className="sticky top-0 bg-white border-b p-5 z-10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary">
                {editingProduct ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-text-secondary hover:text-text-primary text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {formNotice && (
                <div className={`seller-surface-muted p-3 text-sm ${formNotice.type === 'success' ? 'text-success' : 'text-error'}`}>
                  {formNotice.text}
                </div>
              )}

              <div className="seller-surface-muted p-3 text-sm text-text-secondary">
                Yeni özel ürünler admin onayı tamamlanana kadar pasif olarak kaydedilir.
              </div>

              <div className="seller-surface p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="text-text-secondary">Kategori: <span className="text-text-primary font-medium">{SPECIAL_CATEGORY_NAME}</span></div>
                <div className="text-text-secondary">Görsel Kuralı: <span className="text-text-primary font-medium">En az 1 görsel</span></div>
                <div className="text-text-secondary">Açıklama Kuralı: <span className="text-text-primary font-medium">Min {MIN_DESCRIPTION_LENGTH} karakter</span></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Ürün Adı *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="seller-input"
                  />
                  {formErrors.name && <p className="text-error text-xs mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Kategori *</label>
                  <input
                    type="text"
                    value={formData.category}
                    readOnly
                    className="seller-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Fiyat (₺) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="seller-input"
                  />
                  {formErrors.price && <p className="text-error text-xs mt-1">{formErrors.price}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Birim Sayısı *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitAmount}
                    onChange={(e) => setFormData({ ...formData, unitAmount: e.target.value })}
                    className="seller-input"
                    placeholder="1"
                  />
                  {formErrors.unitAmount && <p className="text-error text-xs mt-1">{formErrors.unitAmount}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Birim Türü *</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="seller-input"
                  >
                    <option value="">Birim seçin</option>
                    {unitTypeOptions.map((unitType) => (
                      <option key={unitType} value={unitType}>{unitType}</option>
                    ))}
                  </select>
                  {formErrors.unit && <p className="text-error text-xs mt-1">{formErrors.unit}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Stok Sayısı *</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="seller-input"
                    placeholder="0"
                  />
                  {formErrors.stock && <p className="text-error text-xs mt-1">{formErrors.stock}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Durum</label>
                  <input
                    type="text"
                    value={editingProduct ? (formData.status === 'active' ? 'Aktif' : 'Pasif') : 'Admin Onayı Bekliyor'}
                    readOnly
                    className="seller-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Açıklama</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="seller-textarea"
                  placeholder="Ürün açıklaması"
                />
                {formErrors.description && <p className="text-error text-xs mt-1">{formErrors.description}</p>}

                <div className="mt-3 space-y-2">
                  {featureRows.map((row, idx) => (
                    <div key={`feature-row-${idx}`} className="flex items-center gap-2">
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden="true" />
                      <input
                        type="text"
                        value={row}
                        onChange={(e) => updateFeatureRow(idx, e.target.value)}
                        className="seller-input flex-1"
                        placeholder="Ornek: Dogal, taze, gunluk hazirlanir"
                      />
                      {featureRows.length > 1 && String(row || '').trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => removeFeatureRow(idx)}
                          className="seller-btn-outline px-2 py-1 text-xs"
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-text-secondary mt-2">Ozellikleri aciklama altinda madde madde girin.</p>
              </div>

              <ProductImagesField
                items={images}
                onChange={setImages}
                label="Ürün Görselleri"
                helperText="İlk görsel müşteri uygulamasında ana görsel olarak gösterilir."
              />
              {formErrors.images && <p className="text-error text-xs -mt-3">{formErrors.images}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 seller-btn-outline"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 seller-btn-primary"
                >
                  {editingProduct ? 'Güncelle' : 'Ürün Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmActionModal
        open={Boolean(pendingDeleteProduct)}
        title="Ürünü silmek istiyor musun?"
        description="Bu işlem geri alınamaz."
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        onCancel={() => setPendingDeleteProduct(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
};

export default ProductsAdvanced;
