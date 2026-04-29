import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockGetAll = jest.fn();
const mockLookupBarcode = jest.fn();
const mockVendorCategories = jest.fn();

jest.mock('../../services/api.ts', () => ({
  productsAPI: {
    getAll: (...args) => mockGetAll(...args),
    lookupBarcode: (...args) => mockLookupBarcode(...args),
    create: jest.fn(),
    update: jest.fn(),
    uploadImageUrl: jest.fn(),
  },
  vendorAPI: {
    getCategories: (...args) => mockVendorCategories(...args),
  },
}));

jest.mock('../../context/AuthContext.tsx', () => ({
  useAuth: () => ({
    vendor: {
      id: 'vendor-user-1',
      email: 'vendor@demo.com',
      vendorProfile: { id: 'vendor-profile-1', businessType: 'market' },
    },
  }),
}));

jest.mock('../../context/SellerSearchContext.tsx', () => ({
  useSellerSearch: () => ({
    query: '',
    setQuery: jest.fn(),
  }),
}));

jest.mock('../../components/products/ProductImagesField.tsx', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-images-field">mock-images</div>,
  urlsToImageItems: (urls) => urls.map((url, index) => ({ id: `img-${index}`, previewUrl: url, sourceUrl: url })),
}));

jest.mock('../../components/ui/dropdown-menu.jsx', () => {
  const ReactLocal = require('react');
  const DropdownCtx = ReactLocal.createContext({
    open: false,
    setOpen: (_value) => {},
  });

  const DropdownMenu = ({ children }) => {
    const [open, setOpen] = ReactLocal.useState(false);
    const value = ReactLocal.useMemo(() => ({ open, setOpen }), [open]);
    return <DropdownCtx.Provider value={value}>{children}</DropdownCtx.Provider>;
  };

  const DropdownMenuTrigger = ({ children }) => {
    const { setOpen } = ReactLocal.useContext(DropdownCtx);
    if (ReactLocal.isValidElement(children)) {
      return ReactLocal.cloneElement(children, {
        onClick: (event) => {
          children.props?.onClick?.(event);
          setOpen(true);
        },
      });
    }
    return <button type="button" onClick={() => setOpen(true)}>{children}</button>;
  };

  const DropdownMenuContent = ({ children }) => {
    const { open } = ReactLocal.useContext(DropdownCtx);
    return open ? <div>{children}</div> : null;
  };

  const DropdownMenuItem = ({ children, onSelect }) => {
    const { setOpen } = ReactLocal.useContext(DropdownCtx);
    return (
      <button
        type="button"
        onClick={(event) => {
          onSelect?.(event);
          setOpen(false);
        }}
      >
        {children}
      </button>
    );
  };

  const DropdownMenuSeparator = () => <hr />;

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
  };
});

jest.mock('../../components/ui/dropdown-menu', () => {
  const ReactLocal = require('react');
  const DropdownCtx = ReactLocal.createContext({
    open: false,
    setOpen: (_value) => {},
  });

  const DropdownMenu = ({ children }) => {
    const [open, setOpen] = ReactLocal.useState(false);
    const value = ReactLocal.useMemo(() => ({ open, setOpen }), [open]);
    return <DropdownCtx.Provider value={value}>{children}</DropdownCtx.Provider>;
  };

  const DropdownMenuTrigger = ({ children }) => {
    const { setOpen } = ReactLocal.useContext(DropdownCtx);
    if (ReactLocal.isValidElement(children)) {
      return ReactLocal.cloneElement(children, {
        onClick: (event) => {
          children.props?.onClick?.(event);
          setOpen(true);
        },
      });
    }
    return <button type="button" onClick={() => setOpen(true)}>{children}</button>;
  };

  const DropdownMenuContent = ({ children }) => {
    const { open } = ReactLocal.useContext(DropdownCtx);
    return open ? <div>{children}</div> : null;
  };

  const DropdownMenuItem = ({ children, onSelect }) => {
    const { setOpen } = ReactLocal.useContext(DropdownCtx);
    return (
      <button
        type="button"
        onClick={(event) => {
          onSelect?.(event);
          setOpen(false);
        }}
      >
        {children}
      </button>
    );
  };

  const DropdownMenuSeparator = () => <hr />;

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
  };
});

const Products = require('../Products.tsx').default;

