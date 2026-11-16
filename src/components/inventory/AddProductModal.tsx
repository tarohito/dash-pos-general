import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Product, ProductCondition, ProductStatus } from '../../types';
import { CustomSelect } from '../common/CustomSelect';
import { NumericInput } from '../common/NumericInput';
import { StatusToggle } from '../common/StatusToggle';
import { generateJewelrySku, isValidCode128 } from '../../utils/barcode';
import { JewelryBarcodeTag } from '../common/JewelryBarcodeTag';
import { useToast } from '../../contexts/ToastContext';
import { posApi } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import {
  compressAndCropSquareToWebP,
  formatBytes,
} from '../../utils/imageCompressor';
import {
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_SECONDARY_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
} from '../common/ModalShell';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  editingProduct?: Product | null;
  onSaveProduct: (productData: Omit<Product, 'id'>, editId?: number) => Promise<void> | void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  categories,
  editingProduct,
  onSaveProduct,
}) => {
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: categories[0] || 'Parfum',
    brand: 'No Brand',
    kondisi: 'Baru' as ProductCondition,
    deskripsi: '',
    berat: '50',
    harga: '185000',
    hpp: '',
    stok: '24',
    panjang: '',
    lebar: '',
    tinggi: '',
    status: 'Aktif' as ProductStatus,
    image: '/assets/products/parfum.jpg',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    sizeBytes: number;
    originalSizeBytes: number;
  } | null>(null);
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);
  const [skuCheckState, setSkuCheckState] = useState<{
    status: 'idle' | 'checking' | 'available' | 'duplicate';
    message?: string;
    conflictProduct?: { id: number; name: string; sku: string };
  }>({ status: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasManualSkuEditRef = useRef(false);
  const skuGenAbortRef = useRef<AbortController | null>(null);
  const { showToast } = useToast();

  const debouncedSku = useDebounce(formData.sku.trim().toUpperCase(), 220);

  const fetchUniqueSku = useCallback(
    async (category: string, currentSku?: string, forceReplace = false) => {
      skuGenAbortRef.current?.abort();
      const controller = new AbortController();
      skuGenAbortRef.current = controller;
      setIsGeneratingSku(true);
      try {
        const res = await posApi.getNextUniqueSku(category, currentSku, controller.signal);
        if (controller.signal.aborted) return;
        if (forceReplace || !hasManualSkuEditRef.current) {
          setFormData(prev => ({ ...prev, sku: res.sku }));
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError' && forceReplace) {
          setFormData(prev => ({
            ...prev,
            sku: generateJewelrySku(category, prev.name),
          }));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsGeneratingSku(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!isOpen) {
      skuGenAbortRef.current?.abort();
      setSkuCheckState({ status: 'idle' });
      return;
    }

    setErrorMsg(null);
    setCompressionInfo(null);
    setSkuCheckState({ status: 'idle' });
    const defaultCategory = categories[0] || 'Parfum';

    if (editingProduct) {
      hasManualSkuEditRef.current = true;
      setFormData({
        sku: editingProduct.sku,
        name: editingProduct.name,
        category: editingProduct.category || defaultCategory,
        brand: editingProduct.brand || 'No Brand',
        kondisi: (editingProduct.kondisi === 'Bekas' ? 'Bekas' : 'Baru') as ProductCondition,
        deskripsi: editingProduct.deskripsi || '',
        berat: String(editingProduct.berat),
        harga: String(editingProduct.harga),
        hpp: editingProduct.hpp ? String(editingProduct.hpp) : '',
        stok: String(editingProduct.stok),
        panjang: editingProduct.panjang ? String(editingProduct.panjang) : '',
        lebar: editingProduct.lebar ? String(editingProduct.lebar) : '',
        tinggi: editingProduct.tinggi ? String(editingProduct.tinggi) : '',
        status: (editingProduct.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif') as ProductStatus,
        image: editingProduct.image,
      });
    } else {
      hasManualSkuEditRef.current = false;
      setFormData({
        sku: generateJewelrySku(defaultCategory, ''),
        name: '',
        category: defaultCategory,
        brand: 'No Brand',
        kondisi: 'Baru',
        deskripsi: '',
        berat: '50',
        harga: '185000',
        hpp: '',
        stok: '24',
        panjang: '',
        lebar: '',
        tinggi: '',
        status: 'Aktif',
        image: '/assets/products/parfum.jpg',
      });
      void fetchUniqueSku(defaultCategory, undefined, false);
    }

    return () => {
      skuGenAbortRef.current?.abort();
    };
  }, [isOpen, editingProduct, categories, fetchUniqueSku]);

  useEffect(() => {
    if (!isOpen || !debouncedSku || !isValidCode128(debouncedSku)) {
      setSkuCheckState({ status: 'idle' });
      return;
    }

    const controller = new AbortController();
    setSkuCheckState({ status: 'checking' });

    posApi
      .checkProductSku(debouncedSku, editingProduct?.id, controller.signal)
      .then(res => {
        if (controller.signal.aborted) return;
        if (res.available) {
          setSkuCheckState({ status: 'available' });
        } else {
          const conflictName = res.conflictProduct?.name;
          setSkuCheckState({
            status: 'duplicate',
            message: conflictName
              ? `SKU/Barcode "${debouncedSku}" sudah dipakai oleh produk "${conflictName}".`
              : `SKU/Barcode "${debouncedSku}" sudah digunakan produk lain di outlet ini.`,
            conflictProduct: res.conflictProduct,
          });
        }
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          setSkuCheckState({ status: 'idle' });
        }
      });

    return () => controller.abort();
  }, [isOpen, debouncedSku, editingProduct?.id]);

  const handleRegenerateSku = () => {
    hasManualSkuEditRef.current = false;
    void fetchUniqueSku(formData.category, formData.sku.trim().toUpperCase(), true);
  };

  const failValidation = (msg: string) => {
    setErrorMsg(msg);
    showToast('error', msg, 'Validasi Form Produk');
  };

  const handleProcessFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      failValidation('Silakan pilih file gambar yang valid (JPG, PNG, atau WebP).');
      return;
    }
    setErrorMsg(null);
    setIsCompressing(true);
    try {
      const result = await compressAndCropSquareToWebP(file, { targetSize: 600, quality: 0.82 });
      setFormData(prev => ({ ...prev, image: result.dataUrl }));
      setCompressionInfo({
        sizeBytes: result.sizeBytes,
        originalSizeBytes: result.originalSizeBytes,
      });
      showToast(
        'success',
        `Foto berhasil dipotong 1:1 dan dikompres ke WebP (${formatBytes(result.sizeBytes)})`,
        'Kompresi Gambar'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses gambar.';
      failValidation(msg);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleProcessFile(file);
    }
    // Reset file input value so selecting the same file again triggers change
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleProcessFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanSku = formData.sku.trim().toUpperCase();
    const cleanName = formData.name.trim();
    if (!cleanSku) {
      failValidation('SKU / Barcode produk wajib diisi.');
      return;
    }
    if (!isValidCode128(cleanSku)) {
      failValidation('SKU barcode hanya boleh berisi huruf, angka, dan tanda hubung standar ASCII (Code 128).');
      return;
    }
    if (!cleanName || cleanName.length < 2) {
      failValidation('Nama produk wajib diisi (minimal 2 karakter).');
      return;
    }
    if (!formData.category.trim()) {
      failValidation('Kategori produk wajib dipilih.');
      return;
    }

    const beratNum = parseFloat(formData.berat);
    const hargaNum = parseFloat(String(formData.harga).replace(/[^0-9]/g, ''));
    const hppNum = formData.hpp ? parseFloat(String(formData.hpp).replace(/[^0-9]/g, '')) : 0;
    const stokRaw = String(formData.stok).trim();
    const stokNum = parseInt(stokRaw, 10);
    const panjangNum = formData.panjang ? parseFloat(formData.panjang) : 0;
    const lebarNum = formData.lebar ? parseFloat(formData.lebar) : 0;
    const tinggiNum = formData.tinggi ? parseFloat(formData.tinggi) : 0;

    if (Number.isNaN(beratNum) || beratNum <= 0) {
      failValidation('Berat paket produk harus lebih dari 0 gram.');
      return;
    }
    if (Number.isNaN(hargaNum) || hargaNum <= 0) {
      failValidation('Harga jual harus lebih dari Rp 0.');
      return;
    }
    if (stokRaw === '' || Number.isNaN(stokNum) || stokNum < 0) {
      failValidation('Jumlah stok tidak valid (minimal 0 pcs).');
      return;
    }

    const cleanImage = formData.image.trim();
    if (
      cleanImage &&
      !/^(https?:\/\/|data:image\/|\/)/i.test(cleanImage)
    ) {
      failValidation('URL foto produk tidak valid.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (skuCheckState.status === 'duplicate') {
        failValidation(
          skuCheckState.message ||
            `SKU/Barcode "${cleanSku}" sudah digunakan produk lain di outlet ini.`
        );
        return;
      }

      if (skuCheckState.status !== 'available' || debouncedSku !== cleanSku) {
        try {
          const check = await posApi.checkProductSku(cleanSku, editingProduct?.id);
          if (!check.available) {
            const conflictName = check.conflictProduct?.name;
            const dupMsg = conflictName
              ? `SKU/Barcode "${cleanSku}" sudah dipakai oleh produk "${conflictName}".`
              : `SKU/Barcode "${cleanSku}" sudah digunakan produk lain di outlet ini.`;
            setSkuCheckState({
              status: 'duplicate',
              message: dupMsg,
              conflictProduct: check.conflictProduct,
            });
            failValidation(dupMsg);
            return;
          }
          setSkuCheckState({ status: 'available' });
        } catch {
          // Biarkan server POST/PUT memvalidasi jika cek pra-simpan gagal jaringan
        }
      }

      await onSaveProduct(
        {
          sku: cleanSku,
          name: cleanName,
          category: formData.category,
          brand: (formData.brand.trim() || 'No Brand'),
          kondisi: formData.kondisi,
          deskripsi: formData.deskripsi.trim(),
          berat: beratNum,
          harga: hargaNum,
          hpp: hppNum,
          stok: stokNum,
          panjang: panjangNum,
          lebar: lebarNum,
          tinggi: tinggiNum,
          status: formData.status,
          image: cleanImage || '/assets/products/parfum.jpg',
        },
        editingProduct?.id
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan produk.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewBerat = parseFloat(formData.berat) || 0;
  const previewHarga = parseFloat(String(formData.harga).replace(/[^0-9]/g, '')) || 0;
  const hppVal = parseFloat(String(formData.hpp).replace(/[^0-9]/g, '')) || 0;
  const marginAmount = previewHarga > 0 && hppVal > 0 ? previewHarga - hppVal : null;
  const marginPercent = marginAmount !== null && hppVal > 0 ? ((marginAmount / hppVal) * 100).toFixed(1) : null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      title={editingProduct ? 'Edit Produk' : 'Tambah Produk'}
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
            type="submit"
            form="product-form"
            disabled={isSubmitting}
            className={MODAL_BTN_PRIMARY_CLASS}
          >
            {isSubmitting ? 'Menyimpan...' : editingProduct ? 'Simpan Perubahan' : 'Simpan Produk'}
          </button>
        </div>
      }
    >
      <form id="product-form" noValidate onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
            <GoogleIcon name="error" size={16} className="shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SECTION 1: INFORMASI PRODUK */}
        <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-200/70">
            <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <GoogleIcon name="inventory_2" size={15} />
            </div>
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              1. Informasi Produk
            </h4>
          </div>

          {/* Nama Produk */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-zinc-700">
                Nama Produk <span className="text-red-500">*</span>
              </label>
              <span className="text-xs font-mono text-zinc-400">
                {formData.name.length}/255
              </span>
            </div>
            <input
              type="text"
              required
              maxLength={255}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: Kahf Oil & Acne Care Face Wash 100ml"
              className="w-full h-10 px-3.5 text-sm font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
            />
            <p className="text-xs text-zinc-400 mt-1">
              Format: <strong>[Merek] + [Nama / Jenis Barang] + [Varian / Ukuran]</strong>
            </p>
          </div>

          {/* Kategori, Merek, Kondisi */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Kategori <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                value={formData.category}
                onChange={val => {
                  setFormData(prev => ({ ...prev, category: val }));
                  if (!editingProduct && !hasManualSkuEditRef.current) {
                    void fetchUniqueSku(val, undefined, false);
                  }
                }}
                options={categories}
                columns={2}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Merek / Brand
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, brand: 'No Brand' })}
                  className="text-xs font-medium text-primary hover:underline cursor-pointer"
                >
                  Set "No Brand"
                </button>
              </div>
              <input
                type="text"
                value={formData.brand}
                onChange={e => setFormData({ ...formData, brand: e.target.value })}
                placeholder="Contoh: Kahf, Wardah, No Brand"
                className="w-full h-10 px-3.5 text-sm font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Kondisi Produk
              </label>
              <div className="grid grid-cols-2 gap-1.5 h-10">
                {(['Baru', 'Bekas'] as ProductCondition[]).map(cond => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => setFormData({ ...formData, kondisi: cond })}
                    className={`h-full rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      formData.kondisi === cond
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                    }`}
                  >
                    <GoogleIcon name={cond === 'Baru' ? 'verified' : 'history'} size={14} />
                    <span>{cond}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Deskripsi Produk */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Deskripsi &amp; Spesifikasi Produk
            </label>
            <textarea
              rows={2}
              value={formData.deskripsi}
              onChange={e => setFormData({ ...formData, deskripsi: e.target.value })}
              placeholder="Spesifikasi, keunggulan, komposisi, atau panduan penggunaan produk..."
              className="w-full px-3.5 py-2 text-sm bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors resize-none"
            />
          </div>
        </div>

        {/* SECTION 2: HARGA, STOK & IDENTITAS BARCODE */}
        <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200/70">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <GoogleIcon name="payments" size={15} />
              </div>
              <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                2. Harga, Stok &amp; Barcode SKU
              </h4>
            </div>
            {marginPercent !== null && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                Margin: +{marginPercent}% (+Rp {marginAmount?.toLocaleString('id-ID')})
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Harga Jual (Rp) <span className="text-red-500">*</span>
              </label>
              <NumericInput
                value={formData.harga}
                onChange={val => setFormData({ ...formData, harga: String(val) })}
                prefix="Rp"
                placeholder="185.000"
                required
                className="w-full h-10 px-3.5 text-sm font-bold font-mono text-zinc-950 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Harga Modal / HPP (Rp)
              </label>
              <NumericInput
                value={formData.hpp}
                onChange={val => setFormData({ ...formData, hpp: String(val) })}
                prefix="Rp"
                placeholder="120.000"
                className="w-full h-10 px-3.5 text-sm font-bold font-mono text-zinc-700 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Stok Fisik (pcs) <span className="text-red-500">*</span>
              </label>
              <NumericInput
                value={formData.stok}
                onChange={val => setFormData({ ...formData, stok: String(val) })}
                placeholder="24"
                suffix="pcs"
                required
                className="w-full h-10 px-3.5 text-sm font-bold font-mono bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Status Produk
              </label>
              <div className="flex items-center justify-between h-10 px-3.5 bg-white border border-zinc-200 rounded-xl">
                <span
                  className={`text-sm font-semibold select-none transition-colors ${
                    formData.status === 'Aktif' ? 'text-emerald-700' : 'text-zinc-500'
                  }`}
                >
                  {formData.status === 'Aktif' ? 'Aktif (Dijual)' : 'Nonaktif'}
                </span>
                <StatusToggle
                  checked={formData.status === 'Aktif'}
                  onChange={nextChecked =>
                    setFormData(prev => ({
                      ...prev,
                      status: nextChecked ? 'Aktif' : 'Nonaktif',
                    }))
                  }
                  ariaLabel="Status Produk"
                  tooltip={
                    formData.status === 'Aktif'
                      ? 'Aktif — klik untuk nonaktifkan di kasir'
                      : 'Nonaktif — klik untuk aktifkan di kasir'
                  }
                />
              </div>
            </div>
          </div>

          {/* SKU / Barcode */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-zinc-700">
                SKU Induk / Kode Barcode (Code 128) <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleRegenerateSku}
                disabled={isGeneratingSku}
                className="text-xs font-semibold text-primary hover:text-primary-hover cursor-pointer inline-flex items-center gap-1 disabled:opacity-60"
                title="Buat kode SKU unik otomatis"
              >
                <GoogleIcon
                  name="sync"
                  size={13}
                  className={`shrink-0 ${isGeneratingSku ? 'animate-spin' : ''}`}
                />
                <span>{isGeneratingSku ? 'Membuat SKU...' : 'Generate Auto SKU'}</span>
              </button>
            </div>
            <input
              type="text"
              required
              value={formData.sku}
              onChange={e => {
                hasManualSkuEditRef.current = true;
                setFormData({ ...formData, sku: e.target.value.toUpperCase() });
              }}
              placeholder="Cth: KF-FCW-01"
              className={`w-full h-10 px-3.5 text-sm font-mono font-bold bg-white border rounded-xl outline-none focus:ring-2 uppercase transition-colors ${
                skuCheckState.status === 'duplicate'
                  ? 'border-red-400 text-red-900 focus:border-red-500 focus:ring-red-500/20'
                  : skuCheckState.status === 'available'
                  ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/20'
                  : 'border-zinc-200 focus:border-primary focus:ring-primary/20'
              }`}
            />
            {skuCheckState.status === 'checking' && (
              <p className="text-xs text-zinc-500 mt-1.5 inline-flex items-center gap-1.5">
                <GoogleIcon name="progress_activity" size={13} className="animate-spin text-primary shrink-0" />
                <span>Memeriksa ketersediaan kode SKU / barcode...</span>
              </p>
            )}
            {skuCheckState.status === 'duplicate' && (
              <div className="mt-1.5 p-2.5 rounded-xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start sm:items-center gap-1.5 min-w-0 text-xs font-semibold text-red-700">
                  <GoogleIcon name="error" size={14} className="shrink-0 text-red-600 mt-0.5 sm:mt-0" />
                  <span>{skuCheckState.message}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRegenerateSku}
                  disabled={isGeneratingSku}
                  className="shrink-0 h-7 px-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-60"
                >
                  <GoogleIcon name="auto_awesome" size={12} />
                  <span>Pakai SKU Unik</span>
                </button>
              </div>
            )}
            {skuCheckState.status === 'available' && formData.sku.trim() && (
              <p className="text-xs font-semibold text-emerald-700 mt-1.5 inline-flex items-center gap-1">
                <GoogleIcon name="check_circle" size={13} className="shrink-0 text-emerald-600" />
                <span>SKU unik &amp; siap digunakan pada outlet ini</span>
              </p>
            )}
          </div>
        </div>

        {/* SECTION 3: PENGIRIMAN & SPESIFIKASI LOGISTIK */}
        <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200/70">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <GoogleIcon name="local_shipping" size={15} />
              </div>
              <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                3. Pengiriman &amp; Logistik Ekspedisi
              </h4>
            </div>
            <span className="text-xs text-zinc-400">Untuk kalkulasi ongkir kurir</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Berat Paket (gr) <span className="text-red-500">*</span>
              </label>
              <NumericInput
                value={formData.berat}
                onChange={val => setFormData({ ...formData, berat: String(val) })}
                allowDecimal={true}
                placeholder="50"
                suffix="gr"
                required
                className="w-full h-10 px-3.5 text-sm font-bold font-mono bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Panjang (cm)
              </label>
              <NumericInput
                value={formData.panjang}
                onChange={val => setFormData({ ...formData, panjang: String(val) })}
                allowDecimal={true}
                placeholder="10"
                suffix="cm"
                className="w-full h-10 px-3.5 text-sm font-mono bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Lebar (cm)
              </label>
              <NumericInput
                value={formData.lebar}
                onChange={val => setFormData({ ...formData, lebar: String(val) })}
                allowDecimal={true}
                placeholder="5"
                suffix="cm"
                className="w-full h-10 px-3.5 text-sm font-mono bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Tinggi (cm)
              </label>
              <NumericInput
                value={formData.tinggi}
                onChange={val => setFormData({ ...formData, tinggi: String(val) })}
                allowDecimal={true}
                placeholder="15"
                suffix="cm"
                className="w-full h-10 px-3.5 text-sm font-mono bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: UPLOAD FOTO 1:1 (AUTO KOMPRES WEBP) & PRATINJAU BARCODE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Upload Foto 1:1 Auto Kompres WebP */}
          <div className="lg:col-span-7 bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200/70">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <GoogleIcon name="add_a_photo" size={15} />
                </div>
                <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                  4. Foto Produk 1:1 (WebP)
                </h4>
              </div>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                Auto Kompres WebP
              </span>
            </div>

            {/* Hidden Native File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Upload Area / Image Preview */}
            <div className="space-y-3">
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative rounded-2xl border-2 border-dashed transition-all p-3 sm:p-4 ${
                  isDragging
                    ? 'border-primary bg-primary-soft/40 ring-4 ring-primary/10'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                {isCompressing ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-primary">
                    <GoogleIcon name="progress_activity" size={28} className="animate-spin" />
                    <span className="text-xs font-bold">Memotong 1:1 &amp; Mengompres ke WebP...</span>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* 1:1 Square Thumbnail */}
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 shrink-0 shadow-2xs group">
                      <img
                        src={formData.image || '/assets/products/parfum.jpg'}
                        alt="Preview Foto Produk 1:1"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-1 left-1 bg-zinc-950/70 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-xs">
                        1:1
                      </span>
                      {formData.image.startsWith('data:image/webp') && (
                        <span className="absolute bottom-1 right-1 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                          WebP
                        </span>
                      )}
                    </div>

                    {/* Upload Controls & Details */}
                    <div className="flex-1 text-center sm:text-left min-w-0">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-8 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                        >
                          <GoogleIcon name="upload" size={14} />
                          <span>Pilih Foto Baru</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, image: '/assets/products/parfum.jpg' }));
                            setCompressionInfo(null);
                          }}
                          className="h-8 px-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <GoogleIcon name="refresh" size={13} />
                          <span>Reset</span>
                        </button>
                      </div>

                      <p className="text-xs text-zinc-600 font-medium leading-relaxed">
                        Tarik file foto ke sini atau klik tombol di atas.
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Foto otomatis dipotong simetris 1:1 &amp; dikompres ke WebP (600x600 px).
                      </p>

                      {compressionInfo && (
                        <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          <GoogleIcon name="check_circle" size={12} className="text-emerald-600" />
                          <span>
                            Dikompresi: {formatBytes(compressionInfo.sizeBytes)} (dari {formatBytes(compressionInfo.originalSizeBytes)})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Preset Foto Cepat */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
                  Atau pilih cepat dari preset gambar retail:
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { label: 'Parfum', img: '/assets/products/parfum.jpg' },
                    { label: 'Serum', img: '/assets/products/serum.jpg' },
                    { label: 'Krim', img: '/assets/products/cream.jpg' },
                    { label: 'Body Care', img: '/assets/products/bodycare.jpg' },
                    { label: 'Make Up', img: '/assets/products/makeup.jpg' },
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, image: p.img });
                        setCompressionInfo(null);
                      }}
                      className={`p-1.5 border rounded-xl flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        formData.image === p.img
                          ? 'border-primary bg-primary-soft ring-2 ring-primary/20'
                          : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <img src={p.img} alt={p.label} className="w-8 h-8 object-cover rounded-lg aspect-square" />
                      <span className="text-xs font-semibold text-zinc-700">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pratinjau Barcode Tag */}
          <div className="lg:col-span-5 bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200/70 mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <GoogleIcon name="barcode_scanner" size={15} />
                  </div>
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                    Label Barcode
                  </h4>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  Siap Scan
                </span>
              </div>

              {formData.sku.trim() ? (
                <div className="flex justify-center items-center py-2">
                  <JewelryBarcodeTag
                    compact
                    format="hybrid"
                    product={{
                      sku: formData.sku.trim().toUpperCase(),
                      name: formData.name.trim() || 'Nama Produk',
                      category: formData.category,
                      berat: previewBerat,
                      harga: previewHarga,
                    }}
                  />
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-zinc-400">
                  Masukkan SKU untuk melihat pratinjau barcode
                </div>
              )}
            </div>

            <p className="text-xs text-zinc-400 text-center mt-3 pt-2 border-t border-zinc-200/60">
              Standar Code 128 &amp; QR Code (Kompatibel Semua Scanner POS)
            </p>
          </div>
        </div>
      </form>
    </ModalShell>
  );
};
