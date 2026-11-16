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

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="md"
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
            disabled={isDownloading || isLoadingPreview || !preview || preview.count === 0}
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
            Pilih Periode
          </label>
          <div className="inline-flex flex-wrap p-1 bg-zinc-100/90 border border-zinc-200 rounded-full gap-0.5 max-w-full">
            {PERIOD_TABS.map(tab => {
              const active = period === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeriod(tab.id)}
                  className={`h-8 px-3 text-sm font-semibold rounded-full transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950'
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

        {/* Compact Summary */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
              <GoogleIcon name="table_chart" size={16} className="text-primary" />
              <span>{preview?.periodLabel || 'Menyiapkan data...'}</span>
            </span>
            {isLoadingPreview && (
              <GoogleIcon name="progress_activity" size={14} className="animate-spin text-primary shrink-0" />
            )}
          </div>

          {previewError ? (
            <p className="text-xs text-red-600 font-medium">{previewError}</p>
          ) : preview ? (
            <>
              <div className="flex items-center justify-between gap-2 text-sm pt-0.5">
                <span className="text-zinc-500">Total Data:</span>
                <span className="font-mono font-bold text-zinc-950 tabular-nums">
                  {preview.count} Nota ({preview.totalQty} pcs) &bull;{' '}
                  <span className="text-primary">{formatIDR(preview.totalOmzet)}</span>
                </span>
              </div>

              <div className="flex items-start justify-between gap-2 text-sm">
                <span className="text-zinc-500 shrink-0">File Excel:</span>
                <span
                  className="font-mono text-xs font-semibold text-primary-text bg-primary-soft px-2 py-0.5 rounded-md break-all text-right"
                  title={preview.filename}
                >
                  {preview.filename}
                </span>
              </div>

              {preview.count === 0 && (
                <p className="text-xs text-amber-700 font-medium pt-1">
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
