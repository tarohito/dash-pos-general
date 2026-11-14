import React, { useState, useEffect } from 'react';
import {
  Store,
  Percent,
  FileText,
  Palette,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2,
  Check,
} from 'lucide-react';
import {
  AppThemeId,
  ReceiptLogoPreset,
  ReceiptPaperSize,
  ReceiptTheme,
  StoreSettings,
  StoreSettingsUpdatePayload,
  Tenant,
  UserRole,
} from '../../types';
import { APP_THEMES } from '../../constants/themes';
import { posApi } from '../../services/api';
import { formatIDR } from '../../utils/formatters';
import { CustomSelect } from '../common/CustomSelect';
import { CustomCheckbox } from '../common/CustomCheckbox';
import { NumericInput } from '../common/NumericInput';
import { ErrorBanner } from '../common/ErrorBanner';
import { useToast } from '../../contexts/ToastContext';
import {
  DEFAULT_RECEIPT_TERMS_TEMPLATE,
  ReceiptCustomizationTab,
} from './ReceiptCustomizationTab';

interface StoreSettingsViewProps {
  activeTenant?: Tenant;
  storeSettings: StoreSettings;
  userRole: UserRole;
  onPreviewAppTheme?: (theme: AppThemeId | null) => void;
  onSettingsSaved: (updated: { tenant: Tenant; storeSettings: StoreSettings }) => void;
}

type SettingsTab = 'profile' | 'pos_tax' | 'receipt' | 'appearance';

