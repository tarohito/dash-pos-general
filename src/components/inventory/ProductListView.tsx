import React, { useState, useEffect, useMemo } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Product } from '../../types';
import { formatIDR } from '../../utils/formatters';
import { PaginationControls } from '../common/PaginationControls';
import { ConfirmModal } from '../common/ConfirmModal';
import { BarcodeLabelModal } from './BarcodeLabelModal';
import { ActionDropdownMenu } from '../common/ActionDropdownMenu';
import { CustomSelect } from '../common/CustomSelect';
import { posApi } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import { SearchInput } from '../common/SearchInput';
import { ErrorBanner } from '../common/ErrorBanner';
import { useToast } from '../../contexts/ToastContext';
import { MoneyAmount } from '../common/MoneyAmount';
import { KpiCard } from '../common/KpiCard';
import {
  SortableTh,
  SortDirection,
  getNextColumnSort,
} from '../common/TableSortControls';

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
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [items, setItems] = useState<Product[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalAllProducts, setTotalAllProducts] = useState(0);
  const [totalStockQty, setTotalStockQty] = useState(0);
  const [totalWeightGrams, setTotalWeightGrams] = useState(0);
  const [totalInventoryValue, setTotalInventoryValue] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { showToast } = useToast();

  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [printingBarcodeProduct, setPrintingBarcodeProduct] = useState<Product | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategory, sortBy, sortDir]);

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
          category: selectedCategory !== 'Semua' ? selectedCategory : undefined,
          sortBy,
          sortDir,
        },
        controller.signal
      )
      .then(res => {
        setItems(res.items);
        setTotalItems(res.total);
        setTotalAllProducts(res.totalAllProducts);
        setTotalStockQty(res.totalStockQty ?? 0);
        setTotalWeightGrams(res.totalWeightGrams ?? 0);
        setTotalInventoryValue(res.totalInventoryValue ?? 0);
        setCategoryCounts(res.categoryCounts ?? {});
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
  }, [currentPage, pageSize, debouncedSearch, selectedCategory, sortBy, sortDir, refreshTrigger, retryCount, showToast]);

  const handleHeaderSort = (key: string, defaultDir: SortDirection = 'desc') => {
    const next = getNextColumnSort(key, sortBy, sortDir, defaultDir);
    setSortBy(next.sortBy);
    setSortDir(next.sortDir);
  };

  const availableCategories = useMemo(() => {
    const cats = Object.keys(categoryCounts).filter(k => k !== 'Semua');
    return ['Semua', ...cats];
  }, [categoryCounts]);

  const categoryOptions = useMemo(() => {
    return availableCategories.map(cat => ({
      value: cat,
      label: cat === 'Semua' ? 'Semua Kategori' : cat,
      badge:
        cat === 'Semua'
          ? `${totalAllProducts} SKU`
          : categoryCounts[cat] !== undefined
          ? `${categoryCounts[cat]} SKU`
          : undefined,
    }));
  }, [availableCategories, categoryCounts, totalAllProducts]);

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
    const newStatus = product.status === 'Nonaktif' ? 'Aktif' : 'Nonaktif';
    // Optimistic UI update
    setItems(prev =>
      prev.map(item => (item.id === product.id ? { ...item, status: newStatus } : item))
    );
    try {
      await posApi.updateProduct(product.id, { status: newStatus });
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
      showToast('error', 'Gagal memperbarui status produk.');
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Page Header (Unboxed, Tanpa Card) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-zinc-950 leading-tight">
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
          title="Total Koleksi"
          accent="primary"
          icon={<GoogleIcon name="layers" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 tracking-tight truncate tabular-nums">
              {totalAllProducts ?? 0} SKU
            </div>
          }
          footer={
            <p className="text-xs text-zinc-400 mt-1 truncate">
              Jenis produk aktif
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
            <p className="text-xs text-zinc-400 mt-1 truncate">
              Stok tersedia di etalase
            </p>
          }
        />

        <KpiCard
          title="Total Netto / Berat"
          accent="accent"
          icon={<GoogleIcon name="balance" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 tracking-tight truncate tabular-nums">
              {Number((totalWeightGrams ?? 0).toFixed(2))} gr
            </div>
          }
          footer={
            <p className="text-xs text-zinc-400 mt-1 truncate">
              Akumulasi netto stok
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
            <p className="text-xs text-zinc-400 mt-1 truncate">
              Estimasi total harga jual
            </p>
          }
        />
      </div>

      {/* Table Workspace (Unboxed, Tanpa Card Pembungkus) */}
      <div className="space-y-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari kode barcode, nama produk, atau kategori..."
          />

          <div className="w-full md:w-64 shrink-0">
            <CustomSelect
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={categoryOptions}
              placeholder="Pilih Kategori"
              ariaLabel="Filter kategori barang"
              icon={<GoogleIcon name="filter_list" size={14} />}
              className="!h-9 sm:!h-9 !rounded-xl !text-xs sm:!text-sm !border-zinc-200 hover:!border-zinc-300"
            />
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
                {search || selectedCategory !== 'Semua'
                  ? 'Coba ubah filter kategori atau kata kunci pencarian.'
                  : 'Belum ada produk terdaftar di toko.'}
              </p>
              {canManageInventory && !search && selectedCategory === 'Semua' && (
                <button
                  type="button"
                  onClick={onOpenAddModal}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer border border-zinc-200"
                >
                  <GoogleIcon name="add" size={14} />
                  <span>Tambah Barang Baru</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* MOBILE LIST CARDS (md:hidden) */}
              <div className="md:hidden divide-y divide-zinc-200/80 border-t border-zinc-200">
                {items.map(p => (
                  <div key={p.id} className="p-4 space-y-2.5 hover:bg-zinc-50/70 transition-colors">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={p.image}
                          alt={p.name}
                          loading="lazy"
                          className="w-12 h-12 aspect-square rounded-xl object-cover border border-zinc-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-zinc-900 text-xs">{p.sku}</span>
                            <span className="text-zinc-300">&bull;</span>
                            <span className="text-xs text-zinc-500 font-medium">{p.category}</span>
                            {p.brand && p.brand !== 'No Brand' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200/70">
                                {p.brand}
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              p.kondisi === 'Bekas'
                                ? 'bg-zinc-100 text-zinc-700 border-zinc-300'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {p.kondisi ?? 'Baru'}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-zinc-900 truncate mt-0.5">{p.name}</h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 flex-wrap">
                            <span>
                              Berat: <strong className="text-zinc-800 font-mono">{Number(p.berat.toFixed(2))} gr</strong>
                            </span>
                            <span className="text-zinc-300">&bull;</span>
                            <span className="font-medium text-zinc-600">
                              {p.salesCount ?? 0} terjual
                            </span>
                            {p.isPromo && p.promoLabel && (
                              <span className="text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                                <GoogleIcon name="sell" size={11} className="text-amber-600" />
                                {p.promoLabel}
                              </span>
                            )}
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
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            role="switch"
                            disabled={!canManageInventory}
                            aria-checked={(p.status ?? 'Aktif') === 'Aktif'}
                            onClick={() => handleToggleProductStatus(p)}
                            className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                              (p.status ?? 'Aktif') === 'Aktif' ? 'bg-emerald-500' : 'bg-zinc-300'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                (p.status ?? 'Aktif') === 'Aktif' ? 'translate-x-3.5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className={`text-[10px] font-bold ${
                            (p.status ?? 'Aktif') === 'Aktif' ? 'text-emerald-700' : 'text-zinc-500'
                          }`}>
                            {p.status ?? 'Aktif'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-bold text-zinc-900 font-mono tabular-nums">
                          {formatIDR(p.harga)}
                        </span>
                        {p.hpp !== undefined && p.hpp > 0 && (
                          <span className="block text-[11px] text-zinc-400 font-mono">
                            HPP: {formatIDR(p.hpp)}
                          </span>
                        )}
                      </div>
                      <ActionDropdownMenu
                        ariaLabel={`Aksi untuk ${p.name}`}
                        items={[
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
                        label="Berat"
                        sortKey="berat"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'desc')}
                        align="center"
                        className="py-3 px-4 w-[95px]"
                      />
                      <th className="py-3 px-3 text-center w-[90px]">Status</th>
                      <th className="py-3 px-3 text-center w-[60px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/70 font-medium text-zinc-700">
                    {items.map(p => (
                      <tr key={p.id} className="hover:bg-zinc-100/60 transition-colors">
                        <td className="py-3.5 px-4 align-middle max-w-[320px]">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={p.image}
                              alt={p.name}
                              loading="lazy"
                              className="w-10 h-10 aspect-square rounded-xl object-cover border border-zinc-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-zinc-950 text-xs sm:text-sm block truncate" title={p.name}>
                                {p.name}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[11px] text-zinc-500 font-medium">{p.category}</span>
                                {p.brand && p.brand !== 'No Brand' && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200/80">
                                    {p.brand}
                                  </span>
                                )}
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase border ${
                                  p.kondisi === 'Bekas'
                                    ? 'bg-zinc-100 text-zinc-700 border-zinc-300'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                  {p.kondisi ?? 'Baru'}
                                </span>
                                {p.isPromo && p.promoLabel && (
                                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-full inline-flex items-center gap-1 shadow-2xs">
                                    <GoogleIcon name="sell" size={10} className="text-amber-600" />
                                    {p.promoLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                          <span className="font-mono font-bold text-zinc-900 text-xs sm:text-sm tracking-tight">
                            {p.sku}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right align-middle whitespace-nowrap">
                          <span className="font-bold text-sm text-zinc-950 font-mono tabular-nums block">
                            {formatIDR(p.harga)}
                          </span>
                          {p.hpp !== undefined && p.hpp > 0 && (
                            <span className="text-[11px] text-zinc-400 font-mono block">
                              HPP: {formatIDR(p.hpp)}
                            </span>
                          )}
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
                            {p.salesCount ?? 0} terjual
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-zinc-800 font-mono tabular-nums whitespace-nowrap align-middle text-xs sm:text-sm">
                          {Number(p.berat.toFixed(2))} gr
                        </td>
                        <td className="py-3.5 px-3 text-center whitespace-nowrap align-middle">
                          <button
                            type="button"
                            role="switch"
                            disabled={!canManageInventory}
                            aria-checked={(p.status ?? 'Aktif') === 'Aktif'}
                            onClick={() => handleToggleProductStatus(p)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${
                              (p.status ?? 'Aktif') === 'Aktif' ? 'bg-emerald-500' : 'bg-zinc-300'
                            }`}
                            title={`Status: ${p.status ?? 'Aktif'}. Klik untuk ${
                              (p.status ?? 'Aktif') === 'Aktif' ? 'nonaktifkan' : 'aktifkan'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                (p.status ?? 'Aktif') === 'Aktif' ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="py-3.5 px-3 text-center whitespace-nowrap align-middle">
                          <ActionDropdownMenu
                            ariaLabel={`Aksi untuk ${p.name}`}
                            items={[
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
        title="Hapus Barang Inventaris"
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
    </div>
  );
};