describe('Seller barcode add flow E2E (component)', () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalBarcodeDetector = window.BarcodeDetector;
  const originalPlay = HTMLMediaElement.prototype.play;
  const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    'readyState'
  );
  const originalRAF = window.requestAnimationFrame;
  const originalCancelRAF = window.cancelAnimationFrame;

  let mockLog;

  const mountProducts = async () => {
    render(<Products />);

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalled();
      expect(mockVendorCategories).toHaveBeenCalled();
    });

    const addButton = await screen.findByRole('button', { name: /yeni ürün ekle/i });
    fireEvent.click(addButton);
    fireEvent.click(await screen.findByText(/barkod ile ekle/i));
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    mockGetAll.mockResolvedValue({
      data: { data: { products: [] } },
    });

    mockVendorCategories.mockResolvedValue({
      data: {
        data: {
          categories: [
            {
              id: 'cat-1',
              name: 'İçecek',
              subCategories: [{ id: 'sub-1', name: 'Gazlı İçecek', slug: 'gazli-icecek' }],
            },
          ],
          isVendorManaged: true,
          storeType: 'market',
        },
      },
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: jest.fn().mockResolvedValue({
          getTracks: () => [{ stop: jest.fn() }],
        }),
      },
      configurable: true,
    });

    HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get: () => 4,
    });

    window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    window.cancelAnimationFrame = (id) => clearTimeout(id);

    let detectedOnce = false;
    window.BarcodeDetector = class {
      async detect() {
        if (!detectedOnce) {
          detectedOnce = true;
          return [{ rawValue: '3017620422003', format: 'ean_13' }];
        }
        return [];
      }
    };
  });

  afterEach(() => {
    mockLog.mockRestore();

    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      configurable: true,
    });

    window.BarcodeDetector = originalBarcodeDetector;
    HTMLMediaElement.prototype.play = originalPlay;
    if (originalReadyStateDescriptor) {
      Object.defineProperty(HTMLMediaElement.prototype, 'readyState', originalReadyStateDescriptor);
    }
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCancelRAF;
  });

  it('kamera->detect->backend->autofill akisini tamamlar', async () => {
    mockLookupBarcode.mockResolvedValue({
      data: {
        data: {
          found: true,
          source: 'open_food_facts',
          product: {
            barcode: '3017620422003',
            name: 'Nutella',
            brand: 'Ferrero',
            imageUrl: 'https://example.com/nutella.jpg',
            quantity: '1kg',
            category: 'Gazlı İçecek',
          },
        },
      },
    });

    await mountProducts();

    await waitFor(() => {
      expect(mockLookupBarcode).toHaveBeenCalledWith('3017620422003');
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nutella')).toBeInTheDocument();
      expect(screen.getByDisplayValue('kg')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Open Food Facts kaynağından bulundu\. Alanlar otomatik dolduruldu\./i)
    ).toBeInTheDocument();

    expect(mockLog).toHaveBeenCalledWith('BARKOD_EKRANI_ACILDI');
    expect(mockLog).toHaveBeenCalledWith(
      'BARKOD_OKUNDU',
      expect.objectContaining({ data: '3017620422003', type: 'ean_13' })
    );
    expect(mockLog).toHaveBeenCalledWith(
      'BARKOD_BACKENDE_GONDERILIYOR',
      expect.objectContaining({ barcode: '3017620422003', fromCamera: true })
    );
    expect(mockLog).toHaveBeenCalledWith('BARKOD_API_RESPONSE', expect.anything());
  });

  it('urun bulunamazsa manuel ekleme fallbackini gosterir', async () => {
    mockLookupBarcode.mockResolvedValue({
      data: {
        data: {
          found: false,
          source: 'open_food_facts',
          product: null,
        },
      },
    });

    await mountProducts();

    expect(
      await screen.findByText(/Ürün bulunamadı, manuel olarak devam edebilirsiniz\./i)
    ).toBeInTheDocument();

    const manualToggle = screen.getByRole('button', { name: /Barkodu manuel girmek ister misiniz/i });
    fireEvent.click(manualToggle);

    expect(screen.getByPlaceholderText(/Barkod numarası gir/i)).toBeInTheDocument();
    expect(mockLog).toHaveBeenCalledWith('BARKOD_API_RESPONSE', expect.anything());
  });
});
