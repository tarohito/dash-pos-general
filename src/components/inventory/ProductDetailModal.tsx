import React, { useEffect, useState } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Product } from '../../types';
import { formatIDR } from '../../utils/formatters';
import { SHOPEE_ATTRIBUTE_LIBRARY } from '../../utils/shopeeCategories';
import { useToast } from '../../contexts/ToastContext';
import { MoneyAmount } from '../common/MoneyAmount';
import {
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_SECONDARY_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
  BTN_SECONDARY_CLASS,
} from '../common/ModalShell';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onPrintBarcode: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  canManageInventory?: boolean;
}

const ATTRIBUTE_LABEL_MAP = new Map(
  SHOPEE_ATTRIBUTE_LIBRARY.map(field => [field.key, field.label])
);

function formatAttributeLabel(key: string): string {
  const mapped = ATTRIBUTE_LABEL_MAP.get(key);
  if (mapped) return mapped;
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onPrintBarcode,
  onEditProduct,
  canManageInventory = true,
}) => {
  const { showToast } = useToast();
  const [imgFailed, setImgFailed] = useState(false);
  const [copiedSku, setCopiedSku] = useState(false);

  useEffect(() => {
    setImgFailed(false);
    setCopiedSku(false);
  }, [product?.id, product?.image]);

  if (!product) return null;

  const hasHpp = Boolean(product.hpp && product.hpp > 0);
  const margin = hasHpp && product.hpp ? product.harga - product.hpp : null;
  const marginPct =
    margin !== null && product.hpp && product.hpp > 0
      ? ((margin / product.hpp) * 100).toFixed(1)
      : null;

  const hasDimensions =
    (product.panjang ?? 0) > 0 ||
    (product.lebar ?? 0) > 0 ||
    (product.tinggi ?? 0) > 0;

  const isActive = (product.status ?? 'Aktif') === 'Aktif';
  const stockState =
    product.stok <= 0
      ? { label: 'Habis', textClass: 'text-red-600' }
      : product.stok <= 5
      ? { label: 'Stok Menipis', textClass: 'text-amber-600' }
      : { label: 'Stok Aman', textClass: 'text-emerald-700' };

  const attributeEntries = Object.entries(product.attributes ?? {}).filter(
    ([, value]) => typeof value === 'string' && value.trim().length > 0
  );

  const promoPrice =
    product.isPromo && product.promoDiscountPercent && product.promoDiscountPercent > 0
      ? Math.max(0, Math.round(product.harga * (1 - product.promoDiscountPercent / 100)))
      : null;

  const handleCopySku = async () => {
    try {
      await navigator.clipboard.writeText(product.sku);
      setCopiedSku(true);
      showToast('success', `SKU "${product.sku}" disalin ke clipboard.`);
      setTimeout(() => setCopiedSku(false), 1800);
    } catch {
      showToast('error', 'Gagal menyalin SKU ke clipboard.');
    }
  };

  return (
    <ModalShell
      isOpen={Boolean(product)}
      onClose={onClose}
      size="2xl"
      title="Detail Produk"
      footer={
        <div className={MODAL_FOOTER_END_CLASS}>
          <button
            type="button"
            onClick={onClose}
            className={MODAL_BTN_SECONDARY_CLASS}
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => {
              const target = product;
              onClose();
              onPrintBarcode(target);
            }}
            className={BTN_SECONDARY_CLASS}
          >
            <GoogleIcon name="barcode_scanner" size={15} className="shrink-0" />
            <span>Cetak Barcode</span>
          </button>
          {canManageInventory && (
            <button
              type="button"
              onClick={() => {
                const target = product;
                onClose();
                onEditProduct(target);
              }}
              className={MODAL_BTN_PRIMARY_CLASS}
            >
              <GoogleIcon name="edit" size={15} className="shrink-0" />
              <span>Edit Barang</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {/* Identity & Pricing Summary Header */}
        <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
            {product.image && !imgFailed ? (
              <img
                src={product.image}
                alt={product.name}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-20 h-20 sm:w-22 sm:h-22 aspect-square rounded-xl object-cover border border-zinc-200 bg-white shrink-0"
              />
            ) : (
              <div className="w-20 h-20 sm:w-22 sm:h-22 aspect-square rounded-xl bg-zinc-100 border border-zinc-200 shrink-0 flex items-center justify-center text-zinc-400">
                <GoogleIcon name="deployed_code" size={30} />
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <h4 className="font-bold text-base sm:text-lg text-zinc-950 leading-snug break-words">
                  {product.name}
                </h4>
              </div>

              <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-zinc-600">
                <button
                  type="button"
                  onClick={() => void handleCopySku()}
                  title="Klik untuk salin SKU"
                  className="inline-flex items-center gap-1 font-mono font-bold text-zinc-800 hover:text-primary transition-colors cursor-pointer"
                >
                  <span>{product.sku}</span>
                  <GoogleIcon
                    name={copiedSku ? 'check' : 'content_copy'}
                    size={12}
                    className={copiedSku ? 'text-emerald-600' : 'text-zinc-400'}
                  />
                </button>
                <span aria-hidden="true" className="text-zinc-300">&middot;</span>
                <span className="font-medium text-zinc-700">{product.category}</span>
                {product.brand && product.brand !== 'No Brand' && (
                  <>
                    <span aria-hidden="true" className="text-zinc-300">&middot;</span>
                    <span className="text-zinc-600">{product.brand}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                  }`}
                >
                  {isActive ? 'Aktif' : 'Nonaktif'}
                </span>
                {product.isPromo && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <GoogleIcon name="sell" size={12} className="text-amber-600 shrink-0" />
                    <span>
                      {product.promoLabel || 'Promo'}
                      {product.promoDiscountPercent ? ` (-${product.promoDiscountPercent}%)` : ''}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="pt-3 sm:pt-0 sm:pl-4 border-t sm:border-t-0 sm:border-l border-zinc-200/80 flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center shrink-0 sm:min-w-[165px]">
            <span className="text-xs font-medium text-zinc-500">Harga Jual</span>
            <div className="text-right">
              <MoneyAmount
                value={product.harga}
                maxFontPx={22}
                minFontPx={15}
                className="font-bold font-mono text-primary tracking-tight tabular-nums"
              />
              {promoPrice !== null && (
                <p className="text-xs font-mono font-semibold text-amber-700 tabular-nums mt-0.5">
                  Harga Promo: {formatIDR(promoPrice)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 4-Column Financial & Inventory Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 min-w-0">
            <span className="text-xs text-zinc-500 block mb-1">Harga Modal (HPP)</span>
            <span className="font-mono font-bold text-zinc-950 text-sm tabular-nums block truncate">
              {hasHpp && product.hpp ? formatIDR(product.hpp) : '-'}
            </span>
          </div>

          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 min-w-0">
            <span className="text-xs text-zinc-500 block mb-1">Estimasi Margin</span>
            {margin !== null && marginPct !== null ? (
              <div className="min-w-0">
                <span
                  className={`font-mono font-bold text-sm tabular-nums block truncate ${
                    margin > 0
                      ? 'text-emerald-700'
                      : margin < 0
                      ? 'text-red-600'
                      : 'text-zinc-700'
                  }`}
                >
                  {margin > 0 ? `+${marginPct}%` : `${marginPct}%`}
                </span>
                <span className="text-xs font-mono text-zinc-500 tabular-nums block truncate">
                  {formatIDR(margin)}
                </span>
              </div>
            ) : (
              <span className="font-mono font-bold text-zinc-400 text-sm">-</span>
            )}
          </div>

          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 min-w-0">
            <span className="text-xs text-zinc-500 block mb-1">Stok Fisik</span>
            <span className="font-mono font-bold text-zinc-950 text-sm tabular-nums block">
              {product.stok} pcs
            </span>
            <span className={`text-xs font-semibold block ${stockState.textClass}`}>
              {stockState.label}
            </span>
          </div>

          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 min-w-0">
            <span className="text-xs text-zinc-500 block mb-1">Total Terjual</span>
            <span className="font-mono font-bold text-zinc-950 text-sm tabular-nums block">
              {product.salesCount ?? 0} pcs
            </span>
            <span className="text-xs text-zinc-500 block">Riwayat outlet</span>
          </div>
        </div>

        {/* Structured Details: Catalog & Logistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-4">
            <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider pb-2 border-b border-zinc-200/70 mb-3">
              Informasi Katalog
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="text-zinc-500 shrink-0">Kode SKU</span>
                <span className="font-mono font-semibold text-zinc-900 text-right break-all">
                  {product.sku}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-zinc-500 shrink-0">Kategori</span>
                <span className="font-semibold text-zinc-900 text-right break-words min-w-0">
                  {product.category}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-zinc-500 shrink-0">Merek / Brand</span>
                <span className="font-semibold text-zinc-900 text-right break-words min-w-0">
                  {product.brand || 'No Brand'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-4">
            <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider pb-2 border-b border-zinc-200/70 mb-3">
              Logistik &amp; Dimensi Paket
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="text-zinc-500 shrink-0">Berat Paket</span>
                <span className="font-mono font-semibold text-zinc-900 tabular-nums text-right">
                  {Number(product.berat.toFixed(2))} gr
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-zinc-500 shrink-0">Panjang &times; Lebar &times; Tinggi</span>
                <span className="font-mono font-semibold text-zinc-900 tabular-nums text-right">
                  {hasDimensions
                    ? `${product.panjang ?? 0} × ${product.lebar ?? 0} × ${product.tinggi ?? 0} cm`
                    : '-'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-zinc-500 shrink-0">Status Katalog</span>
                <span className="font-semibold text-zinc-900 text-right">
                  {isActive ? 'Tersedia di Kasir' : 'Disembunyikan (Nonaktif)'}
                </span>
              </div>
              {product.createdAt && (
                <div className="flex items-start justify-between gap-4">
                  <span className="text-zinc-500 shrink-0">Tanggal Terdaftar</span>
                  <span className="font-mono text-zinc-700 tabular-nums text-right">
                    {new Date(product.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Category Specification Attributes (if any) */}
        {attributeEntries.length > 0 && (
          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-4">
            <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider pb-2 border-b border-zinc-200/70 mb-3">
              Atribut Spesifikasi
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              {attributeEntries.map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <span className="text-zinc-500 shrink-0">{formatAttributeLabel(key)}</span>
                  <span className="font-semibold text-zinc-900 text-right break-words min-w-0">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Product Description */}
        {product.deskripsi && product.deskripsi.trim().length > 0 && (
          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-4">
            <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider pb-2 border-b border-zinc-200/70 mb-2.5">
              Deskripsi &amp; Catatan Produk
            </div>
            <p className="text-zinc-700 leading-relaxed whitespace-pre-line break-words">
              {product.deskripsi}
            </p>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
