import React, { useEffect, useMemo, useRef, useState } from 'react';
import { productsAPI, vendorAPI } from '../services/api.ts';
import { Product } from '../types/index.ts';
import ProductImagesField, { ProductImageItem, urlsToImageItems } from '../components/products/ProductImagesField.tsx';
import { useSellerSearch } from '../context/SellerSearchContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu.jsx';

const LOW_STOCK_LEVEL = 5;
const META_MARKER_START = '[MAHALLEM_PRODUCT_META_V1]';
const META_MARKER_END = '[/MAHALLEM_PRODUCT_META_V1]';
const SPECIAL_CATEGORY_NAME = 'Özel Ürünler';

const UNIT_PRESETS = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli'];
const UNIT_PRESET_SET = new Set(UNIT_PRESETS);

type SortOption = 'newest' | 'name-asc' | 'price-asc' | 'price-desc' | 'stock-asc' | 'stock-desc';

type ProductSpecRow = {
  key: string;
  value: string;
};

type ProductMetaV1 = {
  sku?: string;
  barcode?: string;
  brand?: string;
  origin?: string;
  shelfLifeDays?: number;
  netWeightValue?: number;
  netWeightUnit?: string;
  vatRate?: number;
  minOrderQty?: number;
  maxOrderQty?: number;
  prepTimeMin?: number;
  tags?: string[];
  highlights?: string[];
  seoTitle?: string;
  seoDescription?: string;
  specs?: ProductSpecRow[];
};

type VendorCategoryOption = {
  id: string;
  name: string;
  icon?: string;
  image?: string;
  isCustom?: boolean;
  subCategories?: Array<{ id: string; name: string; slug?: string }>;
};

type VendorSubCategoryOption = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
};

type AddProductMethod = 'barcode' | 'manual';
type AddProductMode = AddProductMethod;
type BarcodeLookupMessage = { type: 'success' | 'error' | 'warning' | 'info'; text: string } | null;
type BarcodeLookupStatus = 'found' | 'not_found' | 'invalid' | 'manual';
type BarcodeProductSource = 'barcode_api' | 'mahallem_db' | 'manual';

type BarcodeLookupContext = {
  source: BarcodeProductSource;
  barcodeLookupStatus: BarcodeLookupStatus;
  suggestedCategory: string;
  category: string;
  confidence: number;
  matchedKeywords: string[];
};

type DuplicateBarcodePrompt = {
  visible: boolean;
  productId: string;
  message: string;
};
type BarcodeScannerState =
  | 'idle'
  | 'ready'
  | 'detected'
  | 'loading'
  | 'found'
  | 'not-found'
  | 'error'
  | 'unsupported';

const VENDOR_CATEGORY_CACHE_KEY = 'seller_vendor_categories_cache_v2';
const PENDING_CREATE_QUEUE_KEY = 'seller_products_pending_create_v1';
const PENDING_CREATE_MAX_AGE_MS = 30 * 60 * 1000;

type FormErrors = {
  name?: string;
  category?: string;
  subCategory?: string;
  barcode?: string;
  price?: string;
  unit?: string;
  stock?: string;
  netWeight?: string;
  images?: string;
};

type PendingCreateImage =
  | { kind: 'url'; url: string }
  | { kind: 'file'; name: string; type: string; contentBase64: string };

type PendingCreateJob = {
  tempId: string;
  productId?: string;
  payload: any;
  images: PendingCreateImage[];
  optimisticProduct: Product;
  createdAt: string;
};

type SmartSuggestionItem = {
  id: string;
  name: string;
  imageUrl?: string | null;
  category?: string;
  barcode?: string | null;
  unit?: string | null;
  price?: number;
  soldCount?: number;
  orderCount?: number;
};

const emptyForm = {
  name: '',
  category: '',
  price: '',
  unit: '',
  stock: '',
  status: 'active',
  description: '',
};

const emptyMeta: ProductMetaV1 = {
  sku: '',
  barcode: '',
  brand: '',
  origin: '',
  shelfLifeDays: undefined,
  netWeightValue: undefined,
  netWeightUnit: '',
  vatRate: 10,
  minOrderQty: 1,
  maxOrderQty: undefined,
  prepTimeMin: undefined,
  tags: [],
  highlights: [],
  seoTitle: '',
  seoDescription: '',
  specs: [],
};

const toFixedCurrency = (value: number) =>
  Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatNetWeightLabel = (meta: ProductMetaV1 | null | undefined, fallbackUnit?: string) => {
  const valueRaw = meta?.netWeightValue;
  const unitRaw = String(meta?.netWeightUnit || fallbackUnit || '').trim();

  if (typeof valueRaw === 'number' && Number.isFinite(valueRaw) && valueRaw > 0 && unitRaw) {
    const formattedValue = Number.isInteger(valueRaw)
      ? String(Math.trunc(valueRaw))
      : String(valueRaw).replace('.', ',');
    return `${formattedValue} ${unitRaw}`;
  }

  return unitRaw;
};

const parseNumberInput = (value: string | number | undefined | null) => {
  const raw = String(value ?? '').trim();
  if (!raw) return NaN;
  return Number(raw.replace(',', '.'));
};

const parseQuantityToUnitPreset = (
  quantityRaw: string
): { unit: string; netWeightValue?: number; netWeightUnit?: string } => {
  const raw = String(quantityRaw || '').trim().toLocaleLowerCase('tr-TR');
  if (!raw) return { unit: '' };

  const compact = raw.replace(',', '.').replace(/\s+/g, '');
  const match = compact.match(/^(\d+(?:\.\d+)?)(kg|g|gr|ml|cl|l|lt)$/i);
  if (!match) {
    return { unit: '' };
  }

  const numeric = Number(match[1]);
  const unitRaw = String(match[2] || '').toLocaleLowerCase('tr-TR');
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { unit: '' };
  }

  if (unitRaw === 'kg') {
    return { unit: 'kg', netWeightValue: numeric, netWeightUnit: 'kg' };
  }
  if (unitRaw === 'g' || unitRaw === 'gr') {
    return { unit: 'gr', netWeightValue: numeric, netWeightUnit: 'gr' };
  }
  if (unitRaw === 'ml' || unitRaw === 'cl') {
    return { unit: 'ml', netWeightValue: unitRaw === 'cl' ? numeric * 10 : numeric, netWeightUnit: 'ml' };
  }
  if (unitRaw === 'l' || unitRaw === 'lt') {
    return { unit: 'lt', netWeightValue: numeric, netWeightUnit: 'lt' };
  }

  return { unit: '' };
};

const sanitizeLookupString = (value: unknown) => String(value ?? '').trim();

const getScannerStateText = (state: BarcodeScannerState) => {
  if (state === 'ready') return 'Kamera hazır, barkod bekleniyor';
  if (state === 'detected') return 'Barkod algılandı, arama başlatılıyor';
  if (state === 'loading') return 'Ürün aranıyor...';
  if (state === 'found') return 'Barkod bulundu, form dolduruldu';
  if (state === 'not-found') return 'Ürün bulunamadı, manuel olarak devam edebilirsiniz.';
  if (state === 'error') return 'Kamera veya barkod okuma sırasında bir sorun oluştu.';
  if (state === 'unsupported') return 'Tarayıcınızda barkod tarama desteklenmiyor.';
  return 'Kamera başlatılıyor';
};

const BARCODE_SCANNER_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
const BARCODE_SCAN_COOLDOWN_MS = 1500;
const BARCODE_INVALID_MESSAGE = 'Bu barkod geçerli görünmüyor. Lütfen tekrar okutun veya elle kontrol edin.';
const BARCODE_FOUND_MESSAGE = 'Ürün bulundu. Bilgileri kontrol edip kaydedebilirsin.';
const BARCODE_NOT_FOUND_MESSAGE = 'Bu ürün henüz sistemde yok. Barkod kaydedildi, ürün bilgilerini elle tamamlayabilirsin.';
const BARCODE_ALREADY_EXISTS_MESSAGE = 'Bu barkod mağazanda zaten kayıtlı. Mevcut ürünü düzenleyebilirsin.';
const BARCODE_LOW_CONFIDENCE_MESSAGE = 'Kategori otomatik önerildi ama kontrol etmeni öneririz.';
const BARCODE_LOOKUP_SEARCHING_MESSAGE = 'Ürün aranıyor...';
const BARCODE_DUPLICATE_LOOKUP_COOLDOWN_MS = 30000;

const normalizeBarcodeInput = (value: unknown) =>
  String(value ?? '')
    .replace(/\s+/g, '')
    .trim();

const calculateEan13CheckDigit = (firstTwelveDigits: string): number | null => {
  if (!/^\d{12}$/.test(firstTwelveDigits)) return null;
  let sum = 0;
  for (let idx = 0; idx < 12; idx += 1) {
    const digit = Number(firstTwelveDigits[idx]);
    sum += idx % 2 === 0 ? digit : digit * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
};

const isValidEan13Checksum = (barcode: string) => {
  const normalized = normalizeBarcodeInput(barcode);
  if (!/^\d{13}$/.test(normalized)) return false;
  const expected = calculateEan13CheckDigit(normalized.slice(0, 12));
  if (expected === null) return false;
  return expected === Number(normalized[12]);
};

const validateBarcodeInput = (value: unknown) => {
  const normalizedBarcode = normalizeBarcodeInput(value);
  if (!normalizedBarcode) {
    return { isValid: false, normalizedBarcode, reason: 'empty' as const };
  }
  if (!/^\d+$/.test(normalizedBarcode)) {
    return { isValid: false, normalizedBarcode, reason: 'invalid_format' as const };
  }
  if (![8, 12, 13, 14].includes(normalizedBarcode.length)) {
    return { isValid: false, normalizedBarcode, reason: 'invalid_length' as const };
  }
  if (normalizedBarcode.length === 13 && !isValidEan13Checksum(normalizedBarcode)) {
    return { isValid: false, normalizedBarcode, reason: 'invalid_ean13_checksum' as const };
  }
  return { isValid: true, normalizedBarcode, reason: 'ok' as const };
};

const parseDescriptionWithMeta = (value?: string) => {
  const raw = String(value || '');
  const startIndex = raw.indexOf(META_MARKER_START);
  const endIndex = raw.indexOf(META_MARKER_END);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return { cleanDescription: raw.trim(), meta: null as ProductMetaV1 | null };
  }

  const cleanDescription = raw.slice(0, startIndex).trim();
  const metaChunk = raw.slice(startIndex + META_MARKER_START.length, endIndex).trim();

  try {
    const parsed = JSON.parse(metaChunk);
    if (parsed && typeof parsed === 'object') {
      return { cleanDescription, meta: parsed as ProductMetaV1 };
    }
  } catch {
    return { cleanDescription: raw.trim(), meta: null };
  }

  return { cleanDescription, meta: null };
};

const buildDescriptionWithMeta = (description: string, meta: ProductMetaV1) => {
  const compactMeta: ProductMetaV1 = {
    ...meta,
    tags: (meta.tags || []).map((tag) => tag.trim()).filter(Boolean),
    highlights: (meta.highlights || []).map((row) => row.trim()).filter(Boolean),
    specs: (meta.specs || [])
      .map((row) => ({ key: row.key.trim(), value: row.value.trim() }))
      .filter((row) => row.key || row.value),
  };

  return `${description.trim()}\n\n${META_MARKER_START}\n${JSON.stringify(compactMeta)}\n${META_MARKER_END}`;
};

