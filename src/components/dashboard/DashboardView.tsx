import React, { useState, useEffect } from 'react';
import {
  TrendingDown,
  Loader2,
  Coins,
  ReceiptText,
  TrendingUp,
  Wallet,
  ShoppingBag,
  Package,
} from 'lucide-react';
import { DashboardSummaryResponse, Tenant } from '../../types';
import { CustomerServiceModal } from './CustomerServiceModal';
import { SalesVolumeChart } from './SalesVolumeChart';
import { posApi } from '../../services/api';
import { ErrorBanner } from '../common/ErrorBanner';
import { useToast } from '../../contexts/ToastContext';
import { MoneyAmount } from '../common/MoneyAmount';
import { KpiCard } from '../common/KpiCard';

interface DashboardViewProps {
  refreshTrigger: number;
  activeTenant?: Tenant;
  onNavigateTo: (menu: string) => void;
  onOpenRegisterTenant: () => void;
}

const EMPTY_SUMMARY: DashboardSummaryResponse = {
  period: 'HARI',
  displayTotalPenjualan: 0,
  displayPenjualanKotor: 0,
  displayLabaKotor: 0,
  displayPenerimaan: 0,
  displayTransaksi: 0,
  displayProduk: 0,
  activeLabels: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
  salesData: Array(12).fill(0),
  trxData: Array(12).fill(0),
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  refreshTrigger,
  activeTenant,
  onNavigateTo,
}) => {
  const [period, setPeriod] = useState<'HARI' | 'BULAN'>('HARI');
  const [summary, setSummary] = useState<DashboardSummaryResponse>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isCsModalOpen, setIsCsModalOpen] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setFetchError(null);

    posApi
      .getDashboardSummary(period, controller.signal)
      .then(res => {
        setSummary(res);
        setIsLoading(false);
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          const msg = err instanceof Error ? err.message : 'Gagal memuat ringkasan dashboard.';
          setFetchError(msg);
          setIsLoading(false);
          showToast('error', msg);
        }
      });

    return () => controller.abort();
  }, [period, refreshTrigger, retryCount, showToast]);

  const {
    displayTotalPenjualan,
    displayPenjualanKotor,
    displayLabaKotor,
    displayPenerimaan,
    displayTransaksi,
    displayProduk,
    activeLabels,
    salesData,
    trxData,
  } = summary;

  return (
    <div className="space-y-4 pb-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-zinc-950 leading-tight tracking-tight">
            Kelola Penjualan dan Stok dalam Satu Sistem
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1.5 leading-relaxed">
            Pantau transaksi kasir, manajemen inventaris, dan performa multi-outlet secara real-time dalam tampilan yang ringkas.
          </p>
        </div>
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setIsCsModalOpen(true)}
            className="h-9 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all inline-flex items-center justify-center whitespace-nowrap cursor-pointer shadow-xs active:scale-[0.98]"
          >
            Berlangganan Sekarang
          </button>
        </div>
      </div>

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-base sm:text-lg font-bold text-zinc-950 leading-tight">
              Ringkasan Penjualan {period === 'HARI' ? 'Harian' : 'Bulanan'}
            </h3>
            <span className="text-xs text-zinc-400" aria-hidden="true">&middot;</span>
            <span className="text-xs sm:text-sm font-medium text-zinc-500">
              {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            {isLoading && <Loader2 size={14} className="animate-spin text-zinc-900" />}
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            {period === 'HARI'
              ? 'Pantau omzet, laba kotor, transaksi, dan grafik penjualan per jam dibanding hari kemarin.'
              : 'Pantau akumulasi omzet, laba kotor, transaksi, dan grafik penjualan dibanding bulan kemarin.'}
          </p>
        </div>

        <div className="inline-flex h-9 p-0.5 bg-zinc-100/90 rounded-xl border border-zinc-200/80 self-start sm:self-auto items-center shrink-0">
          <button
            type="button"
            onClick={() => setPeriod('HARI')}
            className={`h-full px-3.5 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center ${
              period === 'HARI'
                ? 'bg-white text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            HARI
          </button>
          <button
            type="button"
            onClick={() => setPeriod('BULAN')}
            className={`h-full px-3.5 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center ${
              period === 'BULAN'
                ? 'bg-white text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            BULAN
          </button>
        </div>
      </div>

      {fetchError && (
        <ErrorBanner message={fetchError} onRetry={() => setRetryCount(c => c + 1)} />
      )}

      {/* 6 Modern Metric KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
        <KpiCard
          title="Total Penjualan"
          compactMobile
          tooltip="Total uang riil yang dibayarkan pembeli (Grand Total di struk termasuk pajak/PPN)."
          icon={<Coins size={15} strokeWidth={2} />}
          value={
            <MoneyAmount
              value={displayTotalPenjualan}
              maxFontPx={24}
              minFontPx={12}
              className="font-bold font-mono text-zinc-950 tracking-tight tabular-nums"
            />
          }
          footer={
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs min-w-0">
              <span className="inline-flex items-center gap-0.5 font-semibold text-rose-600 font-mono shrink-0">
                <TrendingDown size={12} />
                <span>92.23%</span>
              </span>
              <span className="text-zinc-400 truncate">
                termasuk PPN 11%
              </span>
            </div>
          }
        />

        <KpiCard
          title="Penjualan Kotor"
          compactMobile
          tooltip="Total harga murni produk yang terjual sebelum ditambah pajak atau potongan diskon."
          icon={<ReceiptText size={15} strokeWidth={2} />}
          value={
            <MoneyAmount
              value={displayPenjualanKotor}
              maxFontPx={24}
              minFontPx={12}
              className="font-bold font-mono text-zinc-950 tracking-tight tabular-nums"
            />
          }
          footer={
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs min-w-0">
              <span className="inline-flex items-center gap-0.5 font-semibold text-rose-600 font-mono shrink-0">
                <TrendingDown size={12} />
                <span>96.04%</span>
              </span>
              <span className="text-zinc-400 truncate">
                sebelum pajak
              </span>
            </div>
          }
        />

        <KpiCard
          title="Laba Kotor"
          compactMobile
          tooltip="Keuntungan bersih penjualan setelah dikurangi harga pokok pembelian (HPP modal produk)."
          icon={<TrendingUp size={15} strokeWidth={2} />}
          value={
            <MoneyAmount
              value={displayLabaKotor}
              maxFontPx={24}
              minFontPx={12}
              className="font-bold font-mono text-zinc-950 tracking-tight tabular-nums"
            />
          }
          footer={
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs min-w-0">
              <span className="inline-flex items-center gap-0.5 font-semibold text-rose-600 font-mono shrink-0">
                <TrendingDown size={12} />
                <span>91.4%</span>
              </span>
              <span className="text-zinc-400 truncate">
                estimasi margin HPP
              </span>
            </div>
          }
        />

        <KpiCard
          title="Penerimaan Kas Bersih"
          compactMobile
          tooltip="Total penerimaan kas bersih dari transaksi penjualan aktif."
          icon={<Wallet size={15} strokeWidth={2} />}
          value={
            <MoneyAmount
              value={displayPenerimaan}
              maxFontPx={24}
              minFontPx={12}
              className="font-bold font-mono text-zinc-950 tracking-tight tabular-nums"
            />
          }
          footer={
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs min-w-0">
              <span className="font-semibold text-zinc-500 font-mono shrink-0">
                100%
              </span>
              <span className="text-zinc-400 truncate">
                arus kas penjualan aktif
              </span>
            </div>
          }
        />

        <KpiCard
          title="Total Transaksi"
          compactMobile
          tooltip="Jumlah nota/struk belanja yang berhasil diselesaikan dan dibayar oleh pelanggan."
          icon={<ShoppingBag size={15} strokeWidth={2} />}
          value={
            <div className="text-lg sm:text-2xl font-bold font-mono text-zinc-950 truncate tabular-nums tracking-tight">
              {displayTransaksi} Nota
            </div>
          }
          footer={
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs min-w-0">
              <span className="inline-flex items-center gap-0.5 font-semibold text-rose-600 font-mono shrink-0">
                <TrendingDown size={12} />
                <span>85%</span>
              </span>
              <span className="text-zinc-400 truncate">
                transaksi selesai (non-void)
              </span>
            </div>
          }
        />

        <KpiCard
          title="Produk Terjual"
          compactMobile
          tooltip="Jumlah fisik produk yang terjual keluar dari stok toko."
          icon={<Package size={15} strokeWidth={2} />}
          value={
            <div className="text-lg sm:text-2xl font-bold font-mono text-zinc-950 truncate tabular-nums tracking-tight">
              {displayProduk} Pcs
            </div>
          }
          footer={
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs min-w-0">
              <span className="inline-flex items-center gap-0.5 font-semibold text-rose-600 font-mono shrink-0">
                <TrendingDown size={12} />
                <span>88.89%</span>
              </span>
              <span className="text-zinc-400 truncate">
                unit produk keluar
              </span>
            </div>
          }
        />
      </div>

      {/* Chart.js Interactive Line Chart Card */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 sm:p-5">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
          <div>
            <h4 className="text-sm sm:text-base font-bold text-zinc-950">
              Grafik Penjualan &amp; Volume Transaksi
            </h4>
            <p className="text-xs text-zinc-500 mt-0.5">
              {period === 'HARI'
                ? 'Distribusi omzet dan jumlah nota per interval waktu hari ini'
                : 'Distribusi omzet dan jumlah nota harian selama bulan berjalan'}
            </p>
          </div>
        </div>
        <SalesVolumeChart
          period={period}
          labels={activeLabels}
          salesData={salesData}
          trxData={trxData}
        />
      </div>

      <CustomerServiceModal
        isOpen={isCsModalOpen}
        onClose={() => setIsCsModalOpen(false)}
        activeTenant={activeTenant}
      />
    </div>
  );
};
