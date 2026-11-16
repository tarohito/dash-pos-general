import React, { useState, useEffect, useMemo } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Transaction, TransactionStatsSummary } from '../../types';
import { formatIDR } from '../../utils/formatters';
import { PaginationControls } from '../common/PaginationControls';
import { ConfirmModal } from '../common/ConfirmModal';
import { TransactionDetailModal } from './TransactionDetailModal';
import { ExportTransactionsModal } from './ExportTransactionsModal';
import { ActionDropdownMenu } from '../common/ActionDropdownMenu';
import { posApi } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import { SearchInput } from '../common/SearchInput';
import { ErrorBanner } from '../common/ErrorBanner';
import { useToast } from '../../contexts/ToastContext';
import { MoneyAmount } from '../common/MoneyAmount';
import { KpiCard } from '../common/KpiCard';
import { NewBadge } from '../common/NewBadge';
import { isRecentlyCreated, useNewBadgeClock } from '../../utils/newBadge';
import {
  SortableTh,
  SortDirection,
  getNextColumnSort,
} from '../common/TableSortControls';

interface DailyTransactionsViewProps {
  refreshTrigger: number;
  onSelectReceipt: (tx: Transaction) => void;
  onVoidTransaction: (id: string, reason: string, restoreStock: boolean) => Promise<void>;
  onNavigateToPos?: () => void;
  canVoid?: boolean;
}

