import React, { useState, useEffect, useMemo } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { PromoCampaign, Product, PromoStatsSummary } from '../../types';
import { AddEditPromoModal } from './AddEditPromoModal';
import { PaginationControls } from '../common/PaginationControls';
import { ConfirmModal } from '../common/ConfirmModal';
import { useDebounce } from '../../hooks/useDebounce';
import { posApi } from '../../services/api';
import { SearchInput } from '../common/SearchInput';
import { ErrorBanner } from '../common/ErrorBanner';
import { useToast } from '../../contexts/ToastContext';
import Tooltip from '../Tooltip';
import { ActionDropdownMenu } from '../common/ActionDropdownMenu';
import { formatIDR } from '../../utils/formatters';
import {
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
  BTN_PRIMARY_CLASS,
  BTN_SECONDARY_CLASS,
} from '../common/ModalShell';
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

import {
  formatPromoDate,
  getPromoEffectiveStatus,
  getPromoStatusSummary,
  PromoEffectiveStatus,
} from '../../utils/promoDuration';

function getLifecycleBadgeStyle(status: PromoEffectiveStatus): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
    case 'scheduled':
      return 'bg-blue-50 text-blue-700 border border-blue-200/80';
    case 'expired':
      return 'bg-rose-50 text-rose-700 border border-rose-200/80';
    case 'inactive':
    default:
      return 'bg-zinc-100 text-zinc-600 border border-zinc-200';
  }
}

interface PromoManagementViewProps {
  refreshTrigger: number;
  onSavePromo: (promo: PromoCampaign, isEdit?: boolean) => Promise<void>;
  onDeletePromo: (id: string) => Promise<void>;
  onTogglePromoStatus: (id: string) => Promise<void>;
}

