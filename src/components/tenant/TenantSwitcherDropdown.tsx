import React, { useState, useRef, useEffect } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Tenant } from '../../types';

interface TenantSwitcherDropdownProps {
  tenants: Tenant[];
  activeTenantId: string;
  onSelectTenant: (tenantId: string) => void;
  onOpenRegisterModal: () => void;
  onNavigateToManagement: () => void;
  variant?: 'header' | 'sidebar';
}

export const TenantSwitcherDropdown: React.FC<TenantSwitcherDropdownProps> = ({
  tenants,
  activeTenantId,
  onSelectTenant,
  onOpenRegisterModal,
  onNavigateToManagement,
  variant = 'header',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeTenant = tenants.find(t => t.id === activeTenantId) || tenants[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!activeTenant) return null;

  if (variant === 'sidebar') {
    return (
      <div className="px-3 py-2" ref={dropdownRef}>
        <div className="bg-white/10 hover:bg-white/15 rounded-md p-2 text-white border border-white/20 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/80 flex items-center gap-1">
              <GoogleIcon name="apartment" size={13} />
              Multi-Tenant POS
            </span>
            <span className="text-xs bg-emerald-500/90 text-white font-mono font-semibold px-2 py-0.5 rounded">
              {activeTenant.code}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full text-left flex items-center justify-between gap-2 cursor-pointer outline-none"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate leading-tight">{activeTenant.name}</p>
              <p className="text-xs text-white/75 truncate">{activeTenant.branchName}</p>
            </div>
            <GoogleIcon name="keyboard_arrow_down" size={14} className={`text-white/80 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {isOpen && (
          <div className="mt-2 bg-white shadow-lg text-gray-900 rounded-2xl border border-zinc-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2 py-1.5 border-b border-zinc-100 mb-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ganti Tenant Bisnis</p>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {tenants.map(tenant => {
                const isSelected = tenant.id === activeTenant.id;
                return (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => {
                      onSelectTenant(tenant.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      isSelected ? 'bg-primary text-white font-bold' : 'hover:bg-zinc-100/80 text-zinc-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate font-semibold">{tenant.name}</p>
                      <p className={`text-xs truncate ${isSelected ? 'text-white/75' : 'text-gray-500'}`}>
                        {tenant.branchName}
                      </p>
                    </div>
                    {isSelected && <GoogleIcon name="check" size={14} className="text-white shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="pt-2 mt-1 border-t border-zinc-100 flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenRegisterModal();
                }}
                className="w-full py-1.5 px-2 text-xs font-bold text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <GoogleIcon name="add" size={14} className="shrink-0" />
                <span>Daftar Tenant Baru</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default: Header Variant (Prominent Top Bar Multi-Tenant Switcher)
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-100/80 border border-zinc-200/80 hover:border-zinc-300 transition-all text-left cursor-pointer outline-none group bg-zinc-50/80"
        title="Pilih atau ganti Tenant & Cabang Outlet"
        aria-expanded={isOpen}
      >
        <div className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-none">
          {activeTenant.logoInitial}
        </div>
        <div className="hidden sm:flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-900 group-hover:text-zinc-950 transition-colors truncate max-w-[130px] md:max-w-[170px] lg:max-w-[200px]">
              {activeTenant.name}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider bg-zinc-200/80 text-zinc-700 px-1.5 py-0.5 rounded border border-zinc-300/60">
              Tenant
            </span>
          </div>
          <span className="text-xs text-gray-500 font-medium truncate max-w-[150px] md:max-w-[190px]">
            {activeTenant.branchName}
          </span>
        </div>
        <GoogleIcon name="keyboard_arrow_down" size={13}
         
          className={`text-zinc-400 group-hover:text-zinc-900 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-zinc-900' : ''
          }`}
        />
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-92 bg-white shadow-lg rounded-2xl border border-zinc-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="px-3.5 py-2 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <GoogleIcon name="storefront" size={15} className="text-zinc-700" />
              <span className="text-xs font-bold text-gray-900">Multi-Tenant Cloud POS</span>
            </div>
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
              {tenants.length} Tenant Terdaftar
            </span>
          </div>

          {/* Current Tenant Banner */}
          <div className="px-3.5 py-2.5 bg-zinc-50/90 border-b border-zinc-200/80">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500 font-medium">Tenant Aktif Saat Ini:</span>
              <span className="font-mono font-bold text-zinc-900">{activeTenant.code}</span>
            </div>
            <p className="text-xs font-bold text-gray-900">{activeTenant.name}</p>
            <p className="text-xs text-gray-600 mt-0.5">{activeTenant.address}</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded">
                <GoogleIcon name="verified_user" size={13} /> {activeTenant.plan}
              </span>
              <span className="text-gray-500 font-mono">DB: {activeTenant.databaseSchema}</span>
            </div>
          </div>

          {/* Tenant List */}
          <div className="p-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">Pilih / Ganti Tenant Bisnis:</p>
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {tenants.map(t => {
                const isSelected = t.id === activeTenant.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onSelectTenant(t.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-white font-bold'
                        : 'hover:bg-zinc-100/80 text-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {t.logoInitial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs truncate font-bold leading-tight">{t.name}</p>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded font-mono font-medium ${
                              isSelected ? 'bg-white/25 text-white' : 'bg-zinc-200/80 text-zinc-700'
                            }`}
                          >
                            {t.code}
                          </span>
                        </div>
                        <p
                          className={`text-xs truncate mt-0.5 ${
                            isSelected ? 'text-white/80' : 'text-gray-500'
                          }`}
                        >
                          {t.branchName} &bull; {t.city}
                        </p>
                      </div>
                    </div>
                    {isSelected && <GoogleIcon name="check" size={16} className="text-white shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="px-1.5 pt-1.5 border-t border-zinc-100 space-y-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenRegisterModal();
              }}
              className="w-full py-2 px-3 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <GoogleIcon name="add" size={14} className="shrink-0" />
              <span>Daftar / Tambah Tenant Baru</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onNavigateToManagement();
              }}
              className="w-full py-2 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
            >
              Kelola Semua Tenant &amp; Outlet
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
