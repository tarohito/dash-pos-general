import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Tenant } from '../../types';
import { SearchInput } from '../common/SearchInput';
import { ActionDropdownMenu } from '../common/ActionDropdownMenu';
import { KpiCard } from '../common/KpiCard';
import { NewBadge } from '../common/NewBadge';
import { isRecentlyCreated, useNewBadgeClock } from '../../utils/newBadge';
import {
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_SECONDARY_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
} from '../common/ModalShell';

interface TenantManagementViewProps {
  tenants: Tenant[];
  activeTenantId: string;
  onSelectTenant: (tenantId: string) => void;
  onOpenRegisterModal: () => void;
  onNavigateToPos: () => void;
  canCreateOutlet?: boolean;
}

const OUTLET_BATCH_SIZE = 6;

export const TenantManagementView: React.FC<TenantManagementViewProps> = ({
  tenants,
  activeTenantId,
  onSelectTenant,
  onOpenRegisterModal,
  onNavigateToPos,
  canCreateOutlet = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [detailTenant, setDetailTenant] = useState<Tenant | null>(null);

  const activeTenant = useMemo(
    () => tenants.find(t => t.id === activeTenantId) || tenants[0],
    [tenants, activeTenantId]
  );

  const summary = useMemo(() => {
    const activeCount = tenants.filter(t => t.status === 'Aktif').length;
    const totalCashiers = tenants.reduce((acc, t) => acc + (t.cashierCount || 0), 0);
    const citySet = new Set<string>();
    for (const t of tenants) {
      const c = t.city.trim();
      if (c) citySet.add(c);
    }

    return {
      totalTenants: tenants.length,
      activeCount,
      totalCashiers,
      uniqueCities: citySet.size,
    };
  }, [tenants]);

  const tenantTimestamps = useMemo(() => tenants.map(t => t.createdAt), [tenants]);
  const nowMs = useNewBadgeClock(tenantTimestamps);

  const filteredTenants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = tenants.filter(t => {
      if (!q) return true;
      const statusLower = t.status.toLowerCase();
      const matchesStatus =
        q === 'aktif' || q === 'nonaktif'
          ? statusLower === q
          : statusLower.includes(q) || (t.status === 'Trial' && 'uji coba'.includes(q));
      return (
        matchesStatus ||
        t.name.toLowerCase().includes(q) ||
        t.branchName.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      const aNew = isRecentlyCreated(a.createdAt, nowMs);
      const bNew = isRecentlyCreated(b.createdAt, nowMs);
      if (aNew !== bNew) return aNew ? -1 : 1;
      if (aNew && bNew) {
        return Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '');
      }
      return 0;
    });
  }, [tenants, searchQuery, nowMs]);

  const [visibleCount, setVisibleCount] = useState(OUTLET_BATCH_SIZE);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const visibleTenants = useMemo(
    () => filteredTenants.slice(0, visibleCount),
    [filteredTenants, visibleCount]
  );

  const hasMoreTenants = visibleCount < filteredTenants.length;

  useEffect(() => {
    if (!hasMoreTenants) return;

    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + OUTLET_BATCH_SIZE, filteredTenants.length));
        }
      },
      { rootMargin: '150px' }
    );

    observer.observe(el);
    return () => observer.unobserve(el);
  }, [hasMoreTenants, visibleCount, filteredTenants.length]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setVisibleCount(OUTLET_BATCH_SIZE);
  };

  const hasSearchQuery = searchQuery.trim().length > 0;

  const handleClearSearch = () => {
    setSearchQuery('');
    setVisibleCount(OUTLET_BATCH_SIZE);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Page Header (Unboxed, Tanpa Card) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-zinc-950 leading-tight tracking-tight">
            Kelola Multi-Outlet Bisnis
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Kelola daftar gerai / cabang bisnis, peralihan cabang kasir aktif, dan informasi operasional setiap outlet.
          </p>
        </div>

        {canCreateOutlet && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={onOpenRegisterModal}
              className="h-9 px-4 bg-primary hover:bg-primary-hover text-white font-semibold text-xs sm:text-sm rounded-full transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0 active:scale-[0.98]"
            >
              <GoogleIcon name="add" size={16} />
              <span>Tambah Toko / Outlet Baru</span>
            </button>
          </div>
        )}
      </div>

      {/* 4 Modern KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard
          title="Total Outlet Terdaftar"
          accent="primary"
          icon={<GoogleIcon name="storefront" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-gray-900 tracking-tight truncate tabular-nums">
              {summary.totalTenants} Outlet
            </div>
          }
          footer={
            <p className="text-xs text-gray-400 mt-1 truncate">
              {summary.activeCount} gerai berstatus aktif
            </p>
          }
        />

        <KpiCard
          title="Outlet Aktif Saat Ini"
          accent="emerald"
          icon={<GoogleIcon name="check_circle" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-primary tracking-tight truncate tabular-nums">
              {activeTenant?.code || '-'}
            </div>
          }
          footer={
            <p className="text-xs text-gray-400 mt-1 truncate">
              {activeTenant ? activeTenant.name : 'Belum ada outlet dipilih'}
            </p>
          }
        />

        <KpiCard
          title="Total Staf Outlet"
          accent="secondary"
          icon={<GoogleIcon name="group" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-gray-900 tracking-tight truncate tabular-nums">
              {summary.totalCashiers} Staf
            </div>
          }
          footer={
            <p className="text-xs text-gray-400 mt-1 truncate">
              Kepala cabang &amp; kasir aktif
            </p>
          }
        />

        <KpiCard
          title="Cakupan Wilayah"
          accent="accent"
          icon={<GoogleIcon name="location_on" size={16} />}
          value={
            <div className="text-xl sm:text-2xl font-bold font-mono text-gray-900 tracking-tight truncate tabular-nums">
              {summary.uniqueCities} Kota
            </div>
          }
          footer={
            <p className="text-xs text-gray-400 mt-1 truncate">
              Lokasi cabang operasional
            </p>
          }
        />
      </div>

      {/* Search & Outlet Cards Workspace (Unboxed, Tanpa Card Pembungkus) */}
      <div className="space-y-3">
        <SearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Cari nama outlet, kode gerai, cabang, kota, status, atau kontak..."
        />

        {/* Outlet Card Grid or Empty State */}
        {visibleTenants.length === 0 ? (
          <div className="border border-zinc-200 rounded-2xl py-12 px-4 text-center text-gray-400 bg-white">
            <GoogleIcon name="storefront" size={36} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-semibold text-gray-600">Tidak ada outlet ditemukan</p>
            <p className="text-xs text-gray-400 mt-0.5 max-w-sm mx-auto">
              {hasSearchQuery
                ? `Pencarian "${searchQuery}" tidak cocok dengan outlet mana pun.`
                : 'Belum ada outlet bisnis yang terdaftar.'}
            </p>
            {hasSearchQuery ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-primary bg-primary-soft rounded-xl border border-primary-border hover:bg-primary-soft/80 transition-colors cursor-pointer"
              >
                <GoogleIcon name="close" size={14} />
                <span>Bersihkan Pencarian</span>
              </button>
            ) : canCreateOutlet ? (
              <button
                type="button"
                onClick={onOpenRegisterModal}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors cursor-pointer"
              >
                <GoogleIcon name="add" size={14} />
                <span>Tambah Outlet Baru</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleTenants.map(tenant => {
              const isSelected = activeTenant?.id === tenant.id;
              return (
                <div
                  key={tenant.id}
                  className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-colors ${
                    isSelected
                      ? 'bg-primary border-primary text-white'
                      : 'bg-white border-zinc-200 hover:border-primary/50'
                  }`}
                >
                  <div>
                    {/* Top Status & Code Strip */}
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                            isSelected
                              ? 'bg-white/20 text-white border-white/25'
                              : 'bg-gray-100 text-gray-800 border-gray-200/70'
                          }`}
                        >
                          {tenant.code}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                            isSelected
                              ? 'bg-white/20 text-white border-white/25'
                              : tenant.status === 'Aktif'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : tenant.status === 'Trial'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          {tenant.status}
                        </span>
                        {isRecentlyCreated(tenant.createdAt, nowMs) && <NewBadge />}
                      </div>

                      {isSelected && (
                        <span className="text-xs font-bold text-primary bg-white px-2.5 py-0.5 rounded border border-white shrink-0">
                          Aktif Digunakan
                        </span>
                      )}
                    </div>

                    {/* Outlet Identity */}
                    <div className="flex items-center gap-3 mb-4">
                      {tenant.logoUrl ? (
                        <img
                          src={tenant.logoUrl}
                          alt={tenant.name}
                          className={`w-11 h-11 aspect-square rounded-xl object-cover shrink-0 border ${
                            isSelected ? 'border-white/50' : 'border-zinc-200'
                          }`}
                        />
                      ) : (
                        <div
                          className={`w-11 h-11 aspect-square rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            isSelected
                              ? 'bg-white text-primary'
                              : 'bg-secondary-soft text-secondary-text border border-secondary-border'
                          }`}
                        >
                          {tenant.logoInitial}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4
                          className={`text-sm sm:text-base font-bold truncate leading-tight ${
                            isSelected ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {tenant.name}
                        </h4>
                        <p
                          className={`text-xs sm:text-sm truncate mt-0.5 ${
                            isSelected ? 'text-white/90' : 'text-gray-600'
                          }`}
                        >
                          {tenant.branchName}
                        </p>
                        <p
                          className={`text-xs font-mono truncate mt-0.5 ${
                            isSelected ? 'text-white/75' : 'text-gray-400'
                          }`}
                        >
                          {tenant.slug}
                        </p>
                      </div>
                    </div>

                    {/* Operational Info Card */}
                    <div
                      className={`rounded-lg p-3.5 space-y-2 text-xs border ${
                        isSelected
                          ? 'bg-white border-white'
                          : 'bg-gray-50/80 border-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500 shrink-0">Kota Lokasi</span>
                        <span className="font-semibold text-gray-800 text-right truncate">
                          {tenant.city}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500 shrink-0">No. Telepon</span>
                        <span className="font-mono font-semibold text-gray-800 tabular-nums text-right truncate">
                          {tenant.phone}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500 shrink-0">Kapasitas Outlet</span>
                        <span className="font-mono font-semibold text-gray-800 tabular-nums text-right">
                          {tenant.cashierCount} kasir &bull; {tenant.productCount} SKU
                        </span>
                      </div>
                      <div className="pt-1.5 border-t border-gray-200/70">
                        <span className="text-gray-400 block mb-0.5">Alamat Gerai</span>
                        <p className="text-gray-700 leading-relaxed line-clamp-2" title={tenant.address}>
                          {tenant.address}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div
                    className={`mt-4 pt-3 border-t flex items-center gap-2 ${
                      isSelected ? 'border-white/20' : 'border-gray-100'
                    }`}
                  >
                    {isSelected ? (
                      <button
                        type="button"
                        onClick={onNavigateToPos}
                        className="flex-1 h-9 px-3.5 bg-white hover:bg-primary-soft text-primary font-bold text-xs sm:text-sm rounded-xl transition-colors inline-flex items-center justify-center cursor-pointer active:scale-[0.98]"
                      >
                        Buka Kasir POS
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectTenant(tenant.id)}
                        className="flex-1 h-9 px-3.5 bg-zinc-50 hover:bg-primary hover:text-white hover:border-primary border border-zinc-200 text-zinc-800 font-semibold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer inline-flex items-center justify-center active:scale-[0.98]"
                      >
                        Pilih &amp; Aktifkan Outlet
                      </button>
                    )}

                    <ActionDropdownMenu
                      ariaLabel={`Aksi untuk ${tenant.name}`}
                      buttonClassName={
                        isSelected
                          ? 'w-9 h-9 !bg-white/20 hover:!bg-white/30 !text-white !border-white/25 hover:!border-white/40'
                          : 'w-9 h-9'
                      }
                      items={[
                        {
                          id: 'detail',
                          label: 'Lihat Detail Outlet',
                          icon: <GoogleIcon name="visibility" size={14} />,
                          onClick: () => setDetailTenant(tenant),
                        },
                        isSelected
                          ? {
                              id: 'pos',
                              label: 'Buka Kasir POS',
                              icon: <GoogleIcon name="storefront" size={14} />,
                              tone: 'primary',
                              onClick: onNavigateToPos,
                            }
                          : {
                              id: 'activate',
                              label: 'Pilih & Aktifkan Outlet',
                              icon: <GoogleIcon name="check_circle" size={14} />,
                              tone: 'primary',
                              onClick: () => onSelectTenant(tenant.id),
                            },
                      ]}
                    />
                  </div>
                </div>
              );
            })}

            {/* Sentinel untuk auto-load batch outlet berikutnya saat di-scroll */}
            {hasMoreTenants && (
              <div
                ref={loadMoreRef}
                className="col-span-full py-6 flex items-center justify-center text-xs text-gray-400 gap-2"
              >
                <GoogleIcon name="progress_activity" size={16} className="animate-spin text-primary" />
                <span>
                  Memuat outlet lainnya ({visibleTenants.length} dari {filteredTenants.length})...
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Outlet Modal */}
      <ModalShell
        isOpen={!!detailTenant}
        onClose={() => setDetailTenant(null)}
        size="md"
        title="Detail Outlet"
        footer={
          detailTenant ? (
            <div className={MODAL_FOOTER_END_CLASS}>
              <button
                type="button"
                onClick={() => setDetailTenant(null)}
                className={MODAL_BTN_SECONDARY_CLASS}
              >
                Tutup
              </button>
              {activeTenant?.id === detailTenant.id ? (
                <button
                  type="button"
                  onClick={() => {
                    setDetailTenant(null);
                    onNavigateToPos();
                  }}
                  className={MODAL_BTN_PRIMARY_CLASS}
                >
                  Buka Kasir POS
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const targetId = detailTenant.id;
                    setDetailTenant(null);
                    onSelectTenant(targetId);
                  }}
                  className={MODAL_BTN_PRIMARY_CLASS}
                >
                  Pilih Outlet Ini
                </button>
              )}
            </div>
          ) : undefined
        }
      >
        {detailTenant && (
          <div className="space-y-3 text-sm">
            <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Nama Outlet</span>
                <span className="font-bold text-gray-900 text-right">{detailTenant.name}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Kode Outlet</span>
                <span className="font-mono font-bold text-gray-900">{detailTenant.code}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Status Operasional</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                    detailTenant.status === 'Aktif'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {detailTenant.status}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Cabang</span>
                <span className="font-semibold text-gray-900 text-right">{detailTenant.branchName}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Kota</span>
                <span className="font-semibold text-gray-900">{detailTenant.city}</span>
              </div>
              <div className="pt-2 border-t border-gray-200/70">
                <span className="text-gray-500 block mb-1">Alamat Lengkap</span>
                <p className="text-gray-800 font-medium leading-relaxed">{detailTenant.address}</p>
              </div>
            </div>

            <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">No. Telepon / WhatsApp</span>
                <span className="font-mono font-semibold text-gray-900 tabular-nums">
                  {detailTenant.phone}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-800">{detailTenant.email}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Kapasitas Kasir &amp; Katalog</span>
                <span className="font-mono font-semibold text-gray-900 tabular-nums">
                  {detailTenant.cashierCount} kasir &bull; {detailTenant.productCount} SKU
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Domain Portal</span>
                <span className="font-mono text-gray-700">{detailTenant.slug}</span>
              </div>
            </div>
          </div>
        )}
      </ModalShell>
    </div>
  );
};
