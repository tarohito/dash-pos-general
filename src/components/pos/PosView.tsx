import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Product, CartItem, PromoCampaign, PromoCouponValidationResult } from '../../types';
import { ProductCard } from './ProductCard';
import { PromoCard } from './PromoCard';
import { CartPanel } from './CartPanel';
import { formatIDR } from '../../utils/formatters';
import { posApi } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import { SearchInput } from '../common/SearchInput';
import { ConfirmModal } from '../common/ConfirmModal';
import { ErrorBanner } from '../common/ErrorBanner';
import { useToast } from '../../contexts/ToastContext';
import { isRecentlyCreated, useNewBadgeClock } from '../../utils/newBadge';

interface PosViewProps {
  categories: string[];
  refreshTrigger: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAutoScanCode: (code: string) => Promise<Product | null>;
  onOpenScanModal: () => void;
  cart: CartItem[];
  onAddToCart: (product: Product) => void;
  onUpdateQty: (id: number, delta: number) => void;
  onRemoveItem: (id: number) => void;
  onClearCart?: () => void;
  subtotal: number;
  grossSubtotal?: number;
  discountAmount?: number;
  tax: number;
  taxLabel?: string;
  grandTotal: number;
  activePromos?: PromoCampaign[];
  appliedPromo?: PromoCouponValidationResult | null;
  promoCouponError?: string | null;
  isValidatingPromo?: boolean;
  onApplyPromoCode?: (code: string) => Promise<void> | void;
  onRemovePromoCode?: () => void;
  onOpenPaymentModal: () => void;
}

const POS_PAGE_SIZE = 24;

