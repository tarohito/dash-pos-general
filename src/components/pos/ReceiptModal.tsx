import React from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Transaction, Tenant, StoreSettings, ReceiptPaperSize } from '../../types';
import { RetailReceiptDocument } from '../common/RetailReceiptDocument';
import {
  ModalShell,
  MODAL_BTN_SECONDARY_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
  BTN_SECONDARY_CLASS,
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
      title="Nota Penjualan"
      headerActions={
        <div className="inline-flex h-8 p-0.5 bg-zinc-100/90 rounded-full border border-zinc-200 items-center">
          {(['a5', 'a6', '80mm'] as const).map(size => (
            <button
              key={size}
              type="button"
              onClick={() => onPaperSizeChange(size)}
              className={`h-full px-3 text-xs font-bold uppercase rounded-full transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center ${
                paperSize === size
                  ? 'bg-primary text-white shadow-xs'
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
            className={BTN_SECONDARY_CLASS}
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
