import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useLocation, useNavigate } from 'react-router-dom';
import { ordersAPI, productsAPI, vendorAPI } from '../../services/api.ts';
import { Bell, Package, ReceiptText, Search } from 'lucide-react';
import { useSellerSearch } from '../../context/SellerSearchContext.tsx';

type TopbarProductSuggestion = {
  id: string;
  name: string;
  category?: string;
};

type TopbarOrderSuggestion = {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
};

interface TopbarProps {
  onMenuClick: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { query, setQuery } = useSellerSearch();
  const searchRef = React.useRef<HTMLFormElement | null>(null);
  const userMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = React.useState(false);
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [productSuggestions, setProductSuggestions] = React.useState<TopbarProductSuggestion[]>([]);
  const [orderSuggestions, setOrderSuggestions] = React.useState<TopbarOrderSuggestion[]>([]);

  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notifLoading, setNotifLoading] = React.useState(false);

  const fetchNotifications = React.useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await vendorAPI.getNotifications({ limit: 20 });
      const data = res.data?.data || res.data;
      const list = Array.isArray(data) ? data : [];
      setUnreadCount(list.filter((item) => !item?.isRead).length);
    } catch {
      // ignore - notifications are not critical
    } finally {
      setNotifLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  React.useEffect(() => {
    setShowSearchDropdown(false);
    setShowUserMenu(false);
  }, [location.pathname]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchNotifications();
    }, 30000);

    const handleWindowFocus = () => {
      void fetchNotifications();
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [fetchNotifications]);

  React.useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setSearchLoading(false);
      setProductSuggestions([]);
      setOrderSuggestions([]);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const [productsRes, ordersRes] = await Promise.all([
          productsAPI.getAll({ search: trimmedQuery, limit: 4 }),
          ordersAPI.getAll({ limit: 20 }),
        ]);

        if (cancelled) return;

        const products = productsRes?.data?.data?.products || [];
        const orders = ordersRes?.data?.data?.orders || [];
        const lowerQuery = trimmedQuery.toLocaleLowerCase('tr-TR');

        setProductSuggestions(
          products.slice(0, 4).map((product: any) => ({
            id: String(product.id),
            name: String(product.name || ''),
            category: String(product.category || ''),
          })),
        );

        setOrderSuggestions(
          orders
            .filter((order: any) => {
              const orderNumber = String(order.order_number || order.id || '').toLocaleLowerCase('tr-TR');
              const customerName = String(order.customer_info?.name || '').toLocaleLowerCase('tr-TR');
              const customerPhone = String(order.customer_info?.phone || '').toLocaleLowerCase('tr-TR');
              return (
                orderNumber.includes(lowerQuery) ||
                customerName.includes(lowerQuery) ||
                customerPhone.includes(lowerQuery)
              );
            })
            .slice(0, 4)
            .map((order: any) => ({
              id: String(order.id),
              orderNumber: String(order.order_number || String(order.id || '').slice(-6).toUpperCase()),
              customerName: String(order.customer_info?.name || 'Müşteri'),
              total: Number(order.total || 0),
            })),
        );
      } catch {
        if (!cancelled) {
          setProductSuggestions([]);
          setOrderSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
          setShowSearchDropdown(true);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const handleLogout = async () => {
    logout();
    navigate('/login');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const supportedPaths = ['/products', '/orders'];
    if (!supportedPaths.includes(location.pathname)) {
      navigate('/products');
    }

    setShowSearchDropdown(false);
  };

  const openProductsSearch = () => {
    navigate('/products');
    setShowSearchDropdown(false);
  };

  const openOrdersSearch = () => {
    navigate('/orders');
    setShowSearchDropdown(false);
  };

  const hasSuggestions = productSuggestions.length > 0 || orderSuggestions.length > 0;

  return (
    <header className="sticky top-0 z-40 border-b border-primary/10 shadow-[0_6px_18px_rgba(35,49,39,0.06)]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(251,248,242,0.92) 100%)', backdropFilter: 'blur(18px)' }}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center space-x-4 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden text-text-secondary hover:text-text-primary"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-semibold text-text-primary">{user?.full_name || 'Satıcı Paneli'}</h1>
            <p className="text-xs text-text-secondary">{user?.email}</p>
          </div>
        </div>

        <div className="hidden md:flex flex-1 px-6">
          <form ref={searchRef} onSubmit={handleSearchSubmit} className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              type="search"
              placeholder="Sipariş, ürün, müşteri ara…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (query.trim().length >= 2) {
                  setShowSearchDropdown(true);
                }
              }}
              className="w-full rounded-xl border border-black/10 bg-white pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />

            {showSearchDropdown && query.trim().length >= 2 && (
              <div className="absolute left-0 right-0 mt-2 overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-[0_18px_48px_rgba(35,49,39,0.12)]">
                {searchLoading ? (
                  <div className="px-4 py-4 text-sm text-text-secondary">Aranıyor...</div>
                ) : hasSuggestions ? (
                  <div className="max-h-[28rem] overflow-y-auto">
                    {productSuggestions.length > 0 && (
                      <div className="border-b border-black/5">
                        <div className="flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                          <Package className="h-4 w-4" />
                          Ürünler
                        </div>
                        {productSuggestions.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={openProductsSearch}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-background/70"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-text-primary">{product.name}</p>
                              <p className="truncate text-xs text-text-secondary">{product.category || 'Kategori belirtilmedi'}</p>
                            </div>
                            <span className="text-xs font-medium text-primary">Üründe aç</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {orderSuggestions.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                          <ReceiptText className="h-4 w-4" />
                          Siparişler
                        </div>
                        {orderSuggestions.map((order) => (
                          <button
                            key={order.id}
                            type="button"
                            onClick={openOrdersSearch}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-background/70"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-text-primary">#{order.orderNumber} • {order.customerName}</p>
                              <p className="truncate text-xs text-text-secondary">₺{order.total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <span className="text-xs font-medium text-primary">Siparişte aç</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-black/5 px-4 py-3 text-xs text-text-secondary">
                      <span>Daha fazla sonuç için Enter</span>
                      <span>Canlı öneriler aktif</span>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-4 text-sm text-text-secondary">Sonuç bulunamadı.</div>
                )}
              </div>
            )}
          </form>
        </div>

        <div className="flex items-center space-x-4">
          {/* User Menu */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 text-text-primary hover:text-primary rounded-xl"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold shadow-[0_6px_16px_rgba(10,92,54,0.2)]" style={{ background: 'linear-gradient(135deg, #0A5C36 0%, #0F7246 100%)' }}>
                  {user?.full_name?.charAt(0) || 'S'}
                </div>
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-error px-1.5 text-[10px] font-semibold leading-[18px] text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg py-2 z-20 border border-primary/10" style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)' }}>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/notifications');
                    }}
                    className="flex w-full items-center justify-between px-4 py-2 text-sm text-text-primary hover:bg-background"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Bildirimler
                    </span>
                    <span className="text-xs font-semibold text-error">
                      {notifLoading ? '...' : unreadCount > 0 ? `${unreadCount} yeni` : ''}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/profile');
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-background"
                  >
                    Ayarlar
                  </button>
                  <hr className="my-2" />
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-error hover:bg-error/5"
                  >
                    Çıkış Yap
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