const metaToFeaturesInput = (meta: ProductMetaV1 | null | undefined) => {
  const specs = Array.isArray(meta?.specs) ? meta.specs : [];
  const highlights = Array.isArray(meta?.highlights) ? meta.highlights : [];

  const specLines = specs
    .map((row) => {
      const key = String(row?.key || '').trim();
      const value = String(row?.value || '').trim();
      if (!key && !value) return '';
      if (!value) return key;
      if (!key) return value;
      return `${key}: ${value}`;
    })
    .filter(Boolean);

  return Array.from(new Set([...specLines, ...highlights.map((item) => String(item || '').trim()).filter(Boolean)])).join('\n');
};

const featuresInputToSpecs = (value: string): ProductSpecRow[] =>
  String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.split(':');
      const parsedKey = String(key || '').trim();
      const parsedValue = String(rest.join(':') || '').trim();
      if (!parsedValue) return { key: parsedKey, value: '' };
      return { key: parsedKey, value: parsedValue };
    });

const rowsToFeatureSpecs = (rows: string[]): ProductSpecRow[] =>
  rows
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.split(':');
      const parsedKey = String(key || '').trim();
      const parsedValue = String(rest.join(':') || '').trim();
      if (!parsedValue) return { key: parsedKey, value: '' };
      return { key: parsedKey, value: parsedValue };
    });

const slugify = (value: string) =>
  String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const isSpecialProduct = (product: Product) =>
  String(product?.category || '').trim().toLocaleLowerCase('tr-TR') ===
  SPECIAL_CATEGORY_NAME.toLocaleLowerCase('tr-TR');

const normalizeSearchText = (value: string) =>
  String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');

const resolveVendorBusinessType = (vendor: any): string => {
  return String(
    vendor?.vendorProfile?.businessType ||
      vendor?.vendorProfile?.business_type ||
      vendor?.businessType ||
      vendor?.business_type ||
      ''
  ).trim();
};

const resolveProcessingStatus = (product: Product): 'processing' | 'ready' | 'failed' => {
  if (product.processing_status) {
    return product.processing_status;
  }

  const approval = String(product.approval_status || '').toUpperCase();
  if (approval === 'REJECTED') return 'failed';
  return 'ready';
};

const readPendingCreateJobs = (): PendingCreateJob[] => {
  try {
    const raw = localStorage.getItem(PENDING_CREATE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    const validJobs = parsed.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      const createdAtMs = new Date(String((item as PendingCreateJob).createdAt || '')).getTime();
      if (!Number.isFinite(createdAtMs)) return false;
      return now - createdAtMs <= PENDING_CREATE_MAX_AGE_MS;
    }) as PendingCreateJob[];

    if (validJobs.length !== parsed.length) {
      writePendingCreateJobs(validJobs);
    }

    return validJobs;
  } catch {
    return [];
  }
};

const writePendingCreateJobs = (jobs: PendingCreateJob[]) => {
  try {
    localStorage.setItem(PENDING_CREATE_QUEUE_KEY, JSON.stringify(jobs));
  } catch {
    // ignore storage write failures
  }
};

const upsertPendingCreateJob = (job: PendingCreateJob) => {
  const jobs = readPendingCreateJobs();
  const next = [...jobs.filter((item) => item.tempId !== job.tempId), job];
  writePendingCreateJobs(next);
};

