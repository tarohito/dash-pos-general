import React, { useState, useRef, useEffect } from 'react';
import {
  ShoppingCart,
  ReceiptText,
  Package,
  FolderTree,
  ShoppingBag,
  LayoutDashboard,
  Store,
  BadgePercent,
  ChevronDown,
  ChevronLeft,
  Check,
  Plus,
  UserCog,
  Settings,
} from 'lucide-react';
import Tooltip from '../Tooltip';
import { BrandLogo } from '../common/BrandLogo';
import { Tenant, UserRole } from '../../types';

interface SidebarProps {
  activeMenu: string;
  onSelectMenu: (menu: string) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isProdukExpanded: boolean;
  onToggleProdukExpanded: () => void;
  tenants?: Tenant[];
  activeTenantId?: string;
  onSelectTenant?: (tenantId: string) => void;
  onOpenRegisterModal?: () => void;
  userRole?: UserRole;
  isDarkSidebar?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeMenu,
  onSelectMenu,
  isSidebarCollapsed,
  onToggleSidebar,
  isProdukExpanded,
  onToggleProdukExpanded,
  tenants = [],
  activeTenantId = '',
  onSelectTenant,
  onOpenRegisterModal,
  userRole = 'owner',
  isDarkSidebar = false,
}) => {
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
  const storeMenuRef = useRef<HTMLDivElement>(null);

  const activeTenant = tenants.find(t => t.id === activeTenantId) || tenants[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (storeMenuRef.current && !storeMenuRef.current.contains(e.target as Node)) {
        setIsStoreMenuOpen(false);
      }
    };
    if (isStoreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStoreMenuOpen]);

  useEffect(() => {
    setIsStoreMenuOpen(false);
  }, [isSidebarCollapsed]);

  const allMenuItems = [
    { name: 'Dashboard', group: 'overview', icon: LayoutDashboard, roles: ['owner', 'branch_manager'] as UserRole[] },
    { name: 'Kasir POS (Penjualan)', group: 'operations', icon: ShoppingCart, roles: ['owner', 'branch_manager', 'cashier'] as UserRole[] },
    { name: 'Transaksi', group: 'operations', icon: ReceiptText, roles: ['owner', 'branch_manager', 'cashier'] as UserRole[] },
    {
      name: 'Produk',
      group: 'catalog',
      icon: Package,
      roles: ['owner', 'branch_manager', 'cashier'] as UserRole[],
      submenus: [
        { name: 'Daftar Barang', icon: ShoppingBag, roles: ['owner', 'branch_manager', 'cashier'] as UserRole[] },
        { name: 'Daftar Kategori', icon: FolderTree, roles: ['owner', 'branch_manager'] as UserRole[] },
      ],
    },
    { name: 'Promo', group: 'catalog', icon: BadgePercent, roles: ['owner', 'branch_manager'] as UserRole[] },
    { name: 'Multi-Outlet', group: 'admin', icon: Store, roles: ['owner', 'branch_manager'] as UserRole[] },
    { name: 'Manajemen User', group: 'admin', icon: UserCog, roles: ['owner'] as UserRole[] },
    { name: 'Pengaturan', group: 'admin', icon: Settings, roles: ['owner', 'branch_manager'] as UserRole[] },
  ];

  const menuItems = allMenuItems
    .filter(item => item.roles.includes(userRole))
    .map(item =>
      item.submenus
        ? { ...item, submenus: item.submenus.filter(sub => sub.roles.includes(userRole)) }
        : item
    );

  const handleItemSelect = (menuName: string) => {
    onSelectMenu(menuName);
    if (window.innerWidth < 1024 && !isSidebarCollapsed) {
      onToggleSidebar();
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {!isSidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden transition-opacity duration-200"
          onClick={onToggleSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`flex flex-col flex-shrink-0 z-40 transition-all duration-300 fixed inset-y-0 left-0 lg:static lg:h-auto ${
          isDarkSidebar
            ? 'bg-[#1E1B4B] text-indigo-100'
            : 'bg-white text-zinc-700'
        } ${
          isSidebarCollapsed
            ? '-translate-x-full lg:translate-x-0 lg:w-16'
            : 'translate-x-0 w-72 lg:w-60'
        }`}
      >
        {/* Desktop Top Header (Logo + Collapse Toggle) */}
        <div
          className={`hidden lg:flex items-center h-13 shrink-0 transition-all duration-200 ${
            isSidebarCollapsed ? 'justify-center px-2' : 'justify-between px-3.5'
          }`}
        >
          {!isSidebarCollapsed && (
            <button
              type="button"
              onClick={() => handleItemSelect('Kasir POS (Penjualan)')}
              className={`flex items-center cursor-pointer select-none rounded-lg px-1 py-1 transition-colors ${
                isDarkSidebar ? 'hover:bg-indigo-900/55' : 'hover:bg-zinc-100'
              }`}
              aria-label="LogicPOS Beranda"
            >
              <BrandLogo size="md" inverted={isDarkSidebar} />
            </button>
          )}
          <Tooltip content={isSidebarCollapsed ? 'Buka Menu' : 'Ciutkan Menu'} side="right" sideOffset={10}>
            <button
              type="button"
              onClick={onToggleSidebar}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer outline-none focus:outline-none shrink-0 ${
                isDarkSidebar
                  ? 'text-indigo-200 hover:text-white hover:bg-indigo-900/70'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              aria-label={isSidebarCollapsed ? 'Buka Menu' : 'Ciutkan Menu'}
            >
              <svg
                className="w-[18px] h-[18px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <line x1="9" y1="3" x2="9" y2="21" />
                {isSidebarCollapsed ? (
                  <polyline points="13 10 15.5 12 13 14" />
                ) : (
                  <polyline points="15.5 10 13 12 15.5 14" />
                )}
              </svg>
            </button>
          </Tooltip>
        </div>

        {/* Mobile Drawer Top Header (only visible on mobile drawer) */}
        <div
          className={`flex lg:hidden items-center justify-between px-4 h-14 border-b ${
            isDarkSidebar
              ? 'border-indigo-900/80 bg-[#1E1B4B] text-white'
              : 'border-zinc-200 bg-white text-zinc-900'
          }`}
        >
          <BrandLogo size="sm" inverted={isDarkSidebar} />
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer outline-none focus:outline-none ${
              isDarkSidebar
                ? 'text-indigo-200 hover:text-white hover:bg-indigo-900/70'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60'
            }`}
            aria-label="Tutup Menu"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* SIDEBAR MENUS */}
        <div className="flex-1 px-2.5 pt-1 pb-3 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {menuItems.map((menu, i) => {
            const Icon = menu.icon;
            const hasSubmenus = !!menu.submenus && menu.submenus.length > 0;
            const isParentActive = activeMenu === menu.name;
            const isAnySubActive = hasSubmenus && menu.submenus.some(s => s.name === activeMenu);
            const showGroupDivider = i > 0 && menuItems[i - 1].group !== menu.group;

            return (
              <div key={menu.name} className="flex flex-col">
                {showGroupDivider && (
                  <div
                    className={`my-2 mx-1.5 border-t ${
                      isDarkSidebar ? 'border-indigo-900/80' : 'border-zinc-200/80'
                    }`}
                    aria-hidden="true"
                  />
                )}
                {/* Main Menu Button */}
                <Tooltip content={menu.name} side="right" sideOffset={14} disabled={!isSidebarCollapsed}>
                  <button
                    type="button"
                    onClick={() => {
                      if (hasSubmenus) {
                        onToggleProdukExpanded();
                      } else {
                        handleItemSelect(menu.name);
                      }
                    }}
                    className={`relative flex items-center px-3 py-2 text-left text-sm rounded-lg group w-full cursor-pointer min-h-[38px] transition-colors duration-150 ${
                      isDarkSidebar
                        ? isParentActive
                          ? 'bg-[#4F46E5] text-white font-semibold z-20'
                          : isAnySubActive
                          ? 'bg-indigo-900/60 text-white font-semibold z-10'
                          : 'text-indigo-100/85 hover:bg-indigo-900/55 hover:text-white font-medium z-10'
                        : isParentActive
                        ? 'bg-zinc-900 text-white font-semibold z-20'
                        : isAnySubActive
                        ? 'bg-zinc-100 text-zinc-950 font-semibold z-10'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 font-medium z-10'
                    }`}
                  >
                    <Icon
                      size={17}
                      strokeWidth={isParentActive ? 2.1 : 1.8}
                      className={`relative z-10 shrink-0 transition-colors duration-150 ${
                        isDarkSidebar
                          ? isParentActive || isAnySubActive
                            ? 'text-white'
                            : 'text-indigo-300 group-hover:text-white'
                          : isParentActive
                          ? 'text-white'
                          : isAnySubActive
                          ? 'text-zinc-900'
                          : 'text-zinc-500 group-hover:text-zinc-900'
                      }`}
                    />
                    <span
                      className={`relative z-10 whitespace-nowrap text-[13px] transition-all duration-200 overflow-hidden flex-1 ${
                        isSidebarCollapsed
                          ? 'max-w-0 opacity-0 translate-x-2 ml-0'
                          : 'max-w-[220px] opacity-100 translate-x-0 ml-2.5'
                      }`}
                    >
                      {menu.name}
                    </span>

                    {hasSubmenus && !isSidebarCollapsed && (
                      <ChevronDown
                        size={14}
                        className={`relative z-10 transition-transform duration-200 ${
                          isDarkSidebar
                            ? isProdukExpanded
                              ? 'rotate-180 text-white'
                              : 'text-indigo-300'
                            : isProdukExpanded
                            ? 'rotate-180 text-zinc-700'
                            : 'text-zinc-400'
                        }`}
                      />
                    )}
                  </button>
                </Tooltip>

                {/* Submenu List */}
                {hasSubmenus && isProdukExpanded && (
                  <div className="flex flex-col gap-0.5 my-0.5">
                    {menu.submenus.map((sub, j) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeMenu === sub.name;

                      return (
                        <Tooltip key={j} content={sub.name} side="right" sideOffset={14} disabled={!isSidebarCollapsed}>
                          <button
                            type="button"
                            onClick={() => handleItemSelect(sub.name)}
                            className={`relative flex items-center text-left text-[13px] rounded-lg group w-full cursor-pointer transition-colors duration-150 min-h-[34px] ${
                              isSidebarCollapsed ? 'px-3 py-1.5' : 'pl-8 pr-3 py-1.5'
                            } ${
                              isDarkSidebar
                                ? isSubActive
                                  ? 'bg-[#4F46E5] text-white font-semibold'
                                  : 'text-indigo-200/85 hover:bg-indigo-900/55 hover:text-white font-medium'
                                : isSubActive
                                ? 'bg-zinc-900 text-white font-semibold'
                                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 font-medium'
                            }`}
                          >
                            <SubIcon
                              size={16}
                              strokeWidth={isSubActive ? 2.1 : 1.8}
                              className={`relative z-10 shrink-0 transition-colors duration-150 ${
                                isDarkSidebar
                                  ? isSubActive
                                    ? 'text-white'
                                    : 'text-indigo-300 group-hover:text-white'
                                  : isSubActive
                                  ? 'text-white'
                                  : 'text-zinc-500 group-hover:text-zinc-900'
                              }`}
                            />
                            <span
                              className={`relative z-10 whitespace-nowrap text-[13px] transition-all duration-200 overflow-hidden ${
                                isSidebarCollapsed
                                  ? 'max-w-0 opacity-0 translate-x-2 ml-0'
                                  : 'max-w-[220px] opacity-100 translate-x-0 ml-2.5'
                              }`}
                            >
                              {sub.name}
                            </span>
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* BOTTOM SECTION: MENGATUR TOKO / MULTI-OUTLET */}
        <div
          className={`p-2.5 border-t shrink-0 relative ${
            isDarkSidebar ? 'border-indigo-900/80' : 'border-zinc-200'
          }`}
          ref={storeMenuRef}
        >
          {isSidebarCollapsed ? (
            <Tooltip
              content={`Toko: ${activeTenant?.name || 'Toko'} (${activeTenant?.branchName || 'Cabang'})`}
              side="right"
              sideOffset={14}
              disabled={isStoreMenuOpen}
            >
              <button
                type="button"
                onClick={() => setIsStoreMenuOpen(!isStoreMenuOpen)}
                className={`w-9 h-9 mx-auto rounded-lg border flex items-center justify-center font-bold text-xs sm:text-sm cursor-pointer transition-colors ${
                  isDarkSidebar
                    ? `bg-indigo-950/80 hover:bg-indigo-900/80 border-indigo-800/80 text-white ${
                        isStoreMenuOpen ? 'ring-2 ring-indigo-400/40 border-indigo-400' : ''
                      }`
                    : `bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-900 ${
                        isStoreMenuOpen ? 'ring-2 ring-zinc-900/15 border-zinc-400' : ''
                      }`
                }`}
                aria-label="Atur Toko"
                aria-expanded={isStoreMenuOpen}
              >
                <Store size={17} className={isDarkSidebar ? 'text-indigo-200' : 'text-zinc-800'} />
              </button>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={() => setIsStoreMenuOpen(!isStoreMenuOpen)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer group outline-none ${
                isDarkSidebar
                  ? `bg-indigo-950/75 hover:bg-indigo-900/75 border-indigo-800/80 ${
                      isStoreMenuOpen ? 'ring-2 ring-indigo-400/30 border-indigo-400' : ''
                    }`
                  : `bg-zinc-50 hover:bg-zinc-100 border-zinc-200 ${
                      isStoreMenuOpen ? 'ring-2 ring-zinc-900/10 border-zinc-300' : ''
                    }`
              }`}
              aria-label="Pengaturan Toko"
              aria-expanded={isStoreMenuOpen}
            >
              <div
                className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                  isDarkSidebar
                    ? 'bg-indigo-900/70 border-indigo-700/70'
                    : 'bg-zinc-100 border-zinc-200/70'
                }`}
              >
                <Store size={16} className={isDarkSidebar ? 'text-indigo-200' : 'text-zinc-800'} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs sm:text-sm font-semibold truncate leading-tight ${
                    isDarkSidebar ? 'text-white' : 'text-zinc-950'
                  }`}
                >
                  {activeTenant?.name || 'Toko Utama'}
                </p>
                <p
                  className={`text-[11px] truncate mt-0.5 font-medium ${
                    isDarkSidebar ? 'text-indigo-200/80' : 'text-zinc-500'
                  }`}
                >
                  {activeTenant?.branchName || 'Cabang Utama'}
                </p>
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform shrink-0 ${
                  isDarkSidebar
                    ? isStoreMenuOpen
                      ? 'rotate-180 text-white'
                      : 'text-indigo-300'
                    : isStoreMenuOpen
                    ? 'rotate-180 text-zinc-700'
                    : 'text-zinc-400'
                }`}
              />
            </button>
          )}

          {/* Store Selector Popover */}
          {isStoreMenuOpen && (
            <div
              className={`absolute bg-white text-zinc-900 rounded-xl border border-zinc-200 shadow-lg p-2 z-50 duration-150 ${
                isSidebarCollapsed
                  ? 'bottom-2 left-full ml-3 w-64 animate-in fade-in slide-in-from-left-2'
                  : 'bottom-full left-2 sm:left-2.5 mb-2 w-64 animate-in fade-in slide-in-from-bottom-2'
              }`}
            >
              <div className="px-2.5 py-1.5 border-b border-zinc-100 flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-900">Pilih Toko / Outlet</p>
                <span className="text-xs text-zinc-400 font-medium">
                  {tenants.length} Toko
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 my-1.5">
                {tenants.map(t => {
                  const isSelected = t.id === activeTenant?.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onSelectTenant?.(t.id);
                        setIsStoreMenuOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg flex items-center justify-between text-xs sm:text-sm transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-zinc-100 text-zinc-950 font-semibold'
                          : 'hover:bg-zinc-50 text-zinc-700 font-medium'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="truncate font-semibold leading-tight text-xs sm:text-sm">{t.name}</p>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">{t.branchName}</p>
                      </div>
                      {isSelected && <Check size={14} className="text-zinc-900 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {(userRole === 'owner' || userRole === 'branch_manager') && (
                <div className="pt-2 border-t border-zinc-100 space-y-1">
                  {userRole === 'owner' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsStoreMenuOpen(false);
                        onOpenRegisterModal?.();
                      }}
                      className="w-full py-2 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} className="shrink-0" />
                      <span>Tambah Toko / Outlet Baru</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsStoreMenuOpen(false);
                      onSelectMenu('Multi-Outlet');
                    }}
                    className="w-full py-1.5 px-2 text-zinc-700 hover:bg-zinc-100 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                  >
                    Kelola Multi-Outlet
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
