import React, { useState, useEffect, useCallback } from 'react';
import { GoogleIcon, GoogleIconName } from '../common/GoogleIcon';
import {
  AuditLogRecord,
  AuditLogsStatsSummary,
  AuditSeverity,
  BackupDatabaseInfo,
  Tenant,
} from '../../types';
import { posApi } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import { SearchInput } from '../common/SearchInput';
import { CustomSelect } from '../common/CustomSelect';
import { PaginationControls } from '../common/PaginationControls';
import { ErrorBanner } from '../common/ErrorBanner';
import { KpiCard } from '../common/KpiCard';
import { useToast } from '../../contexts/ToastContext';
import {
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_SECONDARY_CLASS,
  BTN_PRIMARY_CLASS,
  BTN_SECONDARY_CLASS,
} from '../common/ModalShell';

interface AuditBackupViewProps {
  tenants: Tenant[];
}

const SEVERITY_META: Record<
  AuditSeverity,
  { label: string; icon: GoogleIconName; badgeClass: string }
> = {
  info: {
    label: 'Info',
    icon: 'info',
    badgeClass: 'bg-zinc-100 text-zinc-700 border border-zinc-200/90',
  },
  warning: {
    label: 'Peringatan',
    icon: 'warning',
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
  },
  critical: {
    label: 'Kritis',
    icon: 'error',
    badgeClass: 'bg-red-50 text-red-700 border border-red-200',
  },
};

