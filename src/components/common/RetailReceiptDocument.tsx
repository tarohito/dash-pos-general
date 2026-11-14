import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ReceiptLogoPreset,
  ReceiptPaperSize,
  ReceiptTheme,
  StoreSettings,
  Tenant,
  Transaction,
} from '../../types';
import { formatIDR } from '../../utils/formatters';
import { createQrCodeDataUrl, renderCode128ToSvg } from '../../utils/barcode';

export type { ReceiptPaperSize };

interface RetailReceiptDocumentProps {
  receipt: Transaction;
  id?: string;
  activeTenant?: Tenant;
  storeSettings?: StoreSettings;
  paperSize?: ReceiptPaperSize;
}

const DEFAULT_TERMS_LINES = [
  'Simpan struk ini sebagai bukti pembayaran yang sah.',
  'Penukaran produk dalam kemasan tersegel berlaku maksimal 3 hari.',
];

interface SimpleThemePalette {
  accentText: string;
  mutedText: string;
  monogramBg: string;
  monogramText: string;
  totalBg: string;
  totalBorder: string;
  totalText: string;
  dividerClass: string;
}

const RECEIPT_THEMES: Record<ReceiptTheme, SimpleThemePalette> = {
  midnight_navy: {
    accentText: 'text-slate-900',
    mutedText: 'text-slate-500',
    monogramBg: 'bg-slate-900',
    monogramText: 'text-white',
    totalBg: 'bg-slate-50',
    totalBorder: 'border-slate-200',
    totalText: 'text-slate-950',
    dividerClass: 'border-slate-200',
  },
  monochrome: {
    accentText: 'text-zinc-950',
    mutedText: 'text-zinc-500',
    monogramBg: 'bg-zinc-950',
    monogramText: 'text-white',
    totalBg: 'bg-zinc-100',
    totalBorder: 'border-zinc-300',
    totalText: 'text-zinc-950',
    dividerClass: 'border-zinc-300',
  },
  rose_gold: {
    accentText: 'text-rose-800',
    mutedText: 'text-rose-600',
    monogramBg: 'bg-rose-700',
    monogramText: 'text-white',
    totalBg: 'bg-rose-50/80',
    totalBorder: 'border-rose-200',
    totalText: 'text-rose-900',
    dividerClass: 'border-rose-200/80',
  },
  royal_emerald: {
    accentText: 'text-emerald-800',
    mutedText: 'text-emerald-700',
    monogramBg: 'bg-emerald-700',
    monogramText: 'text-white',
    totalBg: 'bg-emerald-50/80',
    totalBorder: 'border-emerald-200',
    totalText: 'text-emerald-950',
    dividerClass: 'border-emerald-200/80',
  },
  classic_gold: {
    accentText: 'text-amber-900',
    mutedText: 'text-amber-700',
    monogramBg: 'bg-amber-800',
    monogramText: 'text-white',
    totalBg: 'bg-amber-50/80',
    totalBorder: 'border-amber-200',
    totalText: 'text-amber-950',
    dividerClass: 'border-amber-200/80',
  },
};

function getWatermarkOpacityClass(percent: number): string {
  if (percent <= 3) return 'opacity-[0.03]';
  if (percent <= 5) return 'opacity-[0.05]';
  if (percent <= 7) return 'opacity-[0.06]';
  if (percent <= 10) return 'opacity-[0.09]';
  if (percent <= 14) return 'opacity-[0.12]';
  return 'opacity-[0.15]';
}

function getSalePaymentMethodLabel(tx: Transaction): string {
  switch (tx.paymentMethod) {
    case 'cash':
      return 'Tunai';
    case 'debit':
      return tx.paymentDetails.debitBank
        ? `Debit (${tx.paymentDetails.debitBank})`
        : 'Kartu Debit';
    case 'transfer':
      return tx.paymentDetails.transferBank
        ? `Transfer (${tx.paymentDetails.transferBank})`
        : 'Transfer Bank';
    case 'qris':
      return 'QRIS';
    default:
      return tx.paymentMethod;
  }
}

