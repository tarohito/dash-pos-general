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
} from '../common/ModalShell';
import { MoneyAmount } from '../common/MoneyAmount';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  subtotal: number;
  tax: number;
  taxLabel?: string;
  grandTotal: number;
  customerName: string;
  onCustomerChange: (customer: { id?: string; name: string }) => void;
  onConfirmPayment: (paymentData: {
    method: 'cash' | 'debit' | 'transfer' | 'qris';
    cashReceived?: number;
    debitBank?: string;
    debitCardLast4?: string;
    debitApprovalCode?: string;
    transferBank?: string;
    transferRef?: string;
  }) => Promise<void> | void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  cart,
  subtotal,
  tax,
  taxLabel = 'PPN (11%)',
  grandTotal,
  customerName,
  onCustomerChange,
  onConfirmPayment,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' |'debit' |'transfer' |'qris'>('cash');
  const [cashReceived, setCashReceived] = useState<number | string>(grandTotal);
  const [debitBank, setDebitBank] = useState<BankKey>('BCA');
  const [debitCardLast4, setDebitCardLast4] = useState('');
  const [debitApprovalCode, setDebitApprovalCode] = useState(() => `AUTH-${Math.floor(100000 + Math.random() * 900000)}`);
  const [transferBank, setTransferBank] = useState<BankKey>('BCA');
  const [transferRef, setTransferRef] = useState('');
  const [isQrisConfirmed, setIsQrisConfirmed] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setCashReceived(grandTotal);
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, grandTotal]);

  const copyToClipboard = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopyFeedback(label);
      showToast('success', 'Nomor rekening berhasil disalin.');
      setTimeout(() => setCopyFeedback(null), 2500);
    } catch {
      showToast('error', 'Gagal menyalin nomor rekening ke clipboard.');
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
        failValidation('Masukkan nominal uang tunai yang diterima dari pelanggan.');
        return;
      }
      if (numericCash < grandTotal) {
        failValidation(
          `Nominal pembayaran tunai kurang dari total tagihan (${formatIDR(grandTotal)}).`
        );
        return;
      }
    }

    if (paymentMethod === 'debit') {
      const cleanLast4 = debitCardLast4.trim();
      if (cleanLast4 && cleanLast4.length !== 4) {
        failValidation('4 digit terakhir kartu debit harus tepat 4 angka.');
        return;
      }
      if (!debitApprovalCode.trim()) {
        failValidation('Nomor Approval EDC (struk fisik) wajib diisi.');
        return;
      }
    }

    if (paymentMethod === 'transfer' && transferRef.trim().length > 0 && transferRef.trim().length < 3) {
      failValidation('Nomor referensi transfer minimal 3 karakter.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmPayment({
        method: paymentMethod,
        cashReceived: paymentMethod === 'cash' ? numericCash : undefined,
        debitBank: paymentMethod === 'debit' ? debitBank : undefined,
        debitCardLast4: paymentMethod === 'debit' ? debitCardLast4.trim() || '4921' : undefined,
        debitApprovalCode:
          paymentMethod === 'debit' ? debitApprovalCode.trim() || 'AUTH-829104' : undefined,
        transferBank: paymentMethod === 'transfer' ? transferBank : undefined,
        transferRef:
          paymentMethod === 'transfer'
            ? transferRef.trim() || `TRF-${Math.floor(100000 + Math.random() * 900000)}`
            : undefined,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memproses pembayaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Pembayaran Transaksi"
      subtitle="Pilih metode bayar dan selesaikan transaksi"
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
            className="h-9 px-4 bg-primary hover:bg-primary-hover text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors inline-flex items-center justify-center whitespace-nowrap cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Memproses Pembayaran...' : `Konfirmasi Bayar (${formatIDR(grandTotal)})`}
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
          {/* Total Tagihan Banner */}
          <div className="bg-primary p-4 sm:p-5 rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shadow-xs">
            <div className="min-w-0 flex-1">
              <span className="text-xs text-white/80 font-semibold uppercase tracking-wider block">
                Total Pembayaran
              </span>
              <div className="mt-1">
                <MoneyAmount
                  value={grandTotal}
                  maxFontPx={28}
                  minFontPx={15}
                  className="font-bold text-white tracking-tight font-mono tabular-nums"
                />
              </div>
              <div className="text-xs text-white/85 mt-1 font-medium font-mono">
                {cart.reduce((a, b) => a + b.qty, 0)} Item &bull; Total Netto: {cart.reduce((a, b) => a + b.berat * b.qty, 0).toFixed(0)} g
              </div>
            </div>
            <div className="text-left sm:text-right text-white/90 text-xs sm:text-sm shrink-0 font-medium space-y-1 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-white/20">
              <div>Subtotal: <span className="font-mono text-white font-semibold">{formatIDR(subtotal)}</span></div>
              <div className="text-xs text-white/80">{taxLabel}: <span className="font-mono text-white">{formatIDR(tax)}</span></div>
            </div>
          </div>

          {/* Simple Buyer Name (Optional) */}
          <div className="space-y-1.5 p-3.5 rounded-xl bg-zinc-50/70 border border-zinc-200/70">
            <label htmlFor="buyer-name-input" className="block text-xs sm:text-sm font-semibold text-zinc-800">
              Nama Pembeli (Opsional)
            </label>
            <div className="relative">
              <GoogleIcon name="person" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                id="buyer-name-input"
                type="text"
                value={customerName === 'Pelanggan Umum' ? '' : customerName}
                onChange={e => onCustomerChange({ id: undefined, name: e.target.value || 'Pelanggan Umum' })}
                placeholder="Pelanggan Umum"
                className="w-full h-9 pl-9 pr-3.5 text-xs sm:text-sm bg-white border border-zinc-300 rounded-lg outline-none focus:border-primary font-medium"
              />
            </div>
          </div>

          {/* 4 Payment Methods Selector Tabs */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-zinc-700 mb-1.5">Metode Pembayaran</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                {
                  id: 'cash',
                  title: 'Tunai (Cash)',
                  subtitle: 'Uang Pas / Tunai',
                  icon: 'payments' as GoogleIconName,
                  activeCard: 'border-primary bg-primary-soft/60 ring-1 ring-primary',
                  iconColor: 'text-primary-text',
                  indicator: 'bg-primary',
                },
                {
                  id: 'debit',
                  title: 'Debit EDC',
                  subtitle: 'Kartu Chip / PIN',
                  icon: 'credit_card' as GoogleIconName,
                  activeCard: 'border-primary bg-primary-soft/60 ring-1 ring-primary',
                  iconColor: 'text-primary-text',
                  indicator: 'bg-primary',
                },
                {
                  id: 'transfer',
                  title: 'Transfer Bank',
                  subtitle: 'BCA / Mandiri / BRI',
                  icon: 'account_balance' as GoogleIconName,
                  activeCard: 'border-primary bg-primary-soft/60 ring-1 ring-primary',
                  iconColor: 'text-primary-text',
                  indicator: 'bg-primary',
                },
                {
                  id: 'qris',
                  title: 'QRIS Instant',
                  subtitle: 'GPN & E-Wallet',
                  icon: 'qr_code_2' as GoogleIconName,
                  activeCard: 'border-primary bg-primary-soft/60 ring-1 ring-primary',
                  iconColor: 'text-primary-text',
                  indicator: 'bg-primary',
                },
              ].map(tab => {
                const Icon = tab.icon;
                const isSelected = paymentMethod === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(tab.id as any);
                      if (tab.id === 'cash') {
                        setCashReceived(grandTotal);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between h-[80px] relative ${
                      isSelected
                        ? tab.activeCard
                        : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-primary text-white' : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        <GoogleIcon name={Icon} size={16} filled={isSelected} />
                      </div>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                          isSelected ? 'border-transparent ' + tab.indicator : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div>
                      <div
                        className={`text-xs sm:text-sm leading-tight ${
                          isSelected ? 'font-bold text-primary-text' : 'font-semibold text-gray-700'
                        }`}
                      >
                        {tab.title}
                      </div>
                      <div className="text-xs text-gray-400 font-medium leading-tight mt-0.5 truncate">
                        {tab.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB 1: CASH / TUNAI */}
          {paymentMethod === 'cash' && (
            <div className="p-4 bg-gray-50/50 rounded-md border border-gray-200 space-y-3">
              <div>
                <label className="text-xs sm:text-sm font-semibold text-gray-700 block mb-1.5">
                  Uang Tunai Diterima
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-base">Rp</span>
                  <input
                    type="text"
                    value={cashReceived !== '' ? formatNumber(cashReceived) : ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setCashReceived(raw ? parseInt(raw, 10) : '');
                    }}
                    placeholder={formatNumber(grandTotal)}
                    className="w-full pl-11 pr-4 py-2.5 text-xl sm:text-2xl font-bold text-zinc-950 bg-white border border-zinc-200 rounded-xl outline-none focus:border-zinc-900 font-mono tracking-tight"
                  />
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setCashReceived(grandTotal)}
                  className="px-3 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-800 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  Uang Pas
                </button>
                {[
                  Math.ceil(grandTotal / 50000) * 50000,
                  Math.ceil(grandTotal / 100000) * 100000,
                  Math.ceil(grandTotal / 500000) * 500000,
                  Math.ceil(grandTotal / 1000000) * 1000000,
                  grandTotal + 100000,
                ]
                  .filter((v, idx, arr) => v > grandTotal && arr.indexOf(v) === idx)
                  .slice(0, 3)
                  .map((val, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCashReceived(val)}
                      className="px-3 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg text-xs sm:text-sm font-semibold text-zinc-700 transition-colors cursor-pointer font-mono"
                    >
                      {formatIDR(val)}
                    </button>
                  ))}
              </div>

              {/* Change Calculation */}
              {(() => {
                const numCash = typeof cashReceived === 'string' ? parseFloat(cashReceived) || 0 : cashReceived;
                const change = numCash - grandTotal;
                return (
                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      change >= 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-rose-50 border-rose-200 text-rose-950'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-semibold text-zinc-600 shrink-0">
                      {change >= 0 ? 'Kembalian' : 'Kekurangan Bayar'}
                    </span>
                    <div className="flex-1 min-w-0 text-right">
                      <MoneyAmount
                        value={Math.abs(change)}
                        maxFontPx={20}
                        minFontPx={13}
                        className={`font-bold font-mono tabular-nums ${
                          change >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 2: DEBIT / EDC CARD */}
          {paymentMethod === 'debit' && (
            <div className="p-4 bg-zinc-50/70 rounded-xl border border-zinc-200 space-y-3">
              <div>
                <label className="text-xs sm:text-sm font-semibold text-zinc-700 block mb-1.5">Mesin Terminal EDC</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['BCA', 'Mandiri', 'BRI', 'BNI'] as const).map(bank => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => setDebitBank(bank)}
                      className={`py-2 px-2.5 text-xs sm:text-sm font-semibold rounded-lg border transition-all cursor-pointer text-center ${
                        debitBank === bank
                          ? 'bg-secondary text-white border-secondary'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      EDC {bank}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs sm:text-sm font-semibold text-zinc-700 block mb-1">4 Digit Terakhir Kartu</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={debitCardLast4}
                    onChange={e => setDebitCardLast4(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="8821"
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary tracking-wider"
                  />
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-semibold text-zinc-700 block mb-1">No. Approval EDC (Struk Fisik)</label>
                  <input
                    type="text"
                    value={debitApprovalCode}
                    onChange={e => setDebitApprovalCode(e.target.value)}
                    placeholder="AUTH-938210"
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="p-3 bg-secondary-soft/70 border border-secondary-border rounded-lg text-xs text-secondary-text leading-normal flex items-center gap-2">
                <GoogleIcon name="verified_user" size={18} className="text-secondary shrink-0" />
                <span>
                  <strong>Verifikasi Kasir:</strong> Gesek kartu di terminal EDC fisik toko, pastikan struk fisik EDC telah keluar, lalu masukkan nomor approval di atas.
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: TRANSFER BANK */}
          {paymentMethod === 'transfer' && (
            <div className="p-4 bg-zinc-50/70 rounded-xl border border-zinc-200 space-y-3">
              <div>
                <label className="text-xs sm:text-sm font-semibold text-zinc-700 block mb-1.5">Bank Tujuan Transfer Toko</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['BCA', 'Mandiri', 'BRI', 'BNI'] as const).map(bank => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => setTransferBank(bank)}
                      className={`py-2 px-2.5 text-xs sm:text-sm font-semibold rounded-lg border transition-all cursor-pointer text-center ${
                        transferBank === bank
                          ? 'bg-secondary text-white border-secondary'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {bank}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-zinc-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-400 block font-medium">Rekening Resmi Toko ({transferBank}):</span>
                  <p className="text-base font-bold text-zinc-950 font-mono tracking-wider mt-0.5">
                    {BANK_ACCOUNTS[transferBank].accountNo}
                  </p>
                  <p className="text-xs text-zinc-500">{BANK_ACCOUNTS[transferBank].holder}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(BANK_ACCOUNTS[transferBank].accountNo, 'rekening')}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 border border-zinc-200 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                >
                  {copyFeedback === 'rekening' ? (
                    <GoogleIcon name="check" size={13} className="text-emerald-600 shrink-0" />
                  ) : (
                    <GoogleIcon name="content_copy" size={13} className="shrink-0" />
                  )}
                  <span>{copyFeedback === 'rekening' ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>

              <div>
                <label className="text-xs sm:text-sm font-semibold text-zinc-700 block mb-1">
                  Catatan / No. Referensi Transfer Pelanggan
                </label>
                <input
                  type="text"
                  value={transferRef}
                  onChange={e => setTransferRef(e.target.value)}
                  placeholder="Cth: Ref TRF-839210 / Atas Nama Pengirim"
                  className="w-full px-3 py-2 text-sm font-mono font-medium bg-white border border-zinc-200 rounded-lg outline-none focus:border-zinc-900"
                />
              </div>

              <div className="p-3 bg-zinc-100/80 border border-zinc-200 rounded-lg text-xs text-zinc-700 leading-normal flex items-center gap-2">
                <GoogleIcon name="verified_user" size={18} className="text-zinc-700 shrink-0" />
                <span>
                  <strong>Verifikasi Kasir:</strong> Cek mutasi rekening toko/m-Banking terlebih dahulu untuk memastikan dana dari pelanggan sudah masuk.
                </span>
              </div>
            </div>
          )}

          {/* TAB 4: QRIS */}
          {paymentMethod === 'qris' && (
            <div className="p-4 bg-zinc-50/70 rounded-xl border border-zinc-200 flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl border border-zinc-200 max-w-xs w-full flex flex-col items-center text-center shadow-xs">
                <div className="w-full flex items-center justify-between pb-2 border-b border-zinc-100 mb-2">
                  <span className="font-bold text-zinc-950 tracking-tight text-xs sm:text-sm">QRIS GPN</span>
                  <span className="text-xs bg-zinc-100 text-zinc-700 font-mono px-2 py-0.5 rounded">
                    NMID: ID102003928192
                  </span>
                </div>

                <p className="text-xs sm:text-sm font-bold text-zinc-900">LogicPOS</p>
                <p className="text-xs text-zinc-400">Pembayaran Digital Resmi</p>

                {/* Simulated QR Code SVG */}
                <div className="my-2.5 p-2 bg-white border border-zinc-900 rounded-lg relative">
                  <svg className="w-36 h-36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="5" y="5" width="28" height="28" rx="4" fill="#18181b" />
                    <rect x="9" y="9" width="20" height="20" rx="2" fill="white" />
                    <rect x="13" y="13" width="12" height="12" rx="1" fill="#18181b" />
                    <rect x="67" y="5" width="28" height="28" rx="4" fill="#18181b" />
                    <rect x="71" y="9" width="20" height="20" rx="2" fill="white" />
                    <rect x="75" y="13" width="12" height="12" rx="1" fill="#18181b" />
                    <rect x="5" y="67" width="28" height="28" rx="4" fill="#18181b" />
                    <rect x="9" y="71" width="20" height="20" rx="2" fill="white" />
                    <rect x="13" y="75" width="12" height="12" rx="1" fill="#18181b" />
                    <rect x="38" y="8" width="8" height="8" fill="#18181b" />
                    <rect x="50" y="8" width="6" height="6" fill="#18181b" />
                    <rect x="38" y="20" width="6" height="6" fill="#18181b" />
                    <rect x="48" y="20" width="12" height="6" fill="#18181b" />
                    <rect x="8" y="38" width="6" height="12" fill="#18181b" />
                    <rect x="18" y="38" width="8" height="6" fill="#18181b" />
                    <rect x="28" y="38" width="6" height="6" fill="#18181b" />
                    <rect x="38" y="38" width="24" height="24" rx="4" fill="#18181b" />
                    <rect x="66" y="38" width="8" height="8" fill="#18181b" />
                    <rect x="78" y="38" width="14" height="6" fill="#18181b" />
                    <rect x="66" y="50" width="12" height="12" fill="#18181b" />
                    <rect x="82" y="50" width="10" height="8" fill="#18181b" />
                    <rect x="38" y="66" width="10" height="10" fill="#18181b" />
                    <rect x="52" y="66" width="8" height="6" fill="#18181b" />
                    <rect x="66" y="66" width="26" height="8" fill="#18181b" />
                    <rect x="38" y="80" width="6" height="12" fill="#18181b" />
                    <rect x="48" y="82" width="14" height="10" fill="#18181b" />
                    <rect x="66" y="78" width="10" height="14" fill="#18181b" />
                    <rect x="80" y="78" width="12" height="14" fill="#18181b" />
                  </svg>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-white flex items-center justify-center border border-zinc-200">
                    <GoogleIcon name="storefront" size={14} className="text-zinc-900" />
                  </div>
                </div>

                <div className="w-full bg-gray-50 p-2.5 rounded-md border border-gray-100 mb-2.5 text-center">
                  <span className="text-xs text-gray-500 font-medium block">Nominal Pas:</span>
                  <p className="text-base font-bold text-gray-900 font-mono">{formatIDR(grandTotal)}</p>
                </div>

                <div className="p-2.5 bg-zinc-100/80 border border-zinc-200 rounded-lg text-xs text-zinc-700 leading-normal text-left flex items-center gap-1.5 w-full">
                  <GoogleIcon name="verified_user" size={16} className="text-zinc-700 shrink-0" />
                  <span>Minta pelanggan scan QRIS & periksa notifikasi masuk di aplikasi merchant.</span>
                </div>
              </div>
            </div>
          )}
      </div>
    </ModalShell>
  );
};
