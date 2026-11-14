import React from'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { CartItem } from'../../types';
import { formatIDR } from'../../utils/formatters';
import Tooltip from'../Tooltip';
import { MoneyAmount } from'../common/MoneyAmount';

interface CartPanelProps {
  cart: CartItem[];
  onUpdateQty: (id: number, delta: number) => void;
  onRemoveItem: (id: number) => void;
  onClearCart?: () => void;
  subtotal: number;
  tax: number;
  taxLabel?: string;
  grandTotal: number;
  onOpenPaymentModal: () => void;
  onBackToCatalog?: () => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  subtotal,
  tax,
  taxLabel = 'PPN (11%)',
  grandTotal,
  onOpenPaymentModal,
  onBackToCatalog,
}) => {
  const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);

  return (
    <div className="w-full lg:w-[340px] xl:w-[370px] bg-white rounded-2xl border border-zinc-200 flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Cart Header */}
      <div className="p-3 sm:p-4 border-b border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50">
        <div className="flex items-center gap-2">
          {onBackToCatalog && (
            <button
              type="button"
              onClick={onBackToCatalog}
              className="lg:hidden p-1.5 -ml-1 text-zinc-500 hover:text-zinc-950 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
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
                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-3">
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
                className="p-3 bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-xl flex gap-3 group relative transition-colors"
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
                      className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer"
                      aria-label="Hapus item"
                    >
                      <GoogleIcon name="delete" size={16} />
                    </button>
                  </Tooltip>
                  <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-md p-1 mt-1.5">
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
                        className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-white rounded transition-all cursor-pointer active:scale-95"
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
                        className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-white rounded transition-all cursor-pointer active:scale-95"
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

      {/* Cart Totals */}
      <div className="p-3 sm:p-4 bg-zinc-50 border-t border-zinc-200 shrink-0">
        <div className="space-y-1 sm:space-y-1.5 mb-2.5 sm:mb-3">
          <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
            <span className="text-gray-600 font-medium shrink-0">Subtotal</span>
            <div className="flex-1 min-w-0 text-right">
              <MoneyAmount
                value={subtotal}
                maxFontPx={14}
                minFontPx={11}
                className="text-gray-900 font-semibold font-mono tabular-nums"
              />
            </div>
          </div>
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
          className="w-full h-11 bg-primary hover:bg-primary-hover disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-semibold rounded-xl transition-all inline-flex justify-center items-center cursor-pointer disabled:cursor-not-allowed text-sm active:scale-[0.99] shadow-xs"
        >
          <GoogleIcon name="credit_card" size={17} className="mr-2 shrink-0" />
          <span>Proses Pembayaran ({totalQty} Item)</span>
        </button>
      </div>
    </div>
  );
};