export const PosView: React.FC<PosViewProps> = ({
  refreshTrigger,
  searchQuery,
  onSearchChange,
  onAutoScanCode,
  onOpenScanModal,
  cart,
  onAddToCart,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  subtotal,
  grossSubtotal,
  discountAmount = 0,
  tax,
  taxLabel,
  grandTotal,
  activePromos = [],
  appliedPromo = null,
  promoCouponError = null,
  isValidatingPromo = false,
  onApplyPromoCode,
  onRemovePromoCode,
  onOpenPaymentModal,
}) => {
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  const debouncedSearch = useDebounce(searchQuery, 200);

  // Server-side paginated catalog state
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [promoCount, setPromoCount] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [pendingRemoveItem, setPendingRemoveItem] = useState<CartItem | null>(null);
  const [isConfirmClearCart, setIsConfirmClearCart] = useState(false);
  const { showToast } = useToast();

  // Fetch page 1 whenever search or refreshTrigger changes
  useEffect(() => {
    const controller = new AbortController();
    setIsInitialLoading(true);
    setFetchError(null);
    setPage(1);

    posApi
      .getProducts(
        {
          page: 1,
          pageSize: POS_PAGE_SIZE,
          search: debouncedSearch,
        },
        controller.signal
      )
      .then(res => {
        setProducts(res.items);
        setTotalFiltered(res.total);
        setTotalPages(res.totalPages);
        setPromoCount(res.promoCount);
        setIsInitialLoading(false);
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          const msg = err instanceof Error ? err.message : 'Gagal memuat katalog produk.';
          setFetchError(msg);
          setIsInitialLoading(false);
          showToast('error', msg);
        }
      });

    return () => controller.abort();
  }, [debouncedSearch, refreshTrigger, retryCount, showToast]);

  const loadNextPage = useCallback(async () => {
    if (isLoadingMore || isInitialLoading || page >= totalPages) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const res = await posApi.getProducts({
        page: nextPage,
        pageSize: POS_PAGE_SIZE,
        search: debouncedSearch,
      });
      setProducts(prev => {
        const seen = new Set(prev.map(p => p.id));
        const uniqueNext = res.items.filter(p => !seen.has(p.id));
        return [...prev, ...uniqueNext];
      });
      setPage(nextPage);
      setTotalFiltered(res.total);
      setTotalPages(res.totalPages);
      setPromoCount(res.promoCount);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        showToast('error', err instanceof Error ? err.message : 'Gagal memuat halaman produk berikutnya.');
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, isInitialLoading, page, totalPages, debouncedSearch, showToast]);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (page >= totalPages || isInitialLoading) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          loadNextPage();
        }
      },
      { rootMargin: '200px' }
    );

    const el = loadMoreRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [page, totalPages, isInitialLoading, loadNextPage]);

  const productTimestamps = useMemo(() => products.map(p => p.createdAt), [products]);
  const nowMs = useNewBadgeClock(productTimestamps);

  const totalCartQty = useMemo(() => cart.reduce((acc, it) => acc + it.qty, 0), [cart]);

  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-0 w-full gap-2 sm:gap-3 lg:gap-0 relative overflow-hidden">
      {/* Mobile/Tablet Segmented View Switcher */}
      <div className="lg:hidden flex items-center p-1 bg-zinc-200/70 border border-zinc-200 rounded-full shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[36px] ${
            mobileTab === 'catalog'
              ? 'bg-primary text-white shadow-sm'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <span>Katalog Produk</span>
          <span className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
            mobileTab === 'catalog' ? 'bg-white/20 text-white' : 'bg-zinc-100'
          }`}>
            {totalFiltered}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[36px] ${
            mobileTab === 'cart'
              ? 'bg-primary text-white shadow-sm'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <span>Keranjang</span>
          {totalCartQty > 0 && (
            <span className="text-xs px-2 py-0.5 bg-accent text-white rounded-md font-bold font-mono">
              {totalCartQty}
            </span>
          )}
        </button>
      </div>

      {/* Catalog Panel */}
      <div
        className={`flex-1 min-h-0 flex flex-col min-w-0 lg:pl-6 lg:pr-5 lg:pt-6 ${
          mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Search & Action Bar */}
        <div className="pb-2.5 sm:pb-3 flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Search Input */}
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Cari produk, kategori, merek, promo, atau scan barcode..."
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void onAutoScanCode(searchQuery);
              }
            }}
          />

          {/* Scan Barcode Button (Secondary Accent Action) */}
          <button
            type="button"
            onClick={onOpenScanModal}
            className="h-9 px-3.5 bg-secondary-soft/75 hover:bg-secondary-soft border border-secondary-border text-secondary-text rounded-full text-xs sm:text-sm font-semibold inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Buka Scanner Barcode"
          >
            <GoogleIcon name="barcode_scanner" size={16} className="mr-1.5 text-secondary shrink-0" />
            <span className="hidden sm:inline">Scan Barcode</span>
            <span className="sm:hidden text-xs">Scan</span>
          </button>
        </div>

        {/* Product Grid */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3.5 auto-rows-max ${
            totalCartQty > 0 ? 'pb-20 lg:pb-5' : 'lg:pb-5'
          }`}
        >
          {/* Card Promo */}
          <PromoCard promoCount={promoCount} />

          {isInitialLoading && products.length === 0 ? (
            <div className="col-span-full py-12 flex items-center justify-center text-xs text-zinc-400 gap-2">
              <GoogleIcon name="progress_activity" size={18} className="animate-spin text-primary" />
              <span>Memuat katalog produk...</span>
            </div>
          ) : (
            products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                isNew={isRecentlyCreated(product.createdAt, nowMs)}
                onAddToCart={onAddToCart}
              />
            ))
          )}

          {/* Sentinel Element untuk auto-load halaman berikutnya dari server */}
          {page < totalPages && !isInitialLoading && (
            <div ref={loadMoreRef} className="col-span-full py-6 flex items-center justify-center text-xs text-zinc-400 gap-2">
              <GoogleIcon name="progress_activity" size={16} className="animate-spin text-primary" />
              <span>
                Memuat produk lainnya ({products.length} dari {totalFiltered})...
              </span>
            </div>
          )}

          {fetchError && (
            <div className="col-span-full">
              <ErrorBanner message={fetchError} onRetry={() => setRetryCount(c => c + 1)} />
            </div>
          )}

          {!isInitialLoading && !fetchError && products.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-400">
              <p className="text-sm font-medium">Tidak ada produk yang cocok dengan pencarian.</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart Panel */}
      <div
        className={`min-h-0 lg:border-l lg:border-zinc-200/90 lg:pl-5 lg:pr-6 lg:pt-6 lg:pb-4 ${
          mobileTab === 'catalog' ? 'hidden lg:flex lg:shrink-0 lg:h-full' : 'flex-1 min-h-0 flex flex-col'
        }`}
      >
        <CartPanel
          cart={cart}
          onUpdateQty={onUpdateQty}
          onRemoveItem={id => {
            const target = cart.find(c => c.id === id);
            if (target) setPendingRemoveItem(target);
          }}
          onClearCart={onClearCart ? () => setIsConfirmClearCart(true) : undefined}
          subtotal={subtotal}
          grossSubtotal={grossSubtotal}
          discountAmount={discountAmount}
          tax={tax}
          taxLabel={taxLabel}
          grandTotal={grandTotal}
          activePromos={activePromos}
          appliedPromo={appliedPromo}
          promoCouponError={promoCouponError}
          isValidatingPromo={isValidatingPromo}
          onApplyPromoCode={onApplyPromoCode}
          onRemovePromoCode={onRemovePromoCode}
          onOpenPaymentModal={onOpenPaymentModal}
          onBackToCatalog={() => setMobileTab('catalog')}
        />
      </div>

      {/* Floating Bottom Cart Bar for Tablet & Mobile */}
      {mobileTab === 'catalog' && totalCartQty > 0 && (
        <div className="lg:hidden absolute bottom-2 inset-x-2 z-30 animate-in slide-in-from-bottom duration-200">
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className="w-full bg-primary hover:bg-primary-hover text-white p-3 rounded-full shadow-[0_12px_28px_rgba(0,0,0,0.18)] flex items-center justify-between active:scale-[0.99] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold text-xs sm:text-sm font-mono">
                {totalCartQty}
              </div>
              <div className="text-left">
                <p className="text-xs text-white/80 font-semibold leading-none">Total Tagihan ({totalCartQty} item)</p>
                <p className="text-base font-bold font-mono tracking-tight mt-0.5">{formatIDR(grandTotal)}</p>
              </div>
            </div>
            <div className="flex items-center text-xs sm:text-sm font-semibold bg-white text-primary px-3 py-1.5 rounded-full">
              Buka Keranjang
            </div>
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={!!pendingRemoveItem}
        title="Hapus Item"
        description={
          pendingRemoveItem
            ? `Apakah Anda yakin ingin menghapus "${pendingRemoveItem.name}" (${pendingRemoveItem.qty} pcs) dari keranjang pesanan?`
            : ''
        }
        confirmLabel="Ya, Hapus Item"
        onCancel={() => setPendingRemoveItem(null)}
        onConfirm={() => {
          if (pendingRemoveItem) {
            onRemoveItem(pendingRemoveItem.id);
            setPendingRemoveItem(null);
          }
        }}
      />

      <ConfirmModal
        isOpen={isConfirmClearCart}
        title="Kosongkan Keranjang"
        description={`Apakah Anda yakin ingin menghapus seluruh ${totalCartQty} item dari keranjang pesanan?`}
        confirmLabel="Ya, Kosongkan"
        onCancel={() => setIsConfirmClearCart(false)}
        onConfirm={() => {
          onClearCart?.();
          setIsConfirmClearCart(false);
        }}
      />
    </div>
  );
};