const ENTITY_LABELS: Record<string, string> = {
  auth: 'Autentikasi',
  transaction: 'Transaksi',
  product: 'Produk',
  category: 'Kategori',
  promo: 'Promo',
  tenant: 'Outlet / Tenant',
  user: 'Pengguna',
  settings: 'Pengaturan',
  backup: 'Backup Data',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  branch_manager: 'Kepala Cabang',
  cashier: 'Kasir',
  system: 'Sistem',
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function formatDateTimeId(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const AuditBackupView: React.FC<AuditBackupViewProps> = ({ tenants }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 220);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<AuditLogsStatsSummary>({
    totalLogs: 0,
    todayLogs: 0,
    warningAndCriticalLogs: 0,
    uniqueActors: 0,
  });

  const [backupInfo, setBackupInfo] = useState<BackupDatabaseInfo | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [isLoadingBackupInfo, setIsLoadingBackupInfo] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [downloadingFormat, setDownloadingFormat] = useState<'sqlite' | 'json' | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);

  const { showToast } = useToast();

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, severityFilter, entityFilter, tenantFilter, sortDir]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingLogs(true);
    setFetchError(null);

    posApi
      .getAuditLogs(
        {
          page: currentPage,
          pageSize,
          search: debouncedSearch,
          severity: severityFilter,
          entityType: entityFilter,
          tenantId: tenantFilter,
          sortDir,
        },
        controller.signal
      )
      .then(res => {
        setLogs(Array.isArray(res.items) ? res.items : []);
        setTotalItems(res.total ?? 0);
        setTotalPages(res.totalPages ?? 1);
        if (res.stats) {
          setStats(res.stats);
        }
        if (res.page !== currentPage) {
          setCurrentPage(res.page ?? 1);
        }
        setIsLoadingLogs(false);
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          const msg = err instanceof Error ? err.message : 'Gagal memuat jejak audit aktivitas.';
          setFetchError(msg);
          setIsLoadingLogs(false);
          showToast('error', msg);
        }
      });

    return () => controller.abort();
  }, [
    currentPage,
    pageSize,
    debouncedSearch,
    severityFilter,
    entityFilter,
    tenantFilter,
    sortDir,
    refreshTick,
    showToast,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingBackupInfo(true);
    posApi
      .getBackupInfo(controller.signal)
      .then(info => {
        setBackupInfo(info);
        setIsLoadingBackupInfo(false);
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          setIsLoadingBackupInfo(false);
        }
      });
    return () => controller.abort();
  }, [refreshTick]);

  const handleDownloadBackup = useCallback(
    async (format: 'sqlite' | 'json') => {
      if (downloadingFormat) return;
      setDownloadingFormat(format);
      try {
        const { blob, filename } = await posApi.downloadBackupFile(format);
        triggerBlobDownload(blob, filename);
        showToast(
          'success',
          format === 'sqlite'
            ? `Snapshot database SQLite "${filename}" berhasil diunduh.`
            : `Backup data JSON "${filename}" berhasil diunduh.`
        );
        setRefreshTick(t => t + 1);
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Gagal mengunduh file backup.');
      } finally {
        setDownloadingFormat(null);
      }
    },
    [downloadingFormat, showToast]
  );

  const hasActiveFilter =
    searchQuery.trim().length > 0 ||
    severityFilter !== 'all' ||
    entityFilter !== 'all' ||
    tenantFilter !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSeverityFilter('all');
    setEntityFilter('all');
    setTenantFilter('all');
    setCurrentPage(1);
  };

  const totalDbBytes = (backupInfo?.fileSizeBytes ?? 0) + (backupInfo?.walSizeBytes ?? 0);

  return (
    <div className="space-y-4 pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-zinc-950 leading-tight tracking-tight">
              Audit Log &amp; Backup Data
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-accent-soft text-accent-text border border-accent-border">
              <GoogleIcon name="verified_user" size={12} />
              <span>Khusus Owner</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Pantau jejak aktivitas sensitif di seluruh outlet serta unduh snapshot database SQLite maupun arsip JSON.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            disabled={downloadingFormat !== null}
            onClick={() => void handleDownloadBackup('json')}
            className={`${BTN_SECONDARY_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <GoogleIcon
              name={downloadingFormat === 'json' ? 'progress_activity' : 'download'}
              size={15}
              className={downloadingFormat === 'json' ? 'animate-spin' : ''}
            />
            <span>{downloadingFormat === 'json' ? 'Menyiapkan JSON...' : 'Export JSON'}</span>
          </button>

          <button
            type="button"
            disabled={downloadingFormat !== null}
            onClick={() => void handleDownloadBackup('sqlite')}
            className={`${BTN_PRIMARY_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <GoogleIcon
              name={downloadingFormat === 'sqlite' ? 'progress_activity' : 'database'}
              size={15}
              className={downloadingFormat === 'sqlite' ? 'animate-spin' : ''}
            />
            <span>
              {downloadingFormat === 'sqlite' ? 'Membuat Snapshot...' : 'Backup SQLite (.db)'}
            </span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard
          title="Total Jejak Audit"
          accent="primary"
          icon={<GoogleIcon name="history" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-primary tracking-tight tabular-nums">
              {stats.totalLogs.toLocaleString('id-ID')}
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Dari {stats.uniqueActors} aktor / akun tercatat
            </p>
          }
        />

        <KpiCard
          title="Aktivitas Hari Ini"
          accent="secondary"
          icon={<GoogleIcon name="schedule" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 tracking-tight tabular-nums">
              {stats.todayLogs.toLocaleString('id-ID')}
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Tercatat pada tanggal WIB hari ini
            </p>
          }
        />

        <KpiCard
          title="Peringatan & Kritis"
          accent="accent"
          icon={<GoogleIcon name="warning" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 tracking-tight tabular-nums">
              {stats.warningAndCriticalLogs.toLocaleString('id-ID')}
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Void nota, login gagal, hapus data, pengaturan
            </p>
          }
        />

        <KpiCard
          title="Ukuran Database SQLite"
          accent="emerald"
          icon={<GoogleIcon name="database" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 tracking-tight tabular-nums">
              {isLoadingBackupInfo && !backupInfo ? '...' : formatBytes(totalDbBytes)}
            </div>
          }
          footer={
            <p className="text-xs text-zinc-500 mt-1 truncate font-mono tabular-nums">
              {(backupInfo?.totalRecords ?? 0).toLocaleString('id-ID')} total baris data
            </p>
          }
        />
      </div>

      {/* Database Snapshot & Table Inventory Strip */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <GoogleIcon name="database" size={16} className="text-primary shrink-0" />
              <h4 className="text-sm font-bold text-zinc-950">
                Status Database &amp; Riwayat Backup
              </h4>
              {backupInfo && (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                  {backupInfo.fileName} &bull; {backupInfo.journalMode}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {backupInfo?.lastBackupAt ? (
                <>
                  Backup terakhir:{' '}
                  <span className="font-mono font-semibold text-zinc-800 tabular-nums">
                    {formatDateTimeId(backupInfo.lastBackupAt)}
                  </span>{' '}
                  oleh <span className="font-semibold text-zinc-800">{backupInfo.lastBackupBy || 'Owner'}</span>
                  {backupInfo.lastBackupFormat ? ` (${backupInfo.lastBackupFormat.toUpperCase()})` : ''}
                </>
              ) : (
                'Belum ada riwayat unduhan backup tercatat. Gunakan tombol Backup SQLite (.db) untuk menyimpan salinan konsisten.'
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {backupInfo && (
              <div className="text-xs text-zinc-500 font-mono tabular-nums px-2.5 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200/80">
                DB: {formatBytes(backupInfo.fileSizeBytes)}
                {backupInfo.walSizeBytes > 0 ? ` + WAL: ${formatBytes(backupInfo.walSizeBytes)}` : ''}
              </div>
            )}
            <button
              type="button"
              onClick={() => setRefreshTick(t => t + 1)}
              disabled={isLoadingLogs || isLoadingBackupInfo}
              className={`${BTN_SECONDARY_CLASS} h-8 px-3 text-xs`}
              title="Segarkan Data Audit & Info Database"
            >
              <GoogleIcon
                name="sync"
                size={14}
                className={isLoadingLogs || isLoadingBackupInfo ? 'animate-spin' : ''}
              />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {backupInfo && backupInfo.tables.length > 0 && (
          <div className="pt-2.5 border-t border-zinc-100 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {backupInfo.tables.map(tbl => (
              <div
                key={tbl.tableName}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-50/90 border border-zinc-200/70 flex items-center justify-between gap-2 min-w-0"
              >
                <span className="text-xs text-zinc-600 font-medium truncate" title={tbl.tableName}>
                  {tbl.label}
                </span>
                <span className="text-xs font-mono font-bold text-zinc-900 tabular-nums shrink-0">
                  {tbl.rowCount.toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Filters & Audit Trail Table */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
          <div className="md:col-span-5">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Cari aktor, aksi, entitas, ringkasan, outlet, atau IP..."
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:col-span-7 md:grid-cols-12 gap-2">
            <div className="md:col-span-4">
              <CustomSelect
                value={severityFilter}
                onChange={setSeverityFilter}
                ariaLabel="Filter Tingkat Keparahan"
                options={[
                  { value: 'all', label: 'Semua Tingkat' },
                  { value: 'info', label: 'Info' },
                  { value: 'warning', label: 'Peringatan' },
                  { value: 'critical', label: 'Kritis' },
                ]}
              />
            </div>

            <div className="md:col-span-4">
              <CustomSelect
                value={entityFilter}
                onChange={setEntityFilter}
                ariaLabel="Filter Modul Entitas"
                options={[
                  { value: 'all', label: 'Semua Modul' },
                  { value: 'auth', label: 'Autentikasi' },
                  { value: 'transaction', label: 'Transaksi' },
                  { value: 'product', label: 'Produk' },
                  { value: 'category', label: 'Kategori' },
                  { value: 'promo', label: 'Promo' },
                  { value: 'tenant', label: 'Outlet / Tenant' },
                  { value: 'user', label: 'Pengguna' },
                  { value: 'settings', label: 'Pengaturan' },
                  { value: 'backup', label: 'Backup Data' },
                ]}
              />
            </div>

            <div className="col-span-2 sm:col-span-1 md:col-span-4 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <CustomSelect
                  value={tenantFilter}
                  onChange={setTenantFilter}
                  ariaLabel="Filter Outlet"
                  options={[
                    { value: 'all', label: 'Semua Outlet' },
                    ...tenants.map(t => ({
                      value: t.id,
                      label: `${t.code} • ${t.name}`,
                    })),
                  ]}
                />
              </div>

              <button
                type="button"
                onClick={() => setSortDir(prev => (prev === 'desc' ? 'asc' : 'desc'))}
                className={`${BTN_SECONDARY_CLASS} h-10 px-3 shrink-0`}
                title={sortDir === 'desc' ? 'Urutan: Terbaru dulu' : 'Urutan: Terlama dulu'}
              >
                <GoogleIcon
                  name={sortDir === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                  size={15}
                />
                <span className="hidden xl:inline">{sortDir === 'desc' ? 'Terbaru' : 'Terlama'}</span>
              </button>
            </div>
          </div>
        </div>

        {fetchError && (
          <ErrorBanner
            message={fetchError}
            onRetry={() => setRefreshTick(t => t + 1)}
            className="mb-3"
          />
        )}

        <div className="overflow-hidden">
          {isLoadingLogs && logs.length === 0 ? (
            <div className="py-12 px-4 flex items-center justify-center gap-2 text-xs sm:text-sm text-zinc-400">
              <GoogleIcon name="progress_activity" size={18} className="animate-spin text-primary" />
              <span>Memuat jejak audit aktivitas...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 px-4 text-center text-zinc-400">
              <GoogleIcon name="history" size={36} className="mx-auto mb-2 text-zinc-300" />
              <p className="text-sm font-semibold text-zinc-700">Belum ada catatan audit ditemukan</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {hasActiveFilter
                  ? 'Tidak ada aktivitas yang cocok dengan filter atau kata kunci pencarian.'
                  : 'Aktivitas login, perubahan produk, void transaksi, pengaturan, dan backup akan tercatat otomatis.'}
              </p>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className={`mt-3 ${BTN_SECONDARY_CLASS}`}
                >
                  <GoogleIcon name="close" size={14} />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* MOBILE CARDS */}
              <div className="md:hidden divide-y divide-zinc-200/80 border-t border-zinc-200">
                {logs.map(log => {
                  const sev = SEVERITY_META[log.severity] ?? SEVERITY_META.info;
                  return (
                    <div
                      key={log.id}
                      className="p-3.5 space-y-2 hover:bg-zinc-50/80 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-zinc-900">
                              {log.action}
                            </span>
                            <span className="text-[11px] font-semibold text-zinc-500">
                              &bull; {ENTITY_LABELS[log.entityType] || log.entityType}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-zinc-500 tabular-nums block mt-0.5">
                            {formatDateTimeId(log.createdAt)}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0 ${sev.badgeClass}`}
                        >
                          <GoogleIcon name={sev.icon} size={12} />
                          <span>{sev.label}</span>
                        </span>
                      </div>

                      <p className="text-xs text-zinc-800 leading-relaxed">{log.summary}</p>

                      <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-zinc-500">
                        <span className="truncate">
                          <strong className="text-zinc-800">{log.actorName}</strong> (
                          {ROLE_LABELS[log.actorRole] || log.actorRole})
                          {log.tenantName ? ` • ${log.tenantName}` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 text-primary font-semibold shrink-0 cursor-pointer hover:underline"
                        >
                          <GoogleIcon name="visibility" size={13} />
                          <span>Detail</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[920px] table-fixed text-xs sm:text-sm text-left border-collapse">
                  <thead className="text-zinc-500 uppercase font-semibold text-xs border-b border-zinc-200 tracking-wider">
                    <tr>
                      <th className="py-3 px-3 w-[165px]">Waktu</th>
                      <th className="py-3 px-3 w-[170px]">Aktor</th>
                      <th className="py-3 px-3 w-[170px]">Aksi &amp; Modul</th>
                      <th className="py-3 px-3">Ringkasan Aktivitas</th>
                      <th className="py-3 px-2.5 w-[112px] text-center">Tingkat</th>
                      <th className="py-3 px-2.5 w-[72px] text-center">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/70 font-medium text-zinc-700">
                    {logs.map(log => {
                      const sev = SEVERITY_META[log.severity] ?? SEVERITY_META.info;
                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-zinc-100/60 transition-colors"
                        >
                          <td className="py-3 px-3 align-middle">
                            <span className="font-mono text-xs text-zinc-800 tabular-nums block truncate">
                              {formatDateTimeId(log.createdAt)}
                            </span>
                            {log.ipAddress && (
                              <span className="font-mono text-[11px] text-zinc-400 tabular-nums block truncate mt-0.5">
                                IP: {log.ipAddress}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 align-middle">
                            <span
                              className="font-bold text-zinc-950 text-xs sm:text-sm truncate block"
                              title={log.actorName}
                            >
                              {log.actorName}
                            </span>
                            <span className="text-[11px] text-zinc-500 block truncate mt-0.5">
                              {ROLE_LABELS[log.actorRole] || log.actorRole}
                              {log.tenantName ? ` • ${log.tenantName}` : ''}
                            </span>
                          </td>

                          <td className="py-3 px-3 align-middle">
                            <span className="font-mono text-xs font-bold text-zinc-900 block truncate">
                              {log.action}
                            </span>
                            <span className="text-[11px] text-zinc-500 block truncate mt-0.5">
                              {ENTITY_LABELS[log.entityType] || log.entityType}
                              {log.entityLabel ? ` • ${log.entityLabel}` : ''}
                            </span>
                          </td>

                          <td className="py-3 px-3 align-middle">
                            <p
                              className="text-xs sm:text-sm text-zinc-800 line-clamp-2"
                              title={log.summary}
                            >
                              {log.summary}
                            </p>
                          </td>

                          <td className="py-3 px-2.5 text-center align-middle whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${sev.badgeClass}`}
                            >
                              <GoogleIcon name={sev.icon} size={12} />
                              <span>{sev.label}</span>
                            </span>
                          </td>

                          <td className="py-3 px-2.5 text-center align-middle whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedLog(log)}
                              className="w-8 h-8 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-600 hover:text-zinc-950 inline-flex items-center justify-center transition-colors cursor-pointer"
                              aria-label={`Lihat detail audit ${log.id}`}
                            >
                              <GoogleIcon name="visibility" size={15} />
                            </button>
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
            isLoading={isLoadingLogs}
            onPageChange={setCurrentPage}
            onPageSizeChange={size => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Audit Detail Modal */}
      <ModalShell
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        size="lg"
        title="Detail Jejak Audit"
        footer={
          <div className={MODAL_FOOTER_END_CLASS}>
            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className={MODAL_BTN_SECONDARY_CLASS}
            >
              Tutup
            </button>
          </div>
        }
      >
        {selectedLog && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1">
                <span className="text-zinc-400 font-semibold uppercase tracking-wider block">
                  Aksi &amp; Modul
                </span>
                <p className="font-mono font-bold text-zinc-950 text-sm">{selectedLog.action}</p>
                <p className="text-zinc-600">
                  Modul: <strong>{ENTITY_LABELS[selectedLog.entityType] || selectedLog.entityType}</strong>
                  {selectedLog.entityLabel ? ` (${selectedLog.entityLabel})` : ''}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1">
                <span className="text-zinc-400 font-semibold uppercase tracking-wider block">
                  Aktor &amp; Waktu
                </span>
                <p className="font-bold text-zinc-950 text-sm">
                  {selectedLog.actorName} ({ROLE_LABELS[selectedLog.actorRole] || selectedLog.actorRole})
                </p>
                <p className="font-mono text-zinc-600 tabular-nums">
                  {formatDateTimeId(selectedLog.createdAt)}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                Ringkasan Kejadian
              </span>
              <p className="p-3 rounded-xl bg-white border border-zinc-200 text-sm text-zinc-900 leading-relaxed">
                {selectedLog.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200/70">
                <span className="text-zinc-400 block">ID Log</span>
                <span className="font-mono font-semibold text-zinc-900 break-all">{selectedLog.id}</span>
              </div>
              <div className="px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200/70">
                <span className="text-zinc-400 block">Outlet Terkait</span>
                <span className="font-semibold text-zinc-900">{selectedLog.tenantName || 'Semua / Sistem'}</span>
              </div>
              <div className="px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200/70">
                <span className="text-zinc-400 block">Alamat IP</span>
                <span className="font-mono font-semibold text-zinc-900 tabular-nums">
                  {selectedLog.ipAddress || '-'}
                </span>
              </div>
            </div>

            {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                  Metadata Tambahan (JSON)
                </span>
                <pre className="p-3 rounded-xl bg-zinc-950 text-zinc-100 text-xs font-mono overflow-x-auto leading-relaxed">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </ModalShell>
    </div>
  );
};
