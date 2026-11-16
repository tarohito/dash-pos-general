import React, { useState, useEffect } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { PromoCampaign, Product } from '../../types';
import { formatIDR } from '../../utils/formatters';
import { NumericInput } from '../common/NumericInput';
import { CustomCheckbox } from '../common/CustomCheckbox';
import { StatusToggle } from '../common/StatusToggle';
import { posApi } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../contexts/ToastContext';
import {
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_SECONDARY_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
} from '../common/ModalShell';
import {
  formatPromoDate,
  getEndDateFromDuration,
  getPromoDurationDays,
  getPromoStatusSummary,
  getTodayWibDateStr,
} from '../../utils/promoDuration';

interface AddEditPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (promo: PromoCampaign, isEdit?: boolean) => Promise<void> | void;
  editingPromo?: PromoCampaign | null;
}

export const AddEditPromoModal: React.FC<AddEditPromoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingPromo,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(10);
  const [label, setLabel] = useState('Diskon 10%');
  const [startDate, setStartDate] = useState(() => getTodayWibDateStr());
  const [durationDays, setDurationDays] = useState<number>(7);
  const [endDate, setEndDate] = useState(() => getEndDateFromDuration(getTodayWibDateStr(), 7));
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [minPurchase, setMinPurchase] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Server-side searchable product picker inside modal
  const [productSearch, setProductSearch] = useState('');
  const debouncedProductSearch = useDebounce(productSearch, 200);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);
  const { showToast } = useToast();

  const todayStr = getTodayWibDateStr();
  const isDateExpired = Boolean(endDate && endDate < todayStr);

  useEffect(() => {
    if (!isOpen) return;
    const today = getTodayWibDateStr();
    if (editingPromo) {
      const calcDays = getPromoDurationDays(editingPromo.startDate, editingPromo.endDate) ?? 1;
      const expired = Boolean(editingPromo.endDate && editingPromo.endDate < today);
      setName(editingPromo.name);
      setCode(editingPromo.code);
      setDiscountPercent(editingPromo.discountPercent);
      setLabel(editingPromo.label);
      setStartDate(editingPromo.startDate);
      setDurationDays(Math.max(1, calcDays));
      setEndDate(editingPromo.endDate);
      setSelectedProductIds(editingPromo.productIds || []);
      setIsActive(expired ? false : editingPromo.isActive);
      setMinPurchase(editingPromo.minPurchase || 0);
      setDescription(editingPromo.description || '');
    } else {
      setName('');
      setCode('PROMO' + Math.floor(100 + Math.random() * 900));
      setDiscountPercent(10);
      setLabel('Diskon 10%');
      setStartDate(today);
      setDurationDays(7);
      setEndDate(getEndDateFromDuration(today, 7));
      setSelectedProductIds([]);
      setIsActive(true);
      setMinPurchase(0);
      setDescription('');
    }
    setProductSearch('');
    setError('');
    setProductLoadError(null);
  }, [editingPromo, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setIsLoadingProducts(true);
    setProductLoadError(null);

    posApi
      .getProducts(
        {
          page: 1,
          pageSize: 100,
          search: debouncedProductSearch || undefined,
        },
        controller.signal
      )
      .then(res => {
        setProducts(res.items);
        setTotalProducts(res.totalAllProducts || res.total);
        setIsLoadingProducts(false);
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          const msg = err instanceof Error ? err.message : 'Gagal memuat daftar produk.';
          setProductLoadError(msg);
          setIsLoadingProducts(false);
          showToast('error', msg);
        }
      });

    return () => controller.abort();
  }, [isOpen, debouncedProductSearch, showToast]);

  const handleToggleProduct = (id: number) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const allVisibleSelected =
    products.length > 0 && products.every(p => selectedProductIds.includes(p.id));

  const handleSelectAllVisibleProducts = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(products.map(p => p.id));
      setSelectedProductIds(prev => prev.filter(id => !visibleIds.has(id)));
    } else {
      setSelectedProductIds(prev => {
        const merged = new Set(prev);
        for (const p of products) merged.add(p.id);
        return Array.from(merged);
      });
    }
  };

  const failValidation = (msg: string) => {
    setError(msg);
    showToast('error', msg, 'Validasi Form Promo');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanName) {
      failValidation('Nama promo tidak boleh kosong.');
      return;
    }
    if (!cleanCode || cleanCode.length < 3 || !/^[A-Z0-9_-]+$/.test(cleanCode)) {
      failValidation('Kode promo minimal 3 karakter (hanya huruf, angka, "-" atau "_" tanpa spasi).');
      return;
    }
    if (Number.isNaN(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      failValidation('Persentase diskon harus antara 1% hingga 100%.');
      return;
    }
    if (!startDate || !endDate) {
      failValidation('Tanggal mulai dan tanggal berakhir promo wajib diisi.');
      return;
    }
    if (endDate < startDate) {
      failValidation('Tanggal berakhir promo tidak boleh lebih awal dari tanggal mulai.');
      return;
    }
    if (isActive && endDate < todayStr) {
      failValidation(
        `Tanggal berakhir (${formatPromoDate(endDate)}) sudah terlewati. Perpanjang durasi promo agar dapat diaktifkan.`
      );
      return;
    }
    if (selectedProductIds.length === 0) {
      failValidation('Pilih minimal 1 produk yang mendapatkan promo ini.');
      return;
    }

    const payload: PromoCampaign = {
      id: editingPromo ? editingPromo.id : `PRM-${Date.now().toString().slice(-4)}`,
      name: cleanName,
      code: cleanCode,
      discountPercent: Number(discountPercent),
      label: label.trim() || `Diskon ${discountPercent}%`,
      startDate,
      endDate,
      productIds: selectedProductIds,
      isActive,
      minPurchase: minPurchase > 0 ? Number(minPurchase) : undefined,
      description: description.trim() || undefined,
    };

    try {
      setIsSaving(true);
      await onSave(payload, Boolean(editingPromo));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan promo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={editingPromo ? 'Edit Promo' : 'Buat Promo'}
      disableEscapeClose={isSaving}
      footer={
        <div className={MODAL_FOOTER_END_CLASS}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className={MODAL_BTN_SECONDARY_CLASS}
          >
            Batal
          </button>
          <button
            type="submit"
            form="add-edit-promo-form"
            disabled={isSaving}
            className={MODAL_BTN_PRIMARY_CLASS}
          >
            {isSaving ? 'Menyimpan...' : editingPromo ? 'Simpan Perubahan' : 'Buat Promo'}
          </button>
        </div>
      }
    >
      <form id="add-edit-promo-form" noValidate onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-center gap-2">
              <GoogleIcon name="error" size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Grid 1: Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Nama Promo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Promo Akhir Pekan 10%"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full h-10 px-3.5 text-sm font-medium rounded-xl border border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Kode Promo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: WEEKEND10"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className="w-full h-10 px-3.5 text-sm font-mono font-bold rounded-xl border border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none uppercase"
              />
            </div>
          </div>

          {/* Grid 2: Discount, Min Purchase, Label & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Diskon (%) <span className="text-red-500">*</span>
              </label>
              <NumericInput
                value={discountPercent}
                onChange={val => {
                  setDiscountPercent(val);
                  setLabel(`Diskon ${val}%`);
                }}
                min={1}
                max={100}
                suffix="%"
                placeholder="10"
                required
                className="w-full h-10 px-3.5 text-sm font-bold font-mono rounded-xl border border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Minimal Pembelian (Opsional)
              </label>
              <NumericInput
                value={minPurchase || ''}
                onChange={val => setMinPurchase(Math.max(0, Number(val) || 0))}
                prefix="Rp"
                placeholder="0 (Tanpa minimal)"
                className="w-full h-10 pr-3.5 text-sm font-bold font-mono rounded-xl border border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Label Badge Promo
              </label>
              <input
                type="text"
                placeholder="Diskon 10%"
                value={label}
                onChange={e => setLabel(e.target.value)}
                className="w-full h-10 px-3.5 text-sm font-medium rounded-xl border border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Status Promo
              </label>
              <div className="flex items-center justify-between h-10 px-3.5 bg-white border border-zinc-200 rounded-xl">
                <span
                  onClick={() => {
                    if (!isActive && isDateExpired) {
                      showToast('warning', 'Perpanjang tanggal berakhir atau durasi promo terlebih dahulu untuk mengaktifkan.');
                      return;
                    }
                    setIsActive(prev => !prev);
                  }}
                  className={`text-sm font-semibold cursor-pointer select-none ${
                    isDateExpired
                      ? 'text-red-600'
                      : isActive
                      ? 'text-emerald-700'
                      : 'text-zinc-500'
                  }`}
                >
                  {isDateExpired
                    ? 'Berakhir'
                    : isActive
                    ? startDate > todayStr
                      ? 'Terjadwal (Aktif)'
                      : 'Aktif (Berlaku)'
                    : 'Nonaktif'}
                </span>
                <StatusToggle
                  checked={isActive && !isDateExpired}
                  onChange={next => {
                    if (next && isDateExpired) {
                      showToast('warning', 'Perpanjang tanggal berakhir atau durasi promo terlebih dahulu untuk mengaktifkan.');
                      return;
                    }
                    setIsActive(next);
                  }}
                  tooltip={
                    isDateExpired
                      ? 'Masa berlaku sudah berakhir — perpanjang durasi terlebih dahulu'
                      : isActive
                      ? 'Aktif — klik untuk nonaktifkan promo'
                      : 'Nonaktif — klik untuk aktifkan promo'
                  }
                />
              </div>
            </div>
          </div>

          {/* Grid 3: Duration & Dates */}
          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider inline-flex items-center gap-1.5">
                <GoogleIcon name="schedule" size={15} className="text-primary" />
                Durasi &amp; Periode Berlaku
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[1, 3, 7, 14, 30].map(days => {
                  const selected = durationDays === days;
                  return (
                    <button
                      key={days}
                      type="button"
                      onClick={() => {
                        const nextEnd = getEndDateFromDuration(startDate, days);
                        setDurationDays(days);
                        setEndDate(nextEnd);
                        if (nextEnd >= todayStr && editingPromo === null) {
                          setIsActive(true);
                        }
                      }}
                      className={`h-7 px-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-primary text-white border-primary shadow-2xs'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-900'
                      }`}
                    >
                      {days === 1 ? '1 Hari' : `${days} Hari`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Tanggal Mulai <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => {
                    const nextStart = e.target.value;
                    setStartDate(nextStart);
                    if (nextStart) {
                      const nextEnd = getEndDateFromDuration(nextStart, Math.max(1, durationDays));
                      setEndDate(nextEnd);
                      if (nextEnd < todayStr) {
                        setIsActive(false);
                      }
                    }
                  }}
                  className="w-full h-10 px-3 text-sm font-medium bg-white rounded-xl border border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Durasi Lama (Hari) <span className="text-red-500">*</span>
                </label>
                <NumericInput
                  value={durationDays}
                  onChange={val => {
                    const nextDays = Math.max(1, Math.min(3650, Number(val) || 1));
                    setDurationDays(nextDays);
                    if (startDate) {
                      const nextEnd = getEndDateFromDuration(startDate, nextDays);
                      setEndDate(nextEnd);
                      if (nextEnd < todayStr) {
                        setIsActive(false);
                      }
                    }
                  }}
                  min={1}
                  max={3650}
                  suffix="hari"
                  placeholder="7"
                  required
                  className="w-full h-10 pl-3.5 text-sm font-bold font-mono bg-white rounded-xl border border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Tanggal Berakhir <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={e => {
                    const nextEnd = e.target.value;
                    setEndDate(nextEnd);
                    if (startDate && nextEnd) {
                      const calc = getPromoDurationDays(startDate, nextEnd);
                      if (calc && calc > 0) {
                        setDurationDays(calc);
                      }
                    }
                    if (nextEnd && nextEnd < todayStr) {
                      setIsActive(false);
                    }
                  }}
                  className="w-full h-10 px-3 text-sm font-medium bg-white rounded-xl border border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                />
              </div>
            </div>

            {(() => {
              const summary = getPromoStatusSummary(
                { isActive, startDate, endDate },
                todayStr
              );
              const badgeStyles =
                summary.status === 'active'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : summary.status === 'scheduled'
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : summary.status === 'expired'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-700';
              return (
                <div className={`px-3 py-2 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${badgeStyles}`}>
                  <span className="font-semibold">
                    Status Masa Berlaku: {summary.label} ({summary.detailText})
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatPromoDate(startDate)} s/d {formatPromoDate(endDate)}
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Section: Product Selection */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="text-xs font-semibold text-zinc-700">
                Pilih Produk ({selectedProductIds.length} terpilih dari {totalProducts} katalog)
              </label>
              <button
                type="button"
                onClick={handleSelectAllVisibleProducts}
                className="text-xs font-semibold text-primary hover:text-primary-hover cursor-pointer underline underline-offset-2"
              >
                {allVisibleSelected ? 'Batalkan Daftar Ini' : 'Pilih Semua di Daftar'}
              </button>
            </div>

            {/* Search bar inside product picker */}
            <div className="relative mb-2">
              <GoogleIcon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Cari produk berdasarkan nama atau SKU..."
                className="w-full h-9 pl-9 pr-3.5 text-sm rounded-xl border border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white"
              />
            </div>

            <div className="max-h-52 overflow-y-auto border border-zinc-200 rounded-xl divide-y divide-zinc-100 bg-zinc-50/50">
              {isLoadingProducts ? (
                <div className="py-8 flex items-center justify-center gap-2 text-xs text-zinc-500">
                  <GoogleIcon name="progress_activity" size={16} className="animate-spin text-primary" />
                  <span>Memuat daftar produk...</span>
                </div>
              ) : productLoadError ? (
                <div className="py-8 px-4 text-center text-xs text-red-600 font-semibold">
                  {productLoadError}
                </div>
              ) : products.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400">
                  Tidak ada produk yang cocok dengan pencarian
                </div>
              ) : (
                products.map(product => {
                  const isSelected = selectedProductIds.includes(product.id);
                  const discountedPrice = Math.round(product.harga * (1 - discountPercent / 100));

                  return (
                    <label
                      key={product.id}
                      className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-zinc-100/80 hover:bg-zinc-100' : 'hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CustomCheckbox
                          checked={isSelected}
                          onChange={() => handleToggleProduct(product.id)}
                        />
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            loading="lazy"
                            className="w-8 h-8 rounded object-cover border border-gray-200 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-zinc-100 border border-gray-200 shrink-0 flex items-center justify-center text-zinc-400">
                            <GoogleIcon name="deployed_code" size={14} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate leading-tight">
                            {product.name}
                          </p>
                          <p className="text-xs text-gray-400 font-mono">
                            {product.sku} • {product.category} • {Number(product.berat.toFixed(2))}g
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {isSelected ? (
                          <>
                            <p className="text-sm font-bold font-mono text-zinc-950 leading-tight">
                              {formatIDR(discountedPrice)}
                            </p>
                            <p className="text-xs text-zinc-400 font-mono line-through">
                              {formatIDR(product.harga)}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm font-bold font-mono text-zinc-700">
                            {formatIDR(product.harga)}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Catatan / Deskripsi Promo
            </label>
            <textarea
              rows={2}
              placeholder="Deskripsi syarat & ketentuan promo produk..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none font-medium"
            />
          </div>
        </form>
    </ModalShell>
  );
};
