import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleIcon, GoogleIconName } from '../common/GoogleIcon';
import {
  ReceiptLogoPreset,
  ReceiptPaperSize,
  ReceiptTheme,
  StoreSettings,
  Tenant,
  Transaction,
} from '../../types';
import { RetailReceiptDocument } from '../common/RetailReceiptDocument';
import { CustomSelect } from '../common/CustomSelect';
import { StatusToggle } from '../common/StatusToggle';
import { useToast } from '../../contexts/ToastContext';
import { compressImageToWebP } from '../../utils/imageCompressor';

export const DEFAULT_RECEIPT_TERMS_TEMPLATE = [
  'Simpan struk ini sebagai bukti pembayaran yang sah dari {TOKO}.',
  'Penukaran produk dalam kemasan tersegel berlaku maksimal 3 hari.',
].join('\n');

interface ReceiptCustomizationTabProps {
  settings: StoreSettings;
  tenantPreview: Tenant;
  onUpdateField: <K extends keyof StoreSettings>(field: K, value: StoreSettings[K]) => void;
  onResetReceiptDefaults: () => void;
}

type EditorSubTab = 'theme_header' | 'elements' | 'terms_sign';

const THEME_OPTIONS: Array<{
  value: ReceiptTheme;
  label: string;
  desc: string;
  swatchClass: string;
}> = [
  {
    value: 'midnight_navy',
    label: 'Biru Malam (Standar)',
    desc: 'Slate modern & bersih untuk retail',
    swatchClass: 'bg-slate-900',
  },
  {
    value: 'monochrome',
    label: 'Monokrom Cetak',
    desc: 'Hitam putih kontras tinggi (Thermal)',
    swatchClass: 'bg-gray-950',
  },
  {
    value: 'rose_gold',
    label: 'Rose Quartz',
    desc: 'Nuansa beauty, skincare & parfum',
    swatchClass: 'bg-rose-700',
  },
  {
    value: 'royal_emerald',
    label: 'Zamrud Natural',
    desc: 'Hijau natural segar & elegan',
    swatchClass: 'bg-emerald-700',
  },
  {
    value: 'classic_gold',
    label: 'Amber Hangat',
    desc: 'Aksen amber klasik & hangat',
    swatchClass: 'bg-[#d4a017]',
  },
];

const PAPER_SIZE_OPTIONS: Array<{
  value: ReceiptPaperSize;
  label: string;
  sublabel: string;
}> = [
  { value: 'a5', label: 'A5 Standar', sublabel: '148 × 210 mm' },
  { value: 'a6', label: 'A6 Ringkas', sublabel: '105 × 148 mm' },
  { value: '80mm', label: 'Thermal 80mm', sublabel: 'Struk Roll Kasir' },
];

const WATERMARK_OPACITY_OPTIONS = [
  { value: 4, label: 'Tipis (4%)' },
  { value: 6, label: 'Standar (6%)' },
  { value: 10, label: 'Sedang (10%)' },
  { value: 14, label: 'Tegas (14%)' },
];

