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
      className={`rounded-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between select-none cursor-pointer min-h-[220px] sm:min-h-[240px] transition-all duration-200 active:scale-[0.98] shadow-sm text-white ${
        isActiveFilter
          ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 ring-2 ring-white ring-offset-2 ring-offset-orange-500 shadow-md'
          : 'bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 hover:shadow-md'
      } ${className}`}
      title="Klik untuk memfilter produk promo"
    >
      {/* Giant Dominant Discount Icon Watermark (Overflowing Top-Right) */}
      <div
        className="absolute -top-7 -right-7 sm:-top-8 sm:-right-8 pointer-events-none select-none text-white/20 rotate-[16deg]"
        aria-hidden="true"
      >
        <GoogleIcon name="sell"
          className="w-36 h-36 sm:w-44 sm:h-44 text-white/20"
         
        />
      </div>

      {/* Top Left: Crisp Icon Badge */}
      <div className="relative z-10 flex items-start justify-between w-full">
        <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-xs text-white border border-white/30 flex items-center justify-center shadow-xs">
          <GoogleIcon name="sell" size={24} />
        </div>

        {isActiveFilter && (
          <span className="text-xs font-bold px-2.5 py-0.5 bg-white text-orange-600 rounded-md uppercase tracking-wider shadow-xs">
            Filter Aktif
          </span>
        )}
      </div>

      {/* Bottom Left: Title & Subtext */}
      <div className="relative z-10 mt-auto text-left pt-6">
        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-none mb-1.5">
          Promo
        </h3>
        <p className="text-xs sm:text-sm font-medium text-white/90 leading-snug">
          {promoCount} promo tersedia
          <br />
          untuk pelanggan
        </p>
      </div>
    </div>
  );
};
