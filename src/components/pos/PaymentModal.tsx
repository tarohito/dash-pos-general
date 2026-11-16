import React, { useState, useEffect } from 'react';
import { GoogleIcon, GoogleIconName } from '../common/GoogleIcon';
import { CartItem } from '../../types';
import { formatIDR, formatNumber } from '../../utils/formatters';
import { BANK_ACCOUNTS, BankKey } from '../../constants/bankAccounts';
import { useToast } from '../../contexts/ToastContext';
import {
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_SECONDARY_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
} from '../common/ModalShell';
import { MoneyAmount } from '../common/MoneyAmount';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  subtotal: number;
  grossSubtotal?: number;
  discountAmount?: number;
  promoCode?: string;
  tax: number;
  taxLabel?: string;
  grandTotal: number;
  customerName: string;
  onCustomerChange: (customer: { id?: string; name: string }) => void;
  onConfirmPayment: (paymentData: {
    method: 'cash' | 'transfer';
    cashReceived?: number;
    transferBank?: string;
    transferRef?: string;
  }) => Promise<void> | void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  cart,
  subtotal,
  grossSubtotal,
  discountAmount = 0,
  promoCode,
  tax,
  taxLabel = 'PPN (11%)',
  grandTotal,
  customerName,
  onCustomerChange,
  onConfirmPayment,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [cashReceived, setCashReceived] = useState<number | string>(grandTotal);
  const [transferBank, setTransferBank] = useState<BankKey>('BCA');
  const [transferRef, setTransferRef] = useState('');
  const [copiedBank, setCopiedBank] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('cash');
      setCashReceived(grandTotal);
      setTransferRef('');
      setCopiedBank(false);
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, grandTotal]);

  const copyAccountNo = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedBank(true);
      showToast('success', 'Nomor rekening berhasil disalin.');
      setTimeout(() => setCopiedBank(false), 2000);
    } catch {
      showToast('error', 'Gagal menyalin nomor rekening.');
    }
  };

  const failValidation = (msg: string) => {
    setErrorMsg(msg);
    showToast('error', msg, 'Validasi Pembayaran');
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setErrorMsg(null);

    if (cart.length === 0) {
      failValidation('Keranjang belanja masih kosong.');
      return;
    }

    const numericCash =
      typeof cashReceived === 'string'
        ? parseFloat(cashReceived.replace(/[^0-9]/g, '')) || 0
        : cashReceived;

    if (paymentMethod === 'cash') {
      if (cashReceived === '' || numericCash <= 0) {
        failValidation('Masukkan nominal uang tunai yang diterima.');
        return;
      }
      if (numericCash < grandTotal) {
        failValidation(
          `Nominal tunai kurang dari total tagihan (${formatIDR(grandTotal)}).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onConfirmPayment({
        method: paymentMethod,
        cashReceived: paymentMethod === 'cash' ? numericCash : undefined,
        transferBank: paymentMethod === 'transfer' ? transferBank : undefined,
        transferRef:
          paymentMethod === 'transfer' ? transferRef.trim() || undefined : undefined,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memproses pembayaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalItemsQty = cart.reduce((a, b) => a + b.qty, 0);
  const totalNetto = cart.reduce((a, b) => a + b.berat * b.qty, 0);
  const numericCash =
    typeof cashReceived === 'string'
      ? parseFloat(cashReceived.replace(/[^0-9]/g, '')) || 0
      : cashReceived;
  const cashChange = numericCash - grandTotal;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Pembayaran"
      disableEscapeClose={isSubmitting}
      footer={
        <div className={MODAL_FOOTER_END_CLASS}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={MODAL_BTN_SECONDARY_CLASS}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className={MODAL_BTN_PRIMARY_CLASS}
          >
            <GoogleIcon
              name={isSubmitting ? 'progress_activity' : 'check_circle'}
              size={16}
              className={isSubmitting ? 'animate-spin' : ''}
            />
            <span>
              {isSubmitting
                ? 'Menyimpan...'
                : `Selesaikan (${formatIDR(grandTotal)})`}
            </span>
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
            <GoogleIcon name="error" size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Total Tagihan Ringkas */}
        <div className="bg-primary p-4 rounded-2xl text-white flex items-center justify-between gap-4 shadow-xs">
          <div className="min-w-0 flex-1">
            <span className="text-xs text-white/80 font-semibold uppercase tracking-wider block">
              Total Tagihan
            </span>
            <div className="mt-0.5">
              <MoneyAmount
                value={grandTotal}
                maxFontPx={26}
                minFontPx={15}
                className="font-bold text-white tracking-tight font-mono tabular-nums"
              />
            </div>
            <p className="text-xs text-white/80 mt-0.5 font-mono">
              {totalItemsQty} pcs &bull; {totalNetto.toFixed(0)} gr
            </p>
          </div>

          <div className="text-right text-xs text-white/85 shrink-0 space-y-0.5 font-medium">
            <div>
              Subtotal:{' '}
              <span className="font-mono font-semibold text-white">
                {formatIDR(discountAmount > 0 ? grossSubtotal ?? subtotal + discountAmount : subtotal)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="text-emerald-200">
                Diskon ({promoCode || 'Kupon'}):{' '}
                <span className="font-mono font-semibold text-emerald-100">
                  -{formatIDR(discountAmount)}
                </span>
              </div>
            )}
            <div>
              {taxLabel}:{' '}
              <span className="font-mono font-semibold text-white">{formatIDR(tax)}</span>
            </div>
          </div>
        </div>

        {/* Nama Pembeli (Opsional) */}
        <div>
          <label
            htmlFor="buyer-name-input"
            className="block text-xs font-semibold text-zinc-700 mb-1.5"
          >
            Nama Pembeli <span className="text-zinc-400 font-normal">(Opsional)</span>
          </label>
          <div className="relative">
            <GoogleIcon
              name="person"
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
            />
            <input
              id="buyer-name-input"
              type="text"
              value={customerName === 'Pelanggan Umum' ? '' : customerName}
              onChange={e =>
                onCustomerChange({ id: undefined, name: e.target.value || 'Pelanggan Umum' })
              }
              placeholder="Pelanggan Umum"
              className="w-full h-10 pl-10 pr-3.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white font-medium transition-colors"
            />
          </div>
        </div>

        {/* Metode Pembayaran: Tunai & Transfer */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            Metode Pembayaran
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                {
                  id: 'cash',
                  title: 'Tunai (Cash)',
                  subtitle: 'Terima uang tunai di kasir',
                  icon: 'payments' as GoogleIconName,
                },
                {
                  id: 'transfer',
                  title: 'Transfer Bank',
                  subtitle: 'Cek mutasi masuk manual',
                  icon: 'account_balance' as GoogleIconName,
                },
              ] as const
            ).map(tab => {
              const isSelected = paymentMethod === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(tab.id);
                    setErrorMsg(null);
                    if (tab.id === 'cash') {
                      setCashReceived(grandTotal);
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'border-primary bg-primary-soft/60 ring-1 ring-primary'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/60'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'bg-primary text-white' : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    <GoogleIcon name={tab.icon} size={18} filled={isSelected} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-sm leading-tight truncate ${
                        isSelected ? 'font-bold text-primary-text' : 'font-semibold text-zinc-800'
                      }`}
                    >
                      {tab.title}
                    </div>
                    <div className="text-xs text-zinc-500 leading-tight mt-0.5 truncate">
                      {tab.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PANEL 1: TUNAI */}
        {paymentMethod === 'cash' && (
          <div className="p-3.5 bg-zinc-50/80 rounded-xl border border-zinc-200 space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                Uang Tunai Diterima
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-zinc-400 text-sm">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cashReceived !== '' ? formatNumber(cashReceived) : ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setCashReceived(raw ? parseInt(raw, 10) : '');
                  }}
                  placeholder={formatNumber(grandTotal)}
                  className="w-full h-11 pl-10 pr-3.5 text-lg font-bold text-zinc-950 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono tracking-tight tabular-nums"
                />
              </div>
            </div>

            {/* Pilihan Nominal Cepat */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCashReceived(grandTotal)}
                className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                  numericCash === grandTotal
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-800'
                }`}
              >
                Uang Pas
              </button>
              {[
                Math.ceil(grandTotal / 50000) * 50000,
                Math.ceil(grandTotal / 100000) * 100000,
                Math.ceil(grandTotal / 500000) * 500000,
                grandTotal + 100000,
              ]
                .filter((v, idx, arr) => v > grandTotal && arr.indexOf(v) === idx)
                .slice(0, 3)
                .map((val, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCashReceived(val)}
                    className={`h-8 px-3 rounded-full text-xs font-semibold font-mono border transition-colors cursor-pointer ${
                      numericCash === val
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-700'
                    }`}
                  >
                    {formatIDR(val)}
                  </button>
                ))}
            </div>

            {/* Kembalian / Kekurangan */}
            <div
              className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                cashChange >= 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}
            >
              <span className="text-sm font-semibold text-zinc-700 shrink-0">
                {cashChange >= 0 ? 'Kembalian' : 'Kurang Bayar'}
              </span>
              <MoneyAmount
                value={Math.abs(cashChange)}
                maxFontPx={18}
                minFontPx={13}
                className={`font-bold font-mono tabular-nums ${
                  cashChange >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              />
            </div>
          </div>
        )}

        {/* PANEL 2: TRANSFER BANK (CEK MANUAL) */}
        {paymentMethod === 'transfer' && (
          <div className="p-3.5 bg-zinc-50/80 rounded-xl border border-zinc-200 space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                Bank Tujuan Transfer
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['BCA', 'Mandiri', 'BRI', 'BNI'] as const).map(bank => {
                  const active = transferBank === bank;
                  return (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => setTransferBank(bank)}
                      className={`h-9 px-2 text-sm font-semibold rounded-xl border transition-all cursor-pointer text-center ${
                        active
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {bank}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white px-3.5 py-3 rounded-xl border border-zinc-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs text-zinc-500 block font-medium">
                  Rekening {transferBank} &bull; {BANK_ACCOUNTS[transferBank].holder}
                </span>
                <p className="text-base font-bold text-zinc-950 font-mono tracking-wide mt-0.5 tabular-nums">
                  {BANK_ACCOUNTS[transferBank].accountNo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyAccountNo(BANK_ACCOUNTS[transferBank].accountNo)}
                className="h-8 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
              >
                <GoogleIcon
                  name={copiedBank ? 'check' : 'content_copy'}
                  size={13}
                  className={copiedBank ? 'text-emerald-600' : ''}
                />
                <span>{copiedBank ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                Catatan / Nama Pengirim <span className="text-zinc-400 font-normal">(Opsional)</span>
              </label>
              <input
                type="text"
                value={transferRef}
                onChange={e => setTransferRef(e.target.value)}
                placeholder="Cth: Transfer a.n. Budi / No. Ref"
                className="w-full h-10 px-3.5 text-sm bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-medium transition-colors"
              />
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