const removePendingCreateJob = (tempId: string) => {
  const jobs = readPendingCreateJobs();
  writePendingCreateJobs(jobs.filter((job) => job.tempId !== tempId));
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes('base64,') ? String(result.split('base64,').pop() || '') : result;
      if (!base64) {
        reject(new Error('Base64 donusumu basarisiz'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Dosya okunamadi'));
    reader.readAsDataURL(file);
  });

const base64ToFile = (contentBase64: string, name: string, type: string): File => {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let idx = 0; idx < binary.length; idx += 1) {
    bytes[idx] = binary.charCodeAt(idx);
  }
  return new File([bytes], name, { type: type || 'image/png' });
};

const Products: React.FC = () => {
  const { vendor } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [vendorCategories, setVendorCategories] = useState<VendorCategoryOption[]>([]);
  const [vendorStoreTypeFromApi, setVendorStoreTypeFromApi] = useState('');
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [isVendorManagedCategories, setIsVendorManagedCategories] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formNotice, setFormNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [isAddProductMenuOpen, setIsAddProductMenuOpen] = useState(false);
  const [addProductMode, setAddProductMode] = useState<AddProductMode>('manual');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isBarcodeLookupLoading, setIsBarcodeLookupLoading] = useState(false);
  const [barcodeLookupMessage, setBarcodeLookupMessage] = useState<BarcodeLookupMessage>(null);
  const [barcodeLookupContext, setBarcodeLookupContext] = useState<BarcodeLookupContext>({
    source: 'manual',
    barcodeLookupStatus: 'manual',
    suggestedCategory: '',
    category: '',
    confidence: 0,
    matchedKeywords: [],
  });
  const [duplicateBarcodePrompt, setDuplicateBarcodePrompt] = useState<DuplicateBarcodePrompt>({
    visible: false,
    productId: '',
    message: '',
  });
  const [isManualBarcodeInputOpen, setIsManualBarcodeInputOpen] = useState(false);
  const [barcodeScannerState, setBarcodeScannerState] = useState<BarcodeScannerState>('idle');
  const [barcodeScannerError, setBarcodeScannerError] = useState<string | null>(null);
  const [isBarcodeCameraActive, setIsBarcodeCameraActive] = useState(false);
  const barcodeVideoRef = useRef<HTMLVideoElement | null>(null);
  const barcodeStreamRef = useRef<MediaStream | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const barcodeScanRafRef = useRef<number | null>(null);
  const manualLookupDebounceRef = useRef<number | null>(null);
  const isBarcodeLoopActiveRef = useRef(false);
  const isBarcodeLookupInFlightRef = useRef(false);
  const lastDetectedBarcodeRef = useRef('');
  const lastScanEventRef = useRef<{ barcode: string; at: number }>({ barcode: '', at: 0 });
  const lastLookupRef = useRef<{ barcode: string; at: number }>({ barcode: '', at: 0 });

  const { query: search, setQuery: setSearch } = useSellerSearch();
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'processing' | 'failed'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [processingProductIds, setProcessingProductIds] = useState<string[]>([]);

  const [formData, setFormData] = useState(emptyForm);
  const [metaData, setMetaData] = useState<ProductMetaV1>(emptyMeta);
  const [featureRows, setFeatureRows] = useState<string[]>(['']);
  const [images, setImages] = useState<ProductImageItem[]>([]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState('');
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestionItem[]>([]);
  const [smartSuggestionsLoading, setSmartSuggestionsLoading] = useState(false);

  const qualityRejectedHintVisible = Boolean(
    editingProduct &&
      editingProduct.status === 'inactive' &&
      (!editingProduct.images || editingProduct.images.length === 0)
  );

  const runPendingCreateJob = async (job: PendingCreateJob, options?: { silent?: boolean }) => {
    const processingKey = String(job.productId || job.tempId);
    setProcessingProductIds((prev) => Array.from(new Set([...prev, processingKey])));

    try {
      let response: any;
      if (job.productId) {
        const resolvedUploadedImageUrls: string[] = [];
        for (const image of job.images) {
          if (image.kind === 'url') {
            resolvedUploadedImageUrls.push(image.url);
          } else {
            const file = base64ToFile(image.contentBase64, image.name, image.type);
            const url = await productsAPI.uploadImageUrl(file);
            resolvedUploadedImageUrls.push(url);
          }
        }

        response = await productsAPI.update(job.productId, {
          ...job.payload,
          images: resolvedUploadedImageUrls,
        });
      } else {
        const imageJobs = job.images
          .map((image) => {
            if (image.kind === 'url') {
              return { kind: 'url', url: image.url };
            }

            return {
              kind: 'file',
              filename: image.name,
              mimeType: image.type,
              contentBase64: image.contentBase64,
            };
          })
          .filter(Boolean);

        response = await productsAPI.create({
          ...job.payload,
          images: [],
          imageJobs,
        });
      }
      const createdProduct = response?.data?.data as Product | undefined;

      if (createdProduct?.id && !isSpecialProduct(createdProduct)) {
        setProducts((prev) => {
          const hasTemp = prev.some((item) => item.id === job.tempId || (job.productId ? item.id === job.productId : false));
          if (hasTemp) {
            return prev.map((item) =>
              item.id === job.tempId || (job.productId ? item.id === job.productId : false)
                ? createdProduct
                : item
            );
          }
          const withoutDuplicate = prev.filter((item) => item.id !== createdProduct.id);
          return [createdProduct, ...withoutDuplicate];
        });
      } else {
        setProducts((prev) => prev.filter((item) => item.id !== job.tempId));
      }

      if (!options?.silent) {
        setNotice({ type: 'success', text: 'Yeni ürün eklendi.' });
      }
      void fetchProducts({ background: true });
    } catch (backgroundErr: any) {
      const data = backgroundErr?.response?.data;
      const serverMessage = data?.detail || data?.message || 'İşlem başarısız';
      const zodMessages = Array.isArray(data?.errors)
        ? data.errors.map((item: any) => item?.message).filter(Boolean).join(' ')
        : '';
      const combined = zodMessages ? `${serverMessage}: ${zodMessages}` : serverMessage;
      if (!job.productId) {
        setProducts((prev) => prev.filter((item) => item.id !== job.tempId));
      }
      setNotice({ type: 'error', text: combined });
    } finally {
      removePendingCreateJob(job.tempId);
      setProcessingProductIds((prev) => prev.filter((id) => id !== processingKey));
    }
  };

  const vendorSubCategoryOptions = useMemo(() => {
    const list: VendorSubCategoryOption[] = [];

    vendorCategories.forEach((category) => {
      const categoryId = String(category.id || '').trim();
      const categoryName = String(category.name || '').trim();
      const subCategories = Array.isArray(category.subCategories) ? category.subCategories : [];

      subCategories.forEach((subCategory) => {
        const subCategoryId = String(subCategory.id || '').trim();
        const subCategoryName = String(subCategory.name || '').trim();
        if (!subCategoryId || !subCategoryName) return;

        list.push({
          id: subCategoryId,
          name: subCategoryName,
          categoryId,
          categoryName,
        });
      });
    });

    return list.sort((left, right) => left.name.localeCompare(right.name, 'tr'));
  }, [vendorCategories]);

  const activeSubCategoryOptions = vendorSubCategoryOptions;

  const subCategoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    vendorSubCategoryOptions.forEach((item) => {
      map.set(String(item.id), String(item.name));
    });
    return map;
  }, [vendorSubCategoryOptions]);

  const resolveProductSubCategoryName = (product: Product) => {
    const subCategoryId = String(product?.sub_category_id || '').trim();
    if (subCategoryId && subCategoryNameById.has(subCategoryId)) {
      return String(subCategoryNameById.get(subCategoryId) || '').trim();
    }

    const rawSubCategory = String(product?.sub_category_name || '').trim();
    if (rawSubCategory) return rawSubCategory;

    return 'Genel';
  };

  const categoryFilterOptions = useMemo(() => {
    const names = products
      .map((product) => resolveProductSubCategoryName(product))
      .filter(Boolean);
    return Array.from(new Set(names)).sort((left, right) => left.localeCompare(right, 'tr'));
  }, [products, subCategoryNameById]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    const list = products.filter((product) => {
      const processingStatus = resolveProcessingStatus(product);
      const resolvedSubCategory = resolveProductSubCategoryName(product);
      if (statusFilter === 'processing' && processingStatus !== 'processing') return false;
      if (statusFilter === 'failed' && processingStatus !== 'failed') return false;
      if (statusFilter === 'active' && (processingStatus !== 'ready' || product.status !== 'active')) return false;
      if (statusFilter === 'inactive' && (processingStatus !== 'ready' || product.status !== 'inactive')) return false;
      if (categoryFilter && resolvedSubCategory !== categoryFilter) return false;
      if (!q) return true;

      return (
        String(product.name || '').toLowerCase().includes(q) ||
        String(resolvedSubCategory || '').toLowerCase().includes(q) ||
        String(product.description || '').toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'name-asc') return String(a.name).localeCompare(String(b.name), 'tr');
      if (sortBy === 'price-asc') return Number(a.price || 0) - Number(b.price || 0);
      if (sortBy === 'price-desc') return Number(b.price || 0) - Number(a.price || 0);
      if (sortBy === 'stock-asc') return Number(a.stock || 0) - Number(b.stock || 0);
      if (sortBy === 'stock-desc') return Number(b.stock || 0) - Number(a.stock || 0);

      const aTime = new Date((a as any).created_at || Date.now()).getTime();
      const bTime = new Date((b as any).created_at || Date.now()).getTime();
      return bTime - aTime;
    });
  }, [products, search, statusFilter, categoryFilter, sortBy, subCategoryNameById]);

  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((product) => product.status === 'active').length;
    const lowStock = products.filter((product) => Number(product.stock || 0) <= LOW_STOCK_LEVEL).length;
    const averagePrice = total
      ? products.reduce((sum, product) => sum + Number(product.price || 0), 0) / total
      : 0;

    return { total, active, lowStock, averagePrice };
  }, [products]);

  const allVisibleSelected =
    filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.includes(product.id));

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const jobs = readPendingCreateJobs();
    if (jobs.length === 0) return;

    setProducts((prev) => {
      const optimisticProducts = jobs
        .map((job) => job.optimisticProduct)
        .filter((item) => !prev.some((existing) => existing.id === item.id));
      return [...optimisticProducts, ...prev];
    });

    setProcessingProductIds((prev) => Array.from(new Set([...prev, ...jobs.map((job) => job.tempId)])));
    jobs.forEach((job) => {
      void runPendingCreateJob(job, { silent: true });
    });
  }, []);

  useEffect(() => {
    fetchVendorCategories();
  }, [vendor?.vendorProfile?.businessType]);

  useEffect(() => {
    if (!showModal || Boolean(editingProduct)) {
      setSmartSuggestions([]);
      setSmartSuggestionsLoading(false);
      return;
    }

    const categoryId = String(selectedCategoryId || '').trim();
    if (!categoryId) {
      setSmartSuggestions([]);
      setSmartSuggestionsLoading(false);
      return;
    }

    let mounted = true;
    setSmartSuggestionsLoading(true);

    void (async () => {
      try {
        const response = await productsAPI.getSmartSuggestions({
          categoryId,
          subCategoryId: String(selectedSubCategoryId || '').trim() || undefined,
          limit: 6,
        });
        const list = Array.isArray(response?.data?.data) ? response.data.data : [];
        if (!mounted) return;
        setSmartSuggestions(list);
      } catch {
        if (!mounted) return;
        setSmartSuggestions([]);
      } finally {
        if (!mounted) return;
        setSmartSuggestionsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [showModal, editingProduct, selectedCategoryId, selectedSubCategoryId]);

  const fetchProducts = async (options?: { background?: boolean }) => {
    const useBackgroundRefresh = Boolean(options?.background) && products.length > 0;
    try {
      if (useBackgroundRefresh) {
        setListRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter === 'active' || statusFilter === 'inactive') {
        params.status = statusFilter;
      }

      const response = await productsAPI.getAll(params);
      const list = response?.data?.data?.products || [];
      const nextProducts = Array.isArray(list) ? list.filter((product: Product) => !isSpecialProduct(product)) : [];
      const pendingJobs = readPendingCreateJobs();
      const pendingOptimisticProducts = pendingJobs
        .map((job) => job.optimisticProduct)
        .filter((item) => !nextProducts.some((product: Product) => product.id === item.id));
      setProducts([...pendingOptimisticProducts, ...nextProducts]);
      setSelectedIds([]);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ürünler yüklenemedi');
    } finally {
      if (useBackgroundRefresh) {
        setListRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchProducts({ background: true });
    }, 15000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchProducts({ background: true });
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const fetchVendorCategories = async () => {
    const businessTypeKey = normalizeSearchText(resolveVendorBusinessType(vendor) || 'unknown');
    const vendorScope = String(
      vendor?.vendorProfile?.id || vendor?.id || vendor?.email || 'unknown'
    )
      .trim()
      .toLocaleLowerCase('tr-TR');
    const scopedCacheKey = `${VENDOR_CATEGORY_CACHE_KEY}_${vendorScope}_${businessTypeKey}`;
    const cachedRaw = localStorage.getItem(scopedCacheKey);
    let hasCachedCategories = false;

    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        const cachedCategories = Array.isArray(cached?.categories) ? cached.categories : [];
        if (cachedCategories.length > 0) {
          hasCachedCategories = true;
          setVendorCategories(cachedCategories);
          setIsVendorManagedCategories(Boolean(cached?.isVendorManaged));
        }
      } catch {
        // Ignore cache parse errors and continue with API call.
      }
    }

    try {
      setCategoriesLoading(!hasCachedCategories);
      const response = await vendorAPI.getCategories();
      const payload = response?.data?.data || {};
      const categories = Array.isArray(payload?.categories) ? payload.categories : [];
      setVendorStoreTypeFromApi(String(payload?.storeType || '').trim());

      if (categories.length > 0) {
        setVendorCategories(categories);
        setIsVendorManagedCategories(Boolean(payload?.isVendorManaged));
        localStorage.setItem(
          scopedCacheKey,
          JSON.stringify({ categories, isVendorManaged: Boolean(payload?.isVendorManaged) })
        );
        return;
      }

      if (!hasCachedCategories) {
        setVendorCategories([]);
        setIsVendorManagedCategories(Boolean(payload?.isVendorManaged));
      }
    } catch (err) {
      console.error('Kategori listesi yuklenemedi', err);
      if (!hasCachedCategories) {
        setVendorCategories([]);
        setIsVendorManagedCategories(false);
        setVendorStoreTypeFromApi('');
      }
    } finally {
      setCategoriesLoading(false);
    }
  };

  const createUpdatePayload = (product: Product, overrides?: Partial<Product>) => ({
    name: overrides?.name ?? product.name,
    category: overrides?.category ?? product.category,
    price: Number(overrides?.price ?? product.price ?? 0),
    unit: overrides?.unit ?? product.unit,
    stock: Number(overrides?.stock ?? product.stock ?? 0),
    status: (overrides?.status as any) ?? product.status,
    description: overrides?.description ?? product.description ?? '',
    images: Array.isArray(product.images) ? product.images.filter(Boolean) : [],
  });

  const resetForm = (options?: { keepAddMode?: boolean; keepBarcodeInput?: boolean; keepScannerUi?: boolean }) => {
    setFormData(emptyForm);
    setMetaData(emptyMeta);
    setFeatureRows(['']);
    setImages([]);
    setEditingProduct(null);
    setSelectedCategoryId('');
    setSelectedSubCategoryId('');
    setFormNotice(null);
    setFormErrors({});
    setBarcodeLookupMessage(null);
    setBarcodeLookupContext({
      source: 'manual',
      barcodeLookupStatus: 'manual',
      suggestedCategory: '',
      category: '',
      confidence: 0,
      matchedKeywords: [],
    });
    setDuplicateBarcodePrompt({ visible: false, productId: '', message: '' });
    if (!options?.keepScannerUi) {
      setIsManualBarcodeInputOpen(false);
      setBarcodeScannerState('idle');
      setBarcodeScannerError(null);
    }
    if (!options?.keepAddMode) {
      setAddProductMode('manual');
    }
    if (!options?.keepBarcodeInput) {
      setBarcodeInput('');
    }
  };

  const applyDefaultSubCategorySelection = () => {
    const defaultSubCategory = vendorSubCategoryOptions[0];
    const defaultCategoryId = String(defaultSubCategory?.categoryId || '').trim();
    const defaultSubCategoryId = String(defaultSubCategory?.id || '').trim();
    const defaultCategoryName = String(defaultSubCategory?.categoryName || '').trim();

    setSelectedCategoryId(defaultCategoryId);
    setSelectedSubCategoryId(defaultSubCategoryId);
    setFormData((prev) => ({ ...prev, category: defaultCategoryName }));
  };

  const applySelectedSubCategory = (subCategoryId: string) => {
    const resolvedSubCategoryId = String(subCategoryId || '').trim();
    const selectedSubCategory = vendorSubCategoryOptions.find((item) => String(item.id) === resolvedSubCategoryId);

    setSelectedSubCategoryId(resolvedSubCategoryId);
    setSelectedCategoryId(String(selectedSubCategory?.categoryId || ''));
    setFormData((prev) => ({
      ...prev,
      category: String(selectedSubCategory?.categoryName || '').trim(),
    }));
    setFormErrors((prev) => ({ ...prev, subCategory: undefined }));
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const beginCreate = (mode: AddProductMode) => {
    resetForm({ keepAddMode: true, keepBarcodeInput: false });
    setAddProductMode(mode);
    applyDefaultSubCategorySelection();
    setShowModal(true);
    if (mode === 'barcode') {
      console.log('BARKOD_EKRANI_ACILDI');
    }
  };

  const handleOpenAddProductMenu = () => {
    handleToggleAddProductMenu(true);
  };

  const handleCloseAddProductMenu = () => {
    handleToggleAddProductMenu(false);
  };

  const handleToggleAddProductMenu = (nextOpen?: boolean) => {
    setIsAddProductMenuOpen((prev) => (typeof nextOpen === 'boolean' ? nextOpen : !prev));
  };

  const handleSelectAddMethod = (method: AddProductMethod) => {
    beginCreate(method);
    handleCloseAddProductMenu();
  };

  const findSubCategoryFromLookupCategory = (lookupCategory: string) => {
    const normalizedLookup = normalizeSearchText(lookupCategory).trim();
    if (!normalizedLookup) return null;

    const exactMatch = vendorSubCategoryOptions.find(
      (item) => normalizeSearchText(item.name).trim() === normalizedLookup
    );
    if (exactMatch) return exactMatch;

    return (
      vendorSubCategoryOptions.find((item) => {
        const candidate = normalizeSearchText(item.name).trim();
        return candidate.includes(normalizedLookup) || normalizedLookup.includes(candidate);
      }) || null
    );
  };

  const applySmartSuggestion = (item: SmartSuggestionItem) => {
    const nextName = String(item?.name || '').trim();
    if (!nextName) return;

    setFormData((prev) => ({
      ...prev,
      name: nextName,
      unit: String(item?.unit || prev.unit || '').trim() || prev.unit,
    }));

    if (String(item?.barcode || '').trim()) {
      const normalized = normalizeBarcodeInput(String(item.barcode || ''));
      setMetaData((prev) => ({ ...prev, barcode: normalized }));
      setBarcodeInput(normalized);
    }
  };

  const stopBarcodeScanner = () => {
    isBarcodeLoopActiveRef.current = false;

    if (barcodeScanRafRef.current !== null) {
      window.cancelAnimationFrame(barcodeScanRafRef.current);
      barcodeScanRafRef.current = null;
    }

    const stream = barcodeStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    barcodeStreamRef.current = null;
    setIsBarcodeCameraActive(false);

    const videoElement = barcodeVideoRef.current;
    if (videoElement) {
      videoElement.srcObject = null;
    }

    console.log('BARKOD_KAMERA_DURDURULDU');
  };

  const handleLookupBarcode = async (incomingBarcode?: string, fromCamera: boolean = false) => {
    if (isBarcodeLookupLoading) return;

    const validation = validateBarcodeInput(incomingBarcode ?? barcodeInput ?? '');
    const normalizedBarcode = validation.normalizedBarcode;
    setBarcodeInput(normalizedBarcode);

    const now = Date.now();
    const duplicateLookupInCooldown =
      lastLookupRef.current.barcode === normalizedBarcode &&
      now - lastLookupRef.current.at < BARCODE_DUPLICATE_LOOKUP_COOLDOWN_MS;
    if (normalizedBarcode && duplicateLookupInCooldown) {
      return;
    }

    if (!validation.isValid) {
      setBarcodeLookupMessage({ type: 'error', text: BARCODE_INVALID_MESSAGE });
      setFormNotice({ type: 'error', text: BARCODE_INVALID_MESSAGE });
      setMetaData((prev) => ({ ...prev, barcode: normalizedBarcode }));
      setBarcodeLookupContext({
        source: 'manual',
        barcodeLookupStatus: 'invalid',
        suggestedCategory: '',
        category: '',
        confidence: 0,
        matchedKeywords: [],
      });
      if (fromCamera) {
        setBarcodeScannerState('error');
      }
      return;
    }

    isBarcodeLookupInFlightRef.current = true;
    setIsBarcodeLookupLoading(true);
    setBarcodeLookupMessage({ type: 'info', text: BARCODE_LOOKUP_SEARCHING_MESSAGE });
    setFormNotice(null);
    if (fromCamera) {
      setBarcodeScannerState('loading');
    }
    resetForm({ keepAddMode: true, keepBarcodeInput: true, keepScannerUi: true });
    applyDefaultSubCategorySelection();
    setMetaData((prev) => ({ ...prev, barcode: normalizedBarcode }));
    setBarcodeLookupContext({
      source: 'barcode_api',
      barcodeLookupStatus: 'found',
      suggestedCategory: '',
      category: '',
      confidence: 0,
      matchedKeywords: [],
    });
    setDuplicateBarcodePrompt({ visible: false, productId: '', message: '' });

    console.log('[BARCODE] scanned barcode:', String(incomingBarcode ?? barcodeInput ?? ''));
    console.log('[BARCODE] normalized barcode:', normalizedBarcode);
    console.log('[BARCODE] validation result:', {
      barcode: normalizedBarcode,
      isValid: true,
      reason: 'client_valid',
    });
    console.log('[BARCODE] local DB lookup:', {
      barcode: normalizedBarcode,
      fromCamera,
    });

    try {
      lastLookupRef.current = { barcode: normalizedBarcode, at: now };
      const response = await productsAPI.lookupBarcode(normalizedBarcode);
      console.log('[BARCODE] external API lookup:', response?.data);
      const lookupPayload = response?.data?.data;
      const responseNormalizedBarcode = normalizeBarcodeInput(lookupPayload?.normalizedBarcode || normalizedBarcode);
      const found = Boolean(lookupPayload?.found);
      const lookupErrorCode = String(lookupPayload?.errorCode || '').trim();
      const lookupProduct = lookupPayload?.product;
      const lookupSource = String(lookupPayload?.source || '').trim();
      const alreadyExistsInStore = Boolean(lookupPayload?.alreadyExistsInVendorStore);
      const existingProductId = String(lookupPayload?.productId || '').trim();

      if (!found || !lookupProduct) {
        const notFoundMessage =
          lookupErrorCode === 'timeout'
            ? 'Barkod servisi şu anda yavaş yanıt veriyor. İstersen manuel devam edebilirsin.'
            : lookupErrorCode === 'api_error'
              ? 'Barkod servisine geçici olarak erişilemedi. Lütfen tekrar dene veya manuel eklemeye geç.'
              : BARCODE_NOT_FOUND_MESSAGE;

        const notFoundType = lookupErrorCode === 'not_found' || !lookupErrorCode ? 'warning' : 'error';
        setBarcodeLookupMessage({ type: notFoundType, text: notFoundMessage });
        if (notFoundType === 'error') {
          setFormNotice({ type: 'error', text: notFoundMessage });
        } else {
          setFormNotice(null);
        }
        setMetaData((prev) => ({ ...prev, barcode: responseNormalizedBarcode }));
        setBarcodeLookupContext({
          source: lookupSource === 'database' ? 'mahallem_db' : 'barcode_api',
          barcodeLookupStatus: 'not_found',
          suggestedCategory: '',
          category: '',
          confidence: 0,
          matchedKeywords: [],
        });
        console.log('[BARCODE] manual fallback opened with barcode:', responseNormalizedBarcode);
        if (fromCamera) {
          setBarcodeScannerState('not-found');
        }
        return;
      }

      const productName = sanitizeLookupString(lookupProduct?.name);
      const productBrand = sanitizeLookupString(lookupProduct?.brand);
      const productImageUrl = sanitizeLookupString(lookupProduct?.imageUrl);
      const productQuantity = sanitizeLookupString(lookupProduct?.quantity);
      const suggestedCategory = sanitizeLookupString(lookupProduct?.suggestedCategory || lookupProduct?.category);
      const mappedCategory = sanitizeLookupString(lookupProduct?.category);
      const responseBarcode = sanitizeLookupString(lookupProduct?.barcode);
      const categoryConfidence = Number(lookupProduct?.categoryConfidence || 0);
      const matchedKeywords = Array.isArray(lookupProduct?.matchedKeywords)
        ? lookupProduct.matchedKeywords.map((item: unknown) => String(item || '').trim()).filter(Boolean)
        : [];

      const parsedQuantity = parseQuantityToUnitPreset(productQuantity);
      const matchedSubCategory = findSubCategoryFromLookupCategory(suggestedCategory || mappedCategory);

      setFormData((prev) => ({
        ...prev,
        name: productName || prev.name,
        unit: parsedQuantity.unit || prev.unit,
        category: matchedSubCategory?.categoryName || prev.category,
        description: prev.description,
      }));

      setMetaData((prev) => ({
        ...prev,
        barcode: responseBarcode || responseNormalizedBarcode,
        brand: productBrand || prev.brand,
        netWeightValue: parsedQuantity.netWeightValue ?? prev.netWeightValue,
        netWeightUnit: parsedQuantity.netWeightUnit || prev.netWeightUnit,
      }));

      setBarcodeLookupContext({
        source: lookupSource === 'database' ? 'mahallem_db' : 'barcode_api',
        barcodeLookupStatus: 'found',
        suggestedCategory: suggestedCategory || mappedCategory,
        category: mappedCategory,
        confidence: Number.isFinite(categoryConfidence) ? categoryConfidence : 0,
        matchedKeywords,
      });

      if (matchedSubCategory) {
        setSelectedCategoryId(String(matchedSubCategory.categoryId || ''));
        setSelectedSubCategoryId(String(matchedSubCategory.id || ''));
      }

      if (productImageUrl) {
        setImages(urlsToImageItems([productImageUrl]));
      }

      let successMessage = BARCODE_FOUND_MESSAGE;
      if (lookupSource === 'open_food_facts') {
        successMessage = BARCODE_FOUND_MESSAGE;
      }
      if (categoryConfidence > 0 && categoryConfidence < 0.65) {
        successMessage = `${BARCODE_FOUND_MESSAGE} ${BARCODE_LOW_CONFIDENCE_MESSAGE}`;
      }
      setBarcodeLookupMessage({ type: 'success', text: successMessage });
      setFormNotice({ type: 'success', text: successMessage });

      if (alreadyExistsInStore && existingProductId) {
        setBarcodeLookupMessage({ type: 'success', text: BARCODE_ALREADY_EXISTS_MESSAGE });
        setFormNotice({ type: 'success', text: BARCODE_ALREADY_EXISTS_MESSAGE });
        setDuplicateBarcodePrompt({
          visible: true,
          productId: existingProductId,
          message: BARCODE_ALREADY_EXISTS_MESSAGE,
        });
      }

      if (fromCamera) {
        setBarcodeScannerState('found');
      }
    } catch (error: any) {
      const errorCode = String(error?.code || '').toUpperCase();
      const timeoutError =
        errorCode === 'ECONNABORTED' ||
        String(error?.message || '').toLocaleLowerCase('tr-TR').includes('timeout');

      const backendCode = String(error?.response?.data?.code || '').trim();
      const serverMessage = String(error?.response?.data?.message || error?.response?.data?.detail || '');
      const fallbackMessage = timeoutError
        ? 'Barkod araması zaman aşımına uğradı. Manuel ekleme ile devam edebilirsiniz.'
        : backendCode === 'duplicate'
          ? BARCODE_ALREADY_EXISTS_MESSAGE
          : backendCode === 'invalid_barcode'
            ? BARCODE_INVALID_MESSAGE
        : serverMessage || 'Barkod araması sırasında bir hata oluştu.';
      const effectiveMessage =
        fallbackMessage.toLocaleLowerCase('tr-TR').includes('gecerli gorunmuyor') ||
        fallbackMessage.toLocaleLowerCase('tr-TR').includes('geçerli görünmüyor')
          ? BARCODE_INVALID_MESSAGE
          : fallbackMessage;

      console.log('[BARCODE] external API lookup:', {
        barcode: normalizedBarcode,
        code: errorCode,
        timeoutError,
        status: 'error',
        message: effectiveMessage,
      });

      setBarcodeLookupMessage({ type: 'error', text: effectiveMessage });
      setFormNotice({ type: 'error', text: effectiveMessage });
      setMetaData((prev) => ({ ...prev, barcode: normalizedBarcode }));
      setBarcodeLookupContext({
        source: 'barcode_api',
        barcodeLookupStatus:
          effectiveMessage === BARCODE_INVALID_MESSAGE ? 'invalid' : timeoutError ? 'timeout' : 'api_error',
        suggestedCategory: '',
        category: '',
        confidence: 0,
        matchedKeywords: [],
      });
      if (fromCamera) {
        setBarcodeScannerState('error');
      }
    } finally {
      setIsBarcodeLookupLoading(false);
      isBarcodeLookupInFlightRef.current = false;
      if (fromCamera && (barcodeScannerState === 'loading' || barcodeScannerState === 'detected')) {
        setBarcodeScannerState('ready');
      }
    }
  };

  const startBarcodeScanner = async () => {
    if (isBarcodeCameraActive || editingProduct || addProductMode !== 'barcode') return;

    const supportsMediaDevices =
      typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
    const detectorCtor = (window as any).BarcodeDetector;

    if (!supportsMediaDevices || !detectorCtor) {
      setBarcodeScannerState('unsupported');
      setBarcodeScannerError('Bu tarayıcıda barkod tarama desteklenmiyor. Lütfen güncel Chrome/Edge veya manuel barkod girişini kullanın.');
      return;
    }

    try {
      const detector = new detectorCtor({ formats: BARCODE_SCANNER_FORMATS });
      barcodeDetectorRef.current = detector;

      // Prefer rear camera on mobile, but fall back to standard webcams on desktop.
      const cameraConstraints: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        {
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        {
          video: true,
          audio: false,
        },
      ];

      let stream: MediaStream | null = null;
      for (const constraints of cameraConstraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch {
          // Try the next fallback constraint.
        }
      }

      if (!stream) {
        throw new Error('CAMERA_UNAVAILABLE');
      }

      const videoElement = barcodeVideoRef.current;
      if (!videoElement) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      barcodeStreamRef.current = stream;
      videoElement.srcObject = stream;
      await videoElement.play();

      setIsBarcodeCameraActive(true);
      setBarcodeScannerError(null);
      setBarcodeScannerState('ready');
      isBarcodeLoopActiveRef.current = true;
      console.log('BARKOD_KAMERA_HAZIR');

      const scanFrame = async () => {
        if (!isBarcodeLoopActiveRef.current) return;

        try {
          const detectorInstance = barcodeDetectorRef.current;
          const activeVideo = barcodeVideoRef.current;

          if (
            detectorInstance &&
            activeVideo &&
            activeVideo.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
            !isBarcodeLookupInFlightRef.current
          ) {
            const detections = await detectorInstance.detect(activeVideo);
            if (Array.isArray(detections) && detections.length > 0) {
              const detectedRawValue = String(detections[0]?.rawValue || '').trim();
              const now = Date.now();
              const isSameInCooldown =
                lastScanEventRef.current.barcode === detectedRawValue &&
                now - lastScanEventRef.current.at < BARCODE_SCAN_COOLDOWN_MS;

              if (detectedRawValue && detectedRawValue !== lastDetectedBarcodeRef.current && !isSameInCooldown) {
                lastDetectedBarcodeRef.current = detectedRawValue;
                lastScanEventRef.current = { barcode: detectedRawValue, at: now };
                setBarcodeInput(detectedRawValue);
                setBarcodeScannerState('detected');
                console.log('BARKOD_OKUNDU', {
                  type: String(detections[0]?.format || 'unknown'),
                  data: detectedRawValue,
                });
                void handleLookupBarcode(detectedRawValue, true);

                window.setTimeout(() => {
                  if (lastDetectedBarcodeRef.current === detectedRawValue) {
                    lastDetectedBarcodeRef.current = '';
                  }
                }, BARCODE_SCAN_COOLDOWN_MS);
              }
            }
          }
        } catch {
          if (isBarcodeLoopActiveRef.current) {
            setBarcodeScannerState('error');
            setBarcodeScannerError('Barkod okunurken bir hata oluştu.');
            console.log('BARKOD_ARAMA_HATASI', { reason: 'scanner_detect_error' });
          }
        }

        if (isBarcodeLoopActiveRef.current) {
          barcodeScanRafRef.current = window.requestAnimationFrame(() => {
            void scanFrame();
          });
        }
      };

      barcodeScanRafRef.current = window.requestAnimationFrame(() => {
        void scanFrame();
      });
    } catch {
      setBarcodeScannerState('error');
      setBarcodeScannerError('Kamera erişimi sağlanamadı. Bilgisayarda webcam izinlerini kontrol edip tekrar deneyin.');
      console.log('BARKOD_KAMERA_HATASI', { reason: 'camera_start_failed' });
      stopBarcodeScanner();
    }
  };

  useEffect(() => {
    if (!showModal || addProductMode !== 'barcode' || Boolean(editingProduct)) {
      stopBarcodeScanner();
      return;
    }

    void startBarcodeScanner();
    return () => {
      stopBarcodeScanner();
    };
  }, [showModal, addProductMode, editingProduct]);

  useEffect(() => {
    return () => {
      stopBarcodeScanner();
      if (manualLookupDebounceRef.current !== null) {
        window.clearTimeout(manualLookupDebounceRef.current);
        manualLookupDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (
      !showModal ||
      addProductMode !== 'barcode' ||
      Boolean(editingProduct) ||
      !isManualBarcodeInputOpen
    ) {
      if (manualLookupDebounceRef.current !== null) {
        window.clearTimeout(manualLookupDebounceRef.current);
        manualLookupDebounceRef.current = null;
      }
      return;
    }

    const normalized = normalizeBarcodeInput(barcodeInput || '').replace(/\D/g, '');
    if (!normalized) {
      if (manualLookupDebounceRef.current !== null) {
        window.clearTimeout(manualLookupDebounceRef.current);
        manualLookupDebounceRef.current = null;
      }
      return;
    }

    const validation = validateBarcodeInput(normalized);
    if (!validation.isValid) {
      return;
    }

    if (manualLookupDebounceRef.current !== null) {
      window.clearTimeout(manualLookupDebounceRef.current);
    }

    manualLookupDebounceRef.current = window.setTimeout(() => {
      void handleLookupBarcode(normalized, false);
    }, 550);

    return () => {
      if (manualLookupDebounceRef.current !== null) {
        window.clearTimeout(manualLookupDebounceRef.current);
        manualLookupDebounceRef.current = null;
      }
    };
  }, [showModal, addProductMode, editingProduct, isManualBarcodeInputOpen, barcodeInput]);

  useEffect(() => {
    if (!isAddProductMenuOpen) return;

    const closeMenu = () => handleCloseAddProductMenu();
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);

    return () => {
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [isAddProductMenuOpen]);

  const handleEdit = (product: Product) => {
    const parsed = parseDescriptionWithMeta(product.description || '');
    const parsedMetaRaw = parsed.meta || {};
    const { compareAtPrice: _deprecatedCompareAtPrice, ...parsedMeta } = parsedMetaRaw as any;
    const resolvedCategoryInput = product.category;

    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: resolvedCategoryInput,
      price: String(product.price),
      unit: String(product.unit || '').trim() === 'g' ? 'gr' : product.unit,
      stock: String(product.stock),
      status: product.status,
      description: parsed.cleanDescription || '',
    });

    setMetaData({
      ...emptyMeta,
      ...parsedMeta,
      tags: Array.isArray(parsedMeta.tags) ? parsedMeta.tags : [],
      highlights: Array.isArray(parsedMeta.highlights) ? parsedMeta.highlights : [],
      specs: Array.isArray(parsedMeta.specs) ? parsedMeta.specs : [],
      netWeightValue:
        typeof parsedMeta.netWeightValue === 'number' && Number.isFinite(parsedMeta.netWeightValue)
          ? Number(parsedMeta.netWeightValue)
          : 1,
      netWeightUnit: String(parsedMeta.netWeightUnit || product.unit || emptyMeta.netWeightUnit || 'kg').trim() === 'g'
        ? 'gr'
        : String(parsedMeta.netWeightUnit || product.unit || emptyMeta.netWeightUnit || 'kg'),
    });
    const resolvedFeatureRows = metaToFeaturesInput(parsedMeta as ProductMetaV1)
      .split('\n')
      .map((line) => String(line || '').trim())
      .filter(Boolean);
    setFeatureRows([...resolvedFeatureRows, '']);

    const resolvedSubCategoryId = String(product.sub_category_id || '').trim();
    const selectedSubCategory = vendorSubCategoryOptions.find((item) => String(item.id) === resolvedSubCategoryId);
    const fallbackSubCategory = vendorSubCategoryOptions.find(
      (item) => normalizeSearchText(item.name) === normalizeSearchText(String(product.sub_category_name || ''))
    );
    const effectiveSubCategory = selectedSubCategory || fallbackSubCategory;

    setSelectedCategoryId(String(effectiveSubCategory?.categoryId || product.category_id || ''));
    setSelectedSubCategoryId(String(effectiveSubCategory?.id || resolvedSubCategoryId || ''));

    setImages(urlsToImageItems(product.images || []));
    setAddProductMode('manual');
    setFormErrors({});
    setFormNotice(null);
    setShowModal(true);
  };

  const handleOpenDuplicateBarcodeProduct = async () => {
    const productId = String(duplicateBarcodePrompt.productId || '').trim();
    if (!productId) {
      setDuplicateBarcodePrompt({ visible: false, productId: '', message: '' });
      return;
    }

    const localProduct = products.find((item) => String(item.id) === productId);
    if (localProduct) {
      setDuplicateBarcodePrompt({ visible: false, productId: '', message: '' });
      handleEdit(localProduct);
      return;
    }

    try {
      const productResponse = await productsAPI.getById(productId);
      const productData = productResponse?.data?.data as Product | undefined;
      if (productData?.id) {
        setDuplicateBarcodePrompt({ visible: false, productId: '', message: '' });
        handleEdit(productData);
      }
    } catch {
      setNotice({ type: 'error', text: 'Mevcut ürün bilgisi yüklenemedi. Lütfen tekrar deneyin.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu ürünü silmek istediğinizden emin misiniz?')) return;

    try {
      await productsAPI.delete(id);
      setNotice({ type: 'success', text: 'Ürün silindi.' });
      fetchProducts();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Silme işlemi başarısız';
      setNotice({ type: 'error', text: msg });
      alert(msg);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setNotice(null);
      setFormNotice(null);
      setFormErrors({});

      const priceValue = parseNumberInput(formData.price);
      const stockValue = parseNumberInput(formData.stock);
      const nextErrors: FormErrors = {};

      const normalizedName = formData.name.trim().toLocaleLowerCase('tr-TR');
      const duplicateName = products.some((product) => {
        if (editingProduct && product.id === editingProduct.id) return false;
        return String(product.name || '').trim().toLocaleLowerCase('tr-TR') === normalizedName;
      });

      const selectedSubCategory = activeSubCategoryOptions.find(
        (item) => String(item.id) === String(selectedSubCategoryId)
      );
      const fallbackSubCategory = selectedSubCategory || activeSubCategoryOptions[0];
      const resolvedSubCategoryId = String(fallbackSubCategory?.id || '').trim();
      const payloadCategoryId = String(fallbackSubCategory?.categoryId || '').trim();
      const resolvedCategoryName = String(fallbackSubCategory?.categoryName || '').trim();
      const resolvedSubCategoryName = String(fallbackSubCategory?.name || '').trim();

      if (!resolvedSubCategoryId) {
        nextErrors.subCategory = activeSubCategoryOptions.length > 0
          ? 'Alt kategori secimi zorunludur.'
          : 'Alt kategori bulunamadi. Lutfen once kategori/alt kategori tanimlarini kontrol edin.';
      }

      if (!Number.isFinite(priceValue) || priceValue <= 0) {
        nextErrors.price = 'Bu alan doldurulmalı ve fiyat 0\'dan büyük olmalıdır.';
      }
      if (!Number.isFinite(stockValue) || stockValue < 0) {
        nextErrors.stock = 'Bu alan doldurulmalı ve stok 0 veya daha büyük olmalıdır.';
      }
      if (!formData.name.trim() || formData.name.trim().length < 3) {
        nextErrors.name = 'Bu alan doldurulmalı (en az 3 karakter).';
      } else if (duplicateName) {
        nextErrors.name = 'Bu isimde ürün zaten var. Lütfen farklı bir ürün adı girin.';
      }
      const normalizedUnit = formData.unit.trim() === 'g' ? 'gr' : formData.unit.trim();
      if (!UNIT_PRESET_SET.has(normalizedUnit)) {
        nextErrors.unit = 'Bu alan doldurulmalı. Geçerli bir birim seçin.';
      }
      const netWeightValue = Number(metaData.netWeightValue);
      if (!Number.isFinite(netWeightValue) || netWeightValue <= 0) {
        nextErrors.netWeight = 'Bu alan doldurulmalı. Miktar 0\'dan büyük olmalıdır.';
      }

      const barcodeValidation = validateBarcodeInput(metaData.barcode || '');
      const barcodeShouldBeRequired =
        addProductMode === 'barcode' || barcodeLookupContext.barcodeLookupStatus !== 'manual';

      if (barcodeShouldBeRequired && !barcodeValidation.normalizedBarcode) {
        nextErrors.barcode = 'Barkod zorunludur. Lütfen barkod bilgisini girin.';
      } else if (barcodeValidation.normalizedBarcode && !barcodeValidation.isValid) {
        nextErrors.barcode = BARCODE_INVALID_MESSAGE;
      }

      if (Object.keys(nextErrors).length > 0) {
        setFormErrors(nextErrors);
        setFormNotice({ type: 'error', text: 'Lütfen zorunlu alanları kontrol edin.' });
        return;
      }

      const uploadedImageUrls: string[] = [];
      const hasAtLeastOneImage = images.length > 0;
      if (!hasAtLeastOneImage) {
        setFormErrors((prev) => ({ ...prev, images: 'Bu alan doldurulmalı. En az 1 ürün görseli yükleyin.' }));
        setFormNotice({ type: 'error', text: 'Lütfen zorunlu alanları kontrol edin.' });
        return;
      }

      const finalDescription = buildDescriptionWithMeta(formData.description, {
        ...metaData,
        brand: String(metaData.brand || '').trim(),
        netWeightValue,
        netWeightUnit: String(metaData.netWeightUnit || normalizedUnit || 'kg').trim() === 'g'
          ? 'gr'
          : String(metaData.netWeightUnit || normalizedUnit || 'kg').trim(),
        tags: Array.from(new Set((metaData.tags || []).map((tag) => tag.trim()).filter(Boolean))),
        highlights: Array.from(
          new Set(
            featureRows
              .map((line) => String(line || '').trim())
              .filter(Boolean)
          )
        ),
        specs: rowsToFeatureSpecs(featureRows),
      });

      const normalizedStatus: Product['status'] = formData.status === 'inactive' ? 'inactive' : 'active';

      const basePayload: {
        name: string;
        category: string;
        unit: string;
        status: Product['status'];
        price: number;
        stock: number;
        description: string;
        barcode?: string;
        source?: BarcodeProductSource;
        barcodeLookupStatus?: BarcodeLookupStatus;
        suggestedCategory?: string;
        categoryConfidence?: number;
        matchedKeywords?: string[];
        categoryId?: string;
        subCategoryId?: string;
        subCategoryName?: string;
      } = {
        name: formData.name.trim(),
        category: resolvedCategoryName,
        unit: normalizedUnit,
        status: normalizedStatus,
        price: priceValue,
        stock: Math.trunc(stockValue),
        description: finalDescription,
        source: barcodeLookupContext.source,
        barcodeLookupStatus: barcodeLookupContext.barcodeLookupStatus,
        suggestedCategory: barcodeLookupContext.suggestedCategory || undefined,
        categoryConfidence:
          barcodeLookupContext.confidence > 0 ? Number(barcodeLookupContext.confidence.toFixed(2)) : undefined,
        matchedKeywords:
          barcodeLookupContext.matchedKeywords.length > 0
            ? barcodeLookupContext.matchedKeywords
            : undefined,
      };

      if (barcodeValidation.normalizedBarcode) basePayload.barcode = barcodeValidation.normalizedBarcode;
      if (payloadCategoryId) basePayload.categoryId = payloadCategoryId;
      if (resolvedSubCategoryId) basePayload.subCategoryId = resolvedSubCategoryId;
      if (resolvedSubCategoryName) basePayload.subCategoryName = resolvedSubCategoryName;

      if (payloadCategoryId && payloadCategoryId !== selectedCategoryId) {
        setSelectedCategoryId(payloadCategoryId);
      }
      if (resolvedSubCategoryId && resolvedSubCategoryId !== selectedSubCategoryId) {
        setSelectedSubCategoryId(resolvedSubCategoryId);
      }

      if (editingProduct) {
        const editingSnapshot = editingProduct;
        const editingId = String(editingSnapshot.id || '').trim();
        const previewUrlsToRevoke: string[] = [];
        const optimisticImageUrls = images
          .map((item) => {
            if (item.kind === 'url') return item.url;
            const previewUrl = URL.createObjectURL(item.file);
            previewUrlsToRevoke.push(previewUrl);
            return previewUrl;
          })
          .filter(Boolean);

        const optimisticProduct: Product = {
          ...editingSnapshot,
          ...basePayload,
          status: normalizedStatus,
          category_id: payloadCategoryId || editingSnapshot.category_id,
          sub_category_id: resolvedSubCategoryId || editingSnapshot.sub_category_id,
          sub_category_name: resolvedSubCategoryName || editingSnapshot.sub_category_name,
          images: optimisticImageUrls.length > 0 ? optimisticImageUrls : editingSnapshot.images,
          image_url:
            optimisticImageUrls[0] ||
            editingSnapshot.image_url ||
            (Array.isArray(editingSnapshot.images) ? editingSnapshot.images[0] : undefined),
        };

        if (editingId) {
          setProcessingProductIds((prev) => Array.from(new Set([...prev, editingId])));
        }

        setProducts((prev) => prev.map((item) => (item.id === editingSnapshot.id ? optimisticProduct : item)));
        setNotice({ type: 'success', text: 'Ürün güncellendi, arka planda işleniyor...' });
        setFormNotice({ type: 'success', text: 'Ürün güncellendi, arka planda işleniyor...' });

        setShowModal(false);
        resetForm();
        setFormErrors({});
        setCategoryFilter('');
        setStatusFilter('all');
        setSortBy('newest');
        setSearch('');

        void (async () => {
          try {
            for (const item of images) {
              if (item.kind === 'url') {
                uploadedImageUrls.push(item.url);
              } else {
                const url = await productsAPI.uploadImageUrl(item.file);
                uploadedImageUrls.push(url);
              }
            }

            const payload = {
              ...basePayload,
              images: uploadedImageUrls,
            };

            const response = await productsAPI.update(editingSnapshot.id, payload);
            const updatedProduct = response?.data?.data as Product | undefined;

            if (updatedProduct?.id) {
              setProducts((prev) => prev.map((item) => (item.id === updatedProduct.id ? updatedProduct : item)));
            }

            setNotice({ type: 'success', text: 'Ürün güncellemesi tamamlandı.' });
            void fetchProducts({ background: true });
          } catch (backgroundErr: any) {
            const data = backgroundErr?.response?.data;
            const serverMessage = data?.detail || data?.message || 'Urun guncelleme islemi basarisiz oldu';
            const zodMessages = Array.isArray(data?.errors)
              ? data.errors.map((item: any) => item?.message).filter(Boolean).join(' ')
              : '';
            const combined = zodMessages ? `${serverMessage}: ${zodMessages}` : serverMessage;

            setProducts((prev) => prev.map((item) => (item.id === editingSnapshot.id ? editingSnapshot : item)));
            setNotice({ type: 'error', text: combined });
          } finally {
            previewUrlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
            if (editingId) {
              setProcessingProductIds((prev) => prev.filter((id) => id !== editingId));
            }
          }
        })();

        return;
      } else {
        const tempId = `temp-${Date.now()}`;
        const firstImage = images[0];
        const previewImage = firstImage
          ? firstImage.kind === 'url'
            ? firstImage.url
            : URL.createObjectURL(firstImage.file)
          : undefined;

        const optimisticProduct: Product = {
          id: tempId,
          vendor_id: '',
          category_id: payloadCategoryId,
          sub_category_id: resolvedSubCategoryId,
          sub_category_name: resolvedSubCategoryName,
          name: String(basePayload.name || '').trim(),
          category: resolvedSubCategoryName || resolvedCategoryName,
          price: Number(basePayload.price || 0),
          unit: String(basePayload.unit || ''),
          stock: Number(basePayload.stock || 0),
          status: String(basePayload.status || 'active') === 'inactive' ? 'inactive' : 'active',
          approval_status: 'PENDING',
          processing_status: 'processing',
          description: finalDescription,
          image_url: previewImage,
          images: previewImage ? [previewImage] : [],
          created_at: new Date().toISOString(),
        };

        setProducts((prev) => [optimisticProduct, ...prev]);
        setNotice({ type: 'success', text: 'Ürün eklendi, arka planda işleniyor...' });
        setFormNotice({ type: 'success', text: 'Ürün eklendi, arka planda işleniyor...' });

        setShowModal(false);
        resetForm();
        setFormErrors({});
        setCategoryFilter('');
        setStatusFilter('all');
        setSortBy('newest');
        setSearch('');

        void (async () => {
          try {
            const pendingImages: PendingCreateImage[] = await Promise.all(
              images.map(async (item) => {
                if (item.kind === 'url') {
                  return { kind: 'url' as const, url: item.url };
                }

                const contentBase64 = await fileToBase64(item.file);
                return {
                  kind: 'file' as const,
                  name: item.file.name,
                  type: item.file.type,
                  contentBase64,
                };
              })
            );

            const payload = {
              ...basePayload,
              images: [],
            };

            const queueJob: PendingCreateJob = {
              tempId,
              payload,
              images: pendingImages,
              optimisticProduct,
              createdAt: new Date().toISOString(),
            };

            upsertPendingCreateJob(queueJob);
            void runPendingCreateJob(queueJob);
          } catch (backgroundErr: any) {
            const data = backgroundErr?.response?.data;
            const serverMessage = data?.detail || data?.message || 'Urun olusturma islemi basarisiz oldu';
            const zodMessages = Array.isArray(data?.errors)
              ? data.errors.map((item: any) => item?.message).filter(Boolean).join(' ')
              : '';
            const combined = zodMessages ? `${serverMessage}: ${zodMessages}` : serverMessage;

            setProducts((prev) => prev.filter((item) => item.id !== tempId));
            setNotice({ type: 'error', text: combined });
            setFormNotice({ type: 'error', text: combined });
          } finally {
            if (firstImage && firstImage.kind === 'file' && previewImage) {
              URL.revokeObjectURL(previewImage);
            }
          }
        })();

        return;
      }
    } catch (err: any) {
      const data = err?.response?.data;
      const serverMessage = data?.detail || data?.message || 'İşlem başarısız';
      const zodMessages = Array.isArray(data?.errors)
        ? data.errors.map((item: any) => item?.message).filter(Boolean).join(' ')
        : '';
      const combined = zodMessages ? `${serverMessage}: ${zodMessages}` : serverMessage;
      const normalized = String(combined || '').toLocaleLowerCase('tr-TR');
      if (
        normalized.includes('zaten var') ||
        normalized.includes('already exists') ||
        normalized.includes('unique') ||
        normalized.includes('p2002')
      ) {
        if (normalized.includes('barkod')) {
          setFormErrors((prev) => ({ ...prev, barcode: BARCODE_ALREADY_EXISTS_MESSAGE }));
        } else {
          setFormErrors((prev) => ({ ...prev, name: 'Bu isimde ürün zaten var. Lütfen farklı bir ürün adı girin.' }));
        }
      }
      setNotice({ type: 'error', text: combined });
      setFormNotice({ type: 'error', text: combined });
    } finally {
      setSaving(false);
    }
  };

  const toggleRowSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = filteredProducts.map((product) => product.id);
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds(Array.from(new Set([...selectedIds, ...filteredProducts.map((product) => product.id)])));
  };

  const handleBulkStatus = async (nextStatus: 'active' | 'inactive') => {
    if (selectedIds.length === 0 || bulkWorking) return;

    const selectedProducts = products.filter((product) => selectedIds.includes(product.id));
    if (selectedProducts.length === 0) return;

    setBulkWorking(true);
    try {
      await Promise.all(
        selectedProducts.map((product) =>
          productsAPI.update(product.id, createUpdatePayload(product, { status: nextStatus }))
        )
      );
      setNotice({ type: 'success', text: `${selectedProducts.length} ürün durumu güncellendi.` });
      await fetchProducts();
    } catch {
      setNotice({ type: 'error', text: 'Toplu durum güncellemesi sırasında hata oluştu.' });
    } finally {
      setBulkWorking(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || bulkWorking) return;
    if (!window.confirm(`${selectedIds.length} ürün kalıcı olarak silinsin mi?`)) return;

    setBulkWorking(true);
    try {
      await Promise.all(selectedIds.map((id) => productsAPI.delete(id)));
      setNotice({ type: 'success', text: `${selectedIds.length} ürün silindi.` });
      await fetchProducts();
    } catch {
      setNotice({ type: 'error', text: 'Toplu silme sırasında hata oluştu.' });
    } finally {
      setBulkWorking(false);
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-text-secondary">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="seller-page-title">Ürünler</h1>
          <p className="seller-page-subtitle mt-1">Ürün ekleme ve yönetim alanı</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchProducts({ background: true })}
            disabled={listRefreshing || loading || saving}
            className="seller-btn-outline px-4 py-2 disabled:opacity-60"
          >
            Yenile
          </button>
          <DropdownMenu
            open={isAddProductMenuOpen}
            onOpenChange={(open) => {
              if (open) {
                handleOpenAddProductMenu();
                return;
              }
              handleCloseAddProductMenu();
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="seller-btn-primary px-4 py-2 font-semibold"
                aria-haspopup="menu"
                aria-expanded={isAddProductMenuOpen}
              >
                Yeni Ürün Ekle
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="end"
              sideOffset={10}
              collisionPadding={12}
              className="w-52 rounded-xl border border-black/10 bg-white p-1.5 text-text-primary shadow-[0_18px_40px_-22px_rgba(15,23,42,0.45),0_10px_22px_-16px_rgba(15,23,42,0.35)]"
            >
              <DropdownMenuItem
                className="min-h-10 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-colors data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary"
                onSelect={(event) => {
                  event.preventDefault();
                  handleSelectAddMethod('barcode');
                }}
              >
                Barkod ile ekle
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-1 my-1 h-px bg-black/5" />
              <DropdownMenuItem
                className="min-h-10 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-colors data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary"
                onSelect={(event) => {
                  event.preventDefault();
                  handleSelectAddMethod('manual');
                }}
              >
                Elle ekle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {notice && (
        <div className={`seller-surface p-3 text-sm ${notice.type === 'success' ? 'text-success' : 'text-error'}`}>
          {notice.text}
        </div>
      )}

      {error && <div className="bg-error/5 border border-error/40 rounded-xl p-4 text-error">{error}</div>}

      {listRefreshing && products.length > 0 && (
        <div className="seller-surface p-3 text-sm text-text-secondary flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          Ürünler güncelleniyor...
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary">Toplam Ürün</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{stats.total}</p>
        </div>
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary">Aktif Ürün</p>
          <p className="text-2xl font-bold text-success mt-1">{stats.active}</p>
        </div>
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary">Düşük Stok</p>
          <p className="text-2xl font-bold text-error mt-1">{stats.lowStock}</p>
        </div>
        <div className="seller-surface p-4">
          <p className="text-xs text-text-secondary">Ortalama Fiyat</p>
          <p className="text-2xl font-bold text-text-primary mt-1">₺{toFixedCurrency(stats.averagePrice)}</p>
        </div>
      </div>

      <div className="seller-surface p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Ürün ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="seller-input"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="seller-input"
            disabled={categoriesLoading || categoryFilterOptions.length === 0}
          >
            <option value="">Tüm Kategoriler</option>
            {categoryFilterOptions.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive' | 'processing' | 'failed')}
            className="seller-input"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
            <option value="processing">İşleniyor</option>
            <option value="failed">İşleme Hatası</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="seller-input">
            <option value="newest">Sıralama: En Yeni</option>
            <option value="name-asc">İsme Göre (A-Z)</option>
            <option value="price-asc">Fiyat (Artan)</option>
            <option value="price-desc">Fiyat (Azalan)</option>
            <option value="stock-asc">Stok (Artan)</option>
            <option value="stock-desc">Stok (Azalan)</option>
          </select>
          <div className="seller-surface-muted px-3 py-2.5 text-sm text-text-secondary flex items-center justify-center">
            {filteredProducts.length} ürün gösteriliyor
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={toggleSelectAllVisible} className="seller-btn-outline px-3 py-1.5 text-sm">
            {allVisibleSelected ? 'Görünendeki Seçimi Kaldır' : 'Görünenleri Seç'}
          </button>
          <button
            type="button"
            onClick={() => handleBulkStatus('active')}
            disabled={selectedIds.length === 0 || bulkWorking}
            className="seller-btn-outline px-3 py-1.5 text-sm disabled:opacity-60"
          >
            Seçilenleri Aktifleştir
          </button>
          <button
            type="button"
            onClick={() => handleBulkStatus('inactive')}
            disabled={selectedIds.length === 0 || bulkWorking}
            className="seller-btn-outline px-3 py-1.5 text-sm disabled:opacity-60"
          >
            Seçilenleri Pasifleştir
          </button>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={selectedIds.length === 0 || bulkWorking}
            className="inline-flex items-center justify-center rounded-lg border border-error/25 bg-error/5 px-3 py-1.5 text-sm font-medium text-error hover:bg-error/10 disabled:opacity-60"
          >
            Seçilenleri Sil
          </button>
          <span className="text-xs text-text-secondary ml-auto">Seçili: {selectedIds.length}</span>
        </div>
      </div>

      <div className="seller-surface overflow-hidden relative">
        {listRefreshing && products.length > 0 && (
          <div className="absolute inset-0 bg-white/50 z-10 pointer-events-none flex items-center justify-center">
            <div className="inline-flex items-center gap-2 text-sm text-text-secondary bg-white/90 px-3 py-2 rounded-lg border border-black/10">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              Güncelleniyor...
            </div>
          </div>
        )}
        {filteredProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background/60">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Ürün</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Kategori</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Fiyat</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Birim</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Stok</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Durum</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((product) => {
                  const parsed = parseDescriptionWithMeta(product.description);
                  const resolvedCategoryName = resolveProductSubCategoryName(product);
                  const processingStatus = resolveProcessingStatus(product);
                  const isProcessing = processingStatus === 'processing';
                  const unitLabel = formatNetWeightLabel(parsed.meta, product.unit);
                  const stockUnit = String(product.unit || '').trim();
                  const isOutOfStock = Number(product.stock || 0) <= 0;
                  return (
                    <tr key={product.id} className="hover:bg-background-cream/50 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(product.id)}
                          onChange={() => toggleRowSelection(product.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          {product.images && product.images.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImageUrl(product.images?.[0] || null)}
                              className="w-12 h-12 rounded-lg bg-white p-1 border border-primary/20 overflow-hidden"
                              title="Büyük gör"
                            >
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-full h-full object-contain"
                              />
                            </button>
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-[10px] text-text-secondary border border-gray-light">
                              Görsel Yok
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-text-primary">{product.name}</div>
                            {parsed.cleanDescription && (
                              <div className="text-sm text-text-secondary">{parsed.cleanDescription.substring(0, 80)}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">{resolvedCategoryName}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-text-primary">₺{toFixedCurrency(product.price)}</div>
                        {product.discount_price && (
                          <div className="text-xs text-primary">₺{toFixedCurrency(product.discount_price)} indirimli</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">{unitLabel || '-'}</td>
                      <td className="px-4 py-3">
                        <div className={`text-sm font-medium ${isOutOfStock || product.stock <= LOW_STOCK_LEVEL ? 'text-error' : 'text-text-primary'}`}>
                          {product.stock}{stockUnit ? ` / ${stockUnit}` : ''}
                        </div>
                        {isOutOfStock ? <div className="text-xs text-error font-semibold mt-1">Stok Bitti</div> : null}
                      </td>
                      <td className="px-4 py-3">
                        {isProcessing ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-warning/10 text-warning inline-flex items-center gap-1">
                            <span className="inline-block h-2.5 w-2.5 rounded-full border border-warning border-t-transparent animate-spin" />
                            İşleniyor
                          </span>
                        ) : processingStatus === 'failed' ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-error/10 text-error inline-flex items-center gap-1">
                            İşleme Hatası
                          </span>
                        ) : (
                          <span className={`px-2 py-1 text-xs rounded-full ${product.status === 'active' ? 'bg-success/10 text-success' : 'bg-gray-100 text-text-primary'}`}>
                            {product.status === 'active' ? 'Aktif' : 'Pasif'}
                          </span>
                        )}
                        {String(product.approval_status || '').toUpperCase() === 'REJECTED' && product.rejection_reason && (
                          <div className="mt-1 text-xs text-error max-w-[18rem] break-words">
                            Red nedeni: {product.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => handleEdit(product)} disabled={isProcessing} className="text-info hover:text-blue-800 text-sm font-semibold disabled:opacity-60">
                          Düzenle
                        </button>
                        <button onClick={() => handleDelete(product.id)} disabled={isProcessing} className="text-error hover:text-error text-sm font-semibold disabled:opacity-60">
                          Sil
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-text-secondary">
            <p className="text-lg">Filtreye uygun ürün bulunmuyor</p>
            <button onClick={() => beginCreate('manual')} className="mt-4 text-primary hover:text-primary-700">
              İlk ürününüzü ekleyin
            </button>
          </div>
        )}
      </div>

      {previewImageUrl && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-text-primary border border-black/10"
              title="Kapat"
            >
              ✕
            </button>
            <img
              src={previewImageUrl}
              alt="Ürün görseli"
              className="w-full max-h-[80vh] object-contain rounded-xl bg-white p-3"
            />
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="seller-surface-solid max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold">{editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}</h2>
              <button onClick={() => setShowModal(false)} className="text-text-secondary hover:text-text-primary">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formNotice && (
                <div className={`seller-surface p-3 text-sm ${formNotice.type === 'success' ? 'text-success' : 'text-error'}`}>
                  {formNotice.text}
                </div>
              )}

              {qualityRejectedHintVisible && (
                <div className="seller-surface p-3 text-sm text-warning border border-warning/30 bg-warning/5">
                  Bu urun pasif durumda. Fotograf kalite nedeniyle kabul edilmedi olabilir. Lutfen yeni ve daha net bir fotograf yukleyip tekrar kaydedin.
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div className="seller-surface p-4 space-y-4">
                  {addProductMode === 'barcode' && !editingProduct && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-text-primary">Barkodu okut</h3>
                      <p className="text-xs text-text-secondary">
                        Kamerayı ürün barkoduna doğrultun. Barkod okununca ürün bilgileri otomatik getirilsin.
                      </p>

                      <div className="seller-surface-muted border border-black/10 rounded-xl p-3 space-y-2">
                        <div className="relative w-full overflow-hidden rounded-lg bg-black/90 aspect-[16/9]">
                          {isBarcodeCameraActive ? (
                            <video
                              ref={barcodeVideoRef}
                              className="w-full h-full object-cover"
                              autoPlay
                              muted
                              playsInline
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-white/80 px-3 text-center">
                              Kamera hazır olduğunda barkod alanı burada görünecek.
                            </div>
                          )}

                          <div className="absolute left-2 right-2 bottom-2 rounded-md bg-black/60 text-white text-[11px] px-2 py-1">
                            {getScannerStateText(barcodeScannerState)}
                          </div>
                        </div>

                        {barcodeScannerError && <p className="text-xs text-error">{barcodeScannerError}</p>}

                        {!isBarcodeCameraActive && (
                          <button
                            type="button"
                            onClick={() => {
                              void startBarcodeScanner();
                            }}
                            className="seller-btn-outline px-3 py-1.5 text-xs"
                          >
                            Kamerayı başlat
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsManualBarcodeInputOpen((prev) => !prev)}
                        className="text-xs text-primary hover:text-primary-700 font-medium"
                      >
                        Barkodu manuel girmek ister misiniz?
                      </button>

                      {isManualBarcodeInputOpen && (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={barcodeInput}
                            onChange={(e) => {
                              const normalized = normalizeBarcodeInput(e.target.value).replace(/\D/g, '');
                              setBarcodeInput(normalized);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleLookupBarcode();
                              }
                            }}
                            className="seller-input flex-1"
                            placeholder="Barkod numarası gir"
                            disabled={isBarcodeLookupLoading || saving}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              void handleLookupBarcode();
                            }}
                            disabled={isBarcodeLookupLoading || saving || !String(barcodeInput || '').trim()}
                            className="seller-btn-outline px-4 py-2 min-w-[96px] disabled:opacity-60"
                          >
                            {isBarcodeLookupLoading ? (
                              <span className="inline-flex items-center gap-2">
                                <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-primary/35 border-t-primary animate-spin" />
                                Ürün aranıyor...
                              </span>
                            ) : (
                              'Ara'
                            )}
                          </button>
                        </div>
                      )}

                      <p className="text-[11px] text-text-secondary">
                        Desteklenen barkod tipleri: EAN-13, EAN-8, UPC-A, UPC-E, Code 128.
                      </p>

                      {barcodeLookupMessage && (
                        <p
                          className={`text-xs ${
                            barcodeLookupMessage.type === 'success'
                              ? 'text-success'
                              : barcodeLookupMessage.type === 'warning'
                                ? 'text-warning'
                                : barcodeLookupMessage.type === 'info'
                                  ? 'text-text-secondary'
                                  : 'text-error'
                          }`}
                        >
                          {barcodeLookupMessage.text}
                        </p>
                      )}

                      {duplicateBarcodePrompt.visible && (
                        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                          <p className="text-sm text-warning font-medium">{duplicateBarcodePrompt.message}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                void handleOpenDuplicateBarcodeProduct();
                              }}
                              className="seller-btn-primary px-3 py-1.5 text-xs"
                            >
                              Ürünü düzenle
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDuplicateBarcodePrompt({ visible: false, productId: '', message: '' })
                              }
                              className="seller-btn-outline px-3 py-1.5 text-xs"
                            >
                              Kapat
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <ProductImagesField
                      items={images}
                      onChange={setImages}
                      label="Ürün Görselleri"
                      helperText="İlk görsel vitrin görselidir."
                    />
                    {formErrors.images && <p className="text-error text-xs -mt-2">{formErrors.images}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Marka</label>
                    <input
                      type="text"
                      value={String(metaData.brand || '')}
                      onChange={(e) => setMetaData((prev) => ({ ...prev, brand: e.target.value }))}
                      className="seller-input"
                      placeholder="Orn: Eti, Pinar, Coca-Cola"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Barkod</label>
                    <input
                      type="text"
                      value={String(metaData.barcode || '')}
                      onChange={(e) => {
                        const normalized = normalizeBarcodeInput(e.target.value);
                        setMetaData((prev) => ({ ...prev, barcode: normalized }));
                        setBarcodeInput(normalized);
                        setFormErrors((prev) => ({ ...prev, barcode: undefined }));
                      }}
                      className="seller-input"
                      placeholder="Barkod (8, 12, 13 veya 14 hane)"
                      inputMode="numeric"
                    />
                    <p className="mt-1 text-xs text-text-secondary">
                      Barkodla ekleme akışında bu alan otomatik doldurulur ve kayıtta ürünle birlikte saklanır.
                    </p>
                    {formErrors.barcode && <p className="text-error text-xs mt-1">{formErrors.barcode}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Ürün Adı *</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} className="seller-input" />
                    {formErrors.name && <p className="text-error text-xs mt-1">{formErrors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Alt Kategori *</label>
                    {categoriesLoading ? (
                      <input
                        type="text"
                        value=""
                        readOnly
                        className="seller-input opacity-70"
                        placeholder="Alt kategoriler yukleniyor..."
                      />
                    ) : activeSubCategoryOptions.length > 0 ? (
                      <select
                        value={selectedSubCategoryId}
                        onChange={(e) => applySelectedSubCategory(String(e.target.value || ''))}
                        className="seller-input"
                        disabled={saving || categoriesLoading}
                      >
                        <option value="">Alt kategori secin</option>
                        {activeSubCategoryOptions.map((subCategory) => (
                          <option key={subCategory.id} value={subCategory.id}>{subCategory.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value=""
                        readOnly
                        className="seller-input opacity-70"
                        placeholder="Alt kategori listesi bulunamadi"
                      />
                    )}
                    {formErrors.subCategory && <p className="text-error text-xs mt-1">{formErrors.subCategory}</p>}
                    {barcodeLookupContext.barcodeLookupStatus === 'found' && barcodeLookupContext.suggestedCategory && (
                      <p className="text-xs text-text-secondary mt-1">
                        Kategori otomatik önerildi, kontrol edebilirsin: {barcodeLookupContext.suggestedCategory}
                      </p>
                    )}
                    {barcodeLookupContext.barcodeLookupStatus === 'found' &&
                      barcodeLookupContext.confidence > 0 &&
                      barcodeLookupContext.confidence < 0.65 && (
                        <p className="text-xs text-warning mt-1">
                          {BARCODE_LOW_CONFIDENCE_MESSAGE}
                        </p>
                      )}

                    <div className="mt-3 rounded-lg border border-black/10 bg-background/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-text-primary">Bu kategoride en çok satılan ürünler</p>
                        {smartSuggestionsLoading && (
                          <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-primary/35 border-t-primary animate-spin" />
                        )}
                      </div>

                      {smartSuggestions.length > 0 ? (
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {smartSuggestions.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => applySmartSuggestion(item)}
                              className="text-left rounded-lg border border-black/10 bg-white px-2.5 py-2 hover:border-primary/40 transition-colors"
                            >
                              <p className="text-xs font-medium text-text-primary line-clamp-1">{item.name}</p>
                              <p className="text-[11px] text-text-secondary mt-0.5">
                                {Number(item.soldCount || 0)} adet satildi
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        !smartSuggestionsLoading && (
                          <p className="text-[11px] text-text-secondary mt-2">
                            Bu kategori icin henuz yeterli satis verisi yok.
                          </p>
                        )
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">Birim *</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={metaData.netWeightValue ?? ''}
                          onChange={(e) => {
                            const nextRaw = e.target.value;
                            const next = Number(nextRaw.replace(',', '.'));
                            setMetaData((prev) => ({
                              ...prev,
                              netWeightValue: nextRaw.trim() === '' || Number.isNaN(next) ? undefined : next,
                            }));
                          }}
                          className="seller-input"
                          placeholder="Orn. 1 veya 500"
                        />
                        <select
                          value={String(metaData.netWeightUnit || formData.unit || '')}
                          onChange={(e) => {
                            const nextUnit = e.target.value;
                            setMetaData((prev) => ({ ...prev, netWeightUnit: nextUnit }));
                            setFormData((prev) => ({ ...prev, unit: nextUnit }));
                          }}
                          className="seller-input"
                        >
                          <option value="">Birim secin</option>
                          {UNIT_PRESETS.map((unit) => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                      <p className="mt-2 text-xs text-text-secondary">Musteride urun adi yaninda /miktar birim olarak gorunur (Orn: /1 kg).</p>
                      {(formErrors.netWeight || formErrors.unit) && (
                        <p className="text-error text-xs mt-1">{formErrors.netWeight || formErrors.unit}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">Fiyat (₺) *</label>
                      <input type="number" step="0.01" name="price" value={formData.price} onChange={handleChange} className="seller-input" />
                      {formErrors.price && <p className="text-error text-xs mt-1">{formErrors.price}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">Stok ve Birim *</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          name="stock"
                          value={formData.stock}
                          onChange={handleChange}
                          className="seller-input"
                          placeholder="Stok"
                        />
                        <select
                          name="unit"
                          value={formData.unit}
                          onChange={handleChange}
                          className="seller-input"
                        >
                          <option value="">Birim secin</option>
                          {UNIT_PRESETS.map((unit) => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                      {(formErrors.stock || formErrors.unit) && (
                        <p className="text-error text-xs mt-1">{formErrors.stock || formErrors.unit}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Urun Aciklamasi ve Ozellikler</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={4}
                      className="seller-textarea"
                      placeholder="Ürünün faydasını, kullanım şeklini ve öne çıkan farklarını yazın..."
                    />
                    <p className="text-xs text-text-secondary mt-1">{formData.description.length} karakter</p>

                    <div className="mt-3 space-y-2">
                      {featureRows.map((row, idx) => (
                        <div key={`feature-row-${idx}`} className="flex items-center gap-2">
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden="true" />
                          <input
                            type="text"
                            value={row}
                            onChange={(e) => updateFeatureRow(idx, e.target.value)}
                            className="seller-input flex-1"
                            placeholder="Ornek: Dogal, koruyucusuz, gunluk taze"
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
                </div>
              </div>

              <div className="seller-surface-muted p-3 text-sm text-text-secondary">
                Kalite kontrol: net açıklama ve doğru fiyat/stok bilgisi ürün performansını artırır.
              </div>

              <div className="flex justify-end space-x-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="seller-btn-outline px-6 py-2">İptal</button>
                <button type="submit" disabled={saving} className="seller-btn-primary px-6 py-2">
                  {editingProduct ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
