import React, { useState, useEffect } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { CustomSelect } from '../common/CustomSelect';
import {
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_SECONDARY_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
} from '../common/ModalShell';
import { posApi } from '../../services/api';
import { formatIDR } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';
import type {
  TransactionExportPeriod,
  TransactionExportPreview,
} from '../../types';

interface ExportTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MONTH_OPTIONS = [
  { value: '1', label: 'Januari' },
  { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' },
  { value: '4', label: 'April' },
  { value: '5', label: 'Mei' },
  { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },
  { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

const PERIOD_TABS: Array<{ id: TransactionExportPeriod; label: string }> = [
  { id: 'monthly', label: 'Bulanan' },
  { id: 'daily', label: 'Harian' },
  { id: 'custom', label: 'Rentang Tanggal' },
  { id: 'yearly', label: 'Tahunan' },
  { id: 'all', label: 'Semua' },
];

export const ExportTransactionsModal: React.FC<ExportTransactionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const firstDayOfMonthIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [period, setPeriod] = useState<TransactionExportPeriod>('monthly');
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [date, setDate] = useState<string>(todayIso);
  const [dateFrom, setDateFrom] = useState<string>(firstDayOfMonthIso);
  const [dateTo, setDateTo] = useState<string>(todayIso);

  const [preview, setPreview] = useState<TransactionExportPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const { showToast } = useToast();

  const yearOptions = Array.from({ length: 6 }, (_, i) => {
    const y = now.getFullYear() - i + 1;
    return { value: String(y), label: String(y) };
  });

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setIsLoadingPreview(true);
    setPreviewError(null);

    posApi
      .getTransactionsExportPreview(
        {
          period,
          month,
          year,
          date,
          dateFrom,
          dateTo,
          method: 'semua',
          statusFilter: 'completed',
          format: 'xlsx',
        },
        controller.signal
      )
      .then(res => {
        setPreview(res);
        setIsLoadingPreview(false);
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          setPreviewError(err instanceof Error ? err.message : 'Gagal memuat ringkasan laporan.');
          setIsLoadingPreview(false);
        }
      });

    return () => controller.abort();
  }, [isOpen, period, month, year, date, dateFrom, dateTo]);

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const { blob, filename } = await posApi.downloadTransactionsExport({
        period,
        month,
        year,
        date,
        dateFrom,
        dateTo,
        method: 'semua',
        statusFilter: 'completed',
        format: 'xlsx',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(
        'success',
        `Laporan Excel berhasil diunduh (${filename}).`,
        'Ekspor Laporan Selesai'
      );
      onClose();
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal mengunduh file laporan.'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const isInvalidCustomRange =
    period === 'custom' && Boolean(dateFrom) && Boolean(dateTo) && dateFrom > dateTo;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Export Laporan"
      disableEscapeClose={isDownloading}
      footer={
        <div className={MODAL_FOOTER_END_CLASS}>
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading}
            className={MODAL_BTN_SECONDARY_CLASS}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={
              isDownloading ||
              isLoadingPreview ||
              isInvalidCustomRange ||
              !preview ||
              preview.count === 0
            }
            className={MODAL_BTN_PRIMARY_CLASS}
          >
            <GoogleIcon
              name={isDownloading ? 'progress_activity' : 'download'}
              size={16}
              className={isDownloading ? 'animate-spin' : ''}
            />
            <span>{isDownloading ? 'Menyiapkan Excel...' : 'Unduh Excel (.xlsx)'}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Period Type Tabs */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            Periode Laporan
          </label>
          <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-100/90 border border-zinc-200 rounded-xl">
            {PERIOD_TABS.map(tab => {
              const active = period === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeriod(tab.id)}
                  className={`flex-1 min-w-fit h-8 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap text-center ${
                    active
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/60'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Period Controls */}
        {period === 'monthly' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Bulan
              </label>
              <CustomSelect
                size="md"
                value={String(month)}
                onChange={v => setMonth(Number(v))}
                options={MONTH_OPTIONS}
                ariaLabel="Pilih bulan laporan"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Tahun
              </label>
              <CustomSelect
                size="md"
                value={String(year)}
                onChange={v => setYear(Number(v))}
                options={yearOptions}
                ariaLabel="Pilih tahun laporan"
              />
            </div>
          </div>
        )}

        {period === 'daily' && (
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Tanggal
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full h-10 px-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
            />
          </div>
        )}

        {period === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full h-10 px-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full h-10 px-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
              />
            </div>
          </div>
        )}

        {period === 'yearly' && (
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Tahun
            </label>
            <CustomSelect
              size="md"
              value={String(year)}
              onChange={v => setYear(Number(v))}
              options={yearOptions}
              ariaLabel="Pilih tahun laporan"
            />
          </div>
        )}

        {/* Custom Range Warning */}
        {isInvalidCustomRange && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800 flex items-center gap-2">
            <GoogleIcon name="warning" size={15} className="text-amber-600 shrink-0" />
            <span>Tanggal awal tidak boleh melebihi tanggal akhir.</span>
          </div>
        )}

        {/* Structured Preview Summary */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-zinc-900 flex items-center gap-1.5 min-w-0">
              <GoogleIcon name="table_chart" size={16} className="text-primary shrink-0" />
              <span className="truncate">{preview?.periodLabel || 'Menyiapkan data...'}</span>
            </span>
            {isLoadingPreview && (
              <GoogleIcon name="progress_activity" size={14} className="animate-spin text-primary shrink-0" />
            )}
          </div>

          {previewError ? (
            <p className="text-xs text-red-600 font-medium">{previewError}</p>
          ) : preview ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white border border-zinc-200/80 rounded-lg px-2.5 py-2">
                  <span className="text-[11px] font-medium text-zinc-500 block">Jumlah Nota</span>
                  <span className="text-sm font-bold font-mono text-zinc-950 tabular-nums">
                    {preview.count} Nota
                  </span>
                </div>
                <div className="bg-white border border-zinc-200/80 rounded-lg px-2.5 py-2">
                  <span className="text-[11px] font-medium text-zinc-500 block">Total Qty</span>
                  <span className="text-sm font-bold font-mono text-zinc-950 tabular-nums">
                    {preview.totalQty} pcs
                  </span>
                </div>
                <div className="bg-white border border-zinc-200/80 rounded-lg px-2.5 py-2 min-w-0">
                  <span className="text-[11px] font-medium text-zinc-500 block">Total Omzet</span>
                  <span className="text-sm font-bold font-mono text-primary tabular-nums truncate block">
                    {formatIDR(preview.totalOmzet)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-200/70 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-500 shrink-0">Nama File</span>
                <span
                  className="font-mono text-xs font-semibold text-primary-text bg-primary-soft border border-primary-border/60 px-2.5 py-1 rounded-lg truncate min-w-0"
                  title={preview.filename}
                >
                  {preview.filename}
                </span>
              </div>

              {preview.count === 0 && (
                <p className="text-xs text-amber-700 font-medium">
                  Belum ada transaksi pada periode yang dipilih.
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
};
