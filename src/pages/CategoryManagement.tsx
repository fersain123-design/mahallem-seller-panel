import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { vendorAPI } from '../services/api.ts';

type VendorCategory = {
  id: string;
  name: string;
  icon?: string;
  image?: string;
  description?: string;
  isCustom?: boolean;
};

const ICON_OPTIONS = [
  'shape-outline',
  'food-apple',
  'carrot',
  'basket',
  'coffee',
  'flower',
  'paw',
  'gas-cylinder',
  'bottle-soda',
  'shopping-outline',
];

const IMAGE_OPTIONS = [
  'market.jpg',
  'manavvvv.jpg',
  'firin.webp',
  'pastane.webp',
  'kasap.jpeg',
  'sarkuteri_2.webp',
  'bufe.jpg',
  'balik-tezgahiaa-2373472.jpg',
  'kafe.jpg',
  'kuruyemisci.jpg',
  'aktarci.webp',
  'cicekci.jpg',
];

const emptyForm = {
  name: '',
  icon: ICON_OPTIONS[0],
  image: IMAGE_OPTIONS[0],
  description: '',
};

const CategoryManagement: React.FC = () => {
  const { vendor } = useAuth();
  const [categories, setCategories] = useState<VendorCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeType, setStoreType] = useState('');
  const [isVendorManaged, setIsVendorManaged] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const businessType = String(vendor?.vendorProfile?.businessType || '').trim();

  const pageTitle = useMemo(() => {
    return 'Kategori Yonetimi';
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await vendorAPI.getCategories();
      const payload = response?.data?.data || {};
      setCategories(Array.isArray(payload?.categories) ? payload.categories : []);
      setStoreType(String(payload?.storeType || businessType || ''));
      setIsVendorManaged(true);
    } catch (error) {
      console.error('Kategori listesi yuklenemedi', error);
      setMessage({ type: 'error', text: 'Kategori listesi yuklenemedi.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [businessType]);

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setMessage(null);

      if (editingId) {
        await vendorAPI.updateCategory(editingId, formData);
        setMessage({ type: 'success', text: 'Kategori guncellendi.' });
      } else {
        await vendorAPI.createCategory(formData);
        setMessage({ type: 'success', text: 'Kategori olusturuldu.' });
      }

      resetForm();
      await fetchCategories();
    } catch (error: any) {
      const text = error?.response?.data?.message || error?.response?.data?.detail || 'Islem basarisiz';
      setMessage({ type: 'error', text });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu kategoriyi silmek istediginizden emin misiniz?')) return;

    try {
      await vendorAPI.deleteCategory(id);
      setMessage({ type: 'success', text: 'Kategori silindi.' });
      if (editingId === id) resetForm();
      await fetchCategories();
    } catch (error: any) {
      const text = error?.response?.data?.message || error?.response?.data?.detail || 'Silme islemi basarisiz';
      setMessage({ type: 'error', text });
    }
  };

  const startEdit = (category: VendorCategory) => {
    setEditingId(category.id);
    setFormData({
      name: category.name || '',
      icon: category.icon || ICON_OPTIONS[0],
      image: category.image || IMAGE_OPTIONS[0],
      description: category.description || '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="seller-surface p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{pageTitle}</h1>
            <p className="text-sm text-text-secondary">
              Isletme tipi: {storeType || businessType || '-'}
            </p>
          </div>
          <div className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-2 text-sm text-text-secondary">
            Bu magaza tipinde kategorileri siz olusturup duzenleyebilirsiniz.
          </div>
        </div>
      </div>

      {message ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-success/20 bg-success/10 text-success' : 'border-error/20 bg-error/10 text-error'}`}>
          {message.text}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="seller-surface p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Kategori Adi</label>
              <input
                type="text"
                className="seller-input"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Ikon</label>
              <select
                className="seller-input"
                value={formData.icon}
                onChange={(e) => setFormData((prev) => ({ ...prev, icon: e.target.value }))}
              >
                {ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Gorsel</label>
              <select
                className="seller-input"
                value={formData.image}
                onChange={(e) => setFormData((prev) => ({ ...prev, image: e.target.value }))}
              >
                {IMAGE_OPTIONS.map((image) => (
                  <option key={image} value={image}>{image}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Aciklama</label>
              <input
                type="text"
                className="seller-input"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="seller-btn-primary" disabled={saving}>
              {saving ? 'Kaydediliyor...' : editingId ? 'Kategoriyi Guncelle' : 'Kategori Olustur'}
            </button>
            {editingId ? (
              <button type="button" className="seller-btn-secondary" onClick={resetForm}>
                Iptal
              </button>
            ) : null}
          </div>
      </form>

      <div className="seller-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-primary/5 text-left text-sm text-text-secondary">
              <tr>
                <th className="px-4 py-3">Ad</th>
                <th className="px-4 py-3">Ikon</th>
                <th className="px-4 py-3">Gorsel</th>
                <th className="px-4 py-3">Tur</th>
                <th className="px-4 py-3">Islem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-text-secondary" colSpan={5}>Kategoriler yukleniyor...</td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-text-secondary" colSpan={5}>Kategori bulunmuyor.</td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id} className="border-t border-primary/10 text-sm">
                    <td className="px-4 py-3 font-medium text-text-primary">{category.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{category.icon || '-'}</td>
                    <td className="px-4 py-3 text-text-secondary">{category.image || '-'}</td>
                    <td className="px-4 py-3 text-text-secondary">{category.isCustom ? 'Ozel' : 'Hazir'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button type="button" className="text-primary hover:text-primary-700" onClick={() => startEdit(category)}>
                          Duzenle
                        </button>
                        <button type="button" className="text-error hover:text-error/80" onClick={() => handleDelete(category.id)}>
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CategoryManagement;