export const DailyTransactionsView: React.FC<DailyTransactionsViewProps> = ({
  refreshTrigger,
  onSelectReceipt,
  onVoidTransaction,
  onNavigateToPos,
  canVoid = true,
}) => {
  const [txSearchQuery, setTxSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(txSearchQuery, 220);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [selectedDetailTx, setSelectedDetailTx] = useState<Transaction | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [items, setItems] = useState<Transaction[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<TransactionStatsSummary>({
    totalOmzetPenjualan: 0,
    totalBeratTerjual: 0,
    totalQtyTerjual: 0,
    totalTransaksi: 0,
    voidCount: 0,
    avgPerTransaksi: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { showToast } = useToast();

  const [voidingTx, setVoidingTx] = useState<Transaction | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const txTimestamps = useMemo(() => items.map(tx => tx.dateTime), [items]);
  const nowMs = useNewBadgeClock(txTimestamps);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, sortBy, sortDir]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setFetchError(null);

    posApi
      .getTransactions(
        {
          page: currentPage,
          pageSize,
          search: debouncedSearch,
          sortBy,
          sortDir,
        },
        controller.signal
      )
      .then(res => {
        const list = Array.isArray(res.items) ? res.items : [];
        setItems(list);
        setTotalItems(res.total ?? list.length);
        setTotalPages(res.totalPages ?? 1);
        if (res.stats) {
          setStats({
            totalOmzetPenjualan: res.stats.totalOmzetPenjualan ?? 0,
            totalBeratTerjual: res.stats.totalBeratTerjual ?? 0,
            totalQtyTerjual: res.stats.totalQtyTerjual ?? 0,
            totalTransaksi: res.stats.totalTransaksi ?? 0,
            voidCount: res.stats.voidCount ?? 0,
            avgPerTransaksi: res.stats.avgPerTransaksi ?? 0,
          });
        } else {
          const activeList = list.filter(tx => tx.status !== 'void');
          const sumOmzet = activeList.reduce((acc, tx) => acc + (tx.grandTotal || 0), 0);
          const sumBerat = activeList.reduce((acc, tx) => acc + (tx.totalBerat || 0), 0);
          const sumQty = activeList.reduce((acc, tx) => acc + (tx.totalQty || 0), 0);
          const voidTotal = list.filter(tx => tx.status === 'void').length;
          setStats({
            totalOmzetPenjualan: sumOmzet,
            totalBeratTerjual: sumBerat,
            totalQtyTerjual: sumQty,
            totalTransaksi: activeList.length,
            voidCount: voidTotal,
            avgPerTransaksi: activeList.length > 0 ? Math.round(sumOmzet / activeList.length) : 0,
          });
        }
        if (res.page !== currentPage) setCurrentPage(res.page ?? 1);
        setIsLoading(false);
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          const msg = err instanceof Error ? err.message : 'Gagal memuat riwayat transaksi.';
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

  const handleHeaderSort = (key: string, defaultDir: SortDirection = 'desc') => {
    const next = getNextColumnSort(key, sortBy, sortDir, defaultDir);
    setSortBy(next.sortBy);
    setSortDir(next.sortDir);
  };

  const hasSearchQuery = txSearchQuery.trim().length > 0;

  const handleClearSearch = () => {
    setTxSearchQuery('');
    setCurrentPage(1);
  };

  const handleOpenDetail = async (tx: Transaction) => {
    setLoadingActionId(tx.id);
    try {
      const full = await posApi.getTransactionById(tx.id);
      setSelectedDetailTx(full);
    } catch {
      setSelectedDetailTx(tx);
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleOpenPrint = async (tx: Transaction) => {
    setLoadingActionId(tx.id);
    try {
      const full = await posApi.getTransactionById(tx.id);
      onSelectReceipt(full);
    } catch {
      showToast('warning', 'Detail terbaru gagal dimuat dari server, mencetak data nota dari daftar.');
      onSelectReceipt(tx);
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleConfirmVoid = async (restoreStock: boolean, reason: string) => {
    if (!voidingTx) return;
    setIsVoiding(true);
    try {
      await onVoidTransaction(voidingTx.id, reason, restoreStock);
      setVoidingTx(null);
    } finally {
      setIsVoiding(false);
    }
  };

  const getPaymentBadgeInfo = (tx: Transaction): { label: string; badgeClass: string } => {
    if (tx.status === 'void') {
      return {
        label: 'Dibatalkan',
        badgeClass: 'bg-red-50 text-red-700 border border-red-200/80',
      };
    }
    if (tx.paymentMethod === 'cash') {
      return {
        label: 'Tunai',
        badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
      };
    }
    return {
      label: tx.paymentDetails.transferBank
        ? `Transfer (${tx.paymentDetails.transferBank})`
        : 'Transfer Bank',
      badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200/80',
    };
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Page Header (Unboxed, Tanpa Card) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-zinc-950 leading-tight tracking-tight">
            Daftar Transaksi Penjualan (Kasir POS)
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Arsip dan riwayat penjualan produk, rincian pembayaran, serta cetak ulang bukti nota resmi toko.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="h-9 px-4 text-xs sm:text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-full inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <GoogleIcon name="download" size={16} />
            <span>Export Laporan</span>
          </button>
        </div>
      </div>

      {/* 4 Modern KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard
          title="Total Omzet Penjualan"
          accent="primary"
          icon={<GoogleIcon name="payments" size={16} />}
          value={
            <MoneyAmount
              value={stats?.totalOmzetPenjualan ?? 0}
              maxFontPx={24}
              minFontPx={13}
              className="font-bold font-mono text-primary tracking-tight tabular-nums"
            />
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Uang masuk penjualan aktif
            </p>
          }
        />

        <KpiCard
          title="Total Produk Terjual"
          accent="secondary"
          icon={<GoogleIcon name="deployed_code" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 tracking-tight truncate tabular-nums">
              {stats?.totalQtyTerjual ?? 0} Pcs
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Total unit produk terjual
            </p>
          }
        />

        <KpiCard
          title="Total Transaksi"
          accent="accent"
          icon={<GoogleIcon name="receipt_long" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 tracking-tight truncate tabular-nums">
              {stats?.totalTransaksi ?? 0} Nota
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              {stats?.voidCount
                ? `${stats.voidCount} nota dibatalkan (void)`
                : 'Semua nota lunas & terverifikasi'}
            </p>
          }
        />

        <KpiCard
          title="Rata-rata / Nota"
          accent="emerald"
          icon={<GoogleIcon name="trending_up" size={16} />}
          value={
            <MoneyAmount
              value={stats?.avgPerTransaksi ?? 0}
              maxFontPx={24}
              minFontPx={13}
              className="font-bold font-mono text-zinc-950 tracking-tight tabular-nums"
            />
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Rata-rata nilai per transaksi
            </p>
          }
        />
      </div>

      {/* Table Workspace (Unboxed, Tanpa Card Pembungkus) */}
      <div className="space-y-3">
        <SearchInput
          value={txSearchQuery}
          onChange={setTxSearchQuery}
          placeholder="Cari no. nota, pelanggan, kasir, metode (tunai/transfer), status, kupon, atau produk..."
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
              <span>Memuat transaksi penjualan...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 px-4 text-center text-zinc-400">
              <GoogleIcon name="receipt_long" size={36} className="mx-auto mb-2 text-zinc-300" />
              <p className="text-sm font-semibold text-zinc-700">Tidak ada transaksi penjualan</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {hasSearchQuery
                  ? `Pencarian "${txSearchQuery}" tidak cocok dengan transaksi mana pun.`
                  : 'Belum ada transaksi penjualan kasir yang tercatat.'}
              </p>
              {hasSearchQuery ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-primary bg-primary-soft hover:bg-primary-soft/80 rounded-xl transition-colors cursor-pointer border border-primary-border"
                >
                  <GoogleIcon name="close" size={14} />
                  <span>Bersihkan Pencarian</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onNavigateToPos}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-primary bg-primary-soft hover:bg-primary-soft/80 rounded-xl transition-colors cursor-pointer border border-primary-border"
                >
                  <GoogleIcon name="add" size={14} />
                  <span>Buat Transaksi Penjualan Baru</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* MOBILE CARDS (md:hidden) */}
              <div className="md:hidden divide-y divide-zinc-200/80 border-t border-zinc-200">
                {items.map(tx => {
                  const isVoid = tx.status === 'void';
                  const firstItem = tx.items[0];
                  const remainingItems = Math.max(0, tx.items.length - 1);
                  const badge = getPaymentBadgeInfo(tx);
                  return (
                    <div
                      key={tx.id}
                      className={`p-4 space-y-2.5 transition-colors ${
                        isVoid ? 'bg-red-50/20 opacity-80' : 'hover:bg-zinc-50/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-gray-900 text-xs">
                              {tx.invoiceNo}
                            </span>
                            {isRecentlyCreated(tx.dateTime, nowMs) && <NewBadge />}
                            {isVoid && (
                              <span className="px-1.5 py-0.5 text-[11px] font-bold uppercase bg-red-100 text-red-700 border border-red-200 rounded-md">
                                VOID
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-zinc-500 block mt-0.5 tabular-nums">
                            {tx.dateStr} &bull; {tx.timeStr}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-md shrink-0 ${badge.badgeClass}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-zinc-950 truncate">{tx.customerName}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-zinc-600">
                          <span className="font-semibold text-zinc-900 truncate min-w-0 flex-1">
                            {firstItem ? firstItem.name : '-'}
                            {remainingItems > 0 ? ` (+${remainingItems} item)` : ''}
                          </span>
                          <span className="font-mono font-bold text-zinc-800 shrink-0 tabular-nums text-right">
                            {tx.totalQty} pcs
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                        <span
                          className={`font-mono font-bold text-sm tabular-nums ${
                            isVoid ? 'line-through text-gray-400' : 'text-gray-900'
                          }`}
                        >
                          {formatIDR(tx.grandTotal)}
                        </span>
                        <ActionDropdownMenu
                          ariaLabel={`Aksi untuk ${tx.invoiceNo}`}
                          items={[
                            {
                              id: 'detail',
                              label: loadingActionId === tx.id ? 'Memuat Detail...' : 'Lihat Detail',
                              icon: <GoogleIcon name="visibility" size={14} />,
                              onClick: () => void handleOpenDetail(tx),
                            },
                            {
                              id: 'print',
                              label: loadingActionId === tx.id ? 'Menyiapkan Nota...' : 'Cetak Nota',
                              icon: <GoogleIcon name="print" size={14} />,
                              tone: 'primary',
                              onClick: () => void handleOpenPrint(tx),
                            },
                            ...(canVoid
                              ? [
                                  {
                                    id: 'void',
                                    label: 'Void Transaksi',
                                    icon: <GoogleIcon name="undo" size={14} />,
                                    tone: 'warning' as const,
                                    dividerBefore: true,
                                    disabled: isVoid,
                                    disabledReason: isVoid ? 'Transaksi sudah di-void' : undefined,
                                    onClick: () => setVoidingTx(tx),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[900px] table-fixed text-xs sm:text-sm text-left border-collapse">
                  <thead className="text-zinc-500 uppercase font-semibold text-xs border-b border-zinc-200 tracking-wider">
                    <tr>
                      <SortableTh
                        label="No. Transaksi"
                        sortKey="newest"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'desc')}
                        className="py-3 px-3 w-[186px]"
                      />
                      <SortableTh
                        label="Pelanggan"
                        sortKey="customerName"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'asc')}
                        className="py-3 px-3 w-[155px] xl:w-[175px] 2xl:w-[210px]"
                      />
                      <th className="py-3 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">
                        Nama Produk
                      </th>
                      <th className="py-3 px-2.5 w-[72px] text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">
                        Qty
                      </th>
                      <SortableTh
                        label="Pembayaran"
                        sortKey="paymentMethod"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'asc')}
                        align="center"
                        className="py-3 px-2.5 w-[146px]"
                      />
                      <SortableTh
                        label="Total Bayar"
                        sortKey="grandTotal"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'desc')}
                        align="right"
                        className="py-3 px-3 w-[128px]"
                      />
                      <th className="py-3 px-2.5 text-center w-[54px] whitespace-nowrap">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/70 font-medium text-zinc-700">
                    {items.map(tx => {
                      const isVoid = tx.status === 'void';
                      const firstItem = tx.items[0];
                      const remainingItems = Math.max(0, tx.items.length - 1);
                      const badge = getPaymentBadgeInfo(tx);
                      return (
                        <tr
                          key={tx.id}
                          className={`transition-colors ${
                            isVoid ? 'bg-red-50/20 opacity-80' : 'hover:bg-zinc-100/60'
                          }`}
                        >
                          <td className="py-3.5 px-3 align-middle">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="font-mono font-bold text-zinc-950 text-xs truncate"
                                title={tx.invoiceNo}
                              >
                                {tx.invoiceNo}
                              </span>
                              {isRecentlyCreated(tx.dateTime, nowMs) && <NewBadge />}
                              {isVoid && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200 rounded-md shrink-0">
                                  VOID
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-zinc-500 block mt-0.5 tabular-nums truncate">
                              {tx.dateStr} &bull; {tx.timeStr}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 align-middle">
                            <span
                              className="font-bold text-zinc-950 truncate block text-xs sm:text-sm"
                              title={tx.customerName}
                            >
                              {tx.customerName}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 align-middle">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="font-bold text-zinc-950 text-xs sm:text-sm truncate"
                                title={tx.items.map(i => `${i.name} (${i.qty} pcs)`).join(', ')}
                              >
                                {firstItem ? firstItem.name : '-'}
                              </span>
                              {remainingItems > 0 && (
                                <span className="text-[11px] bg-zinc-100 text-zinc-700 font-semibold px-1.5 py-0.5 rounded-md border border-zinc-200/80 shrink-0 whitespace-nowrap">
                                  +{remainingItems} item
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-2.5 text-center whitespace-nowrap align-middle font-mono font-semibold text-zinc-800 text-xs sm:text-sm tabular-nums">
                            {tx.totalQty} pcs
                          </td>

                          <td className="py-3.5 px-2.5 text-center whitespace-nowrap align-middle">
                            <span
                              className={`inline-block max-w-full truncate text-xs font-semibold px-2 py-0.5 rounded-md ${badge.badgeClass}`}
                              title={badge.label}
                            >
                              {badge.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-right whitespace-nowrap align-middle">
                            <span
                              className={`font-mono font-bold text-xs sm:text-sm block tabular-nums ${
                                isVoid ? 'line-through text-zinc-400' : 'text-zinc-950'
                              }`}
                            >
                              {formatIDR(tx.grandTotal)}
                            </span>
                          </td>

                          <td className="py-3.5 px-2.5 text-center whitespace-nowrap align-middle">
                            <ActionDropdownMenu
                              ariaLabel={`Aksi untuk ${tx.invoiceNo}`}
                              items={[
                                {
                                  id: 'detail',
                                  label: loadingActionId === tx.id ? 'Memuat Detail...' : 'Lihat Detail',
                                  icon: <GoogleIcon name="visibility" size={14} />,
                                  onClick: () => void handleOpenDetail(tx),
                                },
                                {
                                  id: 'print',
                                  label: loadingActionId === tx.id ? 'Menyiapkan Nota...' : 'Cetak Nota',
                                  icon: <GoogleIcon name="print" size={14} />,
                                  tone: 'primary',
                                  onClick: () => void handleOpenPrint(tx),
                                },
                                ...(canVoid
                                  ? [
                                      {
                                        id: 'void',
                                        label: 'Void Transaksi',
                                        icon: <GoogleIcon name="undo" size={14} />,
                                        tone: 'warning' as const,
                                        dividerBefore: true,
                                        disabled: isVoid,
                                        disabledReason: isVoid ? 'Transaksi sudah di-void' : undefined,
                                        onClick: () => setVoidingTx(tx),
                                      },
                                    ]
                                  : []),
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

      <TransactionDetailModal
        isOpen={!!selectedDetailTx}
        transaction={selectedDetailTx}
        onClose={() => setSelectedDetailTx(null)}
        onPrintReceipt={onSelectReceipt}
      />

      <ConfirmModal
        isOpen={!!voidingTx}
        variant="void"
        title="Batalkan Transaksi"
        description={
          voidingTx
            ? `Transaksi ${voidingTx.invoiceNo} atas nama "${voidingTx.customerName}" senilai ${formatIDR(voidingTx.grandTotal)} akan ditandai sebagai VOID agar tetap tercatat dalam jejak audit kasir.`
            : ''
        }
        inputLabel="Alasan Pembatalan / Void"
        inputPlaceholder="Contoh: Salah input metode bayar / pelanggan batal beli"
        inputRequired
        checkboxLabel="Kembalikan stok produk yang terjual kembali ke inventaris"
        defaultChecked={true}
        confirmLabel="Ya, Void Transaksi"
        loadingLabel="Memproses Void..."
        isLoading={isVoiding}
        onCancel={() => setVoidingTx(null)}
        onConfirm={handleConfirmVoid}
      />

      <ExportTransactionsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
};
