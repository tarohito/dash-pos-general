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
  const isInteractive = Boolean(onToggleFilter);
  return (
    <div
      onClick={onToggleFilter}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggleFilter?.();
              }
            }
          : undefined
      }
      aria-pressed={isInteractive ? isActiveFilter : undefined}
      className={`rounded-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between select-none min-h-[220px] sm:min-h-[240px] transition-all duration-200 shadow-sm text-white ${
        isInteractive
          ? 'cursor-pointer active:scale-[0.98] hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 '
          : ''
      }${
        isActiveFilter
          ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 ring-2 ring-orange-500 ring-offset-2 ring-offset-zinc-50 shadow-md'
          : 'bg-gradient-to-br from-amber-500 to-orange-500 hover:shadow-md'
      } ${className}`}
      title={
        isInteractive
          ? isActiveFilter
            ? 'Klik lagi untuk menampilkan semua produk'
            : 'Klik untuk memfilter produk promo'
          : undefined
      }
    >
      {/* Giant Dominant Discount Icon Watermark (Overflowing Top-Right) */}
      <div
        className="absolute -top-7 -right-7 sm:-top-8 sm:-right-8 pointer-events-none select-none text-white/20 rotate-[16deg]"
        aria-hidden="true"
      >
        <GoogleIcon
          name="sell"
          className="w-36 h-36 sm:w-44 sm:h-44 text-white/20"
        />
      </div>

      {/* Top Right: Active Filter Status */}
      {isActiveFilter && (
        <div className="relative z-10 flex items-start justify-end w-full">
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 bg-white text-orange-600 rounded-md uppercase tracking-wider shadow-xs">
            <span>Filter Aktif</span>
            <GoogleIcon name="close" size={12} />
          </span>
        </div>
      )}

      {/* Bottom Left: Title & Subtext */}
      <div className="relative z-10 mt-auto text-left pt-6">
        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-none mb-1.5">
          Promo
        </h3>
        <p className="text-xs sm:text-sm font-medium text-white/90 leading-snug">
          {promoCount} promo tersedia
          <br />
          {isActiveFilter ? 'Klik untuk tampilkan semua' : 'untuk pelanggan'}
        </p>
      </div>
    </div>
  );
};