function getSalePaymentReferenceLine(tx: Transaction): string {
  const d = tx.paymentDetails || {};
  switch (tx.paymentMethod) {
    case 'cash': {
      const received = d.cashReceived ?? tx.grandTotal;
      const change = d.cashChange ?? Math.max(0, received - tx.grandTotal);
      return `Dibayar ${formatIDR(received)} · Kembali ${formatIDR(change)}`;
    }
    case 'debit': {
      const parts: string[] = [];
      if (d.debitCardLast4) parts.push(`•••• ${d.debitCardLast4}`);
      if (d.debitApprovalCode) parts.push(`Appr: ${d.debitApprovalCode}`);
      return parts.join(' · ') || 'Lunas';
    }
    case 'transfer': {
      const parts: string[] = [];
      if (d.transferAccountNo) parts.push(`Rek: ${d.transferAccountNo}`);
      if (d.transferRef) parts.push(`Ref: ${d.transferRef}`);
      return parts.join(' · ') || 'Lunas';
    }
    case 'qris': {
      const parts: string[] = [];
      if (d.qrisRrn) parts.push(`RRN: ${d.qrisRrn}`);
      if (d.qrisNmid) parts.push(`NMID: ${d.qrisNmid}`);
      return parts.join(' · ') || 'Lunas';
    }
    default:
      return '';
  }
}

const StoreBagGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 7h12l1 13H5L6 7z" />
    <path d="M9 7V5a3 3 0 0 1 6 0v2" />
  </svg>
);

const SparklesGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="7" y="8" width="10" height="12" rx="2.5" />
    <path d="M9.5 8V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V8" />
    <line x1="10" y1="13" x2="14" y2="13" />
  </svg>
);

