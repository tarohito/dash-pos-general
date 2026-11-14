import React from 'react';
import { GoogleIcon } from '../common/GoogleIcon';

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
      className={`rounded-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between select-none cursor-pointer min-h-[220px] sm:min-h-[240px] transition-colors duration-150 active:scale-[0.98] border ${
        isActiveFilter
          ? 'ring-2 ring-accent border-accent bg-accent-soft'
          : 'bg-accent-soft/45 border-accent-border hover:border-accent hover:bg-accent-soft/75'
      } ${className}`}
      title="Klik untuk memfilter produk promo"
    >
      {/* Giant Dominant Discount Icon Watermark (Overflowing Top-Right) */}
      <div
        className="absolute -top-7 -right-7 sm:-top-8 sm:-right-8 pointer-events-none select-none text-accent/15 rotate-[16deg]"
        aria-hidden="true"
      >
        <GoogleIcon name="sell"
          className="w-36 h-36 sm:w-44 sm:h-44 text-accent/15"
         
        />
      </div>

      {/* Top Left: Crisp Accent Discount Badge Icon */}
      <div className="relative z-10 flex items-start justify-between w-full">
        <div className="w-11 h-11 rounded-xl bg-accent text-white flex items-center justify-center shadow-xs">
          <GoogleIcon name="sell" size={24} />
        </div>

        {isActiveFilter && (
          <span className="text-xs font-semibold px-2.5 py-0.5 bg-accent text-white rounded-md uppercase tracking-wider">
            Filter Aktif
          </span>
        )}
      </div>

      {/* Bottom Left: Title & Subtext */}
      <div className="relative z-10 mt-auto text-left pt-6">
        <h3 className="text-base sm:text-lg font-bold text-accent-text tracking-tight leading-none mb-1.5">
          Promo
        </h3>
        <p className="text-xs sm:text-sm font-medium text-zinc-600 leading-snug">
          {promoCount} promo tersedia
          <br />
          untuk pelanggan
        </p>
      </div>
    </div>
  );
};
