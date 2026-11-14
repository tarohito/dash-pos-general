import React from 'react';
import { BadgePercent } from 'lucide-react';

interface PromoCardProps {
  promoCount: number;
  isActiveFilter?: boolean;
  onToggleFilter?: () => void;
  className?: string;
}

export const PromoCard: React.FC<PromoCardProps> = ({
  promoCount,
  isActiveFilter = false,
  onToggleFilter,
  className = '',
}) => {
  return (
    <div
      onClick={onToggleFilter}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleFilter?.();
        }
      }}
      className={`bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between select-none cursor-pointer min-h-[220px] sm:min-h-[240px] transition-colors duration-150 active:scale-[0.98] hover:border-zinc-400 ${
        isActiveFilter ? 'ring-2 ring-zinc-900 border-zinc-900 bg-zinc-50' : ''
      } ${className}`}
      title="Klik untuk memfilter produk promo"
    >
      {/* Giant Dominant Discount Icon Watermark (Overflowing Top-Right) */}
      <div
        className="absolute -top-7 -right-7 sm:-top-8 sm:-right-8 pointer-events-none select-none text-zinc-900/[0.04] rotate-[16deg]"
        aria-hidden="true"
      >
        <BadgePercent
          className="w-36 h-36 sm:w-44 sm:h-44 text-zinc-900/[0.04]"
          strokeWidth={1.75}
        />
      </div>

      {/* Top Left: Crisp Dark Discount Badge Icon */}
      <div className="relative z-10 flex items-start justify-between w-full">
        <div className="w-11 h-11 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
          <BadgePercent size={24} strokeWidth={2.2} />
        </div>

        {isActiveFilter && (
          <span className="text-xs font-semibold px-2.5 py-0.5 bg-zinc-900 text-white rounded-md uppercase tracking-wider">
            Filter Aktif
          </span>
        )}
      </div>

      {/* Bottom Left: Title & Subtext */}
      <div className="relative z-10 mt-auto text-left pt-6">
        <h3 className="text-base sm:text-lg font-bold text-zinc-950 tracking-tight leading-none mb-1.5">
          Promo
        </h3>
        <p className="text-xs sm:text-sm font-medium text-zinc-500 leading-snug">
          {promoCount} promo tersedia
          <br />
          untuk pelanggan
        </p>
      </div>
    </div>
  );
};
