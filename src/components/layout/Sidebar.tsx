import React, { useState, useRef, useEffect } from 'react';
import { GoogleIcon, GoogleIconName } from '../common/GoogleIcon';
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
    { name: 'Dashboard', group: 'overview', icon: 'dashboard' as GoogleIconName, roles: ['owner', 'branch_manager'] as UserRole[] },
    { name: 'Kasir POS (Penjualan)', group: 'operations', icon: 'shopping_cart' as GoogleIconName, roles: ['owner', 'branch_manager', 'cashier'] as UserRole[] },
    { name: 'Transaksi', group: 'operations', icon: 'receipt_long' as GoogleIconName, roles: ['owner', 'branch_manager', 'cashier'] as UserRole[] },
    {
      name: 'Produk',
      group: 'catalog',
      icon: 'inventory_2' as GoogleIconName,
      roles: ['owner', 'branch_manager', 'cashier'] as UserRole[],
      submenus: [
        { name: 'Daftar Barang', icon: 'shopping_bag' as GoogleIconName, roles: ['owner', 'branch_manager', 'cashier'] as UserRole[] },
        { name: 'Daftar Kategori', icon: 'category' as GoogleIconName, roles: ['owner', 'branch_manager'] as UserRole[] },
      ],
    },
    { name: 'Promo', group: 'catalog', icon: 'sell' as GoogleIconName, roles: ['owner', 'branch_manager'] as UserRole[] },
    { name: 'Multi-Outlet', group: 'admin', icon: 'storefront' as GoogleIconName, roles: ['owner', 'branch_manager'] as UserRole[] },
    { name: 'Manajemen User', group: 'admin', icon: 'manage_accounts' as GoogleIconName, roles: ['owner'] as UserRole[] },
    { name: 'Pengaturan', group: 'admin', icon: 'settings' as GoogleIconName, roles: ['owner', 'branch_manager'] as UserRole[] },
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
              className={`flex items-center justify-center transition-colors cursor-pointer outline-none focus:outline-none shrink-0 ${
                isSidebarCollapsed ? 'w-10 h-10 rounded-xl' : 'w-8 h-8 rounded-lg'
              } ${
                isDarkSidebar
                  ? 'text-indigo-200 hover:text-white hover:bg-indigo-900/70'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              aria-label={isSidebarCollapsed ? 'Buka Menu' : 'Ciutkan Menu'}
            >
              {isSidebarCollapsed ? (
                <GoogleIcon name="keyboard_double_arrow_right" size={18} />
              ) : (
                <GoogleIcon name="keyboard_double_arrow_left" size={18} />
              )}
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
            <GoogleIcon name="chevron_left" size={18} />
          </button>
        </div>

        {/* SIDEBAR MENUS */}
        <div
          className={`flex-1 px-2.5 pt-1 pb-3 flex flex-col overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${
            isSidebarCollapsed ? 'gap-1' : 'gap-0.5'
          }`}
        >
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
                    className={`relative flex items-center text-left text-sm group cursor-pointer transition-colors duration-150 ${
                      isSidebarCollapsed
                        ? 'w-10 h-10 mx-auto justify-center p-0 rounded-xl shrink-0'
                        : 'px-3 py-2 rounded-lg w-full min-h-[38px]'
                    } ${
                      isDarkSidebar
                        ? isParentActive
                          ? 'bg-primary/25 text-white font-semibold z-20'
                          : isAnySubActive
                          ? 'bg-indigo-900/60 text-white font-semibold z-10'
                          : 'text-indigo-100/85 hover:bg-indigo-900/55 hover:text-white font-medium z-10'
                        : isParentActive
                        ? 'bg-primary/12 text-primary font-semibold z-20'
                        : isAnySubActive
                        ? 'bg-primary/[0.06] text-primary font-semibold z-10'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 font-medium z-10'
                    }`}
                  >
                    <GoogleIcon
                      name={menu.icon}
                      size={isSidebarCollapsed ? 20 : 18}
                      filled={isParentActive}
                      className={`relative z-10 shrink-0 transition-colors duration-150 ${
                        isDarkSidebar
                          ? isParentActive || isAnySubActive
                            ? 'text-white'
                            : 'text-indigo-300 group-hover:text-white'
                          : isParentActive || isAnySubActive
                          ? 'text-primary'
                          : 'text-zinc-500 group-hover:text-zinc-900'
                      }`}
                    />
                    <span
                      className={`relative z-10 whitespace-nowrap text-[14px] transition-all duration-200 overflow-hidden ${
                        isSidebarCollapsed
                          ? 'w-0 max-w-0 opacity-0 translate-x-2 ml-0'
                          : 'flex-1 max-w-[220px] opacity-100 translate-x-0 ml-2.5'
                      }`}
                    >
                      {menu.name}
                    </span>

                    {hasSubmenus && !isSidebarCollapsed && (
                      <GoogleIcon name="keyboard_arrow_down" size={14}
                       
                        className={`relative z-10 transition-transform duration-200 ${
                          isDarkSidebar
                            ? isProdukExpanded
                              ? 'rotate-180 text-white'
                              : 'text-indigo-300'
                            : isProdukExpanded
                            ? 'rotate-180 text-primary'
                            : 'text-zinc-400'
                        }`}
                      />
                    )}
                  </button>
                </Tooltip>

                {/* Submenu List */}
                {hasSubmenus && isProdukExpanded && (
                  <div className={`flex flex-col my-0.5 ${isSidebarCollapsed ? 'gap-1' : 'gap-0.5'}`}>
                    {menu.submenus.map((sub, j) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeMenu === sub.name;

                      return (
                        <Tooltip key={j} content={sub.name} side="right" sideOffset={14} disabled={!isSidebarCollapsed}>
                          <button
                            type="button"
                            onClick={() => handleItemSelect(sub.name)}
                            className={`relative flex items-center text-left text-[14px] group cursor-pointer transition-colors duration-150 ${
                              isSidebarCollapsed
                                ? 'w-10 h-10 mx-auto justify-center p-0 rounded-xl shrink-0'
                                : 'pl-8 pr-3 py-1.5 rounded-lg w-full min-h-[36px]'
                            } ${
                              isDarkSidebar
                                ? isSubActive
                                  ? 'bg-primary/25 text-white font-semibold'
                                  : 'text-indigo-200/85 hover:bg-indigo-900/55 hover:text-white font-medium'
                                : isSubActive
                                ? 'bg-primary/12 text-primary font-semibold'
                                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 font-medium'
                            }`}
                          >
                            <GoogleIcon
                              name={SubIcon}
                              size={isSidebarCollapsed ? 18 : 16}
                              filled={isSubActive}
                              className={`relative z-10 shrink-0 transition-colors duration-150 ${
                                isDarkSidebar
                                  ? isSubActive
                                    ? 'text-white'
                                    : 'text-indigo-300 group-hover:text-white'
                                  : isSubActive
                                  ? 'text-primary'
                                  : 'text-zinc-500 group-hover:text-zinc-900'
                              }`}
                            />
                            <span
                              className={`relative z-10 whitespace-nowrap text-[14px] transition-all duration-200 overflow-hidden ${
                                isSidebarCollapsed
                                  ? 'w-0 max-w-0 opacity-0 translate-x-2 ml-0'
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
            isDarkSidebar ? 'border-indigo-900/80' : 'border-zinc-200/80'
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
                className={`w-10 h-10 mx-auto rounded-xl border flex items-center justify-center font-bold text-xs sm:text-sm cursor-pointer transition-colors ${
                  isDarkSidebar
                    ? `bg-indigo-950/80 hover:bg-indigo-900/80 border-indigo-800/80 text-white ${
                        isStoreMenuOpen ? 'ring-2 ring-indigo-400/40 border-indigo-400' : ''
                      }`
                    : `bg-primary-soft hover:bg-primary-soft/80 border-primary-border text-primary ${
                        isStoreMenuOpen ? 'ring-2 ring-primary/20 border-primary' : ''
                      }`
                }`}
                aria-label="Atur Toko"
                aria-expanded={isStoreMenuOpen}
              >
                <GoogleIcon name="storefront" size={18} className={isDarkSidebar ? 'text-indigo-200' : 'text-primary'} />
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
                  : `bg-zinc-50 hover:bg-primary-soft/40 border-zinc-200 hover:border-primary-border ${
                      isStoreMenuOpen ? 'ring-2 ring-primary/15 border-primary' : ''
                    }`
              }`}
              aria-label="Pengaturan Toko"
              aria-expanded={isStoreMenuOpen}
            >
              <div
                className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                  isDarkSidebar
                    ? 'bg-indigo-900/70 border-indigo-700/70'
                    : 'bg-primary-soft border-primary-border'
                }`}
              >
                <GoogleIcon name="storefront" size={16} className={isDarkSidebar ? 'text-indigo-200' : 'text-primary'} />
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
                  className={`text-xs truncate mt-0.5 font-medium ${
                    isDarkSidebar ? 'text-indigo-200/80' : 'text-zinc-500'
                  }`}
                >
                  {activeTenant?.branchName || 'Cabang Utama'}
                </p>
              </div>
              <GoogleIcon name="keyboard_arrow_down" size={14}
               
                className={`transition-transform shrink-0 ${
                  isDarkSidebar
                    ? isStoreMenuOpen
                      ? 'rotate-180 text-white'
                      : 'text-indigo-300'
                    : isStoreMenuOpen
                    ? 'rotate-180 text-primary'
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
                <span className="text-xs text-secondary-text bg-secondary-soft px-1.5 py-0.5 rounded font-semibold">
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
                          ? 'bg-primary-soft text-primary-text font-semibold'
                          : 'hover:bg-zinc-50 text-zinc-700 font-medium'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="truncate font-semibold leading-tight text-xs sm:text-sm">{t.name}</p>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">{t.branchName}</p>
                      </div>
                      {isSelected && <GoogleIcon name="check" size={14} className="text-primary shrink-0" />}
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
                      className="w-full py-2 px-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <GoogleIcon name="add" size={14} className="shrink-0" />
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
