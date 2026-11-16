import React from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Transaction } from '../../types';
import { formatIDR } from '../../utils/formatters';
import {
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
} from '../common/ModalShell';
import { MoneyAmount } from '../common/MoneyAmount';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onPrintReceipt: (tx: Transaction) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onPrintReceipt,
}) => {
  if (!isOpen || !transaction) return null;

  const isVoid = transaction.status === 'void';
  const discountAmount = transaction.discountAmount || 0;
  const grossSubtotal = transaction.subtotal + discountAmount;
  const methodLabel =
    transaction.paymentMethod === 'cash'
      ? 'Tunai'
      : `Transfer Bank${transaction.paymentDetails.transferBank ? ` (${transaction.paymentDetails.transferBank})` : ''}`;

  return (
    <ModalShell
      isOpen={isOpen && Boolean(transaction)}
      onClose={onClose}
      size="2xl"
      title="Detail Transaksi"
      footer={
        <div className={MODAL_FOOTER_END_CLASS}>
          <button
            type="button"
            onClick={() => {
              onClose();
              onPrintReceipt(transaction);
            }}
            className={`${MODAL_BTN_PRIMARY_CLASS} gap-1.5`}
          >
            <GoogleIcon name="print" size={15} className="shrink-0" />
            <span>Cetak Nota Penjualan</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4">
          {isVoid && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              <strong className="font-bold block">Nota Penjualan Ini Telah Di-VOID (Dibatalkan)</strong>
              {transaction.voidReason && <span className="block mt-0.5">Alasan: {transaction.voidReason}</span>}
            </div>
          )}

          {/* Highlight Banner */}
          <div className="bg-primary p-4 rounded-2xl text-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-mono text-xs font-bold text-white bg-white/15 px-2 py-0.5 rounded-md">
                  {transaction.invoiceNo}
                </span>
                <span className="text-xs text-white/80 tabular-nums">
                  {transaction.dateStr} &bull; {transaction.timeStr}
                </span>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-white/80 block">
                {transaction.tax > 0
                  ? 'Total Nilai Transaksi (Termasuk PPN)'
                  : 'Total Nilai Transaksi (Non-PKP / Bebas PPN)'}
              </span>
              <div className="mt-0.5">
                <MoneyAmount
                  value={transaction.grandTotal}
                  maxFontPx={28}
                  minFontPx={15}
                  className="font-bold font-mono tracking-tight text-white tabular-nums"
                />
              </div>
              <p className="text-xs text-white/85 mt-1">
                Metode: <strong className="text-white">{methodLabel}</strong>
              </p>
            </div>
            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t border-white/15 sm:border-t-0">
              <span className="text-xs text-white/80">Total Qty</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-white">
                {transaction.totalQty} pcs
              </span>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Card 1: Pelanggan & Kasir */}
            <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-3.5">
              <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider pb-2 border-b border-gray-200/60 mb-2.5">
                Pelanggan &amp; Kasir
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 shrink-0">Nama Pelanggan</span>
                  <span className="font-semibold text-gray-900 text-right break-words min-w-0">
                    {transaction.customerName}
                  </span>
                </div>
                {transaction.customerMemberCode && (
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500 shrink-0">No. Pelanggan</span>
                    <span className="font-mono font-semibold text-gray-800 text-right break-all min-w-0">
                      {transaction.customerMemberCode}
                    </span>
                  </div>
                )}
                {transaction.customerPhone && (
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500 shrink-0">Telp / HP</span>
                    <span className="font-mono text-gray-800 text-right break-all min-w-0">
                      {transaction.customerPhone}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 shrink-0">Kasir Bertugas</span>
                  <span className="font-medium text-gray-800 text-right break-words min-w-0">
                    {transaction.cashier}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <span className="text-gray-500 shrink-0">Status Transaksi</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-xs shrink-0 ${
                      isVoid
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {isVoid ? 'VOID / Dibatalkan' : 'Lunas & Selesai'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Detail Pembayaran */}
            <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-3.5">
              <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider pb-2 border-b border-gray-200/60 mb-2.5">
                Rincian Pembayaran
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 shrink-0">Metode Bayar</span>
                  <span className="font-semibold text-gray-900 text-right break-words min-w-0">
                    {methodLabel}
                  </span>
                </div>

                {transaction.paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500 shrink-0">Tunai Diterima</span>
                      <span className="font-mono font-semibold text-gray-900 text-right tabular-nums">
                        {formatIDR(transaction.paymentDetails.cashReceived ?? transaction.grandTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500 shrink-0">Uang Kembalian</span>
                      <span className="font-mono font-semibold text-emerald-700 text-right tabular-nums">
                        {formatIDR(transaction.paymentDetails.cashChange ?? 0)}
                      </span>
                    </div>
                  </>
                )}

                {transaction.paymentMethod !== 'cash' && (
                  <>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500 shrink-0">Bank Tujuan</span>
                      <span className="font-semibold text-gray-900 text-right break-words min-w-0">
                        {transaction.paymentDetails.transferBank || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500 shrink-0">No. Referensi</span>
                      <span className="font-mono font-medium text-gray-800 text-right break-all min-w-0">
                        {transaction.paymentDetails.transferRef || '-'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Daftar Produk & Kalkulasi Harga */}
          <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-3.5">
            <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider pb-2 border-b border-gray-200/60 mb-2.5">
              Rincian Produk &amp; Kalkulasi Harga
            </div>

            <div className="bg-white rounded-lg border border-gray-200/70 mb-3 overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead className="bg-zinc-50/80 text-[11px] text-zinc-500 uppercase font-semibold tracking-wider border-b border-gray-200/80">
                  <tr>
                    <th className="py-2 px-3">Nama Produk</th>
                    <th className="py-2 px-3 text-center whitespace-nowrap">Qty</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Harga Jual</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transaction.items.map((item, idx) => (
                    <tr key={`${item.id}-${idx}`} className="hover:bg-zinc-50/60">
                      <td className="py-2.5 px-3 align-middle">
                        <span className="font-semibold text-gray-900 block leading-snug">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {item.category && (
                            <span className="text-[11px] text-zinc-500 font-medium">
                              {item.category}
                            </span>
                          )}
                          {item.brand && item.brand !== 'No Brand' && (
                            <span className="px-1.5 py-0.2 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200/80 text-[10px] font-semibold">
                              {item.brand}
                            </span>
                          )}
                          {item.kondisi && (
                            <span
                              className={`px-1.5 py-0.2 rounded-md border text-[10px] font-bold uppercase ${
                                item.kondisi === 'Bekas'
                                  ? 'bg-zinc-100 text-zinc-700 border-zinc-300'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {item.kondisi}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap font-mono font-semibold text-zinc-800 tabular-nums text-xs">
                        {item.qty} pcs
                      </td>
                      <td className="py-2.5 px-3 align-middle text-right whitespace-nowrap font-mono text-zinc-700 tabular-nums text-xs">
                        {formatIDR(item.harga)}
                      </td>
                      <td className="py-2.5 px-3 align-middle text-right whitespace-nowrap font-mono font-bold text-gray-900 tabular-nums">
                        {formatIDR(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Subtotal ({transaction.totalQty} pcs)
                </span>
                <span className="font-mono font-semibold text-gray-900 tabular-nums">
                  {formatIDR(discountAmount > 0 ? grossSubtotal : transaction.subtotal)}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span className="font-medium">
                    Diskon Kupon{transaction.promoCode ? ` (${transaction.promoCode})` : ''}
                  </span>
                  <span className="font-mono font-semibold tabular-nums">
                    -{formatIDR(discountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">{transaction.tax > 0 ? 'PPN / Pajak' : 'PPN (Non-PKP)'}</span>
                <span className="font-mono font-semibold text-gray-900 tabular-nums">
                  {formatIDR(transaction.tax)}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-sm">
                <span className="font-bold text-gray-900">Grand Total Pembayaran</span>
                <span className="font-mono font-bold text-zinc-950 text-base tabular-nums">
                  {formatIDR(transaction.grandTotal)}
                </span>
              </div>
            </div>
          </div>
      </div>
    </ModalShell>
  );
};
