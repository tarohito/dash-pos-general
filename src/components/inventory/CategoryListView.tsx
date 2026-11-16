import React, { useEffect, useMemo, useState } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { CategoryStatsItem, Product } from '../../types';
import { ActionDropdownMenu } from '../common/ActionDropdownMenu';
import { ConfirmModal } from '../common/ConfirmModal';
import { posApi } from '../../services/api';
import { usePagination } from '../../hooks/usePagination';
import { PaginationControls } from '../common/PaginationControls';
import { ErrorBanner } from '../common/ErrorBanner';
import { SearchInput } from '../common/SearchInput';
import { useToast } from '../../contexts/ToastContext';
import { KpiCard } from '../common/KpiCard';
import { NewBadge } from '../common/NewBadge';
import { isRecentlyCreated, useNewBadgeClock } from '../../utils/newBadge';
import { formatIDR } from '../../utils/formatters';
import {
  SortableTh,
  SortDirection,
  getNextColumnSort,
} from '../common/TableSortControls';
import {
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_SECONDARY_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
} from '../common/ModalShell';

interface CategoryListViewProps {
  refreshTrigger: number;
  onOpenAddCategoryModal: () => void;
  onEditCategory: (category: string) => void;
  onDeleteCategory: (category: string) => Promise<void>;
}

interface CategoryRow {
  name: string;
  count: number;
  totalStok: number;
  createdAt?: string;
}

