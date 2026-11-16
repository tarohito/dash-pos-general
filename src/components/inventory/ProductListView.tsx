import React, { useState, useEffect, useMemo } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Product, ProductStatus } from '../../types';
import { formatIDR } from '../../utils/formatters';
import { PaginationControls } from '../common/PaginationControls';
import { ConfirmModal } from '../common/ConfirmModal';
import { BarcodeLabelModal } from './BarcodeLabelModal';
import { ActionDropdownMenu } from '../common/ActionDropdownMenu';
import { posApi } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import { SearchInput } from '../common/SearchInput';
import { ErrorBanner } from '../common/ErrorBanner';
import { useToast } from '../../contexts/ToastContext';
import { MoneyAmount } from '../common/MoneyAmount';
import { KpiCard } from '../common/KpiCard';
import { StatusToggle } from '../common/StatusToggle';
import { NewBadge } from '../common/NewBadge';
import { isRecentlyCreated, useNewBadgeClock } from '../../utils/newBadge';
import {
  SortableTh,
  SortDirection,
  getNextColumnSort,
} from '../common/TableSortControls';
import { ProductDetailModal } from './ProductDetailModal';
import { BTN_PRIMARY_CLASS, BTN_SECONDARY_CLASS } from '../common/ModalShell';

interface ProductListViewProps {
  refreshTrigger: number;
  onOpenAddModal: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: number) => Promise<void>;
  canManageInventory?: boolean;
}