export const RetailReceiptDocument: React.FC<RetailReceiptDocumentProps> = ({
  receipt,
  id,
  activeTenant,
  storeSettings,
  paperSize,
}) => {
  const effectivePaperSize: ReceiptPaperSize =
    paperSize || storeSettings?.receiptDefaultPaperSize || 'a5';
  const isA6 = effectivePaperSize === 'a6';
  const isThermal80 = effectivePaperSize === '80mm';

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [thumbBroken, setThumbBroken] = useState(false);
  const [customLogoBroken, setCustomLogoBroken] = useState(false);

  const themeKey: ReceiptTheme = storeSettings?.receiptTheme || 'midnight_navy';
  const palette = RECEIPT_THEMES[themeKey] || RECEIPT_THEMES.midnight_navy;
  const logoPreset: ReceiptLogoPreset = storeSettings?.receiptLogoPreset || 'monogram';
  const customLogoUrl = storeSettings?.receiptCustomLogoUrl || '';

  const showWatermark = storeSettings?.receiptShowWatermark ?? false;
  const watermarkOpacityClass = getWatermarkOpacityClass(storeSettings?.receiptWatermarkOpacity ?? 6);
  const showStoreAddress = storeSettings?.receiptShowStoreAddress ?? true;
  const showBarcode = storeSettings?.receiptShowBarcode ?? false;
  const showQrCode = storeSettings?.receiptShowQrCode ?? false;
  const showPhoto = storeSettings?.receiptShowPhoto ?? false;
  const showItemSku = storeSettings?.receiptShowItemSku ?? false;
  const showTaxLine = storeSettings?.receiptShowTaxLine ?? true;
  const showCashierName = storeSettings?.receiptShowCashierName ?? true;
  const showTerms = storeSettings?.receiptShowTerms ?? false;
  const showSignatures = storeSettings?.receiptShowSignatures ?? false;

  const invoiceNo = receipt.invoiceNo || '-';
  const customerName = receipt.customerName || 'Pelanggan Umum';
  const customerPhone = receipt.customerPhone && receipt.customerPhone !== '-' ? receipt.customerPhone : '';
  const cashierName = receipt.cashier || '';
  const dateStr = [receipt.dateStr, receipt.timeStr].filter(Boolean).join(' · ') || '-';

  const storeName = activeTenant?.name || 'Toko';
  const branchName = activeTenant?.branchName || '';
  const storeMonogram = useMemo(() => {
    if (activeTenant?.logoInitial) return activeTenant.logoInitial.slice(0, 2).toUpperCase();
    const parts = storeName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return storeName.slice(0, 2).toUpperCase() || 'POS';
  }, [activeTenant?.logoInitial, storeName]);

  const storeAddressLine = [activeTenant?.address, activeTenant?.city].filter(Boolean).join(', ');
  const docTitle = (storeSettings?.receiptSaleTitle || '').trim();
  const tagline = (storeSettings?.receiptTagline || '').trim();
  const headerExtra = (storeSettings?.receiptHeaderExtra || '').trim();

  const termsTitle = storeSettings?.receiptTermsTitle || 'Catatan:';
  const termsLines = useMemo(() => {
    const raw = storeSettings?.receiptTermsText?.trim();
    const lines = raw
      ? raw
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
      : DEFAULT_TERMS_LINES;
    return lines.map(line => line.replace(/\{TOKO\}/gi, storeName));
  }, [storeSettings?.receiptTermsText, storeName]);

  const footerNote = useMemo(() => {
    const raw = storeSettings?.receiptFooterNote?.trim();
    return raw ? raw.replace(/\{TOKO\}/gi, storeName) : '';
  }, [storeSettings?.receiptFooterNote, storeName]);

  const signatureGreeting = storeSettings?.receiptSignatureGreeting || 'Hormat Kami,';
  const customerSignLabel = storeSettings?.receiptCustomerSignLabel?.trim() || 'Pelanggan';
  const cashierSignLabel = storeSettings?.receiptCashierSignLabel?.trim() || 'Kasir';

  const subtotalAmount = receipt.subtotal || 0;
  const taxAmount = receipt.tax || 0;
  const totalAmount = receipt.grandTotal || 0;
  const thumbSrc = useMemo(() => receipt.items.find(it => Boolean(it.image))?.image || '', [receipt.items]);

  useEffect(() => {
    setThumbBroken(false);
  }, [thumbSrc, invoiceNo]);

  useEffect(() => {
    setCustomLogoBroken(false);
  }, [customLogoUrl]);

  useEffect(() => {
    if (!showBarcode) return;
    renderCode128ToSvg(barcodeSvgRef.current, invoiceNo, {
      height: isThermal80 ? 22 : isA6 ? 24 : 26,
      barWidth: isThermal80 ? 1.15 : 1.25,
      fontSize: 9,
      displayValue: false,
    });
  }, [invoiceNo, isA6, isThermal80, showBarcode]);

  const qrPayload = useMemo(() => {
    const tenantTag = activeTenant?.code || 'STORE';
    return `${tenantTag}|${invoiceNo}|${totalAmount}`;
  }, [activeTenant?.code, invoiceNo, totalAmount]);

  useEffect(() => {
    if (!showQrCode) return;
    let cancelled = false;
    createQrCodeDataUrl(qrPayload, 96)
      .then(url => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [qrPayload, showQrCode]);

  const isVoid = receipt.status === 'void';
  const cashReceived = receipt.paymentDetails?.cashReceived ?? totalAmount;
  const cashChange = receipt.paymentDetails?.cashChange ?? Math.max(0, cashReceived - totalAmount);

  const renderBrandLogo = (sizeClass: string) => {
    if (logoPreset === 'none') return null;
    if (logoPreset === 'custom' && customLogoUrl && !customLogoBroken) {
      return (
        <img
          src={customLogoUrl}
          alt={storeName}
          onError={() => setCustomLogoBroken(true)}
          className={`${isThermal80 || isA6 ? 'h-9 max-w-[140px]' : 'h-11 max-w-[180px]'} object-contain`}
        />
      );
    }
    if (logoPreset === 'bag') {
      return <StoreBagGlyph className={sizeClass} />;
    }
    if (logoPreset === 'sparkles') {
      return <SparklesGlyph className={sizeClass} />;
    }
    return (
      <div
        className={`${sizeClass} rounded-xl ${palette.monogramBg} ${palette.monogramText} flex items-center justify-center font-bold tracking-tight`}
      >
        <span className={isThermal80 || isA6 ? 'text-xs' : 'text-sm'}>{storeMonogram}</span>
      </div>
    );
  };

  return (
    <div
      id={id}
      data-paper={effectivePaperSize}
      className={`retail-receipt-sheet relative bg-white text-zinc-900 font-sans rounded-xl border border-zinc-200 w-full mx-auto leading-normal select-none ${
        isThermal80
          ? 'max-w-[304px] p-4 text-xs'
          : isA6
          ? 'max-w-[420px] p-4 sm:p-5 text-xs'
          : 'max-w-[580px] p-5 sm:p-7 text-sm'
      }`}
    >
      {/* OPTIONAL SUBTLE WATERMARK */}
      {showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden rounded-xl">
          <span
            className={`font-bold tracking-widest uppercase -rotate-12 ${watermarkOpacityClass} text-zinc-900 ${
              isThermal80 ? 'text-lg' : isA6 ? 'text-2xl' : 'text-3xl'
            }`}
          >
            {storeName}
          </span>
        </div>
      )}

      {/* VOID STAMP */}
      {isVoid && (
        <div className="mb-3 px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 text-center">
          <span className="text-xs font-bold tracking-wider uppercase block">
            Transaksi Dibatalkan (VOID)
          </span>
          {receipt.voidReason && (
            <span className="text-[10px] font-medium block mt-0.5">{receipt.voidReason}</span>
          )}
        </div>
      )}

      <div className="relative z-10 flex flex-col">
        {/* CLEAN STACKED HEADER: LOGO -> NAMA TOKO -> ALAMAT -> NOMOR */}
        <div
          className={`text-center flex flex-col items-center pb-3 border-b ${
            isThermal80 ? 'border-dashed border-zinc-300' : palette.dividerClass
          }`}
        >
          {docTitle && (
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              {docTitle}
            </p>
          )}
          {logoPreset !== 'none' && (
            <div className={`mb-1.5 flex justify-center ${palette.accentText}`}>
              {renderBrandLogo(isThermal80 ? 'w-8 h-8' : isA6 ? 'w-9 h-9' : 'w-10 h-10')}
            </div>
          )}
          <h1
            className={`font-bold tracking-tight leading-tight ${palette.accentText} ${
              isThermal80 ? 'text-base' : isA6 ? 'text-base' : 'text-lg sm:text-xl'
            }`}
          >
            {storeName}
          </h1>
          {tagline && (
            <p className="text-xs text-zinc-500 font-medium mt-0.5">{tagline}</p>
          )}
          {showStoreAddress && storeAddressLine && (
            <p
              className={`text-zinc-500 mt-1 leading-snug max-w-sm ${
                isThermal80 ? 'text-[11px]' : 'text-xs'
              }`}
            >
              {storeAddressLine}
            </p>
          )}
          {showStoreAddress && activeTenant?.phone && (
            <p
              className={`text-zinc-600 font-mono mt-0.5 leading-snug ${
                isThermal80 ? 'text-[11px]' : 'text-xs'
              }`}
            >
              Telp. {activeTenant.phone}
            </p>
          )}
          {headerExtra && (
            <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{headerExtra}</p>
          )}
        </div>

        {/* METADATA SECTION */}
        {isThermal80 ? (
          <div className="py-2.5 space-y-1 text-xs border-b border-dashed border-zinc-300">
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">No. Struk</span>
              <span className="font-mono font-semibold text-zinc-900 tabular-nums">{invoiceNo}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">Tanggal</span>
              <span className="text-zinc-700 tabular-nums">{dateStr}</span>
            </div>
            {showCashierName && cashierName && (
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Kasir</span>
                <span className="text-zinc-800 font-medium">{cashierName}</span>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">Pelanggan</span>
              <span className="text-zinc-900 font-medium text-right">
                {customerName}
                {customerPhone ? ` (${customerPhone})` : ''}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-600 border-b border-zinc-100">
            <div className="space-y-0.5 min-w-0">
              <p className="truncate">
                <span className="text-zinc-400">No. Struk: </span>
                <span className="font-mono font-semibold text-zinc-900 tabular-nums">{invoiceNo}</span>
              </p>
              <p className="truncate tabular-nums">
                <span className="text-zinc-400">Tanggal: </span>
                <span className="text-zinc-700">{dateStr}</span>
              </p>
            </div>
            <div className="space-y-0.5 text-right min-w-0">
              <p className="truncate">
                <span className="text-zinc-400">Pelanggan: </span>
                <span className="font-semibold text-zinc-900">{customerName}</span>
                {customerPhone && <span className="font-mono text-zinc-500"> ({customerPhone})</span>}
              </p>
              <p className="truncate">
                {showCashierName && cashierName && (
                  <>
                    <span className="text-zinc-400">Kasir: </span>
                    <span className="font-medium text-zinc-800">{cashierName}</span>
                    <span className="text-zinc-300 mx-1.5">·</span>
                  </>
                )}
                <span className="font-medium text-zinc-800">{getSalePaymentMethodLabel(receipt)}</span>
              </p>
            </div>
          </div>
        )}

        {/* ITEMS LIST */}
        {isThermal80 ? (
          <div className="py-2.5 space-y-2 border-b border-dashed border-zinc-300">
            {receipt.items && receipt.items.length > 0 ? (
              receipt.items.map((it, idx) => (
                <div key={`${it.id}-${idx}`} className="space-y-0.5">
                  <div className="font-medium text-zinc-900 leading-snug">{it.name}</div>
                  <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
                    <span className="text-zinc-500">
                      {it.qty} &times; {formatIDR(it.harga)}
                      {showItemSku && it.sku ? ` · ${it.sku}` : ''}
                    </span>
                    <span className="font-semibold text-zinc-900">
                      {formatIDR(it.subtotal).replace('Rp', '').trim()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-zinc-400 py-2">Tidak ada rincian item.</p>
            )}
          </div>
        ) : (
          <div className="py-2">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-500">
                  <th className="py-2 pr-2 text-left">Produk</th>
                  <th className="py-2 px-2 text-center w-12">Qty</th>
                  <th className="py-2 px-2 text-right w-24">Harga</th>
                  <th className="py-2 pl-2 text-right w-28">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {receipt.items && receipt.items.length > 0 ? (
                  receipt.items.map((it, idx) => (
                    <tr key={`${it.id}-${idx}`}>
                      <td className="py-2 pr-2 align-top">
                        <div className="font-medium text-zinc-900 leading-snug">{it.name}</div>
                        {showItemSku && it.sku && (
                          <div className="text-xs font-mono text-zinc-400 mt-0.5">
                            SKU: {it.sku}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-zinc-700 tabular-nums align-top">
                        {it.qty}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-zinc-600 whitespace-nowrap tabular-nums align-top">
                        {formatIDR(it.harga).replace('Rp', '').trim()}
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-semibold text-zinc-900 whitespace-nowrap tabular-nums align-top">
                        {formatIDR(it.subtotal).replace('Rp', '').trim()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-xs text-zinc-400">
                      Rincian item tidak tersedia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TOTALS & PAYMENT SUMMARY */}
        {isThermal80 ? (
          <div className="py-2.5 space-y-1 text-xs border-b border-dashed border-zinc-300">
            <div className="flex justify-between gap-2 text-zinc-600">
              <span>Subtotal ({receipt.totalQty} item)</span>
              <span className="font-mono tabular-nums">{formatIDR(subtotalAmount)}</span>
            </div>
            {showTaxLine && (
              <div className="flex justify-between gap-2 text-zinc-600">
                <span>{taxAmount > 0 ? `PPN (${storeSettings?.ppnPercent ?? 11}%)` : 'PPN'}</span>
                <span className="font-mono tabular-nums">{formatIDR(taxAmount)}</span>
              </div>
            )}
            <div className="pt-1.5 mt-1 border-t border-dashed border-zinc-300 flex justify-between items-baseline gap-2 font-bold text-zinc-950 text-sm">
              <span>Total</span>
              <span className="font-mono tabular-nums">{formatIDR(totalAmount)}</span>
            </div>

            {receipt.paymentMethod === 'cash' ? (
              <div className="pt-1.5 space-y-0.5 text-xs text-zinc-600">
                <div className="flex justify-between gap-2">
                  <span>Bayar (Tunai)</span>
                  <span className="font-mono tabular-nums">{formatIDR(cashReceived)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Kembali</span>
                  <span className="font-mono tabular-nums">{formatIDR(cashChange)}</span>
                </div>
              </div>
            ) : (
              <div className="pt-1 text-xs text-zinc-600 flex justify-between gap-2">
                <span>{getSalePaymentMethodLabel(receipt)}</span>
                <span className="font-mono text-right truncate">{getSalePaymentReferenceLine(receipt)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="pt-3 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            {/* Optional Photo Thumbnail or Payment Info on Left */}
            <div className="flex items-start gap-2.5 min-w-0">
              {showPhoto && thumbSrc && !thumbBroken && (
                <img
                  src={thumbSrc}
                  alt={receipt.items[0]?.name || 'Produk'}
                  onError={() => setThumbBroken(true)}
                  className="w-11 h-11 rounded-lg border border-zinc-200 object-cover shrink-0"
                />
              )}
              <div className="text-xs text-zinc-500 space-y-0.5">
                <p>
                  Total Item: <span className="font-semibold text-zinc-800">{receipt.totalQty} pcs</span>
                </p>
                <p className="font-mono text-xs text-zinc-500">
                  {getSalePaymentReferenceLine(receipt)}
                </p>
              </div>
            </div>

            {/* Clean Right-Aligned Totals */}
            <div className={`${isA6 ? 'w-full sm:w-52' : 'w-full sm:w-64'} space-y-1.5 shrink-0`}>
              <div className="flex justify-between gap-3 text-zinc-600">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums text-zinc-900">{formatIDR(subtotalAmount)}</span>
              </div>
              {showTaxLine && (
                <div className="flex justify-between gap-3 text-zinc-600">
                  <span>{taxAmount > 0 ? `PPN (${storeSettings?.ppnPercent ?? 11}%)` : 'PPN'}</span>
                  <span className="font-mono tabular-nums text-zinc-900">{formatIDR(taxAmount)}</span>
                </div>
              )}
              <div
                className={`mt-1.5 px-3 py-2 rounded-lg border flex justify-between items-center gap-3 ${palette.totalBg} ${palette.totalBorder}`}
              >
                <span className={`font-bold ${palette.totalText}`}>Total</span>
                <span
                  className={`font-mono font-bold tabular-nums ${palette.totalText} ${
                    isA6 ? 'text-sm' : 'text-base'
                  }`}
                >
                  {formatIDR(totalAmount)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* OPTIONAL TERMS / SIGNATURES / BARCODE / QR / FOOTER */}
        {(showTerms || showSignatures || showBarcode || showQrCode || Boolean(footerNote)) && (
          <div className={`mt-3.5 pt-3 border-t ${isThermal80 ? 'border-dashed border-zinc-300' : 'border-zinc-100'} space-y-3`}>
            {showTerms && termsLines.length > 0 && (
              <div className="text-xs text-zinc-500 leading-relaxed space-y-0.5">
                <p className="font-semibold text-zinc-700">{termsTitle}</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {termsLines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {showSignatures && (
              <div className="grid grid-cols-2 gap-6 pt-2 text-center text-xs text-zinc-700">
                <div>
                  <p className="text-zinc-500 mb-9">{customerSignLabel}</p>
                  <div className="border-t border-zinc-300 pt-1 font-medium">{customerName}</div>
                </div>
                <div>
                  <p className="text-zinc-500 mb-9">{signatureGreeting}</p>
                  <div className="border-t border-zinc-300 pt-1 font-medium">
                    {cashierName || cashierSignLabel}
                  </div>
                </div>
              </div>
            )}

            {(showBarcode || showQrCode) && (
              <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
                {showBarcode && (
                  <div className="flex flex-col items-center">
                    <svg ref={barcodeSvgRef} className={isThermal80 ? 'w-[140px] h-auto' : 'w-[156px] h-auto'} />
                    <span className="text-[11px] font-mono text-zinc-400 mt-0.5">{invoiceNo}</span>
                  </div>
                )}
                {showQrCode && qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt={`QR ${invoiceNo}`}
                    className="w-12 h-12 rounded border border-zinc-200 p-0.5 bg-white object-contain"
                  />
                )}
              </div>
            )}

            {footerNote && (
              <p className="text-center text-xs text-zinc-500 whitespace-pre-line leading-relaxed">
                {footerNote}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
