import React, { memo } from 'react';
import { Product } from '../../types';
import { formatIDR } from '../../utils/formatters';
import { NewBadge } from '../common/NewBadge';
import { GoogleIcon } from '../common/GoogleIcon';

interface ProductCardProps {
  product: Product;
  isNew?: boolean;
  onAddToCart: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = memo(({ product, isNew = false, onAddToCart }) => {
  const isOutOfStock = product.stok <= 0;

  return (
    <div
      onClick={() => {
        if (!isOutOfStock) {
          onAddToCart(product);
        }
      }}
      className={`border rounded-xl transition-colors duration-150 group flex flex-col justify-between relative overflow-hidden active:scale-[0.98] select-none ${
        isOutOfStock
          ? 'border-zinc-200 opacity-60 cursor-not-allowed bg-zinc-50'
          : 'bg-white border-zinc-200 cursor-pointer hover:border-primary/60'
      }`}
    >
      <div className="flex flex-col flex-1">
        {/* Product Image (1:1 Aspect Ratio) */}
        <div className="w-full aspect-square relative overflow-hidden bg-zinc-50 flex items-center justify-center">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className={`w-full h-full object-cover transition-transform duration-300 ${
                !isOutOfStock ? 'group-hover:scale-105' : 'grayscale-40'
              }`}
            />
          ) : (
            <GoogleIcon name="deployed_code" size={32} className="text-zinc-300" />
          )}
          {/* New / Promo Badges */}
          {(isNew || product.isPromo) && (
            <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1 max-w-[calc(100%-3.25rem)]">
              {isNew && <NewBadge />}
              {product.isPromo && (
                <span className="text-xs font-bold px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-md shadow-xs">
                  {product.promoLabel || 'PROMO'}
                </span>
              )}
            </div>
          )}

          {/* Stock Badge: Cukup angka saja */}
          <div className="absolute top-2 right-2">
            <span
              className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md shadow-2xs ${
                isOutOfStock
                  ? 'bg-red-600 text-white'
                  : product.stok <= 5
                  ? 'bg-amber-500 text-white'
                  : 'bg-white/95 dark:bg-zinc-800/90 backdrop-blur-xs text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700'
              }`}
              title={`Stok: ${product.stok}`}
            >
              {product.stok}
            </span>
          </div>
        </div>

        {/* Product Details: Simple Name, Direct Price, then Weight below it */}
        <div className="p-2.5 sm:p-3 flex flex-col justify-between flex-1">
          <h3
            className={`text-xs sm:text-sm font-semibold leading-snug line-clamp-2 ${
              isOutOfStock ? 'text-zinc-400' : 'text-zinc-900 group-hover:text-zinc-950 transition-colors'
            }`}
            title={product.name}
          >
            {product.name}
          </h3>

          <div className="mt-1.5 sm:mt-2">
            {/* Harga Langsung */}
            <div
              className={`text-sm sm:text-base font-bold font-mono tabular-nums tracking-tight leading-tight transition-colors ${
                isOutOfStock ? 'text-zinc-400' : 'text-zinc-950 group-hover:text-primary'
              }`}
            >
              {formatIDR(product.harga)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';