export const PromoManagementView: React.FC<PromoManagementViewProps> = ({
  refreshTrigger,
  onSavePromo,
  onDeletePromo,
  onTogglePromoStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 220);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCampaign | null>(null);
  const [detailPromo, setDetailPromo] = useState<PromoCampaign | null>(null);
  const [deletingPromo, setDeletingPromo] = useState<PromoCampaign | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [items, setItems] = useState<PromoCampaign[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<PromoStatsSummary>({
    totalPromos: 0,
    activeCount: 0,
    scheduledCount: 0,
    expiredCount: 0,
    inactiveCount: 0,
    totalPromoProducts: 0,
    avgDiscount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { showToast } = useToast();

  const [productList, setProductList] = useState<Product[]>([]);
  const promoTimestamps = useMemo(() => items.map(p => p.createdAt), [items]);
  const nowMs = useNewBadgeClock(promoTimestamps);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, sortBy, sortDir]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setFetchError(null);

    posApi
      .getPromos(
        {
          page: currentPage,
          pageSize,
          search: debouncedSearch || undefined,
          sortBy,
          sortDir,
        },
        controller.signal
      )
      .then(res => {
        setItems(Array.isArray(res.items) ? res.items : []);
        setTotalItems(res.total ?? 0);
        setTotalPages(res.totalPages ?? 1);
        if (res.stats) setStats(res.stats);
        if (res.page !== currentPage) setCurrentPage(res.page ?? 1);
        setIsLoading(false);
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          const msg = err instanceof Error ? err.message : 'Gagal memuat daftar promo.';
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
    sortBy,
    sortDir,
    refreshTrigger,
    retryCount,
    showToast,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    posApi
      .getProducts({ page: 1, pageSize: 200 }, controller.signal)
      .then(res => setProductList(res.items))
      .catch(() => {
        // Ignore background abort
      });
    return () => controller.abort();
  }, [refreshTrigger]);

  const productMap = useMemo(() => new Map(productList.map(p => [p.id, p])), [productList]);

  const handleHeaderSort = (key: string, defaultDir: SortDirection = 'desc') => {
    const next = getNextColumnSort(key, sortBy, sortDir, defaultDir);
    setSortBy(next.sortBy);
    setSortDir(next.sortDir);
  };

  const hasSearchQuery = searchQuery.trim().length > 0;

  const handleClearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleCopyCode = (code: string) => {
    try {
      navigator.clipboard?.writeText(code);
      setCopiedCode(code);
      showToast('success', `Kode promo "${code}" disalin ke clipboard.`);
      setTimeout(() => setCopiedCode(null), 1800);
    } catch {
      showToast('error', 'Gagal menyalin kode promo.');
    }
  };

  const handleOpenAddModal = () => {
    setEditingPromo(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (promo: PromoCampaign) => {
    setEditingPromo(promo);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (promo: PromoCampaign) => {
    if (getPromoEffectiveStatus(promo) === 'expired') {
      showToast(
        'warning',
        `Masa berlaku promo "${promo.name}" sudah berakhir pada ${formatPromoDate(promo.endDate)}. Perpanjang durasi promo terlebih dahulu.`
      );
      handleOpenEditModal(promo);
      return;
    }
    setTogglingId(promo.id);
    try {
      await onTogglePromoStatus(promo.id);
      setDetailPromo(prev => (prev && prev.id === promo.id ? { ...prev, isActive: !prev.isActive } : prev));
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPromo) return;
    setIsDeleting(true);
    try {
      await onDeletePromo(deletingPromo.id);
      if (detailPromo?.id === deletingPromo.id) {
        setDetailPromo(null);
      }
      setDeletingPromo(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const detailProducts = useMemo(() => {
    if (!detailPromo) return [];
    return detailPromo.productIds
      .map(id => productMap.get(id))
      .filter((p): p is Product => Boolean(p));
  }, [detailPromo, productMap]);

  return (
    <div className="space-y-4 pb-8">
      {/* Page Header (Unboxed, Tanpa Card) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-zinc-950 leading-tight tracking-tight">
            Manajemen Promo &amp; Diskon
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Kelola kampanye diskon produk, periode berlaku, dan status promo aktif di kasir POS.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className={BTN_PRIMARY_CLASS}
          >
            <GoogleIcon name="add" size={16} />
            <span>Buat Promo Baru</span>
          </button>
        </div>
      </div>

      {/* 4 Modern KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard
          title="Total Kampanye Promo"
          accent="amber"
          icon={<GoogleIcon name="sell" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 tracking-tight truncate tabular-nums">
              {stats?.totalPromos ?? 0} Promo
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              {(stats?.scheduledCount ?? 0) > 0 || (stats?.expiredCount ?? 0) > 0
                ? `${stats?.scheduledCount ?? 0} terjadwal • ${stats?.expiredCount ?? 0} berakhir`
                : 'Seluruh kampanye terdaftar'}
            </p>
          }
        />

        <KpiCard
          title="Promo Aktif"
          accent="emerald"
          icon={<GoogleIcon name="check_circle" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 tracking-tight truncate tabular-nums">
              {stats?.activeCount ?? 0} Aktif
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Sedang dalam masa berlaku
            </p>
          }
        />

        <KpiCard
          title="Produk Terdampak"
          accent="secondary"
          icon={<GoogleIcon name="deployed_code" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 tracking-tight truncate tabular-nums">
              {stats?.totalPromoProducts ?? 0} SKU
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Mendapat potongan harga
            </p>
          }
        />

        <KpiCard
          title="Rata-Rata Diskon"
          accent="orange"
          icon={<GoogleIcon name="percent" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-orange-600 tracking-tight truncate tabular-nums">
              {stats?.avgDiscount ?? 0}%
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Rata-rata promo aktif
            </p>
          }
        />
      </div>

      {/* Table Workspace (Unboxed, Tanpa Card Pembungkus) */}
      <div className="space-y-3">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Cari nama promo, kode voucher, label, diskon, deskripsi, atau status..."
        />

        {fetchError && (
          <ErrorBanner
            message={fetchError}
            onRetry={() => setRetryCount(c => c + 1)}
            className="mb-3"
          />
        )}

        <div className="overflow-hidden">
          {isLoading && items.length === 0 ? (
            <div className="py-12 px-4 flex items-center justify-center gap-2 text-xs sm:text-sm text-zinc-400">
              <GoogleIcon name="progress_activity" size={18} className="animate-spin text-primary" />
              <span>Memuat daftar promo...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 px-4 text-center text-zinc-400">
              <GoogleIcon name="sell" size={36} className="mx-auto mb-2 text-zinc-300" />
              <p className="text-sm font-semibold text-zinc-700">Tidak ada promo ditemukan</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {hasSearchQuery
                  ? `Pencarian "${searchQuery}" tidak cocok dengan promo mana pun.`
                  : 'Belum ada kampanye promo yang dibuat.'}
              </p>
              {hasSearchQuery ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className={`mt-3 ${BTN_SECONDARY_CLASS}`}
                >
                  <GoogleIcon name="close" size={14} />
                  <span>Bersihkan Pencarian</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className={`mt-3 ${BTN_PRIMARY_CLASS}`}
                >
                  <GoogleIcon name="add" size={14} />
                  <span>Buat Promo Baru</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* MOBILE CARDS (md:hidden) */}
              <div className="md:hidden divide-y divide-zinc-200/80 border-t border-zinc-200">
                {items.map(promo => {
                  const summary = getPromoStatusSummary(promo);
                  const isCurrentlyActive = summary.status === 'active';
                  const toggleTooltip =
                    summary.status === 'expired'
                      ? 'Masa berlaku habis — klik untuk perpanjang durasi'
                      : summary.status === 'scheduled'
                      ? 'Terjadwal — klik untuk nonaktifkan'
                      : summary.status === 'active'
                      ? 'Aktif — klik untuk nonaktifkan'
                      : 'Nonaktif — klik untuk aktifkan';

                  return (
                    <div
                      key={promo.id}
                      className={`p-4 space-y-2.5 transition-colors ${
                        isCurrentlyActive || summary.status === 'scheduled'
                          ? 'hover:bg-zinc-50/80'
                          : 'bg-zinc-50/60 opacity-85'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className="px-2 py-0.5 text-xs font-bold font-mono rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xs">
                              -{promo.discountPercent}%
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(promo.code)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-200 cursor-pointer"
                            >
                              <span>{promo.code}</span>
                              <GoogleIcon name="content_copy" size={11} className="text-gray-400" />
                            </button>
                            <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md ${getLifecycleBadgeStyle(summary.status)}`}>
                              {summary.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-gray-900">{promo.name}</h4>
                            {isRecentlyCreated(promo.createdAt, nowMs) && <NewBadge />}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap text-xs text-gray-500 tabular-nums">
                            {summary.durationDays !== null && (
                              <span className="font-mono font-bold text-gray-900">
                                {summary.durationDays} Hari
                              </span>
                            )}
                            {summary.durationDays !== null && <span className="text-zinc-400">&bull;</span>}
                            <span>
                              {formatPromoDate(promo.startDate)} – {formatPromoDate(promo.endDate)}
                            </span>
                          </div>
                        </div>

                        <StatusToggle
                          checked={promo.isActive && summary.status !== 'expired'}
                          isLoading={togglingId === promo.id}
                          onChange={() => void handleToggleStatus(promo)}
                          ariaLabel={`Toggle Status Promo ${promo.name}`}
                          tooltip={toggleTooltip}
                        />
                      </div>

                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                          {promo.productIds.length > 0 ? `${promo.productIds.length} SKU` : 'Semua SKU'}
                        </span>
                        <ActionDropdownMenu
                          ariaLabel={`Aksi untuk ${promo.name}`}
                          items={[
                            {
                              id: 'detail',
                              label: 'Lihat Detail',
                              icon: <GoogleIcon name="visibility" size={14} />,
                              onClick: () => setDetailPromo(promo),
                            },
                            {
                              id: 'edit',
                              label: 'Edit Promo',
                              icon: <GoogleIcon name="edit" size={14} />,
                              onClick: () => handleOpenEditModal(promo),
                            },
                            {
                              id: 'delete',
                              label: 'Hapus Promo',
                              icon: <GoogleIcon name="delete" size={14} />,
                              tone: 'danger',
                              dividerBefore: true,
                              onClick: () => setDeletingPromo(promo),
                            },
                          ]}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead className="text-zinc-500 uppercase font-semibold text-xs border-b border-zinc-200 tracking-wider">
                    <tr>
                      <SortableTh
                        label="Promo & Kode"
                        sortKey="name"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'asc')}
                        className="py-3 px-4 min-w-[210px]"
                      />
                      <SortableTh
                        label="Diskon"
                        sortKey="discountPercent"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'desc')}
                        align="center"
                        className="py-3 px-4 w-[140px]"
                      />
                      <SortableTh
                        label="Durasi & Masa Berlaku"
                        sortKey="endDate"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'desc')}
                        className="py-3 px-4 min-w-[205px]"
                      />
                      <th className="py-3 px-4 text-center w-[110px]">Produk</th>
                      <SortableTh
                        label="Status"
                        sortKey="isActive"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'desc')}
                        align="center"
                        className="py-3 px-4 w-[145px]"
                      />
                      <th className="py-3 px-3 text-center w-[72px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/70 font-medium text-zinc-700">
                    {items.map(promo => {
                      const summary = getPromoStatusSummary(promo);
                      const isRowLive = summary.status === 'active' || summary.status === 'scheduled';
                      const toggleTooltip =
                        summary.status === 'expired'
                          ? 'Masa berlaku habis — klik untuk perpanjang durasi'
                          : summary.status === 'scheduled'
                          ? 'Terjadwal — klik untuk nonaktifkan'
                          : summary.status === 'active'
                          ? 'Aktif — klik untuk nonaktifkan'
                          : 'Nonaktif — klik untuk aktifkan';

                      return (
                        <tr
                          key={promo.id}
                          className={`transition-colors ${
                            isRowLive ? 'hover:bg-zinc-100/60' : 'bg-zinc-50/60 opacity-85'
                          }`}
                        >
                          <td className="py-3.5 px-4 align-middle max-w-[260px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-gray-900 text-xs sm:text-sm truncate">
                                {promo.name}
                              </span>
                              {isRecentlyCreated(promo.createdAt, nowMs) && <NewBadge />}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Tooltip content="Klik untuk salin kode promo" side="top">
                                <button
                                  type="button"
                                  onClick={() => handleCopyCode(promo.code)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-200 transition-colors cursor-pointer"
                                >
                                  <span>{promo.code}</span>
                                  <GoogleIcon name="content_copy" size={11} className="text-gray-400" />
                                </button>
                              </Tooltip>
                              {copiedCode === promo.code && (
                                <span className="text-xs font-semibold text-emerald-600">Tersalin</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap align-middle">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-white font-mono font-bold text-xs shadow-2xs">
                              -{promo.discountPercent}%
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                            <div>
                              <span className="font-mono font-bold text-gray-900 text-xs sm:text-sm tabular-nums block">
                                {summary.durationDays !== null ? `${summary.durationDays} Hari` : '-'}
                              </span>
                              <span className="text-xs text-gray-500 block mt-0.5 tabular-nums">
                                {formatPromoDate(promo.startDate)} – {formatPromoDate(promo.endDate)}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap align-middle">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200 font-mono text-xs font-bold tabular-nums">
                              {promo.productIds.length > 0 ? `${promo.productIds.length} SKU` : 'Semua SKU'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap align-middle">
                            <div className="inline-flex items-center justify-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${getLifecycleBadgeStyle(
                                  summary.status
                                )}`}
                              >
                                {summary.label}
                              </span>
                              <StatusToggle
                                checked={promo.isActive && summary.status !== 'expired'}
                                isLoading={togglingId === promo.id}
                                onChange={() => void handleToggleStatus(promo)}
                                ariaLabel={`Toggle Status Promo ${promo.name}`}
                                tooltip={toggleTooltip}
                              />
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-center whitespace-nowrap align-middle">
                            <ActionDropdownMenu
                              ariaLabel={`Aksi untuk ${promo.name}`}
                              items={[
                                {
                                  id: 'detail',
                                  label: 'Lihat Detail',
                                  icon: <GoogleIcon name="visibility" size={14} />,
                                  onClick: () => setDetailPromo(promo),
                                },
                                {
                                  id: 'edit',
                                  label: 'Edit Promo',
                                  icon: <GoogleIcon name="edit" size={14} />,
                                  onClick: () => handleOpenEditModal(promo),
                                },
                                {
                                  id: 'delete',
                                  label: 'Hapus Promo',
                                  icon: <GoogleIcon name="delete" size={14} />,
                                  tone: 'danger',
                                  dividerBefore: true,
                                  onClick: () => setDeletingPromo(promo),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
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

      {/* Promo Detail Modal */}
      <ModalShell
        isOpen={!!detailPromo}
        onClose={() => setDetailPromo(null)}
        size="xl"
        title="Detail Promo"
        footer={
          detailPromo ? (
            <div className={MODAL_FOOTER_END_CLASS}>
              <button
                type="button"
                onClick={() => {
                  const target = detailPromo;
                  setDetailPromo(null);
                  handleOpenEditModal(target);
                }}
                className={MODAL_BTN_PRIMARY_CLASS}
              >
                <GoogleIcon name="edit" size={15} className="shrink-0" />
                <span>Edit Promo</span>
              </button>
            </div>
          ) : undefined
        }
      >
        {detailPromo && (
          <div className="space-y-4">
            {/* Promo Coupon Banner */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white shadow-md flex flex-col sm:flex-row items-stretch">
              {/* Left Body: Discount Value */}
              {(() => {
                const detailSummary = getPromoStatusSummary(detailPromo);
                return (
                  <div className="flex-1 px-4 py-4 sm:px-5 sm:py-5 flex flex-col justify-center min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold uppercase tracking-wider text-white/75 truncate">
                        {detailPromo.name}
                      </span>
                      {detailPromo.label && (
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-white/20 text-white rounded-md">
                          {detailPromo.label}
                        </span>
                      )}
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-white mt-0.5">
                      Diskon {detailPromo.discountPercent}%
                    </p>
                    <p className="text-xs text-white/85 mt-1 truncate tabular-nums">
                      Durasi:{' '}
                      <strong className="text-white">
                        {detailSummary.durationDays !== null ? `${detailSummary.durationDays} Hari` : '-'}
                      </strong>{' '}
                      ({formatPromoDate(detailPromo.startDate)} – {formatPromoDate(detailPromo.endDate)})
                      <span className="mx-1.5 text-white/50">&bull;</span>
                      <span>
                        {detailSummary.label} ({detailSummary.detailText})
                      </span>
                    </p>
                  </div>
                );
              })()}

              {/* Perforated Coupon Tear Line */}
              <div className="relative shrink-0 h-0 w-full sm:h-auto sm:w-0">
                {/* Mobile Horizontal Perforation & Notches */}
                <div className="sm:hidden absolute inset-x-3 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-white/25" />
                <span
                  aria-hidden="true"
                  className="sm:hidden absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white z-10"
                />
                <span
                  aria-hidden="true"
                  className="sm:hidden absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white z-10"
                />

                {/* Desktop Vertical Perforation & Notches */}
                <div className="hidden sm:block absolute inset-y-3 left-1/2 -translate-x-1/2 border-l-2 border-dashed border-white/25" />
                <span
                  aria-hidden="true"
                  className="hidden sm:block absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white z-10"
                />
                <span
                  aria-hidden="true"
                  className="hidden sm:block absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white z-10"
                />
              </div>

              {/* Right Coupon Stub: Promo Code */}
              <div className="bg-black/15 px-4 py-3.5 sm:px-6 sm:py-5 flex sm:flex-col items-center sm:justify-center justify-between gap-2 shrink-0 sm:min-w-[178px]">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/75">
                  Kode Promo
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(detailPromo.code)}
                  title="Klik untuk salin kode promo"
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-mono font-bold text-sm border border-dashed border-white/40 transition-colors cursor-pointer active:scale-[0.98]"
                >
                  <span>{detailPromo.code}</span>
                  <GoogleIcon name="content_copy" size={13} />
                </button>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-3.5 min-w-0">
                <span className="text-xs text-gray-500 block mb-1">Minimal Pembelian</span>
                {detailPromo.minPurchase ? (
                  <MoneyAmount
                    value={detailPromo.minPurchase}
                    maxFontPx={15}
                    minFontPx={12}
                    className="font-mono font-bold text-gray-900 tabular-nums"
                  />
                ) : (
                  <span className="font-mono font-bold text-gray-900 text-sm">
                    Tanpa Minimal Belanja
                  </span>
                )}
              </div>
              <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-3.5">
                <span className="text-xs text-gray-500 block mb-1">Total Produk Terdaftar</span>
                <span className="font-mono font-bold text-gray-900 text-sm">
                  {detailPromo.productIds.length} Item Produk (SKU)
                </span>
              </div>
            </div>

            {detailPromo.description && (
              <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-3.5 text-sm">
                <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider block mb-1">Deskripsi &amp; Syarat Promo</span>
                <p className="text-gray-600 leading-relaxed">{detailPromo.description}</p>
              </div>
            )}

            {/* Product List */}
            <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 mb-2.5">
                <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                  Daftar Produk dalam Promo ({detailPromo.productIds.length})
                </span>
              </div>
              {detailProducts.length === 0 ? (
                <p className="text-sm text-gray-500 py-3 text-center">
                  {detailPromo.productIds.length > 0
                    ? `${detailPromo.productIds.length} produk terpilih pada kampanye ini.`
                    : 'Belum ada produk yang dipilih pada kampanye ini.'}
                </p>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200/70 divide-y divide-gray-100 max-h-60 overflow-y-auto">
                  {detailProducts.map(prod => {
                    const discountedPrice = Math.round(
                      prod.harga * (1 - detailPromo.discountPercent / 100)
                    );
                    return (
                      <div key={prod.id} className="p-2.5 flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {prod.image ? (
                            <img
                              src={prod.image}
                              alt={prod.name}
                              className="w-9 h-9 rounded-md object-cover border border-gray-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-md bg-zinc-100 border border-gray-200 shrink-0 flex items-center justify-center text-zinc-400">
                              <GoogleIcon name="deployed_code" size={16} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-semibold text-gray-900 block truncate">{prod.name}</span>
                            <span className="text-xs text-gray-500 font-mono">
                              {prod.sku} &bull; {prod.category}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-zinc-950 block tabular-nums">
                            {formatIDR(discountedPrice)}
                          </span>
                          <span className="font-mono text-xs text-gray-400 line-through tabular-nums">
                            {formatIDR(prod.harga)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </ModalShell>

      {/* Add / Edit Promo Modal */}
      <AddEditPromoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={onSavePromo}
        editingPromo={editingPromo}
      />

      <ConfirmModal
        isOpen={!!deletingPromo}
        title="Hapus Promo"
        description={
          deletingPromo
            ? `Apakah Anda yakin ingin menghapus promo "${deletingPromo.name}" (${deletingPromo.code})?`
            : ''
        }
        confirmLabel="Ya, Hapus Promo"
        isLoading={isDeleting}
        onCancel={() => setDeletingPromo(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
