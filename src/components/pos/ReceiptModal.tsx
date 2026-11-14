import React from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Transaction, Tenant, StoreSettings, ReceiptPaperSize } from '../../types';
import { RetailReceiptDocument } from '../common/RetailReceiptDocument';
import {
  ModalShell,
  MODAL_BTN_SECONDARY_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
} from '../common/ModalShell';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: Transaction | null;
  activeTenant?: Tenant;
  storeSettings?: StoreSettings;
  paperSize: ReceiptPaperSize;
  onPaperSizeChange: (size: ReceiptPaperSize) => void;
  onPrint: () => void;
  onViewDailyTransactions: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
  activeTenant,
  storeSettings,
  paperSize,
  onPaperSizeChange,
  onPrint,
  onViewDailyTransactions,
}) => {
  if (!isOpen || !receipt) return null;

  return (
    <ModalShell
      isOpen={isOpen && Boolean(receipt)}
      onClose={onClose}
      size="2xl"
      title="Struk & Nota Penjualan"
      subtitle={`${receipt.invoiceNo} • ${receipt.customerName || 'Pelanggan Umum'}`}
      headerActions={
        <div className="inline-flex p-0.5 bg-zinc-200/80 rounded-xl border border-zinc-300/70">
          {(['a5', 'a6', '80mm'] as const).map(size => (
            <button
              key={size}
              type="button"
              onClick={() => onPaperSizeChange(size)}
              className={`px-2.5 py-1 text-xs font-bold uppercase rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                paperSize === size
                  ? 'bg-white text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {size === '80mm' ? '80mm' : `Kertas ${size.toUpperCase()}`}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-3 sm:p-5 overflow-y-auto bg-zinc-100/90 flex-1"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onViewDailyTransactions();
            }}
            className={MODAL_BTN_SECONDARY_CLASS}
          >
            Lihat Transaksi Harian
          </button>
          <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={MODAL_BTN_SECONDARY_CLASS}
            >
              Transaksi Baru
            </button>
            <button
              type="button"
              onClick={onPrint}
              className={`${MODAL_BTN_PRIMARY_CLASS} gap-1.5`}
            >
              <GoogleIcon name="print" size={15} className="shrink-0" />
              <span>Cetak Nota ({paperSize.toUpperCase()})</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="w-full mx-auto flex justify-center">
        <RetailReceiptDocument
          receipt={receipt}
          activeTenant={activeTenant}
          storeSettings={storeSettings}
          paperSize={paperSize}
        />
      </div>
    </ModalShell>
  );
};
