import React, { useState, useRef, useEffect } from 'react';
import { GoogleIcon, GoogleIconName } from '../common/GoogleIcon';
import Tooltip from '../Tooltip';
import { BrandLogo } from '../common/BrandLogo';
import { Tenant, UserAccount, UserRole } from '../../types';

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
  currentUser?: UserAccount;
  onLogout?: () => void;
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
  currentUser,
  onLogout,
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const activeTenant = tenants.find(t => t.id === activeTenantId) || tenants[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  useEffect(() => {
    setIsProfileMenuOpen(false);
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
        className={`flex flex-col flex-shrink-0 z-40 transition-all duration-300 fixed inset-y-0 left-0 lg:static lg:h-auto bg-white lg:bg-transparent text-zinc-800 border-r border-zinc-200 lg:border-none ${
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
                isDarkSidebar ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-100'
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
                isSidebarCollapsed ? 'w-10 h-10 aspect-square rounded-full' : 'w-8 h-8 aspect-square rounded-full'
              } ${
                isDarkSidebar
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
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
              ? 'border-zinc-800/80 bg-[#0e0e11] text-white'
              : 'border-zinc-200 bg-white text-zinc-900'
          }`}
        >
          <BrandLogo size="sm" inverted={isDarkSidebar} />
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`w-8 h-8 aspect-square flex items-center justify-center rounded-full transition-colors cursor-pointer outline-none focus:outline-none ${
              isDarkSidebar
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
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
                      isDarkSidebar ? 'border-zinc-800/80' : 'border-zinc-200/80'
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
                        ? 'w-10 h-10 aspect-square mx-auto justify-center p-0 rounded-full shrink-0'
                        : 'px-3 py-2 rounded-lg w-full min-h-[38px]'
                    } ${
                      isDarkSidebar
                        ? isParentActive
                          ? 'bg-primary/20 text-white font-semibold z-20 shadow-xs'
                          : isAnySubActive
                          ? 'bg-zinc-800/80 text-white font-semibold z-10'
                          : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white font-medium z-10'
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
                            : 'text-zinc-400 group-hover:text-white'
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
                              : 'text-zinc-400'
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
                                  ? 'bg-primary/20 text-white font-semibold'
                                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white font-medium'
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
                                    : 'text-zinc-400 group-hover:text-white'
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

        {/* BOTTOM SECTION: PROFIL */}
        <div className="p-2.5 shrink-0 flex flex-col gap-2 relative">
          {/* USER PROFILE SECTION */}
          {currentUser && (
            <div ref={profileMenuRef} className="relative">
              {isSidebarCollapsed ? (
                <div className="flex justify-center">
                  <Tooltip
                    content={`${currentUser.fullName} (${ROLE_LABELS[currentUser.role]})`}
                    side="right"
                    sideOffset={14}
                    disabled={isProfileMenuOpen}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(!isProfileMenuOpen);
                      }}
                      className={`w-10 h-10 aspect-square rounded-full flex items-center justify-center font-bold text-xs cursor-pointer transition-colors shadow-xs outline-none ${
                        isProfileMenuOpen ? 'ring-2 ring-primary/40 ring-offset-1' : ''
                      } bg-primary text-white hover:bg-primary-hover`}
                      aria-label="Profil Pengguna"
                      aria-expanded={isProfileMenuOpen}
                    >
                      {getInitials(currentUser.fullName)}
                    </button>
                  </Tooltip>
                </div>
              ) : (
                <div className="w-full">
                  {/* Profile Card Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(!isProfileMenuOpen);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer group outline-none ${
                      isDarkSidebar
                        ? `bg-zinc-900/90 hover:bg-zinc-800/90 border-zinc-800 ${
                            isProfileMenuOpen ? 'ring-2 ring-primary/40 border-primary' : ''
                          }`
                        : `bg-zinc-50 hover:bg-zinc-100/80 border-zinc-200 ${
                            isProfileMenuOpen ? 'ring-2 ring-primary/15 border-primary' : ''
                          }`
                    }`}
                    aria-label="Menu Profil Pengguna"
                    aria-expanded={isProfileMenuOpen}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      {getInitials(currentUser.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-semibold truncate leading-tight ${
                          isDarkSidebar ? 'text-white' : 'text-zinc-950'
                        }`}
                      >
                        {currentUser.fullName}
                      </p>
                      <p
                        className={`text-[11px] truncate mt-0.5 font-medium ${
                          isDarkSidebar ? 'text-zinc-400' : 'text-zinc-500'
                        }`}
                      >
                        {ROLE_LABELS[currentUser.role]}
                      </p>
                    </div>
                    <GoogleIcon
                      name="keyboard_arrow_down"
                      size={14}
                      className={`transition-transform shrink-0 ${
                        isDarkSidebar
                          ? isProfileMenuOpen ? 'rotate-180 text-white' : 'text-zinc-400'
                          : isProfileMenuOpen ? 'rotate-180 text-primary' : 'text-zinc-400'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Profile Dropdown Popover */}
              {isProfileMenuOpen && (
                <div
                  className={`absolute rounded-xl border shadow-2xl p-1.5 z-50 duration-150 ${
                    isDarkSidebar
                      ? 'bg-[#18181b] text-zinc-100 border-zinc-700/80 shadow-black/80'
                      : 'bg-white text-zinc-900 border-zinc-200 shadow-xl'
                  } ${
                    isSidebarCollapsed
                      ? 'bottom-0 left-full ml-3 w-64 animate-in fade-in slide-in-from-left-2'
                      : 'bottom-full left-0 mb-2 w-64 animate-in fade-in slide-in-from-bottom-2'
                  }`}
                >
                  {/* User Profile Header */}
                  <div className="px-3 py-2.5 border-b border-zinc-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        {getInitials(currentUser.fullName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs sm:text-sm font-bold text-zinc-950 truncate">
                            {currentUser.fullName}
                          </p>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-soft text-primary-text shrink-0">
                            {ROLE_LABELS[currentUser.role]}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {currentUser.shiftLabel}
                        </p>
                      </div>
                    </div>

                    {activeTenant && (
                      <div className="mt-2 text-[11px] bg-zinc-50 border border-zinc-200/80 text-zinc-700 px-2 py-1 rounded-md">
                        <span className="text-[10px] text-zinc-400 block leading-tight">Outlet Aktif:</span>
                        <span className="font-semibold text-zinc-900 block truncate">
                          {activeTenant.code} &bull; {activeTenant.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Menu Options */}
                  <div className="p-1 space-y-0.5">
                    {currentUser.role === 'owner' && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectMenu('Manajemen User');
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <GoogleIcon name="manage_accounts" size={15} className="text-zinc-400 shrink-0" />
                        <span>Manajemen User &amp; Akses</span>
                      </button>
                    )}

                    {currentUser.role !== 'cashier' && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectMenu('Pengaturan');
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <GoogleIcon name="settings" size={15} className="text-zinc-400 shrink-0" />
                        <span>Pengaturan Toko</span>
                      </button>
                    )}

                    <div className="my-1 border-t border-zinc-100" />

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onLogout?.();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left cursor-pointer"
                    >
                      <GoogleIcon name="logout" size={15} className="text-red-500 shrink-0" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