export const StoreSettingsView: React.FC<StoreSettingsViewProps> = ({
  activeTenant,
  storeSettings,
  userRole,
  onPreviewAppTheme,
  onSettingsSaved,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Tenant Profile form state
  const [storeName, setStoreName] = useState(activeTenant?.name || '');
  const [branchName, setBranchName] = useState(activeTenant?.branchName || '');
  const [address, setAddress] = useState(activeTenant?.address || '');
  const [city, setCity] = useState(activeTenant?.city || '');
  const [phone, setPhone] = useState(activeTenant?.phone || '');
  const [email, setEmail] = useState(activeTenant?.email || '');
  const [status, setStatus] = useState<'Aktif' | 'Trial' | 'Nonaktif'>(activeTenant?.status || 'Aktif');

  // Operational Store Settings state
  const [appTheme, setAppTheme] = useState<AppThemeId>(storeSettings.appTheme || 'zinc_classic');
  const [enablePpn, setEnablePpn] = useState(storeSettings.enablePpn);
  const [ppnPercent, setPpnPercent] = useState(storeSettings.ppnPercent);
  const [requireCustomerOnSale, setRequireCustomerOnSale] = useState(storeSettings.requireCustomerOnSale);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(storeSettings.autoPrintReceipt);

  const [price24k, setPrice24k] = useState(storeSettings.goldPrice24kBuyback);
  const [price22k, setPrice22k] = useState(storeSettings.goldPrice22kBuyback);
  const [price18k, setPrice18k] = useState(storeSettings.goldPrice18kBuyback);
  const [price16k, setPrice16k] = useState(storeSettings.goldPrice16kBuyback);

  const [receiptTagline, setReceiptTagline] = useState(storeSettings.receiptTagline);
  const [receiptFooterNote, setReceiptFooterNote] = useState(storeSettings.receiptFooterNote);
  const [receiptSaleTitle, setReceiptSaleTitle] = useState(storeSettings.receiptSaleTitle);
  const [receiptBuybackTitle, setReceiptBuybackTitle] = useState(storeSettings.receiptBuybackTitle);
  const [receiptHeaderExtra, setReceiptHeaderExtra] = useState(storeSettings.receiptHeaderExtra);
  const [receiptTheme, setReceiptTheme] = useState<ReceiptTheme>(storeSettings.receiptTheme);
  const [receiptDefaultPaperSize, setReceiptDefaultPaperSize] = useState<ReceiptPaperSize>(
    storeSettings.receiptDefaultPaperSize
  );
  const [receiptLogoPreset, setReceiptLogoPreset] = useState<ReceiptLogoPreset>(
    storeSettings.receiptLogoPreset
  );
  const [receiptCustomLogoUrl, setReceiptCustomLogoUrl] = useState(
    storeSettings.receiptCustomLogoUrl
  );
  const [receiptShowWatermark, setReceiptShowWatermark] = useState(
    storeSettings.receiptShowWatermark
  );
  const [receiptWatermarkOpacity, setReceiptWatermarkOpacity] = useState(
    storeSettings.receiptWatermarkOpacity
  );
  const [receiptShowStoreAddress, setReceiptShowStoreAddress] = useState(
    storeSettings.receiptShowStoreAddress
  );
  const [receiptShowBarcode, setReceiptShowBarcode] = useState(storeSettings.receiptShowBarcode);
  const [receiptShowQrCode, setReceiptShowQrCode] = useState(storeSettings.receiptShowQrCode);
  const [receiptShowPhoto, setReceiptShowPhoto] = useState(storeSettings.receiptShowPhoto);
  const [receiptShowItemSku, setReceiptShowItemSku] = useState(storeSettings.receiptShowItemSku);
  const [receiptShowTaxLine, setReceiptShowTaxLine] = useState(storeSettings.receiptShowTaxLine);
  const [receiptShowCashierName, setReceiptShowCashierName] = useState(
    storeSettings.receiptShowCashierName
  );
  const [receiptShowTerms, setReceiptShowTerms] = useState(storeSettings.receiptShowTerms);
  const [receiptTermsTitle, setReceiptTermsTitle] = useState(storeSettings.receiptTermsTitle);
  const [receiptTermsText, setReceiptTermsText] = useState(storeSettings.receiptTermsText);
  const [receiptShowSignatures, setReceiptShowSignatures] = useState(
    storeSettings.receiptShowSignatures
  );
  const [receiptSignatureGreeting, setReceiptSignatureGreeting] = useState(
    storeSettings.receiptSignatureGreeting
  );
  const [receiptCustomerSignLabel, setReceiptCustomerSignLabel] = useState(
    storeSettings.receiptCustomerSignLabel
  );
  const [receiptCashierSignLabel, setReceiptCashierSignLabel] = useState(
    storeSettings.receiptCashierSignLabel
  );
  const [lastUpdatedMeta, setLastUpdatedMeta] = useState<{ updatedAt?: string; updatedBy?: string }>({
    updatedAt: storeSettings.updatedAt,
    updatedBy: storeSettings.updatedBy,
  });

  // Baseline snapshot for Reset Changes
  const [baseline, setBaseline] = useState<{ tenant: Tenant | null; settings: StoreSettings } | null>(null);

  const applyData = (tenant: Tenant | null, s: StoreSettings) => {
    setBaseline({ tenant, settings: s });
    if (tenant) {
      setStoreName(tenant.name);
      setBranchName(tenant.branchName);
      setAddress(tenant.address);
      setCity(tenant.city);
      setPhone(tenant.phone);
      setEmail(tenant.email);
      setStatus(tenant.status);
    }
    setAppTheme(s.appTheme || 'zinc_classic');
    setEnablePpn(s.enablePpn);
    setPpnPercent(s.ppnPercent);
    setRequireCustomerOnSale(s.requireCustomerOnSale);
    setAutoPrintReceipt(s.autoPrintReceipt);
    setPrice24k(s.goldPrice24kBuyback);
    setPrice22k(s.goldPrice22kBuyback);
    setPrice18k(s.goldPrice18kBuyback);
    setPrice16k(s.goldPrice16kBuyback);
    setReceiptTagline(s.receiptTagline);
    setReceiptFooterNote(s.receiptFooterNote);
    setReceiptSaleTitle(s.receiptSaleTitle);
    setReceiptBuybackTitle(s.receiptBuybackTitle);
    setReceiptHeaderExtra(s.receiptHeaderExtra);
    setReceiptTheme(s.receiptTheme);
    setReceiptDefaultPaperSize(s.receiptDefaultPaperSize);
    setReceiptLogoPreset(s.receiptLogoPreset);
    setReceiptCustomLogoUrl(s.receiptCustomLogoUrl);
    setReceiptShowWatermark(s.receiptShowWatermark);
    setReceiptWatermarkOpacity(s.receiptWatermarkOpacity);
    setReceiptShowStoreAddress(s.receiptShowStoreAddress);
    setReceiptShowBarcode(s.receiptShowBarcode);
    setReceiptShowQrCode(s.receiptShowQrCode);
    setReceiptShowPhoto(s.receiptShowPhoto);
    setReceiptShowItemSku(s.receiptShowItemSku);
    setReceiptShowTaxLine(s.receiptShowTaxLine);
    setReceiptShowCashierName(s.receiptShowCashierName);
    setReceiptShowTerms(s.receiptShowTerms);
    setReceiptTermsTitle(s.receiptTermsTitle);
    setReceiptTermsText(s.receiptTermsText);
    setReceiptShowSignatures(s.receiptShowSignatures);
    setReceiptSignatureGreeting(s.receiptSignatureGreeting);
    setReceiptCustomerSignLabel(s.receiptCustomerSignLabel);
    setReceiptCashierSignLabel(s.receiptCashierSignLabel);
    setLastUpdatedMeta({ updatedAt: s.updatedAt, updatedBy: s.updatedBy });
  };

  const loadSettings = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await posApi.getStoreSettings(signal);
      applyData(res.tenant, res.storeSettings);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : 'Gagal memuat pengaturan toko.';
        setFetchError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadSettings(controller.signal);
    return () => controller.abort();
  }, [activeTenant?.id]);

  useEffect(() => {
    return () => {
      onPreviewAppTheme?.(null);
    };
  }, [onPreviewAppTheme]);

  const handleReset = () => {
    if (!baseline) return;
    applyData(baseline.tenant, baseline.settings);
    onPreviewAppTheme?.(null);
    showToast('info', 'Perubahan dikembalikan ke pengaturan tersimpan.');
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!storeName.trim() || !branchName.trim()) {
      showToast('error', 'Nama toko dan nama cabang wajib diisi.');
      setActiveTab('profile');
      return;
    }
    if (!Number.isFinite(ppnPercent) || ppnPercent < 0 || ppnPercent > 30) {
      showToast('error', 'Tarif PPN harus antara 0% sampai 30%.');
      setActiveTab('pos_tax');
      return;
    }

    setIsSaving(true);
    try {
      const payload: StoreSettingsUpdatePayload = {
        tenantProfile: {
          name: storeName.trim(),
          branchName: branchName.trim(),
          address: address.trim(),
          city: city.trim(),
          phone: phone.trim(),
          email: email.trim(),
          status: userRole === 'owner' ? status : undefined,
        },
        settings: {
          appTheme,
          enablePpn,
          ppnPercent: Number(ppnPercent),
          requireCustomerOnSale,
          autoPrintReceipt,
          goldPrice24kBuyback: price24k,
          goldPrice22kBuyback: price22k,
          goldPrice18kBuyback: price18k,
          goldPrice16kBuyback: price16k,
          receiptTagline: receiptTagline.trim(),
          receiptFooterNote: receiptFooterNote.trim(),
          receiptSaleTitle: receiptSaleTitle.trim(),
          receiptBuybackTitle: receiptBuybackTitle.trim(),
          receiptHeaderExtra: receiptHeaderExtra.trim(),
          receiptTheme,
          receiptDefaultPaperSize,
          receiptLogoPreset,
          receiptCustomLogoUrl,
          receiptShowWatermark,
          receiptWatermarkOpacity,
          receiptShowStoreAddress,
          receiptShowBarcode,
          receiptShowQrCode,
          receiptShowPhoto,
          receiptShowItemSku,
          receiptShowTaxLine,
          receiptShowCashierName,
          receiptShowTerms,
          receiptTermsTitle: receiptTermsTitle.trim() || 'Catatan:',
          receiptTermsText: receiptTermsText.trim() || DEFAULT_RECEIPT_TERMS_TEMPLATE,
          receiptShowSignatures,
          receiptSignatureGreeting: receiptSignatureGreeting.trim() || 'Hormat Kami,',
          receiptCustomerSignLabel: receiptCustomerSignLabel.trim() || 'Pelanggan',
          receiptCashierSignLabel: receiptCashierSignLabel.trim() || 'Kasir',
        },
      };

      const saved = await posApi.updateStoreSettings(payload);
      applyData(saved.tenant, saved.storeSettings);
      onPreviewAppTheme?.(null);
      onSettingsSaved(saved);
      showToast('success', `Pengaturan outlet "${saved.tenant.name}" berhasil disimpan.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan pengaturan toko.');
    } finally {
      setIsSaving(false);
    }
  };

  const sampleSubtotal = 10000000;
  const sampleTax = enablePpn ? Math.round(sampleSubtotal * (ppnPercent / 100)) : 0;
  const sampleTotal = sampleSubtotal + sampleTax;

  const formattedUpdatedAt = lastUpdatedMeta.updatedAt
    ? new Date(lastUpdatedMeta.updatedAt).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  return (
    <form onSubmit={handleSave} className="space-y-4 pb-8">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
              Pengaturan Toko &amp; Operasional Outlet
            </h3>
            {isLoading && <Loader2 size={15} className="animate-spin text-zinc-900" />}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            <span>{activeTenant?.code || 'OUTLET'}</span>
            <span aria-hidden="true" className="mx-1.5 text-gray-300">&middot;</span>
            <span className="font-medium text-gray-700">{activeTenant?.name || 'Toko Aktif'}</span>
            <span aria-hidden="true" className="mx-1.5 text-gray-300">&middot;</span>
            <span>Terakhir diperbarui {formattedUpdatedAt}{lastUpdatedMeta.updatedBy ? ` oleh ${lastUpdatedMeta.updatedBy}` : ''}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving || isLoading}
            className="h-9 px-3.5 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>

          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="h-9 px-4 bg-zinc-900 hover:bg-zinc-800 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </div>

      {fetchError && <ErrorBanner message={fetchError} onRetry={() => void loadSettings()} />}

      {/* Section Navigation Tabs */}
      <div className="bg-zinc-100 rounded-2xl border border-zinc-200 p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {(
          [
            { key: 'profile', label: 'Profil Outlet', icon: Store },
            { key: 'pos_tax', label: 'Pajak PPN & POS', icon: Percent },
            { key: 'receipt', label: 'Tampilan Nota', icon: FileText },
            { key: 'appearance', label: 'Tema & Warna', icon: Palette },
          ] as const
        ).map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`h-9 px-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-all inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-white text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 sm:p-6 space-y-5">
          <div>
            <h4 className="text-sm sm:text-base font-bold text-gray-900">Identitas &amp; Kontak Outlet</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Informasi ini tampil pada header nota faktur penjualan dan daftar multi-outlet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Nama Toko / Brand <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                placeholder="MKI (Maklon Kosmetik Indonesia)"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Nama Cabang / Lokasi <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={branchName}
                onChange={e => setBranchName(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                placeholder="Cabang Utama (Grand City Mall Lt. 1)"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nomor Telepon / WhatsApp</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 font-mono"
                placeholder="0812-8899-7766"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email Resmi Outlet</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                placeholder="admin@mki-kosmetik.id"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kota / Wilayah</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                placeholder="Jakarta Pusat"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Status Operasional Outlet</label>
              <CustomSelect
                value={status}
                onChange={val => setStatus(val as 'Aktif' | 'Trial' | 'Nonaktif')}
                disabled={userRole !== 'owner'}
                options={[
                  { value: 'Aktif', label: 'Aktif (Operasional Normal)' },
                  { value: 'Trial', label: 'Masa Uji Coba (Trial)' },
                  { value: 'Nonaktif', label: 'Nonaktif Sementara' },
                ]}
              />
              {userRole !== 'owner' && (
                <p className="text-xs text-gray-400 mt-1">Hanya Owner yang dapat mengubah status operasional outlet.</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Alamat Lengkap Outlet</label>
              <textarea
                rows={2}
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full p-3 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                placeholder="Jl. Pemuda No. 108..."
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pos_tax' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-zinc-200 p-4 sm:p-6 space-y-5">
            <div>
              <h4 className="text-sm sm:text-base font-bold text-gray-900">Konfigurasi Pajak PPN &amp; Kasir POS</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Tarif PPN langsung diterapkan ke perhitungan keranjang Kasir POS dan backend checkout outlet ini.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 p-3.5 rounded-lg border border-gray-200 bg-gray-50/70">
              <div>
                <p className="text-sm font-semibold text-gray-900">Aktifkan PPN pada Transaksi Penjualan</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Nonaktifkan jika toko menggunakan harga net (Non-PKP) atau pajak sudah termasuk di harga jual.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enablePpn}
                onClick={() => setEnablePpn(prev => !prev)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${
                  enablePpn ? 'bg-zinc-900' : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white transition-transform transform ${
                    enablePpn ? 'translate-x-5.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {enablePpn && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-700">Pilih Preset atau Isi Tarif PPN (%)</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'PPN Umum 11%', value: 11 },
                    { label: 'PPN Umum 12%', value: 12 },
                    { label: 'Pajak Resto / PB1 10%', value: 10 },
                    { label: 'Tarif Khusus 1,1%', value: 1.1 },
                  ].map(preset => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setPpnPercent(preset.value)}
                      className={`h-8 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                        Number(ppnPercent) === preset.value
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="max-w-xs">
                  <NumericInput
                    value={ppnPercent}
                    onChange={val => setPpnPercent(val)}
                    allowDecimal
                    min={0}
                    max={30}
                    suffix="%"
                    className="h-10 px-3 text-sm font-mono font-bold bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                  />
                </div>
              </div>
            )}

            <div className="border-t border-gray-100 pt-4 space-y-3">

              <label className="flex items-start gap-3 cursor-pointer">
                <CustomCheckbox
                  checked={autoPrintReceipt}
                  onChange={setAutoPrintReceipt}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-800 block">
                    Tampilkan Opsi Cetak Cepat Setelah Transaksi Lunas
                  </span>
                  <span className="text-xs text-gray-500">
                    Otomatis memunculkan nota resmi transaksi siap cetak begitu pembayaran diselesaikan.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Live Tax Preview Card */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200 p-4 sm:p-6 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-sm sm:text-base font-bold text-gray-900">Simulasi Kalkulasi POS Aktif</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Contoh perhitungan invoice dengan konfigurasi PPN saat ini.
              </p>

              <div className="mt-4 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal Produk</span>
                  <span className="font-mono font-semibold text-gray-900 tabular-nums">{formatIDR(sampleSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {enablePpn ? `PPN (${ppnPercent}%)` : 'PPN (Nonaktif / 0%)'}
                  </span>
                  <span className="font-mono font-semibold text-gray-900 tabular-nums">{formatIDR(sampleTax)}</span>
                </div>
                <div className="pt-2.5 border-t border-zinc-200 flex justify-between items-center">
                  <span className="font-bold text-gray-900">Total Tagihan Kasir</span>
                  <span className="font-mono font-bold text-base text-zinc-950 tabular-nums">
                    {formatIDR(sampleTotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <p>
                Perubahan tarif PPN akan langsung aktif pada keranjang POS &amp; server checkout tanpa perlu restart aplikasi.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'receipt' && (
        <ReceiptCustomizationTab
          settings={{
            ...storeSettings,
            enablePpn,
            ppnPercent,
            goldPrice24kBuyback: price24k,
            goldPrice22kBuyback: price22k,
            goldPrice18kBuyback: price18k,
            goldPrice16kBuyback: price16k,
            receiptTagline,
            receiptFooterNote,
            receiptSaleTitle,
            receiptBuybackTitle,
            receiptHeaderExtra,
            receiptTheme,
            receiptDefaultPaperSize,
            receiptLogoPreset,
            receiptCustomLogoUrl,
            receiptShowWatermark,
            receiptWatermarkOpacity,
            receiptShowStoreAddress,
            receiptShowBarcode,
            receiptShowQrCode,
            receiptShowPhoto,
            receiptShowItemSku,
            receiptShowTaxLine,
            receiptShowCashierName,
            receiptShowTerms,
            receiptTermsTitle,
            receiptTermsText,
            receiptShowSignatures,
            receiptSignatureGreeting,
            receiptCustomerSignLabel,
            receiptCashierSignLabel,
            autoPrintReceipt,
            requireCustomerOnSale,
          }}
          tenantPreview={{
            id: activeTenant?.id || storeSettings.tenantId,
            name: storeName || activeTenant?.name || 'Toko',
            code: activeTenant?.code || 'OUTLET',
            branchName: branchName || activeTenant?.branchName || 'Cabang Utama',
            address,
            city,
            plan: activeTenant?.plan || 'Pro Multi-Outlet',
            cashierCount: activeTenant?.cashierCount || 1,
            productCount: activeTenant?.productCount || 0,
            phone,
            email,
            slug: activeTenant?.slug || 'toko',
            logoInitial:
              (storeName || activeTenant?.name || 'FP').slice(0, 2).toUpperCase(),
            databaseSchema: activeTenant?.databaseSchema || 'public',
            status,
          }}
          onUpdateField={(field, value) => {
            switch (field) {
              case 'receiptTagline':
                setReceiptTagline(String(value));
                break;
              case 'receiptFooterNote':
                setReceiptFooterNote(String(value));
                break;
              case 'receiptSaleTitle':
                setReceiptSaleTitle(String(value));
                break;
              case 'receiptBuybackTitle':
                setReceiptBuybackTitle(String(value));
                break;
              case 'receiptHeaderExtra':
                setReceiptHeaderExtra(String(value));
                break;
              case 'receiptTheme':
                setReceiptTheme(value as ReceiptTheme);
                break;
              case 'receiptDefaultPaperSize':
                setReceiptDefaultPaperSize(value as ReceiptPaperSize);
                break;
              case 'receiptLogoPreset':
                setReceiptLogoPreset(value as ReceiptLogoPreset);
                break;
              case 'receiptCustomLogoUrl':
                setReceiptCustomLogoUrl(String(value));
                break;
              case 'receiptShowWatermark':
                setReceiptShowWatermark(Boolean(value));
                break;
              case 'receiptWatermarkOpacity':
                setReceiptWatermarkOpacity(Number(value));
                break;
              case 'receiptShowStoreAddress':
                setReceiptShowStoreAddress(Boolean(value));
                break;
              case 'receiptShowBarcode':
                setReceiptShowBarcode(Boolean(value));
                break;
              case 'receiptShowQrCode':
                setReceiptShowQrCode(Boolean(value));
                break;
              case 'receiptShowPhoto':
                setReceiptShowPhoto(Boolean(value));
                break;
              case 'receiptShowItemSku':
                setReceiptShowItemSku(Boolean(value));
                break;
              case 'receiptShowTaxLine':
                setReceiptShowTaxLine(Boolean(value));
                break;
              case 'receiptShowCashierName':
                setReceiptShowCashierName(Boolean(value));
                break;
              case 'receiptShowTerms':
                setReceiptShowTerms(Boolean(value));
                break;
              case 'receiptTermsTitle':
                setReceiptTermsTitle(String(value));
                break;
              case 'receiptTermsText':
                setReceiptTermsText(String(value));
                break;
              case 'receiptShowSignatures':
                setReceiptShowSignatures(Boolean(value));
                break;
              case 'receiptSignatureGreeting':
                setReceiptSignatureGreeting(String(value));
                break;
              case 'receiptCustomerSignLabel':
                setReceiptCustomerSignLabel(String(value));
                break;
              case 'receiptCashierSignLabel':
                setReceiptCashierSignLabel(String(value));
                break;
            }
          }}
          onResetReceiptDefaults={() => {
            setReceiptTagline('');
            setReceiptSaleTitle('');
            setReceiptBuybackTitle('SURAT PEMBELIAN KEMBALI');
            setReceiptHeaderExtra('');
            setReceiptTheme('midnight_navy');
            setReceiptDefaultPaperSize('a5');
            setReceiptLogoPreset('monogram');
            setReceiptCustomLogoUrl('');
            setReceiptShowWatermark(false);
            setReceiptWatermarkOpacity(6);
            setReceiptShowStoreAddress(true);
            setReceiptShowBarcode(false);
            setReceiptShowQrCode(false);
            setReceiptShowPhoto(false);
            setReceiptShowItemSku(false);
            setReceiptShowTaxLine(true);
            setReceiptShowCashierName(true);
            setReceiptShowTerms(false);
            setReceiptTermsTitle('Catatan:');
            setReceiptTermsText(DEFAULT_RECEIPT_TERMS_TEMPLATE);
            setReceiptFooterNote('Terima kasih telah berbelanja di {TOKO}.');
            setReceiptShowSignatures(false);
            setReceiptSignatureGreeting('Hormat Kami,');
            setReceiptCustomerSignLabel('Pelanggan');
            setReceiptCashierSignLabel('Kasir');
            showToast('info', 'Desain struk dikembalikan ke tampilan simpel standar (klik Simpan Pengaturan untuk menerapkan).');
          }}
        />
      )}

      {activeTab === 'appearance' && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm sm:text-base font-bold text-zinc-950">
                Kombinasi Warna Tema Aplikasi
              </h4>
              <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                Pilih palet warna untuk seluruh antarmuka outlet ini. Pratinjau langsung aktif saat Anda memilih tema.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setAppTheme('zinc_classic');
                onPreviewAppTheme?.('zinc_classic');
              }}
              disabled={appTheme === 'zinc_classic'}
              className="h-9 px-3.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-default"
            >
              <RotateCcw size={14} />
              <span>Kembalikan ke Bawaan</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {APP_THEMES.map(theme => {
              const isSelected = appTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    setAppTheme(theme.id);
                    onPreviewAppTheme?.(theme.id);
                  }}
                  aria-pressed={isSelected}
                  className={`text-left rounded-2xl border p-3.5 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-zinc-900 ring-2 ring-zinc-900/15 bg-zinc-50/70'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/40'
                  }`}
                >
                  {/* Mini UI Wireframe Preview */}
                  <div
                    className="w-full h-28 rounded-xl border overflow-hidden flex flex-col"
                    style={{
                      backgroundColor: theme.swatches.canvas,
                      borderColor: theme.swatches.border,
                    }}
                  >
                    {/* Mini Top Header */}
                    <div
                      className="h-6 px-2.5 flex items-center justify-between border-b shrink-0"
                      style={{
                        backgroundColor: theme.swatches.header,
                        borderColor: theme.swatches.border,
                      }}
                    >
                      <span
                        className="text-[10px] font-bold tracking-tight"
                        style={{ color: theme.swatches.text }}
                      >
                        Logic<span style={{ color: theme.swatches.muted }}>POS</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <span
                          className="w-6 h-2 rounded-sm"
                          style={{ backgroundColor: theme.swatches.canvas }}
                        />
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: theme.swatches.accent }}
                        />
                      </div>
                    </div>

                    {/* Mini Sidebar + Content Area */}
                    <div className="flex-1 flex min-h-0">
                      {/* Mini Sidebar */}
                      <div
                        className="w-14 p-1.5 flex flex-col gap-1 border-r shrink-0"
                        style={{
                          backgroundColor: theme.swatches.sidebar,
                          borderColor: theme.swatches.border,
                        }}
                      >
                        <div
                          className="h-2.5 rounded-sm px-1 flex items-center"
                          style={{ backgroundColor: theme.swatches.sidebarActive }}
                        >
                          <span className="w-5 h-1 rounded-xs bg-white/90" />
                        </div>
                        <div
                          className="h-2 rounded-sm w-9"
                          style={{
                            backgroundColor: theme.isDarkSidebar
                              ? 'rgba(255,255,255,0.22)'
                              : theme.swatches.canvas,
                          }}
                        />
                        <div
                          className="h-2 rounded-sm w-7"
                          style={{
                            backgroundColor: theme.isDarkSidebar
                              ? 'rgba(255,255,255,0.16)'
                              : theme.swatches.canvas,
                          }}
                        />
                      </div>

                      {/* Mini Main Card + Accent Button */}
                      <div className="flex-1 p-2 flex flex-col gap-1.5">
                        <div
                          className="flex-1 rounded-lg border p-2 flex flex-col justify-between"
                          style={{
                            backgroundColor: theme.swatches.surface,
                            borderColor: theme.swatches.border,
                          }}
                        >
                          <div className="space-y-1">
                            <div
                              className="h-2 w-16 rounded-xs"
                              style={{ backgroundColor: theme.swatches.text }}
                            />
                            <div
                              className="h-1.5 w-24 rounded-xs opacity-60"
                              style={{ backgroundColor: theme.swatches.muted }}
                            />
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <span
                              className="h-2 w-10 rounded-xs"
                              style={{ backgroundColor: theme.swatches.canvas }}
                            />
                            <span
                              className="h-4 px-2 rounded-sm inline-flex items-center justify-center text-[8px] font-semibold text-white"
                              style={{ backgroundColor: theme.swatches.accent }}
                            >
                              Bayar
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Theme Metadata & Swatch Strip */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-950 leading-tight">
                          {theme.name}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {theme.subtitle}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 shrink-0">
                          <Check size={14} strokeWidth={2.4} />
                          <span>Aktif</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-600 leading-relaxed">
                      {theme.description}
                    </p>

                    <div className="pt-2 border-t border-zinc-100 flex items-center gap-3 text-[11px] text-zinc-600 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                          style={{ backgroundColor: theme.swatches.canvas }}
                        />
                        <span>Kanvas</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                          style={{ backgroundColor: theme.swatches.sidebar }}
                        />
                        <span>Sidebar</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                          style={{ backgroundColor: theme.swatches.accent }}
                        />
                        <span>Aksen</span>
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              {appTheme !== (baseline?.settings.appTheme || storeSettings.appTheme)
                ? 'Sedang menampilkan pratinjau warna baru. Klik "Simpan Pengaturan" untuk menyimpan permanen ke outlet ini.'
                : 'Tema warna tersimpan dan aktif untuk outlet ini.'}
            </p>
            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="h-9 px-4 bg-zinc-900 hover:bg-zinc-800 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.98] disabled:opacity-50 shrink-0"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
            </button>
          </div>
        </div>
      )}
    </form>
  );
};
