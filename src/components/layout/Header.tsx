import React, { useRef, useEffect } from 'react';
import {
  Bell,
  ChevronDown,
  Settings,
  LogOut,
  UserCog,
} from 'lucide-react';
import Tooltip from '../Tooltip';
import { BrandLogo } from '../common/BrandLogo';
import { Tenant, UserAccount, UserRole } from '../../types';

interface HeaderProps {
  activeMenu?: string;
  onSelectMenu: (menu: string) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  hasNotification: boolean;
  onToggleNotification: () => void;
  isAdminMenuOpen: boolean;
  onToggleAdminMenu: () => void;
  onCloseAdminMenu: () => void;
  currentUser: UserAccount;
  activeTenant?: Tenant;
  onLogout: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  branch_manager: 'Kepala Cabang',
  cashier: 'Kasir',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'US';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Header: React.FC<HeaderProps> = ({
  activeMenu,
  onSelectMenu,
  isSidebarCollapsed,
  onToggleSidebar,
  hasNotification,
  onToggleNotification,
  isAdminMenuOpen,
  onToggleAdminMenu,
  onCloseAdminMenu,
  currentUser,
  activeTenant,
  onLogout,
}) => {
  const adminDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(e.target as Node)) {
        onCloseAdminMenu();
      }
    };
    if (isAdminMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAdminMenuOpen, onCloseAdminMenu]);

  const initials = getInitials(currentUser.fullName);
  const firstName = currentUser.fullName.split(' ')[0] || currentUser.username;

  return (
    <header className="h-12 sm:h-13 flex items-center justify-between gap-3 px-3 sm:px-5 bg-transparent z-30 shrink-0 relative">
      {/* 1. LEFT: Mobile Drawer Toggle + Logo (<lg), Desktop Active View Title (lg+) */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        <div className="flex lg:hidden items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="w-9 h-9 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-white/80 transition-colors flex items-center justify-center cursor-pointer shrink-0 outline-none focus:outline-none"
            title={isSidebarCollapsed ? 'Buka Menu' : 'Sembunyikan Menu'}
            aria-label="Toggle Sidebar"
          >
            <svg
              className="w-5 h-5 transition-transform duration-200"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {isSidebarCollapsed ? (
                <>
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="14" y2="12" />
                  <line x1="4" y1="18" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="4" y1="6" x2="16" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="12" y2="18" />
                </>
              )}
            </svg>
          </button>

          <button
            type="button"
            onClick={() => onSelectMenu('Kasir POS (Penjualan)')}
            className="flex items-center cursor-pointer select-none rounded-lg px-1.5 py-1 hover:bg-white/80 transition-colors"
            aria-label="LogicPOS Beranda"
          >
            <BrandLogo size="sm" />
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2.5 min-w-0">
          <h1 className="text-sm font-bold text-zinc-900 tracking-tight truncate">
            {activeMenu || 'Kasir POS (Penjualan)'}
          </h1>
          {activeTenant?.name && (
            <>
              <span className="text-zinc-300 select-none" aria-hidden="true">/</span>
              <span className="text-xs font-medium text-zinc-500 truncate max-w-[260px]">
                {activeTenant.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. RIGHT CONTROLS (Notification & User Profile) */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
        <Tooltip content={hasNotification ? 'Ada notifikasi baru' : 'Tidak ada notifikasi'} side="bottom" sideOffset={6}>
          <button
            type="button"
            onClick={onToggleNotification}
            className="relative w-9 h-9 text-zinc-600 hover:text-zinc-950 hover:bg-white/80 rounded-lg transition-colors flex items-center justify-center cursor-pointer outline-none focus:outline-none"
            aria-label="Notifikasi"
          >
            <Bell size={18} strokeWidth={1.8} />
            {hasNotification && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-zinc-900 ring-2 ring-zinc-100" />
            )}
          </button>
        </Tooltip>

        <div className="h-5 w-px bg-zinc-300/70 mx-0.5 hidden sm:block" aria-hidden="true" />

        {/* USER PROFILE DROPDOWN */}
        <div className="relative" ref={adminDropdownRef}>
          <button
            type="button"
            onClick={onToggleAdminMenu}
            className={`h-9 flex items-center justify-center gap-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer px-1.5 sm:px-2.5 outline-none focus:outline-none ${
              isAdminMenuOpen
                ? 'bg-white text-zinc-950'
                : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/80'
            }`}
            aria-expanded={isAdminMenuOpen}
          >
            <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center font-semibold text-xs shrink-0">
              {initials}
            </div>
            <div className="hidden sm:flex flex-col items-start text-left leading-tight">
              <span className="font-semibold text-xs sm:text-sm text-zinc-900 max-w-[130px] truncate">{firstName}</span>
              <span className="text-[11px] font-medium text-zinc-500 leading-none mt-0.5">{ROLE_LABELS[currentUser.role]}</span>
            </div>
            <ChevronDown
              size={14}
              className={`text-zinc-400 transition-transform duration-200 hidden sm:inline shrink-0 ${
                isAdminMenuOpen ? 'rotate-180 text-zinc-800' : ''
              }`}
            />
          </button>

          {isAdminMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-zinc-200 shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              {/* User Profile Header */}
              <div className="px-4 py-3 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="text-sm font-bold text-zinc-950 truncate">{currentUser.fullName}</p>
                      <span className="text-xs font-medium text-zinc-500 shrink-0">
                        {ROLE_LABELS[currentUser.role]}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{currentUser.shiftLabel}</p>
                  </div>
                </div>

                {activeTenant && (
                  <div className="mt-2.5 text-xs bg-zinc-50 border border-zinc-200/80 text-zinc-700 px-2.5 py-1.5 rounded-lg">
                    <span className="text-xs text-zinc-400 block">Outlet Aktif:</span>
                    <span className="font-semibold text-zinc-900 block truncate">
                      {activeTenant.code} &bull; {activeTenant.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Menu Options */}
              <div className="p-1.5 space-y-0.5">
                {currentUser.role === 'owner' && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectMenu('Manajemen User');
                      onCloseAdminMenu();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 rounded-lg transition-colors text-left cursor-pointer"
                  >
                    <UserCog size={15} className="text-zinc-400 shrink-0" />
                    <span>Manajemen User &amp; Akses</span>
                  </button>
                )}

                {currentUser.role !== 'cashier' && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectMenu('Pengaturan');
                      onCloseAdminMenu();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 rounded-lg transition-colors text-left cursor-pointer"
                  >
                    <Settings size={15} className="text-zinc-400 shrink-0" />
                    <span>Pengaturan Toko</span>
                  </button>
                )}

                <div className="my-1 border-t border-zinc-200/60" />

                <button
                  type="button"
                  onClick={() => {
                    onCloseAdminMenu();
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left cursor-pointer"
                >
                  <LogOut size={15} className="text-red-500 shrink-0" />
                  <span>Keluar (Logout)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
