import React, { useState } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { CartItem, PromoCampaign, PromoCouponValidationResult } from '../../types';
import { formatIDR } from '../../utils/formatters';
import { formatPromoDate, getPromoStatusSummary } from '../../utils/promoDuration';
import Tooltip from '../Tooltip';
import { MoneyAmount } from '../common/MoneyAmount';

interface CartPanelProps {
  cart: CartItem[];
  onUpdateQty: (id: number, delta: number) => void;
  onRemoveItem: (id: number) => void;
  onClearCart?: () => void;
  subtotal: number;
  grossSubtotal?: number;
  discountAmount?: number;
  tax: number;
  taxLabel?: string;
  grandTotal: number;
  activePromos?: PromoCampaign[];
  appliedPromo?: PromoCouponValidationResult | null;
  promoCouponError?: string | null;
  isValidatingPromo?: boolean;
  onApplyPromoCode?: (code: string) => Promise<void> | void;
  onRemovePromoCode?: () => void;
  onOpenPaymentModal: () => void;
  onBackToCatalog?: () => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  subtotal,
  grossSubtotal,
  discountAmount = 0,
  tax,
  taxLabel = 'PPN (11%)',
  grandTotal,
  activePromos = [],
  appliedPromo = null,
  promoCouponError = null,
  isValidatingPromo = false,
  onApplyPromoCode,
  onRemovePromoCode,
  onOpenPaymentModal,
  onBackToCatalog,
}) => {
  const [couponInput, setCouponInput] = useState('');
  const [showPromoPicker, setShowPromoPicker] = useState(false);
  const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);
  const displayGrossSubtotal = grossSubtotal ?? subtotal + discountAmount;
  const hasDiscount = discountAmount > 0;

  const handleSubmitCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onApplyPromoCode || !couponInput.trim() || isValidatingPromo) return;
    await onApplyPromoCode(couponInput.trim());
    setShowPromoPicker(false);
  };

  const handleSelectQuickPromo = async (promo: PromoCampaign) => {
    if (!onApplyPromoCode || isValidatingPromo) return;
    setCouponInput(promo.code);
    await onApplyPromoCode(promo.code);
    setShowPromoPicker(false);
  };

  return (
    <div className="w-full lg:w-[340px] xl:w-[370px] flex flex-col flex-1 min-h-0">
      {/* Cart Header */}
      <div className="pb-2.5 sm:pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {onBackToCatalog && (
            <button
              type="button"
              onClick={onBackToCatalog}
              className="lg:hidden w-9 h-9 aspect-square -ml-1 text-zinc-500 hover:text-zinc-950 rounded-full flex items-center justify-center cursor-pointer"
              title="Kembali ke Katalog"
            >
              <GoogleIcon name="chevron_left" size={20} />
            </button>
          )}
          <h2 className="font-bold text-zinc-950 text-sm sm:text-base">
            Keranjang Pesanan
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          {cart.length > 0 && onClearCart && (
            <Tooltip content="Kosongkan Keranjang" side="bottom">
              <button
                type="button"
                onClick={onClearCart}
                className="w-8 h-8 aspect-square flex items-center justify-center text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                aria-label="Kosongkan Keranjang"
              >
                <GoogleIcon name="delete" size={15} />
              </button>
            </Tooltip>
          )}
          <span className="px-2.5 py-0.5 bg-secondary-soft text-secondary-text border border-secondary-border text-xs font-bold rounded-md">
            {totalQty} Item
          </span>
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 py-1">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400">
            <GoogleIcon name="inventory_2" size={48} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">Belum ada produk di keranjang</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {cart.map(item => (
              <div
                key={item.id}
                className="p-3 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-xl flex gap-3 group relative transition-colors shadow-2xs"
              >
                <div className="w-12 h-12 bg-white rounded-lg border border-zinc-200 flex items-center justify-center shrink-0">
                  <GoogleIcon name="deployed_code" size={20} className="text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="text-xs font-mono font-medium text-zinc-500 truncate mb-0.5">
                    {item.sku} &bull; {Number(item.berat.toFixed(2))}g
                  </div>
                  <div className="text-sm font-semibold text-zinc-900 truncate mb-1">{item.name}</div>
                  <div className="text-sm font-bold font-mono text-zinc-950">{formatIDR(item.harga)}</div>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <Tooltip content="Hapus" side="left" sideOffset={6}>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onRemoveItem(item.id);
                      }}
                      className="w-8 h-8 aspect-square text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors flex items-center justify-center cursor-pointer"
                      aria-label="Hapus item"
                    >
                      <GoogleIcon name="delete" size={16} />
                    </button>
                  </Tooltip>
                  <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-full p-1 mt-1.5">
                    <Tooltip content="Kurang" side="top" sideOffset={4}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          if (item.qty <= 1) {
                            onRemoveItem(item.id);
                          } else {
                            onUpdateQty(item.id, -1);
                          }
                        }}
                        className="w-7 h-7 aspect-square flex items-center justify-center text-gray-600 hover:bg-zinc-100 rounded-full transition-all cursor-pointer active:scale-95"
                        aria-label="Kurang satu"
                      >
                        <GoogleIcon name="remove" size={13} />
                      </button>
                    </Tooltip>
                    <span className="text-sm font-bold font-mono w-6 text-center tabular-nums">{item.qty}</span>
                    <Tooltip content="Tambah" side="top" sideOffset={4}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onUpdateQty(item.id, 1);
                        }}
                        className="w-7 h-7 aspect-square flex items-center justify-center text-gray-600 hover:bg-zinc-100 rounded-full transition-all cursor-pointer active:scale-95"
                        aria-label="Tambah satu"
                      >
                        <GoogleIcon name="add" size={13} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Totals & Coupon */}
      <div className="p-3 sm:p-4 bg-white border border-zinc-200 rounded-2xl shrink-0 mt-2 shadow-2xs space-y-2.5">
        {cart.length > 0 && onApplyPromoCode && (
          <div className="pb-2.5 border-b border-zinc-100 space-y-2">
            {appliedPromo ? (
              <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <GoogleIcon name="sell" size={13} className="text-emerald-700 shrink-0" />
                    <span className="font-mono font-bold text-xs text-emerald-900">
                      {appliedPromo.promo.code}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white font-mono font-bold text-[10px]">
                      -{appliedPromo.promo.discountPercent}%
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 truncate mt-0.5">
                    {appliedPromo.promo.name} &bull; s/d {formatPromoDate(appliedPromo.promo.endDate)}
                  </p>
                </div>
                {onRemovePromoCode && (
                  <button
                    type="button"
                    onClick={() => {
                      setCouponInput('');
                      onRemovePromoCode();
                    }}
                    className="w-7 h-7 aspect-square rounded-full flex items-center justify-center text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer shrink-0"
                    title="Lepas kupon promo"
                    aria-label="Lepas kupon promo"
                  >
                    <GoogleIcon name="close" size={14} />
                  </button>
                )}
              </div>
            ) : (
              <>
                <form onSubmit={e => void handleSubmitCoupon(e)} className="flex items-center gap-1.5">
                  <div className="relative flex-1 min-w-0">
                    <GoogleIcon
                      name="confirmation_number"
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={e => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Kode kupon promo..."
                      className="w-full h-8 pl-8 pr-2.5 text-xs font-mono font-semibold uppercase text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-primary focus:bg-white transition-colors"
                    />
                  </div>
                  {activePromos.length > 0 && (
                    <Tooltip content="Pilih kupon aktif" side="top">
                      <button
                        type="button"
                        onClick={() => setShowPromoPicker(prev => !prev)}
                        className={`h-8 px-2 rounded-lg border text-xs font-mono font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                          showPromoPicker
                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                            : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700'
                        }`}
                      >
                        <GoogleIcon name="sell" size={13} />
                        <span>{activePromos.length}</span>
                      </button>
                    </Tooltip>
                  )}
                  <button
                    type="submit"
                    disabled={!couponInput.trim() || isValidatingPromo}
                    className="h-8 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
                  >
                    {isValidatingPromo ? '...' : 'Pakai'}
                  </button>
                </form>

                {showPromoPicker && activePromos.length > 0 && (
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/70 divide-y divide-zinc-200/70">
                    {activePromos.map(promo => {
                      const summary = getPromoStatusSummary(promo);
                      return (
                        <button
                          key={promo.id}
                          type="button"
                          onClick={() => void handleSelectQuickPromo(promo)}
                          className="w-full px-2.5 py-2 text-left hover:bg-white transition-colors cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-zinc-900">
                                {promo.code}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono font-bold text-[10px]">
                                -{promo.discountPercent}%
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 truncate">
                              {summary.detailText}
                              {promo.minPurchase && promo.minPurchase > 0
                                ? ` • Min. ${formatIDR(promo.minPurchase)}`
                                : ''}
                            </p>
                          </div>
                          <span className="text-[11px] font-semibold text-primary shrink-0">
                            Pakai
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {promoCouponError && (
                  <p className="text-[11px] font-medium text-rose-600 flex items-start gap-1 leading-snug">
                    <GoogleIcon name="error" size={13} className="shrink-0 mt-0.5" />
                    <span>{promoCouponError}</span>
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="space-y-1 sm:space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
            <span className="text-gray-600 font-medium shrink-0">
              {hasDiscount ? 'Subtotal Produk' : 'Subtotal'}
            </span>
            <div className="flex-1 min-w-0 text-right">
              <MoneyAmount
                value={hasDiscount ? displayGrossSubtotal : subtotal}
                maxFontPx={14}
                minFontPx={11}
                className="text-gray-900 font-semibold font-mono tabular-nums"
              />
            </div>
          </div>
          {hasDiscount && (
            <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
              <span className="text-emerald-700 font-medium shrink-0 truncate">
                Diskon ({appliedPromo?.promo.code || 'Kupon'})
              </span>
              <div className="flex-1 min-w-0 text-right font-mono font-semibold text-emerald-700 tabular-nums">
                -{formatIDR(discountAmount)}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
            <span className="text-gray-600 font-medium shrink-0">{taxLabel}</span>
            <div className="flex-1 min-w-0 text-right">
              <MoneyAmount
                value={tax}
                maxFontPx={14}
                minFontPx={11}
                className="text-gray-900 font-semibold font-mono tabular-nums"
              />
            </div>
          </div>
          <div className="pt-1.5 sm:pt-2 border-t border-zinc-200 flex justify-between items-center gap-3">
            <span className="text-zinc-950 font-bold text-sm sm:text-base shrink-0">Total Tagihan</span>
            <div className="flex-1 min-w-0 text-right">
              <MoneyAmount
                value={grandTotal}
                maxFontPx={20}
                minFontPx={13}
                className="font-bold font-mono text-primary tabular-nums"
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenPaymentModal}
          disabled={cart.length === 0}
          className="w-full h-11 bg-primary hover:bg-primary-hover disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-semibold rounded-full transition-all inline-flex justify-center items-center cursor-pointer disabled:cursor-not-allowed text-sm active:scale-[0.99] shadow-xs"
        >
          <GoogleIcon name="credit_card" size={17} className="mr-2 shrink-0" />
          <span>Proses Pembayaran ({totalQty} Item)</span>
        </button>
      </div>
    </div>
  );
};