export const CategoryListView: React.FC<CategoryListViewProps> = ({
  refreshTrigger,
  onOpenAddCategoryModal,
  onEditCategory,
  onDeleteCategory,
}) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryStats, setCategoryStats] = useState<Record<string, CategoryStatsItem>>({});
  const [categoryCreatedAt, setCategoryCreatedAt] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detailCategory, setDetailCategory] = useState<CategoryRow | null>(null);
  const [detailProducts, setDetailProducts] = useState<Product[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!detailCategory) {
      setDetailProducts([]);
      return;
    }
    const controller = new AbortController();
    setIsLoadingDetail(true);
    posApi
      .getProducts(
        { category: detailCategory.name, page: 1, pageSize: 8, sortBy: 'newest', sortDir: 'desc' },
        controller.signal
      )
      .then(res => {
        setDetailProducts(res.items || []);
        setIsLoadingDetail(false);
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          setDetailProducts([]);
          setIsLoadingDetail(false);
        }
      });
    return () => controller.abort();
  }, [detailCategory]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setFetchError(null);
    posApi
      .getCategoriesWithStats(controller.signal)
      .then(res => {
        setCategories(res.categories);
        setCategoryStats(res.stats);
        setCategoryCreatedAt(res.categoryCreatedAt ?? {});
        setIsLoading(false);
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          const msg = err instanceof Error ? err.message : 'Gagal memuat daftar kategori.';
          setFetchError(msg);
          setIsLoading(false);
          showToast('error', msg);
        }
      });
    return () => controller.abort();
  }, [refreshTrigger, retryCount, showToast]);

  const rows = useMemo<CategoryRow[]>(() => {
    return categories.map(name => {
      const stats = categoryStats[name] || { count: 0, totalStok: 0 };
      return {
        name,
        count: stats.directCount ?? stats.count ?? 0,
        totalStok: stats.directStok ?? stats.totalStok ?? 0,
        createdAt: categoryCreatedAt[name],
      };
    });
  }, [categories, categoryStats, categoryCreatedAt]);

  const categoryTimestamps = useMemo(() => rows.map(r => r.createdAt), [rows]);
  const nowMs = useNewBadgeClock(categoryTimestamps);

  const summary = useMemo(() => {
    let filledCount = 0;
    let emptyCount = 0;
    let totalSku = 0;
    let totalStok = 0;

    for (const row of rows) {
      if (row.count > 0) filledCount += 1;
      else emptyCount += 1;
      totalSku += row.count;
      totalStok += row.totalStok;
    }

    return {
      totalCategories: rows.length,
      filledCount,
      emptyCount,
      totalSku,
      totalStok,
    };
  }, [rows]);

  const filteredAndSortedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter(row => {
      if (!q) return true;
      const statusText = row.count > 0 ? 'terisi' : 'kosong';
      return row.name.toLowerCase().includes(q) || statusText.includes(q);
    });

    const isDefaultSort = sortBy === 'name' && sortDir === 'asc';
    const factor = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (isDefaultSort) {
        const aNew = isRecentlyCreated(a.createdAt, nowMs);
        const bNew = isRecentlyCreated(b.createdAt, nowMs);
        if (aNew !== bNew) return aNew ? -1 : 1;
        if (aNew && bNew) {
          return Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '');
        }
      }
      if (sortBy === 'count') {
        const diff = (a.count - b.count) * factor;
        return diff !== 0 ? diff : a.name.localeCompare(b.name, 'id-ID');
      }
      if (sortBy === 'totalStok') {
        const diff = (a.totalStok - b.totalStok) * factor;
        return diff !== 0 ? diff : a.name.localeCompare(b.name, 'id-ID');
      }
      return a.name.localeCompare(b.name, 'id-ID') * factor;
    });
  }, [rows, search, sortBy, sortDir, nowMs]);

  const {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    paginatedItems,
    goToPage,
    setPageSize,
  } = usePagination(filteredAndSortedRows, { initialPageSize: 10 });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    goToPage(1);
  };

  const handleHeaderSort = (key: string, defaultDir: SortDirection = 'desc') => {
    const next = getNextColumnSort(key, sortBy, sortDir, defaultDir);
    setSortBy(next.sortBy);
    setSortDir(next.sortDir);
    goToPage(1);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    setIsDeleting(true);
    try {
      await onDeleteCategory(deletingCategory);
      setDeletingCategory(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasSearchQuery = search.trim().length > 0;

  const handleClearSearch = () => {
    setSearch('');
    goToPage(1);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-lg sm:text-xl font-bold text-zinc-950 leading-tight tracking-tight">
              Daftar Kategori Produk
            </h3>
            {isLoading && <GoogleIcon name="progress_activity" size={14} className="animate-spin text-primary" />}
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Kelola kategori produk toko agar mudah dicari di kasir dan daftar barang.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onOpenAddCategoryModal}
            className="h-9 px-4 text-xs sm:text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-full inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs active:scale-[0.98]"
          >
            <GoogleIcon name="add" size={16} />
            <span>Tambah Kategori</span>
          </button>
        </div>
      </div>

      {/* 4 Simple KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard
          title="Total Kategori"
          accent="primary"
          icon={<GoogleIcon name="category" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 tracking-tight truncate tabular-nums">
              {summary.totalCategories} Kategori
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Mendukung semua jenis produk
            </p>
          }
        />

        <KpiCard
          title="Kategori Terisi"
          accent="emerald"
          icon={<GoogleIcon name="check_circle" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 tracking-tight truncate tabular-nums">
              {summary.filledCount} Terisi
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              {summary.emptyCount} kategori belum memiliki produk
            </p>
          }
        />

        <KpiCard
          title="Total Produk"
          accent="secondary"
          icon={<GoogleIcon name="layers" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 tracking-tight truncate tabular-nums">
              {summary.totalSku} SKU
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Total model produk di semua kategori
            </p>
          }
        />

        <KpiCard
          title="Total Stok"
          accent="accent"
          icon={<GoogleIcon name="deployed_code" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 tracking-tight truncate tabular-nums">
              {summary.totalStok} Pcs
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Akumulasi unit stok lintas kategori
            </p>
          }
        />
      </div>

      {/* Search & Simple Table Workspace */}
      <div className="space-y-3">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="Cari nama kategori atau status (terisi / kosong)..."
        />

        {fetchError && (
          <ErrorBanner
            message={fetchError}
            onRetry={() => setRetryCount(c => c + 1)}
            className="mb-3"
          />
        )}

        {/* Table & Mobile Cards */}
        <div className="overflow-hidden">
          {/* MOBILE LIST CARDS (md:hidden) */}
          <div className="md:hidden divide-y divide-zinc-200/80 border-t border-zinc-200">
            {isLoading && rows.length === 0 ? (
              <div className="py-12 px-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
                <GoogleIcon name="progress_activity" size={18} className="animate-spin text-primary" />
                <span>Memuat daftar kategori...</span>
              </div>
            ) : paginatedItems.length === 0 ? (
              <div className="py-12 px-4 text-center text-zinc-400">
                <GoogleIcon name="layers" size={36} className="mx-auto mb-2 text-zinc-300" />
                <p className="text-sm font-semibold text-zinc-600">Tidak ada kategori produk</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {hasSearchQuery
                    ? `Pencarian "${search}" tidak cocok dengan kategori mana pun.`
                    : 'Belum ada kategori terdaftar di toko.'}
                </p>
                {hasSearchQuery ? (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-primary bg-primary-soft hover:bg-primary-soft/80 rounded-xl transition-colors cursor-pointer border border-primary-border"
                  >
                    <GoogleIcon name="close" size={14} />
                    <span>Bersihkan Pencarian</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenAddCategoryModal}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer border border-zinc-200"
                  >
                    <GoogleIcon name="add" size={14} />
                    <span>Tambah Kategori Baru</span>
                  </button>
                )}
              </div>
            ) : (
              paginatedItems.map(row => (
                  <div
                    key={row.name}
                    className="p-4 flex flex-col gap-3 hover:bg-zinc-50/70 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-xl bg-zinc-50 text-zinc-700 border border-zinc-200/80 flex items-center justify-center shrink-0">
                          <GoogleIcon name="category" size={18} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4 className="text-sm sm:text-base font-bold text-gray-900 truncate">{row.name}</h4>
                            {isRecentlyCreated(row.createdAt, nowMs) && <NewBadge />}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 font-mono tabular-nums">
                            {row.count} SKU
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border shrink-0 ${
                          row.count > 0
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        {row.count > 0 ? 'Terisi' : 'Kosong'}
                      </span>
                    </div>

                    <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>
                          Total Stok:{' '}
                          <strong className="text-gray-900 font-mono tabular-nums">
                            {row.totalStok} pcs
                          </strong>
                        </span>
                      </div>

                      <ActionDropdownMenu
                        ariaLabel={`Aksi untuk ${row.name}`}
                        items={[
                          {
                            id: 'detail',
                            label: 'Lihat Detail',
                            icon: <GoogleIcon name="visibility" size={14} />,
                            onClick: () => setDetailCategory(row),
                          },
                          {
                            id: 'edit',
                            label: 'Edit Kategori',
                            icon: <GoogleIcon name="edit" size={14} />,
                            onClick: () => onEditCategory(row.name),
                          },
                          {
                            id: 'delete',
                            label: 'Hapus Kategori',
                            icon: <GoogleIcon name="delete" size={14} />,
                            tone: 'danger',
                            dividerBefore: true,
                            disabled: row.count > 0,
                            disabledReason: row.count > 0 ? 'Masih dipakai produk' : undefined,
                            onClick: () => setDeletingCategory(row.name),
                          },
                        ]}
                      />
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead className="border-b border-zinc-200 text-zinc-500 uppercase font-semibold tracking-wider text-xs">
                <tr>
                  <SortableTh
                    label="Kategori Produk"
                    sortKey="name"
                    currentSortBy={sortBy}
                    currentSortDir={sortDir}
                    onSort={key => handleHeaderSort(key, 'asc')}
                    className="py-3 px-3.5 sm:px-4"
                  />
                  <SortableTh
                    label="Jumlah Produk"
                    sortKey="count"
                    currentSortBy={sortBy}
                    currentSortDir={sortDir}
                    onSort={key => handleHeaderSort(key, 'desc')}
                    align="center"
                    className="py-3 px-3 sm:px-4"
                  />
                  <SortableTh
                    label="Total Stok"
                    sortKey="totalStok"
                    currentSortBy={sortBy}
                    currentSortDir={sortDir}
                    onSort={key => handleHeaderSort(key, 'desc')}
                    align="center"
                    className="py-3 px-3 sm:px-4"
                  />
                  <th className="py-3 px-3 sm:px-4 text-center">Status</th>
                  <th className="py-3 px-3 sm:px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70 font-medium text-zinc-700">
                {isLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-400">
                      <div className="inline-flex items-center gap-2">
                        <GoogleIcon name="progress_activity" size={18} className="animate-spin text-primary" />
                        <span>Memuat daftar kategori...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-400">
                      <GoogleIcon name="layers" size={36} className="mx-auto mb-2 text-zinc-300" />
                      <p className="text-sm font-semibold text-zinc-600">
                        Tidak ada kategori produk
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {hasSearchQuery
                          ? `Pencarian "${search}" tidak cocok dengan kategori mana pun.`
                          : 'Belum ada kategori terdaftar di toko.'}
                      </p>
                      {hasSearchQuery ? (
                        <button
                          type="button"
                          onClick={handleClearSearch}
                          className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-primary bg-primary-soft hover:bg-primary-soft/80 rounded-xl transition-colors cursor-pointer border border-primary-border"
                        >
                          <GoogleIcon name="close" size={14} />
                          <span>Bersihkan Pencarian</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onOpenAddCategoryModal}
                          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer border border-zinc-200"
                        >
                          <GoogleIcon name="add" size={14} />
                          <span>Tambah Kategori Baru</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map(row => (
                      <tr key={row.name} className="hover:bg-zinc-100/60 transition-colors">
                        <td className="py-3.5 px-3.5 sm:px-4">
                          <div className="flex items-center gap-3">
                            <span className="w-9 h-9 rounded-lg bg-zinc-50 text-zinc-700 border border-zinc-200/80 flex items-center justify-center shrink-0">
                              <GoogleIcon name="category" size={16} />
                            </span>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-zinc-950 text-xs sm:text-sm truncate">
                                {row.name}
                              </span>
                              {isRecentlyCreated(row.createdAt, nowMs) && <NewBadge />}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 sm:px-4 text-center whitespace-nowrap">
                          <span className="font-mono font-bold text-zinc-900 text-xs sm:text-sm tabular-nums">
                            {row.count} SKU
                          </span>
                        </td>
                        <td className="py-3.5 px-3 sm:px-4 text-center whitespace-nowrap">
                          <span className="font-mono font-semibold text-zinc-800 text-xs sm:text-sm tabular-nums">
                            {row.totalStok} pcs
                          </span>
                        </td>
                        <td className="py-3.5 px-3 sm:px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                              row.count > 0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                          >
                            {row.count > 0 ? 'Terisi' : 'Kosong'}
                          </span>
                        </td>
                        <td className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                          <ActionDropdownMenu
                            ariaLabel={`Aksi untuk ${row.name}`}
                            items={[
                              {
                                id: 'detail',
                                label: 'Lihat Detail',
                                icon: <GoogleIcon name="visibility" size={14} />,
                                onClick: () => setDetailCategory(row),
                              },
                              {
                                id: 'edit',
                                label: 'Edit Kategori',
                                icon: <GoogleIcon name="edit" size={14} />,
                                onClick: () => onEditCategory(row.name),
                              },
                              {
                                id: 'delete',
                                label: 'Hapus Kategori',
                                icon: <GoogleIcon name="delete" size={14} />,
                                tone: 'danger',
                                dividerBefore: true,
                                disabled: row.count > 0,
                                disabledReason: row.count > 0 ? 'Masih dipakai produk' : undefined,
                                onClick: () => setDeletingCategory(row.name),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            isLoading={isLoading}
            onPageChange={goToPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deletingCategory}
        title="Hapus Kategori"
        description={
          deletingCategory
            ? `Apakah Anda yakin ingin menghapus kategori "${deletingCategory}"? Kategori hanya dapat dihapus jika tidak ada barang yang menggunakannya.`
            : ''
        }
        confirmLabel="Ya, Hapus Kategori"
        isLoading={isDeleting}
        onCancel={() => setDeletingCategory(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Detail Kategori Modal */}
      <ModalShell
        isOpen={!!detailCategory}
        onClose={() => setDetailCategory(null)}
        size="md"
        title="Detail Kategori"
        footer={
          detailCategory ? (
            <div className={MODAL_FOOTER_END_CLASS}>
              <button
                type="button"
                onClick={() => setDetailCategory(null)}
                className={MODAL_BTN_SECONDARY_CLASS}
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetName = detailCategory.name;
                  setDetailCategory(null);
                  onEditCategory(targetName);
                }}
                className={MODAL_BTN_PRIMARY_CLASS}
              >
                <GoogleIcon name="edit" size={15} className="shrink-0" />
                <span>Edit Kategori</span>
              </button>
            </div>
          ) : undefined
        }
      >
        {detailCategory && (() => {
          const sharePercent =
            summary.totalSku > 0
              ? Math.round((detailCategory.count / summary.totalSku) * 100)
              : 0;
          return (
            <div className="space-y-4 text-sm">
              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Nama Kategori</span>
                  <span className="font-bold text-zinc-950 text-right">{detailCategory.name}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Status</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                      detailCategory.count > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {detailCategory.count > 0 ? 'Terisi' : 'Kosong'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Jumlah Produk</span>
                  <span className="font-mono font-bold text-zinc-900 tabular-nums">
                    {detailCategory.count} SKU
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Total Stok</span>
                  <span className="font-mono font-semibold text-zinc-900 tabular-nums">
                    {detailCategory.totalStok} pcs
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Porsi Katalog</span>
                  <span className="font-mono font-semibold text-zinc-800 tabular-nums">
                    {sharePercent}%
                  </span>
                </div>
              </div>

              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200/70 mb-2.5">
                  <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                    Produk dalam Kategori ({detailCategory.count})
                  </span>
                </div>
                {isLoadingDetail ? (
                  <div className="py-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
                    <GoogleIcon name="progress_activity" size={16} className="animate-spin text-primary" />
                    <span>Memuat produk...</span>
                  </div>
                ) : detailProducts.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-3 text-center">
                    Belum ada produk pada kategori ini.
                  </p>
                ) : (
                  <div className="bg-white rounded-lg border border-zinc-200/70 divide-y divide-zinc-100 max-h-56 overflow-y-auto">
                    {detailProducts.map(prod => (
                      <div key={prod.id} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-900 truncate">{prod.name}</p>
                          <p className="text-zinc-400 font-mono">
                            {prod.sku} &bull; {prod.stok} pcs
                          </p>
                        </div>
                        <span className="font-mono font-bold text-zinc-900 shrink-0 tabular-nums">
                          {formatIDR(prod.harga)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </ModalShell>
    </div>
  );
};
