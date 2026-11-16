import React, { useState, useEffect, useMemo } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import {
  Tenant,
  UserAccount,
  UserCreatePayload,
  UserRole,
  UserUpdatePayload,
} from '../../types';
import { posApi } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import { SearchInput } from '../common/SearchInput';
import { PaginationControls } from '../common/PaginationControls';
import { ErrorBanner } from '../common/ErrorBanner';
import { ConfirmModal } from '../common/ConfirmModal';
import { AddEditUserModal } from './AddEditUserModal';
import { useToast } from '../../contexts/ToastContext';
import { ActionDropdownMenu } from '../common/ActionDropdownMenu';
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
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_SECONDARY_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
} from '../common/ModalShell';

interface UserManagementViewProps {
  currentUser: UserAccount;
  tenants: Tenant[];
  onUpdateCurrentUser?: (user: UserAccount) => void;
}

const ROLE_META: Record<UserRole, { label: string; badgeClass: string }> = {
  owner: {
    label: 'Owner',
    badgeClass: 'bg-accent-soft text-accent-text border border-accent-border',
  },
  branch_manager: {
    label: 'Kepala Cabang',
    badgeClass: 'bg-primary-soft text-primary-text border border-primary-border',
  },
  cashier: {
    label: 'Kasir',
    badgeClass: 'bg-secondary-soft text-secondary-text border border-secondary-border',
  },
};

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  currentUser,
  tenants,
  onUpdateCurrentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 220);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [items, setItems] = useState<UserAccount[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    ownerCount: 0,
    managerCount: 0,
    cashierCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [detailUser, setDetailUser] = useState<UserAccount | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const userTimestamps = useMemo(() => items.map(u => u.createdAt), [items]);
  const nowMs = useNewBadgeClock(userTimestamps);

  const tenantMap = useMemo(() => new Map(tenants.map(t => [t.id, t])), [tenants]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, sortBy, sortDir]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setFetchError(null);

    posApi
      .getUsers(
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
        setItems(Array.isArray(res.items) ? res.items : []);
        setTotalItems(res.total ?? 0);
        setTotalPages(res.totalPages ?? 1);
        if (res.stats) {
          setStats({
            totalUsers: res.stats.totalUsers ?? 0,
            activeUsers: res.stats.activeUsers ?? 0,
            ownerCount: res.stats.ownerCount ?? 0,
            managerCount: res.stats.managerCount ?? 0,
            cashierCount: res.stats.cashierCount ?? 0,
          });
        }
        if (res.page !== currentPage) setCurrentPage(res.page ?? 1);
        setIsLoading(false);
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          const msg = err instanceof Error ? err.message : 'Gagal memuat daftar pengguna.';
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

  const handleHeaderSort = (key: string, defaultDir: SortDirection = 'asc') => {
    const next = getNextColumnSort(key, sortBy, sortDir, defaultDir);
    setSortBy(next.sortBy);
    setSortDir(next.sortDir);
  };

  const hasSearchQuery = searchQuery.trim().length > 0;

  const handleClearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleSaveUser = async (
    payload: UserCreatePayload | UserUpdatePayload,
    editId?: string
  ) => {
    try {
      if (editId) {
        const updated = await posApi.updateUser(editId, payload as UserUpdatePayload);
        showToast('success', `Akun "${updated.fullName}" berhasil diperbarui.`);
        if (editId === currentUser.id) {
          onUpdateCurrentUser?.(updated);
        }
      } else {
        const created = await posApi.createUser(payload as UserCreatePayload);
        showToast('success', `Akun "${created.fullName}" berhasil dibuat.`);
      }
      setIsModalOpen(false);
      setEditingUser(null);
      setRefreshTrigger(k => k + 1);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan akun pengguna.');
      throw err;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await posApi.deleteUser(deletingUser.id);
      showToast('success', `Akun "${deletingUser.fullName}" berhasil dihapus.`);
      setDeletingUser(null);
      setRefreshTrigger(k => k + 1);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menghapus akun pengguna.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleUserStatus = async (user: UserAccount) => {
    if (user.id === currentUser.id) return;
    const nextActive = !user.isActive;
    setTogglingId(user.id);
    setItems(prev =>
      prev.map(item => (item.id === user.id ? { ...item, isActive: nextActive } : item))
    );
    setStats(prev => ({
      ...prev,
      activeUsers: Math.max(0, prev.activeUsers + (nextActive ? 1 : -1)),
    }));
    try {
      await posApi.updateUser(user.id, { isActive: nextActive });
      showToast(
        'success',
        `Status akun "${user.fullName}" diubah menjadi ${nextActive ? 'Aktif' : 'Nonaktif'}.`
      );
    } catch (err) {
      setItems(prev =>
        prev.map(item => (item.id === user.id ? { ...item, isActive: user.isActive } : item))
      );
      setStats(prev => ({
        ...prev,
        activeUsers: Math.max(0, prev.activeUsers + (nextActive ? -1 : 1)),
      }));
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal memperbarui status akun pengguna.'
      );
    } finally {
      setTogglingId(null);
    }
  };

  const renderOutletAccessSummary = (user: UserAccount) => {
    if (user.role === 'owner') {
      return (
        <span className="inline-block text-xs bg-accent-soft text-accent-text font-semibold px-2 py-0.5 rounded border border-accent-border">
          Semua Outlet ({tenants.length})
        </span>
      );
    }
    if (!user.allowedTenantIds || user.allowedTenantIds.length === 0) {
      return <span className="text-xs text-gray-400">Belum ada akses</span>;
    }
    if (user.allowedTenantIds.length === 1) {
      const tenant = tenantMap.get(user.allowedTenantIds[0]);
      return (
        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-semibold">
          {tenant ? tenant.code : user.allowedTenantIds[0]}
        </span>
      );
    }
    return (
      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-semibold">
        {user.allowedTenantIds.length} Outlet
      </span>
    );
  };

  return (
    <div className="space-y-4 pb-8">
      {/* 1. HEADER SECTION (Unboxed, Tanpa Card) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-lg sm:text-xl font-bold text-zinc-950 leading-tight tracking-tight">
              Manajemen Pengguna &amp; Hak Akses
            </h3>
            {isLoading && <GoogleIcon name="progress_activity" size={14} className="animate-spin text-primary" />}
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Kelola akun staf kasir, kepala cabang, jadwal shift, dan pembatasan akses per outlet toko.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setEditingUser(null);
              setIsModalOpen(true);
            }}
            className="h-9 px-4 bg-primary hover:bg-primary-hover text-white font-semibold text-xs sm:text-sm rounded-full transition-colors cursor-pointer shadow-xs shrink-0 inline-flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            <GoogleIcon name="add" size={16} />
            <span>Tambah Pengguna Baru</span>
          </button>
        </div>
      </div>

      {/* 2. RINGKASAN METRIK */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard
          title="Total Pengguna"
          accent="primary"
          icon={<GoogleIcon name="group" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold text-gray-900 font-mono tabular-nums tracking-tight truncate">
              {stats.totalUsers} Akun
            </div>
          }
          footer={
            <p className="text-xs text-gray-400 mt-1 truncate">
              {stats.ownerCount} Owner &middot; Terdaftar di jaringan
            </p>
          }
        />

        <KpiCard
          title="Akun Aktif"
          accent="emerald"
          icon={<GoogleIcon name="verified" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono tabular-nums tracking-tight truncate">
              {stats.activeUsers} Aktif
            </div>
          }
          footer={
            <p className="text-xs text-gray-400 mt-1 truncate">
              Diizinkan masuk ke sistem
            </p>
          }
        />

        <KpiCard
          title="Kepala Cabang"
          accent="accent"
          icon={<GoogleIcon name="verified_user" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold text-gray-900 font-mono tabular-nums tracking-tight truncate">
              {stats.managerCount} Orang
            </div>
          }
          footer={
            <p className="text-xs text-gray-400 mt-1 truncate">
              Supervisor stok, promo &amp; void
            </p>
          }
        />

        <KpiCard
          title="Staf Kasir"
          accent="secondary"
          icon={<GoogleIcon name="manage_accounts" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold text-gray-900 font-mono tabular-nums tracking-tight truncate">
              {stats.cashierCount} Orang
            </div>
          }
          footer={
            <p className="text-xs text-gray-400 mt-1 truncate">
              Operator kasir &amp; transaksi penjualan
            </p>
          }
        />
      </div>

      {/* 3. TABLE WORKSPACE (Unboxed, Tanpa Card Pembungkus) */}
      <div className="space-y-3">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Cari nama, username, email, role, shift, status, atau outlet..."
        />

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
            <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2 text-xs sm:text-sm">
              <GoogleIcon name="progress_activity" size={18} className="animate-spin text-primary" />
              <span>Memuat data pengguna...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 px-4 text-center text-gray-400">
              <GoogleIcon name="group" size={36} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-semibold text-gray-600">Tidak ada pengguna ditemukan</p>
              <p className="text-xs text-gray-400 mt-0.5 max-w-sm mx-auto">
                {hasSearchQuery
                  ? `Pencarian "${searchQuery}" tidak cocok dengan akun pengguna mana pun.`
                  : 'Belum ada akun pengguna yang terdaftar.'}
              </p>
              {hasSearchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-primary bg-primary-soft rounded-xl border border-primary-border hover:bg-primary-soft/80 transition-colors cursor-pointer"
                >
                  <GoogleIcon name="close" size={14} />
                  <span>Bersihkan Pencarian</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500 font-semibold uppercase tracking-wider text-xs">
                      <SortableTh
                        label="Pengguna"
                        sortKey="fullName"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'asc')}
                        className="py-3 px-3.5 sm:px-4"
                      />
                      <SortableTh
                        label="Role"
                        sortKey="role"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'asc')}
                        className="py-3 px-3 sm:px-4"
                      />
                      <th className="py-3 px-3 sm:px-4">Shift</th>
                      <th className="py-3 px-3 sm:px-4">Akses Outlet</th>
                      <SortableTh
                        label="Status"
                        sortKey="isActive"
                        currentSortBy={sortBy}
                        currentSortDir={sortDir}
                        onSort={key => handleHeaderSort(key, 'desc')}
                        align="center"
                        className="py-3 px-3 sm:px-4"
                      />
                      <th className="py-3 px-3 sm:px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/70 font-medium text-zinc-700">
                    {items.map(u => {
                      const meta = ROLE_META[u.role];
                      const isSelf = u.id === currentUser.id;
                      return (
                        <tr key={u.id} className="hover:bg-zinc-100/60 transition-colors">
                          <td className="py-3.5 px-3.5 sm:px-4 align-middle min-w-[200px]">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-bold text-gray-900 text-xs sm:text-sm leading-tight">
                                  {u.fullName}
                                </p>
                                {isRecentlyCreated(u.createdAt, nowMs) && <NewBadge />}
                                {isSelf && (
                                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-primary text-white">
                                    Anda
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-xs text-gray-500 block mt-0.5">
                                @{u.username}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 sm:px-4 align-middle whitespace-nowrap">
                            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${meta.badgeClass}`}>
                              {meta.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 sm:px-4 align-middle whitespace-nowrap">
                            <span className="text-xs text-gray-700 font-medium">
                              {u.shiftLabel}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 sm:px-4 align-middle whitespace-nowrap">
                            {renderOutletAccessSummary(u)}
                          </td>

                          <td className="py-3.5 px-3 sm:px-4 align-middle text-center whitespace-nowrap">
                            <div className="inline-flex justify-center">
                              <StatusToggle
                                checked={u.isActive}
                                disabled={isSelf}
                                isLoading={togglingId === u.id}
                                onChange={() => void handleToggleUserStatus(u)}
                                label={u.isActive ? 'Aktif' : 'Nonaktif'}
                                ariaLabel={`Status akun ${u.fullName}`}
                                tooltip={
                                  isSelf
                                    ? 'Akun yang sedang login tidak bisa dinonaktifkan'
                                    : u.isActive
                                    ? 'Aktif — klik untuk nonaktifkan'
                                    : 'Nonaktif — klik untuk aktifkan'
                                }
                              />
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-middle text-center whitespace-nowrap">
                            <ActionDropdownMenu
                              ariaLabel={`Aksi untuk ${u.fullName}`}
                              items={[
                                {
                                  id: 'detail',
                                  label: 'Lihat Detail',
                                  icon: <GoogleIcon name="visibility" size={14} />,
                                  onClick: () => setDetailUser(u),
                                },
                                {
                                  id: 'edit',
                                  label: 'Edit Pengguna',
                                  icon: <GoogleIcon name="edit" size={14} />,
                                  onClick: () => {
                                    setEditingUser(u);
                                    setIsModalOpen(true);
                                  },
                                },
                                {
                                  id: 'delete',
                                  label: 'Hapus Pengguna',
                                  icon: <GoogleIcon name="delete" size={14} />,
                                  tone: 'danger',
                                  dividerBefore: true,
                                  disabled: isSelf,
                                  disabledReason: isSelf ? 'Tidak dapat menghapus akun sendiri' : undefined,
                                  onClick: () => setDeletingUser(u),
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

              {/* Mobile / Tablet Card View */}
              <div className="lg:hidden divide-y divide-zinc-200/80 border-t border-zinc-200">
                {items.map(u => {
                  const meta = ROLE_META[u.role];
                  const isSelf = u.id === currentUser.id;
                  return (
                    <div key={u.id} className="p-3.5 sm:p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-gray-900 text-xs sm:text-sm leading-tight truncate">
                              {u.fullName}
                            </p>
                            {isRecentlyCreated(u.createdAt, nowMs) && <NewBadge />}
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${meta.badgeClass}`}>
                              {meta.label}
                            </span>
                            {isSelf && (
                              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-primary text-white shrink-0">
                                Anda
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                            @{u.username}
                          </p>
                        </div>

                        <StatusToggle
                          checked={u.isActive}
                          disabled={isSelf}
                          isLoading={togglingId === u.id}
                          onChange={() => void handleToggleUserStatus(u)}
                          label={u.isActive ? 'Aktif' : 'Nonaktif'}
                          ariaLabel={`Status akun ${u.fullName}`}
                          tooltip={
                            isSelf
                              ? 'Akun yang sedang login tidak bisa dinonaktifkan'
                              : u.isActive
                              ? 'Aktif — klik untuk nonaktifkan'
                              : 'Nonaktif — klik untuk aktifkan'
                          }
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                        <span className="text-gray-500 font-medium">{u.shiftLabel}</span>
                        <div>{renderOutletAccessSummary(u)}</div>
                      </div>

                      <div className="pt-2 border-t border-gray-100 flex items-center justify-end">
                        <ActionDropdownMenu
                          ariaLabel={`Aksi untuk ${u.fullName}`}
                          items={[
                            {
                              id: 'detail',
                              label: 'Lihat Detail',
                              icon: <GoogleIcon name="visibility" size={14} />,
                              onClick: () => setDetailUser(u),
                            },
                            {
                              id: 'edit',
                              label: 'Edit Pengguna',
                              icon: <GoogleIcon name="edit" size={14} />,
                              onClick: () => {
                                setEditingUser(u);
                                setIsModalOpen(true);
                              },
                            },
                            {
                              id: 'delete',
                              label: 'Hapus Pengguna',
                              icon: <GoogleIcon name="delete" size={14} />,
                              tone: 'danger',
                              dividerBefore: true,
                              disabled: isSelf,
                              disabledReason: isSelf ? 'Tidak dapat menghapus akun sendiri' : undefined,
                              onClick: () => setDeletingUser(u),
                            },
                          ]}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {items.length > 0 && (
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
          )}
        </div>
      </div>

      <AddEditUserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(null);
        }}
        editingUser={editingUser}
        currentUserId={currentUser.id}
        tenants={tenants}
        onSaveUser={handleSaveUser}
      />

      <ConfirmModal
        isOpen={!!deletingUser}
        title="Hapus Pengguna"
        description={
          deletingUser
            ? `Apakah Anda yakin ingin menghapus akun "${deletingUser.fullName}" (@${deletingUser.username})? Sesi login pengguna tersebut akan langsung dihentikan.`
            : ''
        }
        confirmLabel="Ya, Hapus Akun"
        isLoading={isDeleting}
        onCancel={() => setDeletingUser(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Detail Pengguna Modal */}
      <ModalShell
        isOpen={!!detailUser}
        onClose={() => setDetailUser(null)}
        size="md"
        title="Detail Pengguna"
        footer={
          detailUser ? (
            <div className={MODAL_FOOTER_END_CLASS}>
              <button
                type="button"
                onClick={() => setDetailUser(null)}
                className={MODAL_BTN_SECONDARY_CLASS}
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = detailUser;
                  setDetailUser(null);
                  setEditingUser(target);
                  setIsModalOpen(true);
                }}
                className={MODAL_BTN_PRIMARY_CLASS}
              >
                <GoogleIcon name="edit" size={15} className="shrink-0" />
                <span>Edit Pengguna</span>
              </button>
            </div>
          ) : undefined
        }
      >
        {detailUser && (() => {
          const meta = ROLE_META[detailUser.role];
          const allowedList =
            detailUser.role === 'owner'
              ? tenants
              : (detailUser.allowedTenantIds || [])
                  .map(id => tenantMap.get(id))
                  .filter((t): t is Tenant => Boolean(t));

          return (
            <div className="space-y-4 text-sm">
              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Nama Lengkap</span>
                  <span className="font-bold text-zinc-950 text-right">{detailUser.fullName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Username</span>
                  <span className="font-mono font-semibold text-zinc-900">@{detailUser.username}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Role / Jabatan</span>
                  <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${meta.badgeClass}`}>
                    {meta.label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Status Akun</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                      detailUser.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                    }`}
                  >
                    {detailUser.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Email</span>
                  <span className="font-mono text-zinc-800 text-right break-all">{detailUser.email}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Jadwal Shift</span>
                  <span className="font-medium text-zinc-800 text-right">{detailUser.shiftLabel}</span>
                </div>
              </div>

              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200/70 mb-2.5">
                  <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                    Akses Outlet ({detailUser.role === 'owner' ? 'Semua Outlet' : allowedList.length})
                  </span>
                </div>
                {allowedList.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-2 text-center">
                    Pengguna ini belum memiliki akses outlet.
                  </p>
                ) : (
                  <div className="bg-white rounded-lg border border-zinc-200/70 divide-y divide-zinc-100 max-h-48 overflow-y-auto">
                    {allowedList.map(t => (
                      <div key={t.id} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-900 truncate">{t.name}</p>
                          <p className="text-zinc-500 truncate">
                            {t.branchName} &bull; {t.city}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded shrink-0">
                          {t.code}
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
