import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Sparkles,
  Truck,
  Target,
  Wallet,
  LineChart,
  Star,
  Store,
  HelpCircle,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { ordersAPI, productsAPI, reviewsAPI, vendorSupportAPI } from '../../services/api.ts';
import type { Order } from '../../types/index.ts';
import { hasPendingCustomerMessage } from '../../lib/sidebarBadgeState.ts';

type SidebarBadgeCounts = {
  orders: number;
  reviews: number;
  support: number;
};

type SidebarBadgeMessage = {
  senderRole?: 'CUSTOMER' | 'VENDOR' | 'ADMIN' | null;
  createdAt?: string | null;
};

type SidebarSupportConversation = {
  id: string;
  messages?: SidebarBadgeMessage[];
};

type SidebarReview = {
  vendorReply?: string | null;
};

const ORDER_ALERT_AUDIO_PATH = '/sounds/vendor-order-alert.mp3';
const ORDER_ALERT_LOOP_MS = 1600;

const EMPTY_BADGE_COUNTS: SidebarBadgeCounts = {
  orders: 0,
  reviews: 0,
  support: 0,
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, collapsed, onToggleCollapse }) => {
  const location = useLocation();
  const [badgeCounts, setBadgeCounts] = React.useState<SidebarBadgeCounts>(EMPTY_BADGE_COUNTS);
  const orderAlertAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const orderAlertTimerRef = React.useRef<number | null>(null);
  const orderAlertAudioContextRef = React.useRef<AudioContext | null>(null);
  const orderAlertSilencedOnOrdersRef = React.useRef(false);
  const isOrdersPage = location.pathname.startsWith('/orders');

  const dashboardItem = { path: '/dashboard', icon: LayoutDashboard, label: 'Kontrol Paneli' };

  const menuGroups = [
    {
      title: 'OPERASYON',
      items: [
        { path: '/orders', icon: ShoppingCart, label: 'Siparişler' },
        { path: '/products', icon: Package, label: 'Ürünler' },
        { path: '/products-advanced', icon: Sparkles, label: 'Özel Ürünler' },
        { path: '/campaigns', icon: Target, label: 'İndirim Kampanya' },
      ],
    },
    {
      title: 'TAKİP',
      items: [
        { path: '/payments', icon: Wallet, label: 'Ödemeler' },
        { path: '/analytics', icon: LineChart, label: 'Analitik' },
        { path: '/reviews', icon: Star, label: 'Yorumlar' },
        { path: '/support-messages', icon: HelpCircle, label: 'Destek Mesajları' },
      ],
    },
    {
      title: 'AYARLAR',
      items: [
        { path: '/magazam', icon: Store, label: 'Mağazam' },
        { path: '/help', icon: HelpCircle, label: 'Yardım' },
        { path: '/delivery-settings', icon: Truck, label: 'Teslimat Ayarları' },
        { path: '/profile', icon: Settings, label: 'Ayarlar' },
      ],
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  const getBadgeCount = React.useCallback((path: string) => {
    switch (path) {
      case '/orders':
        return badgeCounts.orders;
      case '/reviews':
        return badgeCounts.reviews;
      case '/support-messages':
        return badgeCounts.support;
      default:
        return 0;
    }
  }, [badgeCounts.orders, badgeCounts.reviews, badgeCounts.support]);

  const stopOrderAlert = React.useCallback(() => {
    if (orderAlertTimerRef.current !== null) {
      window.clearInterval(orderAlertTimerRef.current);
      orderAlertTimerRef.current = null;
    }

    const audio = orderAlertAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, []);

  const playSynthAlertBurst = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    if (!orderAlertAudioContextRef.current) {
      orderAlertAudioContextRef.current = new AudioContextCtor();
    }

    const context = orderAlertAudioContextRef.current;
    if (!context) {
      return;
    }

    const scheduleClick = (startDelaySec: number) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const now = context.currentTime + startDelaySec;

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(1800, now);
      oscillator.frequency.exponentialRampToValueAtTime(850, now + 0.06);

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.28, now + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.start(now);
      oscillator.stop(now + 0.1);
    };

    scheduleClick(0);
    scheduleClick(0.13);
  }, []);

  const startOrderAlert = React.useCallback(async () => {
    const ensureAudio = () => {
      if (orderAlertAudioRef.current) {
        return orderAlertAudioRef.current;
      }

      const audio = new Audio(ORDER_ALERT_AUDIO_PATH);
      audio.loop = true;
      audio.preload = 'auto';
      orderAlertAudioRef.current = audio;
      return audio;
    };

    const audio = ensureAudio();

    try {
      await audio.play();
      if (orderAlertTimerRef.current !== null) {
        window.clearInterval(orderAlertTimerRef.current);
        orderAlertTimerRef.current = null;
      }
    } catch {
      if (orderAlertTimerRef.current !== null) {
        return;
      }

      playSynthAlertBurst();
      orderAlertTimerRef.current = window.setInterval(() => {
        playSynthAlertBurst();
      }, ORDER_ALERT_LOOP_MS);
    }
  }, [playSynthAlertBurst]);

  React.useEffect(() => {
    let cancelled = false;

    const refreshBadgeCounts = async () => {
      try {
        const [ordersResponse, firstProductsResponse, supportResponse] = await Promise.all([
          ordersAPI.getAll(),
          productsAPI.getAll({ page: 1, limit: 100 }),
          vendorSupportAPI.listConversations(),
        ]);
        if (cancelled) {
          return;
        }

        const orders = Array.isArray(ordersResponse.data?.data?.orders) ? ordersResponse.data.data.orders : [];
        const orderCount = orders.filter((order: Order) => order.status === 'pending').length;

        const firstProductsPayload = firstProductsResponse?.data?.data;
        const firstProducts = Array.isArray(firstProductsPayload?.products) ? firstProductsPayload.products : [];
        const totalProductPages = Number(firstProductsPayload?.pagination?.pages || 1);
        const remainingProductPageNumbers = Array.from(
          { length: Math.max(totalProductPages - 1, 0) },
          (_, index) => index + 2,
        );
        const remainingProductResponses = await Promise.all(
          remainingProductPageNumbers.map((page) => productsAPI.getAll({ page, limit: 100 })),
        );
        if (cancelled) {
          return;
        }

        const products = [
          ...firstProducts,
          ...remainingProductResponses.flatMap((response) => {
            const payload = response?.data?.data;
            return Array.isArray(payload?.products) ? payload.products : [];
          }),
        ];
        const reviewLists = await Promise.all(
          products.map(async (product: any) => {
            try {
              const response = await reviewsAPI.getByProduct(String(product.id));
              const reviews = Array.isArray(response?.data?.data) ? response.data.data : [];
              return reviews as SidebarReview[];
            } catch {
              return [] as SidebarReview[];
            }
          }),
        );
        if (cancelled) {
          return;
        }

        const reviewCount = reviewLists
          .flat()
          .filter((review) => !String(review?.vendorReply || '').trim()).length;

        const supportItems = ((supportResponse.data?.data || supportResponse.data || []) as SidebarSupportConversation[]);
        const supportCount = supportItems.filter((conversation) =>
          hasPendingCustomerMessage('support', String(conversation.id || ''), conversation.messages),
        ).length;

        setBadgeCounts({
          orders: orderCount,
          reviews: reviewCount,
          support: supportCount,
        });
      } catch {
        // Keep the last known badge value when the request fails.
      }
    };

    void refreshBadgeCounts();

    const intervalId = window.setInterval(() => {
      void refreshBadgeCounts();
    }, 15000);

    const handleWindowFocus = () => {
      void refreshBadgeCounts();
    };

    const handleOrdersUpdated = () => {
      void refreshBadgeCounts();
    };

    const handleSidebarBadgesUpdated = () => {
      void refreshBadgeCounts();
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('seller-orders-updated', handleOrdersUpdated);
    window.addEventListener('seller-sidebar-badges-updated', handleSidebarBadgesUpdated);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('seller-orders-updated', handleOrdersUpdated);
      window.removeEventListener('seller-sidebar-badges-updated', handleSidebarBadgesUpdated);
    };
  }, []);

  React.useEffect(() => {
    if (!isOrdersPage) {
      orderAlertSilencedOnOrdersRef.current = false;
    }
  }, [isOrdersPage]);

  React.useEffect(() => {
    if (isOrdersPage) {
      stopOrderAlert();
      return;
    }

    if (badgeCounts.orders > 0 && !orderAlertSilencedOnOrdersRef.current) {
      void startOrderAlert();
      return;
    }

    stopOrderAlert();
  }, [badgeCounts.orders, isOrdersPage, startOrderAlert, stopOrderAlert]);

  React.useEffect(() => {
    if (!isOrdersPage) {
      return;
    }

    const dismissAlert = () => {
      orderAlertSilencedOnOrdersRef.current = true;
      stopOrderAlert();
    };

    window.addEventListener('keydown', dismissAlert, true);
    window.addEventListener('click', dismissAlert, true);

    return () => {
      window.removeEventListener('keydown', dismissAlert, true);
      window.removeEventListener('click', dismissAlert, true);
    };
  }, [isOrdersPage, stopOrderAlert]);

  React.useEffect(() => {
    return () => {
      stopOrderAlert();
      if (orderAlertAudioContextRef.current) {
        void orderAlertAudioContextRef.current.close();
        orderAlertAudioContextRef.current = null;
      }
    };
  }, [stopOrderAlert]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full ${collapsed ? 'w-20' : 'w-64'} border-r border-primary/10 transform transition-transform duration-300 z-50 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(251,248,242,0.94) 58%, rgba(245,241,234,0.96) 100%)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 18px 42px rgba(35,49,39,0.08)',
        }}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Logo Section */}
          <div className="flex items-center justify-between p-3 border-b border-primary/10 bg-white/70">
            <div className="flex items-center gap-3 min-w-0">
              <div className="seller-logo-box seller-logo-box-tight h-9 w-9 p-1">
                <img
                  src="/logo.png"
                  alt="MAHALLEM Logo"
                  className="seller-logo-img"
                />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <span className="text-sm font-bold text-primary block leading-tight truncate">MAHALLEM</span>
                  <span className="text-[10px] text-text-secondary leading-tight">Satıcı Paneli</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden lg:inline-flex p-2 rounded-md hover:bg-accent/10 text-text-secondary hover:text-primary"
                title={collapsed ? 'Genişlet' : 'Daralt'}
              >
                {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
              </button>
              <button onClick={onClose} className="lg:hidden text-text-secondary hover:text-text-primary">
                <span className="text-xl">✕</span>
              </button>
            </div>
          </div>

          {/* Menu */}
          <nav className={`flex-1 min-h-0 overflow-y-auto ${collapsed ? 'p-2' : 'p-3'} space-y-2`}>
            <Link
              key={dashboardItem.path}
              to={dashboardItem.path}
              onClick={() => {
                if (isOpen) onClose();
              }}
              title={collapsed ? dashboardItem.label : undefined}
                className={`group flex items-center ${collapsed ? 'justify-center px-3' : 'px-3'} py-2.5 rounded-lg transition-all ${
                isActive(dashboardItem.path)
                  ? 'bg-primary text-white font-semibold shadow-[0_10px_24px_rgba(10,92,54,0.24)] ring-1 ring-white/20'
                  : 'text-text-secondary hover:bg-white/85 hover:text-primary hover:shadow-sm hover:ring-1 hover:ring-primary/10'
              }`}
            >
              <dashboardItem.icon className="w-5 h-5" />
              {!collapsed && <span className="ml-3">{dashboardItem.label}</span>}
            </Link>

            {menuGroups.map((group) => (
              <div key={group.title} className={collapsed ? 'space-y-1 pt-1' : 'space-y-1 pt-2'}>
                {!collapsed && (
                  <div className="px-3 pb-1">
                    <div className="h-px bg-black/10 mb-2" />
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-text-secondary/80">{group.title}</p>
                  </div>
                )}

                {group.items.map((item) => {
                  const badgeCount = getBadgeCount(item.path);

                  return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      if (item.path === '/orders') {
                        orderAlertSilencedOnOrdersRef.current = true;
                        stopOrderAlert();
                      }
                      if (isOpen) onClose();
                    }}
                    title={collapsed ? item.label : undefined}
                    className={`group flex items-center ${collapsed ? 'justify-center px-3' : 'px-3'} py-2.5 rounded-lg transition-all ${
                      isActive(item.path)
                        ? 'bg-primary text-white font-semibold shadow-[0_10px_24px_rgba(10,92,54,0.24)] ring-1 ring-white/20'
                        : 'text-text-secondary hover:bg-white/85 hover:text-primary hover:shadow-sm hover:ring-1 hover:ring-primary/10'
                    }`}
                  >
                    <div className="relative">
                      <item.icon className="w-5 h-5" />
                      {collapsed && badgeCount > 0 && (
                        <span className="absolute -right-2 -top-2 min-w-[18px] rounded-full bg-warning px-1.5 text-center text-[10px] font-bold leading-[18px] text-white shadow-sm">
                          {badgeCount}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      <div className="ml-3 flex min-w-0 items-center gap-2">
                        <span className="truncate">{item.label}</span>
                        {badgeCount > 0 && (
                          <span className={`inline-flex min-w-[22px] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold leading-none ${
                            isActive(item.path) ? 'bg-white/20 text-white' : 'bg-warning text-white'
                          }`}>
                            {badgeCount}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Footer */}
          {!collapsed && (
            <div className="p-4 border-t border-primary/10 text-xs text-text-secondary bg-background/80">
              © 2025 MAHALLEM - Satıcı Paneli
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
