import React from 'react';
import { BrandLogo } from '../common/BrandLogo';

interface HeaderProps {
  onSelectMenu: (menu: string) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectMenu,
  isSidebarCollapsed,
  onToggleSidebar,
}) => {
  return (
    <header className="h-11 sm:h-12 flex lg:hidden items-center justify-between gap-3 px-3 sm:px-4 bg-transparent z-30 shrink-0 relative">
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="w-9 h-9 aspect-square rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-white/80 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center cursor-pointer shrink-0 outline-none focus:outline-none"
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
          className="flex items-center cursor-pointer select-none rounded-lg px-1.5 py-1 hover:bg-white/80 dark:hover:bg-zinc-800 transition-colors"
          aria-label="LogicPOS Beranda"
        >
          <BrandLogo size="sm" />
        </button>
      </div>
    </header>
  );
};
