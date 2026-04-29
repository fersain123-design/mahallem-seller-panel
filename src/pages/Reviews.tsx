import React, { useEffect, useMemo, useState } from 'react';
import { productsAPI, reviewsAPI, vendorAPI } from '../services/api.ts';
import { emitSidebarBadgesUpdated } from '../lib/sidebarBadgeState.ts';

interface ProductOption {
  id: string;
  name: string;
}

interface ReviewItem {
  id: string;
  productId: string;
  productName: string;
  rating: number | null;
  comment: string;
  createdAt: string;
  vendorReply: string | null;
  customer?: {
    id: string;
    name: string;
  } | null;
}

interface SellerRatingItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user?: {
    id: string;
    name: string;
  } | null;
}

interface SellerRatingSummary {
  seller_id: string;
  rating: number;
  rating_count: number;
}

const ALL_PRODUCTS_VALUE = '__ALL_PRODUCTS__';

const Reviews: React.FC = () => {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(ALL_PRODUCTS_VALUE);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filter, setFilter] = useState<'all' | 'replied' | 'pending'>('all');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [sellerSummary, setSellerSummary] = useState<SellerRatingSummary | null>(null);
  const [sellerRatings, setSellerRatings] = useState<SellerRatingItem[]>([]);
  const [loadingSellerRatings, setLoadingSellerRatings] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoadingProducts(true);
        setError('');
        const allProducts: any[] = [];
        let page = 1;
        let pages = 1;

        do {
          const res = await productsAPI.getAll({ page, limit: 100 });
          const payload = res?.data?.data;
          const list = Array.isArray(payload?.products) ? payload.products : [];
          const totalPages = Number(payload?.pagination?.pages || 1);
          allProducts.push(...list);
          pages = Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1;
          page += 1;
        } while (page <= pages);

        const mapped: ProductOption[] = allProducts.map((p: any) => ({
          id: String(p.id),
          name: String(p.name || 'Ürün'),
        }));
        setProducts(mapped);
        setSelectedProductId(ALL_PRODUCTS_VALUE);
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Ürünler yüklenemedi');
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProducts();
  }, []);

  useEffect(() => {
    const loadSellerRatings = async () => {
      try {
        setLoadingSellerRatings(true);

        const profileRes = await vendorAPI.getProfile();
        const profilePayload =
          profileRes?.data?.data?.vendor ||
          profileRes?.data?.data ||
          profileRes?.data?.vendor ||
          profileRes?.data ||
          {};
        const vendorId = String(profilePayload?.id || profilePayload?._id || '').trim();
        if (!vendorId) {
          setSellerSummary(null);
          setSellerRatings([]);
          return;
        }

        const [summaryRes, listRes] = await Promise.all([
          reviewsAPI.getSellerSummary(vendorId),
          reviewsAPI.getSellerRatings(vendorId, { page: 1, limit: 50 }),
        ]);

        const summaryRaw =
          summaryRes?.data?.data?.summary ||
          summaryRes?.data?.data ||
          summaryRes?.data ||
          null;

        const listRaw =
          listRes?.data?.data?.comments ||
          listRes?.data?.data ||
          listRes?.data ||
          [];

        const mappedSummary: SellerRatingSummary | null = summaryRaw
          ? {
              seller_id: String(summaryRaw?.seller_id || vendorId),
              rating: Number(summaryRaw?.rating || 0),
              rating_count: Number(summaryRaw?.rating_count || 0),
            }
          : null;

        const mappedList: SellerRatingItem[] = Array.isArray(listRaw)
          ? listRaw.map((row: any) => ({
              id: String(row?.id || ''),
              rating: Number(row?.rating || 0),
              comment: typeof row?.comment === 'string' ? row.comment : null,
              created_at: String(row?.created_at || row?.createdAt || ''),
              user: row?.user
                ? {
                    id: String(row.user.id || ''),
                    name: String(row.user.name || 'Müşteri'),
                  }
                : null,
            }))
          : [];

        setSellerSummary(mappedSummary);
        setSellerRatings(mappedList);
      } catch {
        // Keep seller rating section optional when endpoint/profile is unavailable.
        setSellerSummary(null);
        setSellerRatings([]);
      } finally {
        setLoadingSellerRatings(false);
      }
    };

    void loadSellerRatings();
  }, []);

  useEffect(() => {
    const loadReviews = async () => {
      if (!selectedProductId) {
        setReviews([]);
        return;
      }
      try {
        setLoadingReviews(true);
        setError('');

        if (selectedProductId === ALL_PRODUCTS_VALUE) {
          const allLists = await Promise.all(
            products.map(async (product) => {
              try {
                const res = await reviewsAPI.getByProduct(product.id);
                const list = Array.isArray(res?.data?.data) ? res.data.data : [];
                return list;
              } catch {
                return [];
              }
            })
          );

          const merged = allLists
            .flat()
            .sort(
              (a: any, b: any) =>
                new Date(String(b?.createdAt || 0)).getTime() -
                new Date(String(a?.createdAt || 0)).getTime()
            );
          setReviews(merged as ReviewItem[]);
        } else {
          const res = await reviewsAPI.getByProduct(selectedProductId);
          const list = Array.isArray(res?.data?.data) ? res.data.data : [];
          setReviews(list as ReviewItem[]);
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Yorumlar yüklenemedi');
      } finally {
        setLoadingReviews(false);
      }
    };

    loadReviews();
  }, [products, selectedProductId]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      const replied = Boolean(review.vendorReply && String(review.vendorReply).trim());
      if (filter === 'replied') return replied;
      if (filter === 'pending') return !replied;
      return true;
    });
  }, [reviews, filter]);

  const averageRating = useMemo(() => {
    const rated = reviews.filter((r) => typeof r.rating === 'number');
    if (rated.length === 0) return '0.0';
    const total = rated.reduce((sum, r) => sum + Number(r.rating || 0), 0);
    return (total / rated.length).toFixed(1);
  }, [reviews]);

  const repliedCount = reviews.filter((r) => Boolean(r.vendorReply && String(r.vendorReply).trim())).length;
  const pendingCount = reviews.length - repliedCount;

  const handleReply = async () => {
    if (!selectedReview || !replyText.trim()) return;

    try {
      setSubmittingReply(true);
      setError('');
      await reviewsAPI.reply(selectedReview.productId, selectedReview.id, replyText.trim());

      if (selectedProductId === ALL_PRODUCTS_VALUE) {
        const allLists = await Promise.all(
          products.map(async (product) => {
            try {
              const res = await reviewsAPI.getByProduct(product.id);
              const list = Array.isArray(res?.data?.data) ? res.data.data : [];
              return list;
            } catch {
              return [];
            }
          })
        );
        const merged = allLists
          .flat()
          .sort(
            (a: any, b: any) =>
              new Date(String(b?.createdAt || 0)).getTime() -
              new Date(String(a?.createdAt || 0)).getTime()
          );
        setReviews(merged as ReviewItem[]);
      } else {
        const refreshed = await reviewsAPI.getByProduct(selectedProductId);
        const list = Array.isArray(refreshed?.data?.data) ? refreshed.data.data : [];
        setReviews(list as ReviewItem[]);
      }

      emitSidebarBadgesUpdated();

      setSelectedReview(null);
      setReplyText('');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Yanıt gönderilemedi');
    } finally {
      setSubmittingReply(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? 'text-warning' : 'text-gray-300'}>
        ⭐
      </span>
    ));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="seller-page-title">Yorumlar ve Değerlendirmeler</h1>
        <p className="seller-page-subtitle mt-1">Müşteri yorumlarını yönetin ve yanıtlayın</p>
      </div>

      {error && (
        <div className="seller-surface p-4 border border-error/30 bg-error/10 text-error">
          {error}
        </div>
      )}

      <div className="seller-surface p-3">
        <label className="block text-sm font-medium text-text-primary mb-2">Ürün Seç</label>
        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          disabled={loadingProducts || products.length === 0}
          className="w-full max-w-md px-4 py-2 bg-background border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary/20"
        >
          {products.length === 0 ? (
            <option value="">Ürün bulunamadı</option>
          ) : (
            <>
              <option value={ALL_PRODUCTS_VALUE}>Tüm Ürünler</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="seller-surface p-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-text-primary">{averageRating}</div>
            <div className="flex justify-center mt-2">{renderStars(Math.round(parseFloat(averageRating)))}</div>
            <div className="text-sm text-text-secondary mt-2">Ortalama Puan</div>
          </div>
        </div>

        <div className="seller-surface p-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">{reviews.length}</div>
            <div className="text-sm text-text-secondary mt-2">Toplam Yorum</div>
          </div>
        </div>

        <div className="seller-surface p-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-success">{repliedCount}</div>
            <div className="text-sm text-text-secondary mt-2">Yanıtlanan</div>
          </div>
        </div>

        <div className="seller-surface p-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-error">{pendingCount}</div>
            <div className="text-sm text-text-secondary mt-2">Bekleyen</div>
          </div>
        </div>
      </div>

      {/* Seller Ratings (Order-based) */}
      <div className="seller-surface p-4 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Mağaza Değerlendirmeleri</h2>
            <p className="text-sm text-text-secondary mt-1">Sipariş sonrası mağaza puan ve yorumları</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-text-primary">
              {Number(sellerSummary?.rating || 0).toFixed(1)}
            </div>
            <div className="text-sm text-text-secondary">
              {Number(sellerSummary?.rating_count || sellerRatings.length || 0)} yorum
            </div>
          </div>
        </div>

        {loadingSellerRatings && (
          <div className="text-sm text-text-secondary">Mağaza değerlendirmeleri yükleniyor...</div>
        )}

        {!loadingSellerRatings && sellerRatings.length === 0 && (
          <div className="text-sm text-text-secondary">Henüz mağaza değerlendirmesi yok.</div>
        )}

        {!loadingSellerRatings && sellerRatings.length > 0 && (
          <div className="space-y-3">
            {sellerRatings.map((item) => (
              <div key={item.id} className="rounded-xl border border-primary/15 bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-text-primary">{item.user?.name || 'Müşteri'}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-warning">{renderStars(Math.round(Number(item.rating || 0)))}</div>
                    <span className="text-sm text-text-secondary">{Number(item.rating || 0).toFixed(1)}</span>
                  </div>
                </div>
                <p className="text-text-primary mt-2">{item.comment || 'Yorum bırakılmadı.'}</p>
                <div className="text-xs text-text-secondary mt-2">
                  {item.created_at ? new Date(item.created_at).toLocaleDateString('tr-TR') : '-'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="seller-surface p-3">
        <div className="flex space-x-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === 'all' ? 'bg-primary text-white' : 'bg-background text-text-primary hover:bg-primary/10'
            }`}
          >
            Tüm Yorumlar ({reviews.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === 'pending' ? 'bg-primary text-white' : 'bg-background text-text-primary hover:bg-primary/10'
            }`}
          >
            Bekleyenler ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('replied')}
            className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === 'replied' ? 'bg-primary text-white' : 'bg-background text-text-primary hover:bg-primary/10'
            }`}
          >
            Yanıtlananlar ({repliedCount})
          </button>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {loadingReviews && (
          <div className="seller-surface p-6 text-text-secondary">Yorumlar yükleniyor...</div>
        )}

        {!loadingReviews && filteredReviews.length === 0 && (
          <div className="seller-surface p-6 text-text-secondary">Bu ürün için yorum bulunamadı.</div>
        )}

        {filteredReviews.map((review) => (
          <div key={review.id} className="seller-surface p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-primary font-semibold">{(review.customer?.name || 'M').charAt(0)}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-text-primary">{review.customer?.name || 'Müşteri'}</div>
                    <div className="text-sm text-text-secondary">{review.productName}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mb-2">
                  {renderStars(Number(review.rating || 0))}
                  <span className="text-sm text-text-secondary">
                    {new Date(review.createdAt).toLocaleDateString('tr-TR')}
                  </span>
                </div>
                <p className="text-text-primary">{review.comment}</p>

                {/* Reply */}
                {review.vendorReply && (
                  <div className="mt-4 bg-primary/5 border-l-4 border-primary rounded-lg p-4">
                    <div className="text-sm font-semibold text-primary mb-1">Sizin Yanıtınız:</div>
                    <p className="text-sm text-text-primary">{review.vendorReply}</p>
                  </div>
                )}
              </div>

              {/* Reply Button */}
              {!review.vendorReply && (
                <button
                  onClick={() => setSelectedReview(review)}
                  className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-all text-sm font-medium"
                >
                  Yanıtla
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reply Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="seller-surface-solid max-w-2xl w-full p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-text-primary">Yorum Yanıtla</h3>
              <button
                onClick={() => setSelectedReview(null)}
                className="text-text-secondary hover:text-text-primary text-2xl"
              >
                ×
              </button>
            </div>

            {/* Original Review */}
            <div className="bg-background rounded-xl p-4 mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className="font-semibold">{selectedReview.customer?.name || 'Müşteri'}</span>
                <span className="text-text-secondary">-</span>
                <span className="text-text-secondary">{selectedReview.productName}</span>
              </div>
              <div className="flex items-center mb-2">{renderStars(Number(selectedReview.rating || 0))}</div>
              <p className="text-text-primary">{selectedReview.comment}</p>
            </div>

            {/* Reply Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-primary mb-2">Yanıtınız</label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                placeholder="Müşteriye yanıtınızı yazın..."
                className="w-full px-4 py-2.5 bg-white border border-primary/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            {/* Quick Responses */}
            <div className="mb-6">
              <p className="text-sm text-text-secondary mb-2">Hızlı Yanıtlar:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setReplyText('Güzel yorumunuz için teşekkür ederiz!')}
                  className="px-3 py-1 bg-background text-text-primary rounded-lg hover:bg-primary/10 text-sm"
                >
                  Teşekkür
                </button>
                <button
                  onClick={() => setReplyText('Geri bildiriminiz bizim için çok değerli. Daha iyi hizmet için çalışmaya devam edeceğiz.')}
                  className="px-3 py-1 bg-background text-text-primary rounded-lg hover:bg-primary/10 text-sm"
                >
                  İyileştirme
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => setSelectedReview(null)}
                className="flex-1 px-4 py-2.5 border border-primary/30 text-primary rounded-lg hover:bg-primary/5 transition-all font-semibold"
              >
                İptal
              </button>
              <button
                onClick={handleReply}
                disabled={!replyText.trim() || submittingReply}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all font-semibold"
              >
                {submittingReply ? 'Gönderiliyor...' : 'Yanıt Gönder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reviews;
