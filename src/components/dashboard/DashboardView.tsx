import React, { useState, useEffect } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { DashboardSummaryResponse, Tenant, UserAccount } from '../../types';
import { SalesVolumeChart } from './SalesVolumeChart';
import {
  PaymentBreakdownChartCard,
  TopSellingChartCard,
} from './DashboardInsightsCharts';
import { posApi } from '../../services/api';
import { ErrorBanner } from '../common/ErrorBanner';
import { useToast } from '../../contexts/ToastContext';
import { MoneyAmount } from '../common/MoneyAmount';
import { KpiCard } from '../common/KpiCard';
import { BTN_PRIMARY_CLASS, BTN_SECONDARY_CLASS } from '../common/ModalShell';
import { formatIDR } from '../../utils/formatters';

interface DashboardViewProps {
  refreshTrigger: number;
  activeTenant?: Tenant;
  currentUser?: UserAccount | null;
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
  totalTax: 0,
  enablePpn: true,
  ppnPercent: 11,
  marginPercent: 0,
  avgPerTransaksi: 0,
  cashPercent: 0,
  transferPercent: 0,
  voidCount: 0,
  activeSkuCount: 0,
  lowStockCount: 0,
  activeLabels: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
  salesData: Array(12).fill(0),
  trxData: Array(12).fill(0),
  topProducts: [],
  topCategories: [],
  paymentBreakdown: [],
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  refreshTrigger,
  currentUser,
  onNavigateTo,
}) => {
  const [period, setPeriod] = useState<'HARI' | 'BULAN'>('HARI');
  const [summary, setSummary] = useState<DashboardSummaryResponse>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
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
    totalTax = 0,
    enablePpn = true,
    ppnPercent = 11,
    marginPercent = 0,
    avgPerTransaksi = 0,
    cashPercent = 0,
    transferPercent = 0,
    voidCount = 0,
    activeSkuCount = 0,
    lowStockCount = 0,
    activeLabels,
    salesData,
    trxData,
    topProducts = [],
    topCategories = [],
    paymentBreakdown = [],
  } = summary;

  const displayName = currentUser?.fullName?.trim() || currentUser?.username || 'Pengguna';

  return (
    <div className="space-y-4 pb-6">
      {/* User Welcome Banner */}
      <div className="relative rounded-2xl border border-zinc-200 bg-white/85 backdrop-blur-xs p-4 sm:p-6">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-zinc-950 leading-tight tracking-tight">
              Halo, <span className="text-primary">{displayName}</span>!
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 mt-1 leading-relaxed max-w-2xl">
              Selamat datang kembali di dashboard LogicPOS. Pantau performa penjualan, pergerakan stok, dan aktivitas transaksi hari ini dengan cepat.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTo('Kasir POS (Penjualan)')}
              className={BTN_PRIMARY_CLASS}
            >
              <GoogleIcon name="shopping_cart" size={16} />
              <span>Buka Kasir POS</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTo('Transaksi')}
              className={BTN_SECONDARY_CLASS}
            >
              <GoogleIcon name="receipt_long" size={16} />
              <span>Lihat Transaksi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Page Header (Unboxed, Tanpa Card) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-lg sm:text-xl font-bold text-zinc-950 leading-tight tracking-tight">
              Ringkasan Penjualan {period === 'HARI' ? 'Harian' : 'Bulanan'}
            </h3>
            <span className="text-xs text-zinc-400" aria-hidden="true">&middot;</span>
            <span className="text-xs sm:text-sm font-semibold text-primary">
              {period === 'HARI'
                ? new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                : new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </span>
            {isLoading && <GoogleIcon name="progress_activity" size={14} className="animate-spin text-primary" />}
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            {period === 'HARI'
              ? 'Pantau omzet, laba kotor, transaksi, dan grafik penjualan hari ini per interval waktu.'
              : 'Pantau akumulasi omzet, laba kotor, transaksi, dan grafik penjualan selama bulan berjalan.'}
          </p>
        </div>

        <div className="inline-flex h-9 p-0.5 bg-zinc-100/90 rounded-full border border-zinc-200 self-start sm:self-auto items-center shrink-0">
          <button
            type="button"
            onClick={() => setPeriod('HARI')}
            className={`h-full px-3.5 text-xs sm:text-sm font-semibold rounded-full transition-all cursor-pointer flex items-center justify-center ${
              period === 'HARI'
                ? 'bg-primary text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-950'
            }`}
          >
            HARI
          </button>
          <button
            type="button"
            onClick={() => setPeriod('BULAN')}
            className={`h-full px-3.5 text-xs sm:text-sm font-semibold rounded-full transition-all cursor-pointer flex items-center justify-center ${
              period === 'BULAN'
                ? 'bg-primary text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-950'
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
          accent="primary"
          compactMobile
          tooltip="Total uang riil yang dibayarkan pembeli (Grand Total di struk termasuk pajak/PPN jika aktif)."
          icon={<GoogleIcon name="payments" size={15} />}
          value={
            <MoneyAmount
              value={displayTotalPenjualan}
              maxFontPx={24}
              minFontPx={12}
              className="font-bold font-mono text-primary tracking-tight tabular-nums"
            />
          }
          footer={
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs min-w-0">
              {enablePpn ? (
                <>
                  <span className="font-semibold text-primary font-mono shrink-0">
                    PPN {ppnPercent}%
                  </span>
                  <span className="text-zinc-500 truncate">
                    aktif &middot; {formatIDR(totalTax)}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-emerald-600 shrink-0">
                    Bebas PPN
                  </span>
                  <span className="text-zinc-500 truncate">
                    harga final struk
                  </span>
                </>
              )}
            </div>
          }
        />

        <KpiCard
          title="Penjualan Kotor"
          accent="secondary"
          compactMobile
          tooltip="Total harga murni produk yang terjual sebelum ditambah pajak PPN."
          icon={<GoogleIcon name="receipt_long" size={15} />}
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
              <span className="font-semibold text-zinc-700 font-mono shrink-0">
                {displayTransaksi > 0 ? formatIDR(avgPerTransaksi) : 'Rp 0'}
              </span>
              <span className="text-zinc-500 truncate">
                {displayTransaksi > 0 ? 'rata-rata / nota' : 'belum ada transaksi'}
              </span>
            </div>
          }
        />

        <KpiCard
          title="Laba Kotor"
          accent="emerald"
          compactMobile
          tooltip="Estimasi keuntungan penjualan setelah dikurangi harga pokok pembelian (HPP modal produk)."
          icon={<GoogleIcon name="trending_up" size={15} />}
          value={
            <MoneyAmount
              value={displayLabaKotor}
              maxFontPx={24}
              minFontPx={12}
              className="font-bold font-mono text-emerald-700 tracking-tight tabular-nums"
            />
          }
          footer={
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs min-w-0">
              <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600 font-mono shrink-0">
                <GoogleIcon name="trending_up" size={12} />
                <span>{marginPercent}%</span>
              </span>
              <span className="text-zinc-500 truncate">
                margin berbasis HPP
              </span>
            </div>
          }
        />

        <KpiCard
          title="Penerimaan Penjualan"
          accent="primary"
          compactMobile
          tooltip="Total penerimaan pembayaran bersih dari transaksi penjualan aktif (Tunai & Non-Tunai)."
          icon={<GoogleIcon name="account_balance_wallet" size={15} />}
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
              <span className="font-semibold text-secondary font-mono shrink-0">
                Tunai {cashPercent}%
              </span>
              <span className="text-zinc-500 truncate">
                &middot; Non-Tunai {transferPercent}%
              </span>
            </div>
          }
        />

        <KpiCard
          title="Total Transaksi"
          accent="accent"
          compactMobile
          tooltip="Jumlah nota/struk belanja yang berhasil diselesaikan dan dibayar oleh pelanggan."
          icon={<GoogleIcon name="shopping_bag" size={15} />}
          value={
            <div className="text-lg sm:text-2xl font-bold font-mono text-zinc-950 truncate tabular-nums tracking-tight">
              {displayTransaksi} Nota
            </div>
          }
          footer={
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs min-w-0">
              {voidCount > 0 ? (
                <>
                  <span className="font-semibold text-rose-600 font-mono shrink-0">
                    {voidCount} Void
                  </span>
                  <span className="text-zinc-500 truncate">
                    nota dibatalkan
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-emerald-600 shrink-0">
                    100% Selesai
                  </span>
                  <span className="text-zinc-500 truncate">
                    semua nota terverifikasi
                  </span>
                </>
              )}
            </div>
          }
        />

        <KpiCard
          title="Produk Terjual"
          accent="secondary"
          compactMobile
          tooltip="Jumlah fisik unit produk yang terjual keluar dari stok outlet."
          icon={<GoogleIcon name="deployed_code" size={15} />}
          value={
            <div className="text-lg sm:text-2xl font-bold font-mono text-zinc-950 truncate tabular-nums tracking-tight">
              {displayProduk} Pcs
            </div>
          }
          footer={
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs min-w-0">
              {lowStockCount > 0 ? (
                <>
                  <span className="font-semibold text-amber-600 font-mono shrink-0">
                    {lowStockCount} SKU
                  </span>
                  <span className="text-zinc-500 truncate">
                    stok menipis (&le;5 pcs)
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-emerald-600 font-mono shrink-0">
                    {activeSkuCount} SKU
                  </span>
                  <span className="text-zinc-500 truncate">
                    produk aktif tersedia
                  </span>
                </>
              )}
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

      {/* Supporting Insights Charts (2-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopSellingChartCard
          period={period}
          topProducts={topProducts}
          topCategories={topCategories}
        />
        <PaymentBreakdownChartCard
          period={period}
          totalAmount={displayPenerimaan}
          totalTransactions={displayTransaksi}
          breakdown={paymentBreakdown}
        />
      </div>
    </div>
  );
};