export const ProductListView: React.FC<ProductListViewProps> = ({
  refreshTrigger,
  onOpenAddModal,
  onEditProduct,
  onDeleteProduct,
  canManageInventory = true,
}) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 220);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Aktif' | 'Nonaktif'>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [items, setItems] = useState<Product[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalAllProducts, setTotalAllProducts] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [promoCount, setPromoCount] = useState(0);
  const [totalStockQty, setTotalStockQty] = useState(0);
  const [totalInventoryValue, setTotalInventoryValue] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { showToast } = useToast();

  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [printingBarcodeProduct, setPrintingBarcodeProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const productTimestamps = useMemo(() => items.map(p => p.createdAt), [items]);
  const nowMs = useNewBadgeClock(productTimestamps);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, sortBy, sortDir]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setFetchError(null);

    posApi
      .getProducts(
        {
          page: currentPage,
          pageSize,
          search: debouncedSearch,
          statusFilter,
          sortBy,
          sortDir,
        },
        controller.signal
      )
      .then(res => {
        setItems(res.items);
        setTotalItems(res.total);
        setTotalAllProducts(res.totalAllProducts);
        setActiveCount(res.activeCount ?? 0);
        setInactiveCount(res.inactiveCount ?? 0);
        setLowStockCount(res.lowStockCount ?? 0);
        setPromoCount(res.promoCount ?? 0);
        setTotalStockQty(res.totalStockQty ?? 0);
        setTotalInventoryValue(res.totalInventoryValue ?? 0);
        setTotalPages(res.totalPages);
        if (res.page !== currentPage) setCurrentPage(res.page);
        setIsLoading(false);
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          const msg = err instanceof Error ? err.message : 'Gagal memuat daftar barang.';
          setFetchError(msg);
          setIsLoading(false);
          showToast('error', msg);
        }
      });

    return () => controller.abort();
  }, [
    currentPage,
    pageSize,
    debouncedSearch,
    statusFilter,
    sortBy,
    sortDir,
    refreshTrigger,
    retryCount,
    showToast,
  ]);

  const handleHeaderSort = (key: string, defaultDir: SortDirection = 'desc') => {
    const next = getNextColumnSort(key, sortBy, sortDir, defaultDir);
    setSortBy(next.sortBy);
    setSortDir(next.sortDir);
  };

  const hasSearchQuery = search.trim().length > 0;

  const handleClearSearch = () => {
    setSearch('');
    setCurrentPage(1);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      await onDeleteProduct(deletingProduct.id);
      setDeletingProduct(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleProductStatus = async (product: Product) => {
    if (!canManageInventory) return;
    const newStatus: ProductStatus = product.status === 'Nonaktif' ? 'Aktif' : 'Nonaktif';
    // Optimistic UI update
    setItems(prev => {
      const updated = prev.map(item =>
        item.id === product.id ? { ...item, status: newStatus } : item
      );
      if (statusFilter !== 'all') {
        return updated.filter(item => (item.status ?? 'Aktif') === statusFilter);
      }
      return updated;
    });
    setActiveCount(prev => Math.max(0, prev + (newStatus === 'Aktif' ? 1 : -1)));
    setInactiveCount(prev => Math.max(0, prev + (newStatus === 'Nonaktif' ? 1 : -1)));
    try {
      await posApi.updateProduct(product.id, { status: newStatus });
      if (statusFilter !== 'all') {
        setRetryCount(c => c + 1);
      }
      showToast(
        'success',
        `Status produk "${product.name}" diubah menjadi ${newStatus}.`,
        'Status Produk'
      );
    } catch {
      // Revert if API fails
      setItems(prev =>
        prev.map(item => (item.id === product.id ? { ...item, status: product.status } : item))
      );
      setActiveCount(prev => Math.max(0, prev + (newStatus === 'Aktif' ? -1 : 1)));
      setInactiveCount(prev => Math.max(0, prev + (newStatus === 'Nonaktif' ? -1 : 1)));
      if (statusFilter !== 'all') {
        setRetryCount(c => c + 1);
      }
      showToast('error', 'Gagal memperbarui status produk.');
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Page Header (Unboxed, Tanpa Card) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-zinc-950 leading-tight tracking-tight">
            Inventaris &amp; Daftar Produk
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Kelola katalog produk, pantau stok fisik, harga jual, performa penjualan, dan cetak label barcode.
          </p>
        </div>

        {canManageInventory && (
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={onOpenAddModal}
              className="h-9 px-4 text-xs sm:text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-full inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs active:scale-[0.98]"
            >
              <GoogleIcon name="add" size={16} />
              <span>Tambah Barang</span>
            </button>
          </div>
        )}
      </div>

      {/* 4 Modern KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard
          title="Total Produk"
          accent="primary"
          icon={<GoogleIcon name="layers" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 tracking-tight truncate tabular-nums">
              {totalAllProducts ?? 0} SKU
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              {activeCount} aktif &middot; {lowStockCount} stok menipis
            </p>
          }
        />

        <KpiCard
          title="Total Stok Fisik"
          accent="secondary"
          icon={<GoogleIcon name="deployed_code" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 tracking-tight truncate tabular-nums">
              {totalStockQty ?? 0} Pcs
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Stok tersedia di etalase outlet
            </p>
          }
        />

        <KpiCard
          title="Produk Sedang Promo"
          accent="amber"
          icon={<GoogleIcon name="sell" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-amber-600 tracking-tight truncate tabular-nums">
              {promoCount ?? 0} SKU
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Terhubung kampanye promo aktif
            </p>
          }
        />

        <KpiCard
          title="Nilai Aset Etalase"
          accent="emerald"
          icon={<GoogleIcon name="payments" size={16} />}
          value={
            <MoneyAmount
              value={totalInventoryValue ?? 0}
              maxFontPx={24}
              minFontPx={13}
              className="font-bold font-mono text-primary tracking-tight tabular-nums"
            />
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Estimasi total harga jual
            </p>
          }
        />
      </div>

      {/* Table Workspace (Unboxed, Tanpa Card Pembungkus) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex-1 min-w-0">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Cari nama produk, SKU/barcode, kategori, merek, promo, atau status..."
            />
          </div>

          <div
            role="group"
            aria-label="Filter status produk"
            className="inline-flex h-9 p-0.5 bg-zinc-100/90 rounded-full border border-zinc-200 self-start sm:self-auto items-center shrink-0"
          >
            {(
              [
                { value: 'all', label: 'Semua', count: totalAllProducts },
                { value: 'Aktif', label: 'Aktif', count: activeCount },
                { value: 'Nonaktif', label: 'Nonaktif', count: inactiveCount },
              ] as const
            ).map(opt => {
              const isSelected = statusFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={`h-full px-3 text-xs font-semibold rounded-full transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
                    isSelected
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      isSelected ? 'text-white/85' : 'text-zinc-400'
                    }`}
                  >
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {fetchError && (
          <ErrorBanner
            message={fetchError}
            onRetry={() => setRetryCount(c => c + 1)}
            className="mb-3"
          />
        )}

        {/* Table & Mobile Cards (Unboxed) */}
        <div className="overflow-hidden">
          {isLoading && items.length === 0 ? (
            <div className="py-12 px-4 flex items-center justify-center gap-2 text-xs sm:text-sm text-zinc-400">
              <GoogleIcon name="progress_activity" size={18} className="animate-spin text-primary" />
              <span>Memuat data inventaris...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 px-4 text-center text-zinc-400">
              <GoogleIcon name="deployed_code" size={36} className="mx-auto mb-2 text-zinc-300" />
              <p className="text-sm font-semibold text-zinc-600">Tidak ada data produk</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {hasSearchQuery
                  ? `Pencarian "${search}" tidak cocok dengan produk mana pun.`
                  : statusFilter !== 'all'
                  ? `Belum ada produk berstatus ${statusFilter}.`
                  : 'Belum ada produk terdaftar di toko.'}
              </p>
              {hasSearchQuery || statusFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    handleClearSearch();
                    setStatusFilter('all');
                  }}
                  className={`mt-3 ${BTN_SECONDARY_CLASS}`}
                >
                  <GoogleIcon name="close" size={14} />
                  <span>{hasSearchQuery ? 'Bersihkan Pencarian' : 'Tampilkan Semua Produk'}</span>
                </button>
              ) : canManageInventory ? (
                <button
                  type="button"
                  onClick={onOpenAddModal}
                  className={`mt-3 ${BTN_PRIMARY_CLASS}`}
                >
                  <GoogleIcon name="add" size={14} />
                  <span>Tambah Barang Baru</span>
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {/* MOBILE LIST CARDS (md:hidden) */}
              <div className="md:hidden divide-y divide-zinc-200/80 border-t border-zinc-200">
                {items.map(p => (
                  <div key={p.id} className="p-4 space-y-2.5 hover:bg-zinc-50/70 transition-colors">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.name}
                            loading="lazy"
                            className="w-12 h-12 aspect-square rounded-xl object-cover border border-zinc-200 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 aspect-square rounded-xl bg-zinc-100 border border-zinc-200 shrink-0 flex items-center justify-center text-zinc-400">
                            <GoogleIcon name="deployed_code" size={20} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-zinc-900 text-xs">{p.sku}</span>
                            <span className="text-zinc-300">&bull;</span>
                            <span className="text-xs text-zinc-500 font-medium">{p.category}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                            <h4 className="text-sm font-bold text-zinc-900 truncate">{p.name}</h4>
                            {isRecentlyCreated(p.createdAt, nowMs) && <NewBadge />}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 flex-wrap">
                            <span className="font-medium text-zinc-600 tabular-nums">
                              {p.salesCount ?? 0} terjual
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-xs border ${
                            p.stok > 5
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : p.stok > 0
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {p.stok} pcs
                        </span>
                        <StatusToggle
                          checked={(p.status ?? 'Aktif') === 'Aktif'}
                          disabled={!canManageInventory}
                          onChange={() => void handleToggleProductStatus(p)}
                          label={p.status ?? 'Aktif'}
                          ariaLabel={`Status produk ${p.name}`}
                          tooltip={
                            !canManageInventory
                              ? 'Hanya Owner atau Kepala Cabang yang dapat mengubah status produk'
                              : (p.status ?? 'Aktif') === 'Aktif'
                              ? 'Aktif — klik untuk nonaktifkan'
                              : 'Nonaktif — klik untuk aktifkan'
                          }
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-zinc-900 font-mono tabular-nums">
                        {formatIDR(p.harga)}
                      </span>
                      <ActionDropdownMenu
                        ariaLabel={`Aksi untuk ${p.name}`}
                        items={[
                          {
                            id: 'detail',
                            label: 'Lihat Detail',
                            icon: <GoogleIcon name="visibility" size={14} />,
                            onClick: () => setDetailProduct(p),
                          },
                          {
                            id: 'barcode',
                            label: 'Cetak Barcode',
                            icon: <GoogleIcon name="barcode_scanner" size={14} />,
                            tone: 'primary',
                            onClick: () => setPrintingBarcodeProduct(p),
                          },
                          ...(canManageInventory
                            ? [
                                {
                                  id: 'edit',
                                  label: 'Edit Barang',
                                  icon: <GoogleIcon name="edit" size={14} />,
                                  onClick: () => onEditProduct(p),
                                },
                                {
                                  id: 'delete',
                                  label: 'Hapus Barang',
                                  icon: <GoogleIcon name="delete" size={14} />,
                                  tone: 'danger' as const,
                                  dividerBefore: true,
                                  disabled: (p.salesCount ?? 0) > 0,
                                  disabledReason:
                                    (p.salesCount ?? 0) > 0 ? 'Sudah terjual' : undefined,
                                  onClick: () => setDeletingProduct(p),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP TABLE (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead className="text-zinc-500 uppercase font-semibold text-xs border-b border-zinc-200 tracking-wider">
                    <tr>
                      <SortableTh
                        label="Nama Produk"
                        sortKey="name"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'asc')}
                        className="py-3 px-4 min-w-[240px]"
                      />
                      <SortableTh
                        label="SKU Barcode"
                        sortKey="sku"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'asc')}
                        className="py-3 px-4 w-[130px]"
                      />
                      <SortableTh
                        label="Harga Jual"
                        sortKey="harga"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'desc')}
                        align="right"
                        className="py-3 px-4 w-[150px]"
                      />
                      <SortableTh
                        label="Stok"
                        sortKey="stok"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'asc')}
                        align="center"
                        className="py-3 px-4 w-[100px]"
                      />
                      <SortableTh
                        label="Terjual"
                        sortKey="sales"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'desc')}
                        align="center"
                        className="py-3 px-4 w-[105px]"
                      />
                      <SortableTh
                        label="Status"
                        sortKey="status"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'desc')}
                        align="center"
                        className="py-3 px-3 w-[100px]"
                      />
                      <th className="py-3 px-3 text-center w-[60px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/70 font-medium text-zinc-700">
                    {items.map(p => (
                      <tr key={p.id} className="hover:bg-zinc-100/60 transition-colors">
                        <td className="py-3.5 px-4 align-middle max-w-[320px]">
                          <div className="flex items-center gap-3 min-w-0">
                            {p.image ? (
                              <img
                                src={p.image}
                                alt={p.name}
                                loading="lazy"
                                className="w-10 h-10 aspect-square rounded-xl object-cover border border-zinc-200 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 aspect-square rounded-xl bg-zinc-100 border border-zinc-200 shrink-0 flex items-center justify-center text-zinc-400">
                                <GoogleIcon name="deployed_code" size={18} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-bold text-zinc-950 text-xs sm:text-sm truncate" title={p.name}>
                                  {p.name}
                                </span>
                                {isRecentlyCreated(p.createdAt, nowMs) && <NewBadge />}
                              </div>
                              <span className="text-xs text-zinc-500 font-medium block mt-0.5 truncate">
                                {p.category}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                          <span className="font-mono font-bold text-zinc-900 text-xs sm:text-sm tracking-tight">
                            {p.sku}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right align-middle whitespace-nowrap">
                          <span className="font-bold text-sm text-zinc-950 font-mono tabular-nums">
                            {formatIDR(p.harga)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap align-middle">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono border ${
                              p.stok > 5
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : p.stok > 0
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {p.stok} pcs
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap align-middle">
                          <span className="font-semibold text-zinc-700 text-xs tabular-nums">
                            {p.salesCount ?? 0} pcs
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center whitespace-nowrap align-middle">
                          <div className="inline-flex justify-center">
                            <StatusToggle
                              checked={(p.status ?? 'Aktif') === 'Aktif'}
                              disabled={!canManageInventory}
                              onChange={() => void handleToggleProductStatus(p)}
                              ariaLabel={`Status produk ${p.name}`}
                              tooltip={
                                !canManageInventory
                                  ? 'Hanya Owner atau Kepala Cabang yang dapat mengubah status produk'
                                  : (p.status ?? 'Aktif') === 'Aktif'
                                  ? 'Aktif — klik untuk nonaktifkan'
                                  : 'Nonaktif — klik untuk aktifkan'
                              }
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center whitespace-nowrap align-middle">
                          <ActionDropdownMenu
                            ariaLabel={`Aksi untuk ${p.name}`}
                            items={[
                              {
                                id: 'detail',
                                label: 'Lihat Detail',
                                icon: <GoogleIcon name="visibility" size={14} />,
                                onClick: () => setDetailProduct(p),
                              },
                              {
                                id: 'barcode',
                                label: 'Cetak Barcode',
                                icon: <GoogleIcon name="barcode_scanner" size={14} />,
                                tone: 'primary',
                                onClick: () => setPrintingBarcodeProduct(p),
                              },
                              ...(canManageInventory
                                ? [
                                    {
                                      id: 'edit',
                                      label: 'Edit Barang',
                                      icon: <GoogleIcon name="edit" size={14} />,
                                      onClick: () => onEditProduct(p),
                                    },
                                    {
                                      id: 'delete',
                                      label: 'Hapus Barang',
                                      icon: <GoogleIcon name="delete" size={14} />,
                                      tone: 'danger' as const,
                                      dividerBefore: true,
                                      disabled: (p.salesCount ?? 0) > 0,
                                      disabledReason:
                                        (p.salesCount ?? 0) > 0 ? 'Sudah terjual' : undefined,
                                      onClick: () => setDeletingProduct(p),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            isLoading={isLoading}
            onPageChange={setCurrentPage}
            onPageSizeChange={size => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deletingProduct}
        title="Hapus Produk"
        description={
          deletingProduct
            ? `Apakah Anda yakin ingin menghapus "${deletingProduct.name}" (${deletingProduct.sku}) dari database? Tindakan ini tidak dapat dibatalkan.`
            : ''
        }
        confirmLabel="Ya, Hapus Barang"
        isLoading={isDeleting}
        onCancel={() => setDeletingProduct(null)}
        onConfirm={handleConfirmDelete}
      />

      <BarcodeLabelModal
        product={printingBarcodeProduct}
        onClose={() => setPrintingBarcodeProduct(null)}
      />

      <ProductDetailModal
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        onPrintBarcode={target => setPrintingBarcodeProduct(target)}
        onEditProduct={onEditProduct}
        canManageInventory={canManageInventory}
      />
    </div>
  );
};