export const ReceiptCustomizationTab: React.FC<ReceiptCustomizationTabProps> = ({
  settings,
  tenantPreview,
  onUpdateField,
  onResetReceiptDefaults,
}) => {
  const { showToast } = useToast();
  const [editorTab, setEditorTab] = useState<EditorSubTab>('theme_header');
  const [previewPaperSize, setPreviewPaperSize] = useState<ReceiptPaperSize>(
    settings.receiptDefaultPaperSize || 'a5'
  );
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPreviewPaperSize(settings.receiptDefaultPaperSize || 'a5');
  }, [settings.receiptDefaultPaperSize]);

  const sampleSaleReceipt: Transaction = useMemo(() => {
    const subtotal = 430000;
    const tax = settings.enablePpn ? Math.round(subtotal * (settings.ppnPercent / 100)) : 0;
    const grandTotal = subtotal + tax;
    return {
      id: 'preview-sale-1',
      invoiceNo: 'INV-20261114-008',
      dateTime: new Date().toISOString(),
      dateStr: '14 Nov 2026',
      timeStr: '14:25',
      cashier: 'Sinta Wijaya',
      customerMemberCode: 'VIP-0042',
      customerName: 'Ibu Ratna Kusuma',
      customerPhone: '0812-9000-4455',
      customerAddress: 'Jl. Kemang Raya No. 18, Jakarta Selatan',
      items: [
        {
          id: 1,
          sku: 'PF-001',
          name: 'Eau de Parfum Vanilla Noir 50ml',
          category: 'Parfum',
          berat: 50,
          harga: 285000,
          qty: 1,
          subtotal: 285000,
        },
        {
          id: 2,
          sku: 'SK-002',
          name: 'Barrier Repair Moisturizer 50g',
          category: 'Skincare',
          berat: 50,
          harga: 145000,
          qty: 1,
          subtotal: 145000,
        },
      ],
      totalQty: 2,
      totalBerat: 100,
      subtotal,
      tax,
      grandTotal,
      paymentMethod: 'transfer',
      paymentDetails: {
        transferBank: 'BCA',
        transferRef: 'TRF-261115-001',
      },
      status: 'completed',
    };
  }, [settings.enablePpn, settings.ppnPercent]);

  const handleUploadCustomLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Pilih file gambar yang valid.');
      return;
    }
    try {
      const result = await compressImageToWebP(file, { maxDimension: 320, quality: 0.88 });
      onUpdateField('receiptCustomLogoUrl', result.dataUrl);
      onUpdateField('receiptLogoPreset', 'custom');
      showToast('success', 'Logo custom nota siap digunakan.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal memproses gambar logo.');
    }
  };

  const elementToggles: Array<{
    key: keyof StoreSettings;
    label: string;
    desc: string;
    checked: boolean;
  }> = [
    {
      key: 'receiptShowStoreAddress',
      label: 'Alamat & Telepon Outlet',
      desc: 'Menampilkan alamat dan nomor telepon cabang di header struk.',
      checked: settings.receiptShowStoreAddress,
    },
    {
      key: 'receiptShowCashierName',
      label: 'Nama Kasir / Staff',
      desc: 'Mencetak nama petugas kasir yang memproses transaksi.',
      checked: settings.receiptShowCashierName,
    },
    {
      key: 'receiptShowItemSku',
      label: 'Kode SKU Produk',
      desc: 'Menampilkan kode SKU barang di bawah nama produk.',
      checked: settings.receiptShowItemSku,
    },
    {
      key: 'receiptShowTaxLine',
      label: 'Baris Rincian Pajak PPN',
      desc: 'Tampilkan baris PPN di ringkasan total.',
      checked: settings.receiptShowTaxLine,
    },
    {
      key: 'receiptShowBarcode',
      label: 'Barcode Invoice (Code-128)',
      desc: 'Menampilkan barcode di bagian bawah struk untuk scan retur.',
      checked: settings.receiptShowBarcode,
    },
    {
      key: 'receiptShowQrCode',
      label: 'QR Code Verifikasi',
      desc: 'Menampilkan QR Code ringkas di bagian bawah struk.',
      checked: settings.receiptShowQrCode,
    },
    {
      key: 'receiptShowPhoto',
      label: 'Thumbnail Foto Produk',
      desc: 'Menampilkan gambar kecil produk pertama di samping ringkasan.',
      checked: settings.receiptShowPhoto,
    },
    {
      key: 'receiptShowTerms',
      label: 'Blok Catatan / Ketentuan',
      desc: 'Menampilkan poin catatan tambahan di bagian bawah nota.',
      checked: settings.receiptShowTerms,
    },
    {
      key: 'receiptShowSignatures',
      label: 'Kolom Tanda Tangan',
      desc: 'Menampilkan garis tanda tangan Pelanggan dan Kasir.',
      checked: settings.receiptShowSignatures,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* Left Column: Customization Controls */}
      <div className="lg:col-span-6 bg-white rounded-2xl border border-zinc-200 p-4 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm sm:text-base font-bold text-gray-900">
              Desain Struk &amp; Nota Penjualan
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Atur tampilan struk agar tetap simpel, bersih, dan sesuai kebutuhan kasir outlet Anda.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetReceiptDefaults}
            className="h-8 px-2.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl transition-colors inline-flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
          >
            <GoogleIcon name="undo" size={13} />
            <span>Standar</span>
          </button>
        </div>

        {/* Sub-tab Switcher */}
        <div className="inline-flex h-10 p-1 bg-zinc-100/90 rounded-full border border-zinc-200 items-center gap-1 overflow-x-auto max-w-full no-scrollbar">
          {(
            [
              { key: 'theme_header', label: 'Tema & Header', icon: 'palette' as GoogleIconName },
              { key: 'elements', label: 'Elemen Nota', icon: 'tune' as GoogleIconName },
              { key: 'terms_sign', label: 'Ketentuan & TTD', icon: 'edit_document' as GoogleIconName },
            ] as const
          ).map(tab => {
            const Icon = tab.icon;
            const active = editorTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setEditorTab(tab.key)}
                className={`h-full px-3 rounded-full text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                <GoogleIcon name={Icon} size={14} filled={active} className="shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sub-Tab 1: Tema & Header */}
        {editorTab === 'theme_header' && (
          <div className="space-y-4">
            {/* Default Paper Size */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Ukuran Kertas Cetak Default
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PAPER_SIZE_OPTIONS.map(opt => {
                  const active = settings.receiptDefaultPaperSize === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onUpdateField('receiptDefaultPaperSize', opt.value)}
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-primary-soft border-primary ring-1 ring-primary text-primary-text'
                          : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                      }`}
                    >
                      <span className="text-xs font-bold block leading-tight">{opt.label}</span>
                      <span className="text-xs text-gray-500 block mt-0.5 tabular-nums">
                        {opt.sublabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Theme */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Tema Warna &amp; Aksen Nota
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {THEME_OPTIONS.map(theme => {
                  const active = settings.receiptTheme === theme.value;
                  return (
                    <button
                      key={theme.value}
                      type="button"
                      onClick={() => onUpdateField('receiptTheme', theme.value)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-primary-soft border-primary ring-1 ring-primary'
                          : 'bg-white border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-md shrink-0 border border-black/10 ${theme.swatchClass}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-gray-900 block leading-tight">
                          {theme.label}
                        </span>
                        <span className="text-xs text-gray-500 block truncate mt-0.5">
                          {theme.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Logo & Watermark */}
            <div className="pt-3 border-t border-gray-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Logo Header Nota
                  </label>
                  <CustomSelect
                    value={settings.receiptLogoPreset}
                    onChange={val => onUpdateField('receiptLogoPreset', val as ReceiptLogoPreset)}
                    options={[
                      { value: 'monogram', label: 'Monogram Inisial Toko' },
                      { value: 'bag', label: 'Ikon Tas Belanja (Retail)' },
                      { value: 'sparkles', label: 'Ikon Parfum & Skincare' },
                      { value: 'custom', label: 'Upload Logo Sendiri' },
                      { value: 'none', label: 'Tanpa Logo (Teks Saja)' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Ketebalan Watermark Latar
                  </label>
                  <CustomSelect
                    value={String(settings.receiptWatermarkOpacity)}
                    disabled={!settings.receiptShowWatermark}
                    onChange={val => onUpdateField('receiptWatermarkOpacity', Number(val))}
                    options={WATERMARK_OPACITY_OPTIONS.map(o => ({
                      value: String(o.value),
                      label: o.label,
                    }))}
                  />
                </div>
              </div>

              {settings.receiptLogoPreset === 'custom' && (
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/70 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                      {settings.receiptCustomLogoUrl ? (
                        <img
                          src={settings.receiptCustomLogoUrl}
                          alt="Logo Custom"
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <GoogleIcon name="upload" size={16} className="text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {settings.receiptCustomLogoUrl ? 'Logo Custom Aktif' : 'Belum Ada Logo Custom'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleUploadCustomLogo}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="h-8 px-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <GoogleIcon name="upload" size={13} />
                      <span>{settings.receiptCustomLogoUrl ? 'Ganti' : 'Upload'}</span>
                    </button>
                    {settings.receiptCustomLogoUrl && (
                      <button
                        type="button"
                        onClick={() => onUpdateField('receiptCustomLogoUrl', '')}
                        className="h-8 w-8 bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-300 rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer"
                        aria-label="Hapus logo custom"
                      >
                        <GoogleIcon name="delete" size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50/70">
                <div>
                  <span className="text-xs font-semibold text-gray-900 block">
                    Tampilkan Watermark Nama Toko di Latar
                  </span>
                  <span className="text-xs text-gray-500">
                    Opsional: tampilkan teks nama toko tipis di belakang struk.
                  </span>
                </div>
                <StatusToggle
                  checked={settings.receiptShowWatermark}
                  onChange={val => onUpdateField('receiptShowWatermark', val)}
                  ariaLabel="Tampilkan Watermark Nama Toko di Latar"
                  tooltip={
                    settings.receiptShowWatermark
                      ? 'Watermark aktif — klik untuk sembunyikan'
                      : 'Watermark nonaktif — klik untuk tampilkan'
                  }
                />
              </div>
            </div>

            {/* Header Text Fields */}
            <div className="pt-3 border-t border-gray-100 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Subjudul / Tagline Toko (Opsional)
                </label>
                <input
                  type="text"
                  value={settings.receiptTagline}
                  onChange={e => onUpdateField('receiptTagline', e.target.value)}
                  className="w-full h-10 px-3.5 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Kosongkan untuk tampilan simpel"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Label Judul Atas Nota (Opsional)
                </label>
                <input
                  type="text"
                  value={settings.receiptSaleTitle}
                  onChange={e => onUpdateField('receiptSaleTitle', e.target.value)}
                  className="w-full h-10 px-3.5 text-sm font-semibold bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Contoh: Struk Pembelian (kosongkan jika tidak perlu)"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Info Tambahan Header (Instagram / Jam Buka / NPWP)
                </label>
                <input
                  type="text"
                  value={settings.receiptHeaderExtra}
                  onChange={e => onUpdateField('receiptHeaderExtra', e.target.value)}
                  className="w-full h-10 px-3.5 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="IG @mki.kosmetik • Buka Setiap Hari 09:00–21:00"
                />
              </div>
            </div>
          </div>
        )}

        {/* Sub-Tab 2: Elemen Nota */}
        {editorTab === 'elements' && (
          <div className="space-y-2.5">
            {elementToggles.map(item => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50/70 transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-gray-900 block">{item.label}</span>
                  <span className="text-xs text-gray-500 block mt-0.5 leading-snug">
                    {item.desc}
                  </span>
                </div>
                <StatusToggle
                  checked={item.checked}
                  onChange={val => onUpdateField(item.key, val as StoreSettings[typeof item.key])}
                  ariaLabel={item.label}
                  tooltip={
                    item.checked
                      ? `${item.label} aktif — klik untuk sembunyikan di nota`
                      : `${item.label} nonaktif — klik untuk tampilkan di nota`
                  }
                />
              </div>
            ))}
          </div>
        )}

        {/* Sub-Tab 3: Ketentuan & Tanda Tangan */}
        {editorTab === 'terms_sign' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Judul Bagian Syarat &amp; Ketentuan
              </label>
              <input
                type="text"
                value={settings.receiptTermsTitle}
                onChange={e => onUpdateField('receiptTermsTitle', e.target.value)}
                className="w-full h-10 px-3.5 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-semibold"
                placeholder="Catatan:"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-semibold text-gray-700">
                  Daftar Poin Syarat &amp; Ketentuan (1 Baris = 1 Poin)
                </label>
                <button
                  type="button"
                  onClick={() => onUpdateField('receiptTermsText', DEFAULT_RECEIPT_TERMS_TEMPLATE)}
                  className="text-xs font-semibold text-primary hover:text-primary-hover underline underline-offset-2 cursor-pointer whitespace-nowrap"
                >
                  Isi Template Standar
                </button>
              </div>
              <textarea
                rows={5}
                value={settings.receiptTermsText}
                onChange={e => onUpdateField('receiptTermsText', e.target.value)}
                className="w-full p-3 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed"
                placeholder="Harap simpan struk ini sebagai bukti transaksi resmi..."
              />
              <p className="text-xs text-gray-400 mt-1">
                Gunakan variabel <span className="font-mono font-semibold text-gray-600">{'{TOKO}'}</span> untuk otomatis menampilkan nama outlet Anda.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Catatan Tambahan / Footer Nota
              </label>
              <textarea
                rows={3}
                value={settings.receiptFooterNote}
                onChange={e => onUpdateField('receiptFooterNote', e.target.value)}
                className="w-full p-3 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed"
                placeholder="Contoh: Garansi tukar 7 hari dengan struk asli • WA Layanan Pelanggan 0812-xxxx"
              />
            </div>

            <div className="pt-3 border-t border-gray-100 space-y-3">
              <p className="text-xs font-bold text-gray-800">Label Blok Tanda Tangan</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Salam Penutup
                  </label>
                  <input
                    type="text"
                    value={settings.receiptSignatureGreeting}
                    onChange={e => onUpdateField('receiptSignatureGreeting', e.target.value)}
                    className="w-full h-10 px-3.5 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Hormat Kami,"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Label Pelanggan
                  </label>
                  <input
                    type="text"
                    value={settings.receiptCustomerSignLabel}
                    onChange={e => onUpdateField('receiptCustomerSignLabel', e.target.value)}
                    className="w-full h-10 px-3.5 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Customer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Label Petugas Toko
                  </label>
                  <input
                    type="text"
                    value={settings.receiptCashierSignLabel}
                    onChange={e => onUpdateField('receiptCashierSignLabel', e.target.value)}
                    className="w-full h-10 px-3.5 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Kasir / Staff"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Live WYSIWYG Preview */}
      <div className="lg:col-span-6 lg:sticky lg:top-4 bg-white rounded-2xl border border-zinc-200 p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <GoogleIcon name="visibility" size={16} className="text-zinc-700 shrink-0" />
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-gray-900 leading-tight">
                Pratinjau Nota Langsung
              </h4>
              <p className="text-xs text-gray-500">
                Simulasi tampilan cetak aktual sebelum disimpan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div className="inline-flex h-8 p-0.5 bg-zinc-100/90 rounded-full border border-zinc-200 items-center">
              {(['a5', 'a6', '80mm'] as const).map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPreviewPaperSize(size)}
                  className={`h-full px-2.5 text-xs font-bold uppercase rounded-full transition-all cursor-pointer whitespace-nowrap flex items-center justify-center ${
                    previewPaperSize === size
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-950'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200/80 bg-zinc-100/80 p-3 sm:p-4 overflow-x-auto flex justify-center">
          <RetailReceiptDocument
            receipt={sampleSaleReceipt}
            activeTenant={tenantPreview}
            storeSettings={settings}
            paperSize={previewPaperSize}
          />
        </div>
      </div>
    </div>
  );
};
