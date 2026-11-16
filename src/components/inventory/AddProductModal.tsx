import React, { useState, useEffect } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Product, ProductCondition, ProductStatus } from '../../types';
import { CustomSelect } from '../common/CustomSelect';
import { NumericInput } from '../common/NumericInput';
import { generateJewelrySku, isValidCode128 } from '../../utils/barcode';
import { JewelryBarcodeTag } from '../common/JewelryBarcodeTag';
import { useToast } from '../../contexts/ToastContext';
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
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      const defaultCategory = categories[0] || 'Parfum';
      if (editingProduct) {
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
      }
    }
  }, [isOpen, editingProduct, categories]);

  const handleRegenerateSku = () => {
    setFormData(prev => ({
      ...prev,
      sku: generateJewelrySku(prev.category, prev.name),
    }));
  };

  const failValidation = (msg: string) => {
    setErrorMsg(msg);
    showToast('error', msg, 'Validasi Form Produk');
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
      failValidation('Berat / netto produk harus lebih dari 0 gram (standar ongkir).');
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
      failValidation('URL foto produk tidak valid. Gunakan awalan http:// atau https://.');
      return;
    }

    setIsSubmitting(true);
    try {
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
      size="xl"
      title={editingProduct ? 'Edit Produk (Standar Shopee)' : 'Tambah Produk Baru (Standar Shopee)'}
      subtitle={
        editingProduct
          ? `Perbarui informasi katalog, harga, stok, dan logistik SKU ${editingProduct.sku}`
          : 'Lengkapi spesifikasi produk sesuai standar Seller Centre & sistem POS kasir'
      }
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
      <form id="product-form" noValidate onSubmit={handleSubmit} className="space-y-6">
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
            <GoogleIcon name="error" size={16} className="shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SECTION 1: INFORMASI DASAR (STANDAR SHOPEE) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Informasi Dasar Produk
              </h4>
            </div>
            <span className="text-[11px] text-zinc-400">Standar Shopee Seller Centre</span>
          </div>

          {/* Nama Produk */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs sm:text-sm font-semibold text-zinc-800">
                Nama Produk <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] font-mono text-zinc-400">
                {formData.name.length}/255 karakter
              </span>
            </div>
            <input
              type="text"
              required
              maxLength={255}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: Kahf Oil & Acne Care Face Wash 100ml"
              className="w-full px-3.5 py-2.5 text-sm font-medium bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
            />
            <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
              <GoogleIcon name="info" size={13} className="shrink-0 text-zinc-400" />
              <span>Rekomendasi Shopee: <strong>[Merek] + [Jenis/Model Barang] + [Spesifikasi/Ukuran]</strong></span>
            </p>
          </div>

          {/* Kategori, Merek / Brand, Kondisi */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-zinc-800 mb-1.5">
                Kategori <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                value={formData.category}
                onChange={val => setFormData({ ...formData, category: val })}
                options={categories}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs sm:text-sm font-semibold text-zinc-800">
                  Merek / Brand
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, brand: 'No Brand' })}
                  className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                >
                  Set "No Brand"
                </button>
              </div>
              <input
                type="text"
                value={formData.brand}
                onChange={e => setFormData({ ...formData, brand: e.target.value })}
                placeholder="Contoh: Kahf, Wardah, atau No Brand"
                className="w-full px-3.5 py-2.5 text-sm font-medium bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-zinc-800 mb-1.5">
                Kondisi Produk
              </label>
              <div className="grid grid-cols-2 gap-2 h-10">
                {(['Baru', 'Bekas'] as ProductCondition[]).map(cond => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => setFormData({ ...formData, kondisi: cond })}
                    className={`h-full rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      formData.kondisi === cond
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 border border-zinc-200'
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
            <label className="block text-xs sm:text-sm font-semibold text-zinc-800 mb-1.5">
              Deskripsi &amp; Spesifikasi Produk
            </label>
            <textarea
              rows={2}
              value={formData.deskripsi}
              onChange={e => setFormData({ ...formData, deskripsi: e.target.value })}
              placeholder="Jelaskan detail spesifikasi, manfaat, komposisi, atau panduan penggunaan produk..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors resize-none"
            />
          </div>
        </div>

        {/* SECTION 2: INFORMASI PENJUALAN & INVENTARIS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Harga, Stok &amp; Barcode SKU
              </h4>
            </div>
            {marginPercent !== null && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Margin: +{marginPercent}% (+Rp {marginAmount?.toLocaleString('id-ID')})
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-zinc-800 mb-1.5">
                Harga Jual (Rp) <span className="text-red-500">*</span>
              </label>
              <NumericInput
                value={formData.harga}
                onChange={val => setFormData({ ...formData, harga: String(val) })}
                prefix="Rp"
                placeholder="185.000"
                required
                className="w-full px-3.5 py-2 text-sm font-bold font-mono text-zinc-950 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-zinc-800 mb-1.5">
                Harga Modal / HPP (Rp)
              </label>
              <NumericInput
                value={formData.hpp}
                onChange={val => setFormData({ ...formData, hpp: String(val) })}
                prefix="Rp"
                placeholder="120.000"
                className="w-full px-3.5 py-2 text-sm font-bold font-mono text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-zinc-800 mb-1.5">
                Stok Fisik (pcs) <span className="text-red-500">*</span>
              </label>
              <NumericInput
                value={formData.stok}
                onChange={val => setFormData({ ...formData, stok: String(val) })}
                placeholder="24"
                suffix="pcs"
                required
                className="w-full px-3.5 py-2 text-sm font-bold font-mono bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-zinc-800 mb-1.5">
                Status Produk
              </label>
              <div className="grid grid-cols-2 gap-1.5 h-9">
                {(['Aktif', 'Nonaktif'] as ProductStatus[]).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFormData({ ...formData, status: st })}
                    className={`h-full rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      formData.status === st
                        ? st === 'Aktif'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-zinc-600 text-white shadow-xs'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${st === 'Aktif' ? 'bg-emerald-300' : 'bg-zinc-400'}`} />
                    <span>{st}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SKU / Barcode */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs sm:text-sm font-semibold text-zinc-800">
                SKU Induk / Kode Barcode (Code 128) <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleRegenerateSku}
                className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 cursor-pointer inline-flex items-center gap-1"
                title="Generate kode SKU otomatis"
              >
                <GoogleIcon name="sync" size={13} className="shrink-0" />
                <span>Auto SKU</span>
              </button>
            </div>
            <input
              type="text"
              required
              value={formData.sku}
              onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
              placeholder="Cth: KF-FCW-01"
              className="w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white uppercase transition-colors"
            />
          </div>
        </div>

        {/* SECTION 3: PENGIRIMAN & LOGISTIK (STANDAR SHOPEE) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                3
              </span>
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Pengiriman &amp; Logistik Ekspedisi
              </h4>
            </div>
            <span className="text-[11px] text-zinc-400">Untuk kalkulasi ongkir kurir</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-zinc-800 mb-1.5">
                Berat Paket (gr) <span className="text-red-500">*</span>
              </label>
              <NumericInput
                value={formData.berat}
                onChange={val => setFormData({ ...formData, berat: String(val) })}
                allowDecimal={true}
                placeholder="50"
                suffix="gr"
                required
                className="w-full px-3.5 py-2 text-sm font-bold font-mono bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-zinc-800 mb-1.5">
                Panjang (cm)
              </label>
              <NumericInput
                value={formData.panjang}
                onChange={val => setFormData({ ...formData, panjang: String(val) })}
                allowDecimal={true}
                placeholder="10"
                suffix="cm"
                className="w-full px-3.5 py-2 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-zinc-800 mb-1.5">
                Lebar (cm)
              </label>
              <NumericInput
                value={formData.lebar}
                onChange={val => setFormData({ ...formData, lebar: String(val) })}
                allowDecimal={true}
                placeholder="5"
                suffix="cm"
                className="w-full px-3.5 py-2 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-zinc-800 mb-1.5">
                Tinggi (cm)
              </label>
              <NumericInput
                value={formData.tinggi}
                onChange={val => setFormData({ ...formData, tinggi: String(val) })}
                allowDecimal={true}
                placeholder="15"
                suffix="cm"
                className="w-full px-3.5 py-2 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: MEDIA FOTO & PRATINJAU BARCODE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                4
              </span>
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Foto Produk &amp; Pratinjau Label Barcode
              </h4>
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-zinc-800 mb-1.5">
              Pilihan Foto Cepat (Preset Gambar)
            </label>
            <div className="grid grid-cols-5 gap-2 mb-2.5">
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
                  onClick={() => setFormData({ ...formData, image: p.img })}
                  className={`p-2 border rounded-xl flex flex-col items-center gap-1 cursor-pointer transition-all ${
                    formData.image === p.img
                      ? 'border-primary bg-primary-soft ring-2 ring-primary/20'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <img src={p.img} alt={p.label} className="w-10 h-10 object-cover rounded-lg" />
                  <span className="text-[11px] font-semibold text-zinc-700">{p.label}</span>
                </button>
              ))}
            </div>
            <input
              type="url"
              value={formData.image}
              onChange={e => setFormData({ ...formData, image: e.target.value })}
              placeholder="Atau masukkan URL foto eksternal (https://...)"
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white text-zinc-600 font-medium transition-colors"
            />
          </div>

          {/* Live Code 128 + QR Code Preview */}
          {formData.sku.trim() && (
            <div className="bg-zinc-50 border border-zinc-200/90 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                  <GoogleIcon name="barcode_scanner" size={14} className="text-primary" />
                  <span>Pratinjau Label Barcode (Code 128 &amp; QR)</span>
                </span>
                <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Siap Scan POS Kasir
                </span>
              </div>
              <div className="flex justify-center py-1">
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
            </div>
          )}
        </div>
      </form>
    </ModalShell>
  );
};
