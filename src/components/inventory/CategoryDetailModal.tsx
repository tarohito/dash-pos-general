import React, { useState } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { CategoryItem, CategoryStatsItem, Product } from '../../types';
import { formatIDR } from '../../utils/formatters';
import { suggestSkuPrefix } from '../../utils/shopeeCategories';
import {
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_SECONDARY_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
} from '../common/ModalShell';

export interface CategoryDetailRow {
  name: string;
  count: number;
  totalStok: number;
  createdAt?: string;
}

interface CategoryDetailModalProps {
  category: CategoryDetailRow | null;
  categoryItem?: CategoryItem | null;
  stats?: CategoryStatsItem;
  totalCatalogSku: number;
  products: Product[];
  isLoadingProducts: boolean;
  onClose: () => void;
  onEditCategory: (categoryName: string) => void;
}

const ProductRowThumb: React.FC<{ image?: string; name: string }> = ({ image, name }) => {
  const [failed, setFailed] = useState(false);

  if (!image || failed) {
    return (
      <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200/80 shrink-0 flex items-center justify-center text-zinc-400">
        <GoogleIcon name="deployed_code" size={16} />
      </div>
    );
  }

  return (
    <img
      src={image}
      alt={name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-10 h-10 aspect-square rounded-lg object-cover border border-zinc-200/80 bg-white shrink-0"
    />
  );
};

export const CategoryDetailModal: React.FC<CategoryDetailModalProps> = ({
  category,
  categoryItem,
  stats,
  totalCatalogSku,
  products,
  isLoadingProducts,
  onClose,
  onEditCategory,
}) => {
  if (!category) return null;

  const sharePercent =
    totalCatalogSku > 0 ? Math.round((category.count / totalCatalogSku) * 100) : 0;
  const totalGram = stats?.directGram ?? stats?.totalGram ?? 0;
  const childrenCount = stats?.childrenCount ?? 0;
  const attributeFields = categoryItem?.attributeFields ?? [];
  const skuPrefix = categoryItem?.skuPrefix?.trim() || suggestSkuPrefix(category.name);
  const isFilled = category.count > 0;
  const isActive = categoryItem?.isActive ?? true;
  const iconName = categoryItem?.icon?.trim() || 'category';

  return (
    <ModalShell
      isOpen={Boolean(category)}
      onClose={onClose}
      size="2xl"
      title="Detail Kategori"
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
              const targetName = category.name;
              onClose();
              onEditCategory(targetName);
            }}
            className={MODAL_BTN_PRIMARY_CLASS}
          >
            <GoogleIcon name="edit" size={15} className="shrink-0" />
            <span>Edit Kategori</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {/* Identity & Catalog Share Summary Header */}
        <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
            <div className="w-16 h-16 aspect-square rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-primary shrink-0 shadow-2xs">
              <GoogleIcon name={iconName} size={28} />
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <h4 className="font-bold text-base sm:text-lg text-zinc-950 leading-snug break-words">
                {category.name}
              </h4>

              <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-zinc-600">
                <span className="font-mono font-bold text-zinc-800">
                  Prefix {skuPrefix}
                </span>
                <span aria-hidden="true" className="text-zinc-300">&middot;</span>
                <span className="font-medium text-zinc-700">
                  {categoryItem?.parentName
                    ? `Sub-kategori dari ${categoryItem.parentName}`
                    : 'Kategori Utama'}
                </span>
                {category.createdAt && (
                  <>
                    <span aria-hidden="true" className="text-zinc-300">&middot;</span>
                    <span className="tabular-nums text-zinc-500">
                      {new Date(category.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${
                    isFilled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                  }`}
                >
                  {isFilled ? 'Terisi' : 'Kosong'}
                </span>
                {!isActive && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border bg-zinc-100 text-zinc-600 border-zinc-200">
                    Nonaktif
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="pt-3 sm:pt-0 sm:pl-4 border-t sm:border-t-0 sm:border-l border-zinc-200/80 flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center shrink-0 sm:min-w-[160px]">
            <span className="text-xs font-medium text-zinc-500">Porsi Katalog</span>
            <div className="text-right">
              <span className="font-bold font-mono text-2xl text-primary tracking-tight tabular-nums block">
                {sharePercent}%
              </span>
              <span className="text-xs font-mono text-zinc-500 tabular-nums block">
                {category.count} dari {totalCatalogSku} SKU
              </span>
            </div>
          </div>
        </div>

        {/* 4-Column Category Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 min-w-0">
            <span className="text-xs text-zinc-500 block mb-1">Jumlah Produk</span>
            <span className="font-mono font-bold text-zinc-950 text-sm tabular-nums block">
              {category.count} SKU
            </span>
            <span className="text-xs text-zinc-500 block">Terdaftar langsung</span>
          </div>

          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 min-w-0">
            <span className="text-xs text-zinc-500 block mb-1">Total Stok Fisik</span>
            <span className="font-mono font-bold text-zinc-950 text-sm tabular-nums block">
              {category.totalStok} pcs
            </span>
            <span className="text-xs text-zinc-500 block">Akumulasi unit</span>
          </div>

          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 min-w-0">
            <span className="text-xs text-zinc-500 block mb-1">Total Berat Stok</span>
            <span className="font-mono font-bold text-zinc-950 text-sm tabular-nums block">
              {Number(totalGram.toFixed(2))} gr
            </span>
            <span className="text-xs text-zinc-500 block">Akumulasi bobot</span>
          </div>

          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3.5 min-w-0">
            <span className="text-xs text-zinc-500 block mb-1">
              {childrenCount > 0 ? 'Sub-Kategori' : 'Atribut Kategori'}
            </span>
            <span className="font-mono font-bold text-zinc-950 text-sm tabular-nums block">
              {childrenCount > 0
                ? `${childrenCount} Sub`
                : `${attributeFields.length} Field`}
            </span>
            <span className="text-xs text-zinc-500 block">
              {childrenCount > 0 ? 'Cabang hierarki' : 'Spesifikasi produk'}
            </span>
          </div>
        </div>

        {/* Structured Two-Column Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-4">
            <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider pb-2 border-b border-zinc-200/70 mb-3">
              Informasi Kategori
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="text-zinc-500 shrink-0">Nama Kategori</span>
                <span className="font-semibold text-zinc-900 text-right break-words min-w-0">
                  {category.name}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-zinc-500 shrink-0">Hierarki</span>
                <span className="font-semibold text-zinc-900 text-right break-words min-w-0">
                  {categoryItem?.parentName
                    ? `Sub dari ${categoryItem.parentName}`
                    : 'Kategori Utama'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-zinc-500 shrink-0">Prefix SKU</span>
                <span className="font-mono font-semibold text-zinc-900 text-right">
                  {skuPrefix}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-zinc-500 shrink-0">Status Penggunaan</span>
                <span className="font-semibold text-zinc-900 text-right">
                  {isFilled ? `Terisi (${category.count} SKU)` : 'Belum ada produk'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-4">
            <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider pb-2 border-b border-zinc-200/70 mb-3">
              {attributeFields.length > 0 ? 'Atribut Spesifikasi' : 'Ringkasan Katalog'}
            </div>
            {attributeFields.length > 0 ? (
              <div className="space-y-2 text-sm">
                {attributeFields.slice(0, 5).map(field => (
                  <div key={field.key} className="flex items-start justify-between gap-4">
                    <span className="text-zinc-600 truncate min-w-0">{field.label}</span>
                    <span className="font-mono text-xs font-semibold text-zinc-500 shrink-0">
                      {field.type === 'select' ? 'Pilihan' : 'Teks'}
                    </span>
                  </div>
                ))}
                {attributeFields.length > 5 && (
                  <p className="text-xs text-zinc-500 pt-1">
                    +{attributeFields.length - 5} atribut lainnya
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-zinc-500 shrink-0">Status Katalog</span>
                  <span className="font-semibold text-zinc-900 text-right">
                    {isActive ? 'Aktif di Katalog' : 'Nonaktif'}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-zinc-500 shrink-0">Total SKU Gabungan</span>
                  <span className="font-mono font-semibold text-zinc-900 tabular-nums text-right">
                    {stats?.count ?? category.count} SKU
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-zinc-500 shrink-0">Total Stok Gabungan</span>
                  <span className="font-mono font-semibold text-zinc-900 tabular-nums text-right">
                    {stats?.totalStok ?? category.totalStok} pcs
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-zinc-500 shrink-0">Deskripsi</span>
                  <span className="text-zinc-700 text-right break-words min-w-0">
                    {categoryItem?.description?.trim() || '-'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description Block (when attributes card occupies right column & description exists) */}
        {attributeFields.length > 0 && categoryItem?.description?.trim() && (
          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-4">
            <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider pb-2 border-b border-zinc-200/70 mb-2.5">
              Deskripsi Kategori
            </div>
            <p className="text-zinc-700 leading-relaxed whitespace-pre-line break-words">
              {categoryItem.description}
            </p>
          </div>
        )}

        {/* Single-Level Product List Card (No Nested Card Border) */}
        <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-zinc-50/80 border-b border-zinc-200/70 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
              Produk dalam Kategori ({category.count})
            </span>
            {!isLoadingProducts && category.count > products.length && products.length > 0 && (
              <span className="text-xs text-zinc-500 tabular-nums">
                Menampilkan {products.length} terbaru
              </span>
            )}
          </div>

          {isLoadingProducts ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-zinc-500">
              <GoogleIcon name="progress_activity" size={16} className="animate-spin text-primary" />
              <span>Memuat produk dalam kategori...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="py-8 px-4 text-center text-zinc-500">
              <GoogleIcon name="inventory_2" size={26} className="mx-auto mb-1.5 text-zinc-300" />
              <p className="text-xs font-medium">
                Belum ada produk yang menggunakan kategori ini.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 max-h-60 overflow-y-auto">
              {products.map(prod => (
                <div
                  key={prod.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <ProductRowThumb image={prod.image} name={prod.name} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-zinc-900 text-xs sm:text-sm truncate">
                        {prod.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono truncate">
                        <span>{prod.sku}</span>
                        <span aria-hidden="true" className="text-zinc-300">&middot;</span>
                        <span
                          className={`tabular-nums font-semibold ${
                            prod.stok <= 0
                              ? 'text-red-600'
                              : prod.stok <= 5
                              ? 'text-amber-600'
                              : 'text-zinc-600'
                          }`}
                        >
                          {prod.stok} pcs
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-zinc-950 text-xs sm:text-sm tabular-nums block">
                      {formatIDR(prod.harga)}
                    </span>
                    <span className="text-[11px] text-zinc-500 tabular-nums block">
                      {Number(prod.berat.toFixed(2))} gr
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
};
