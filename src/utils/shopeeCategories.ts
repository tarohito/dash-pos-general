import { CategoryAttributeField, CategoryItem } from '../types';
import type { CustomSelectOption } from '../components/common/CustomSelect';

export const SHOPEE_ATTRIBUTE_LIBRARY: CategoryAttributeField[] = [
  {
    key: 'ukuran_varian',
    label: 'Ukuran / Kapasitas / Varian',
    type: 'text',
    placeholder: 'Cth: 100 ml / Size L / 256 GB',
  },
  {
    key: 'warna_motif',
    label: 'Warna / Motif',
    type: 'text',
    placeholder: 'Cth: Hitam Matte, Putih, Rose Gold',
  },
  {
    key: 'bahan_material',
    label: 'Bahan / Material',
    type: 'text',
    placeholder: 'Cth: Katun Combed 30s, Aluminium, Kaca',
  },
  {
    key: 'masa_garansi',
    label: 'Masa Garansi',
    type: 'select',
    placeholder: 'Pilih masa garansi',
    options: ['Tanpa Garansi', '1 Bulan', '3 Bulan', '6 Bulan', '12 Bulan', '24 Bulan', 'Garansi Seumur Hidup'],
  },
  {
    key: 'jenis_garansi',
    label: 'Jenis Garansi',
    type: 'select',
    placeholder: 'Pilih jenis garansi',
    options: ['Tidak Ada', 'Garansi Toko', 'Garansi Distributor', 'Garansi Resmi Merek', 'Garansi Internasional'],
  },
  {
    key: 'kedaluwarsa',
    label: 'Kedaluwarsa / Masa Simpan',
    type: 'text',
    placeholder: 'Cth: 24 Bulan / 12-2028',
  },
  {
    key: 'izin_edar',
    label: 'No. BPOM / Halal / SNI / Postel',
    type: 'text',
    placeholder: 'Cth: BPOM NA18240601234 / SNI / Halal MUI',
  },
  {
    key: 'spesifikasi_teknis',
    label: 'Daya / Spesifikasi Teknis',
    type: 'text',
    placeholder: 'Cth: 65W USB-C PD, Bluetooth 5.3, 220V',
  },
  {
    key: 'negara_asal',
    label: 'Negara Asal / Produksi',
    type: 'text',
    placeholder: 'Cth: Indonesia, Korea Selatan, Jepang',
  },
  {
    key: 'usia_pengguna',
    label: 'Rekomendasi Usia / Pengguna',
    type: 'text',
    placeholder: 'Cth: Dewasa, Anak 3+ Tahun, 0-12 Bulan',
  },
];

export const CATEGORY_ICON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'sparkles', label: 'Kecantikan & Parfum' },
  { value: 'smartphone', label: 'Handphone & Gadget' },
  { value: 'desktop_windows', label: 'Komputer & Laptop' },
  { value: 'headphones', label: 'Audio & Elektronik' },
  { value: 'checkroom', label: 'Fashion Wanita' },
  { value: 'shirt', label: 'Fashion Pria' },
  { value: 'shopping_bag', label: 'Tas, Sepatu & Retail' },
  { value: 'utensils', label: 'Makanan & Dapur' },
  { value: 'coffee', label: 'Minuman & Kopi' },
  { value: 'home', label: 'Perlengkapan Rumah' },
  { value: 'heart_pulse', label: 'Kesehatan & Medis' },
  { value: 'baby', label: 'Ibu & Bayi' },
  { value: 'dumbbell', label: 'Olahraga & Outdoor' },
  { value: 'car', label: 'Otomotif' },
  { value: 'book_open', label: 'Buku & Alat Tulis' },
  { value: 'gamepad', label: 'Hobi & Koleksi' },
  { value: 'gem', label: 'Perhiasan & Aksesoris' },
  { value: 'watch', label: 'Jam Tangan' },
  { value: 'palette', label: 'Make Up & Seni' },
  { value: 'deployed_code', label: 'Umum / Paket' },
];

export function suggestSkuPrefix(name: string): string {
  const words = name
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  const alpha = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return (alpha.slice(0, 2) || 'PR').toUpperCase();
}

/**
 * Resolves Shopee specification attributes for a category.
 * If a sub-category has no custom attributes configured, inherits from its parent L1 category.
 */
export function resolveEffectiveAttributes(
  categoryName: string,
  categoryItems: CategoryItem[]
): CategoryAttributeField[] {
  const item = categoryItems.find(c => c.name.toLowerCase() === categoryName.trim().toLowerCase());
  if (!item) return [];
  if (item.attributeFields && item.attributeFields.length > 0) {
    return item.attributeFields;
  }
  if (item.parentName) {
    const parent = categoryItems.find(
      c => c.name.toLowerCase() === item.parentName!.trim().toLowerCase()
    );
    if (parent?.attributeFields && parent.attributeFields.length > 0) {
      return parent.attributeFields;
    }
  }
  return [];
}

/**
 * Builds hierarchical options (L1 parents followed by indented L2 children) for CustomSelect.
 */
export function buildHierarchicalCategoryOptions(
  categoryItems: CategoryItem[],
  opts?: {
    fallbackNames?: string[];
    includeAll?: boolean;
    activeOnly?: boolean;
    preserveValue?: string;
    counts?: Record<string, number>;
    totalAllProducts?: number;
  }
): CustomSelectOption[] {
  const options: CustomSelectOption[] = [];
  if (opts?.includeAll) {
    options.push({
      value: 'Semua',
      label: 'Semua Kategori',
      badge:
        opts.totalAllProducts !== undefined ? `${opts.totalAllProducts} SKU` : undefined,
    });
  }

  const preserveLower = opts?.preserveValue?.trim().toLowerCase() || '';

  if (categoryItems.length > 0) {
    const visibleItems = opts?.activeOnly
      ? categoryItems.filter(c => c.isActive || c.name.toLowerCase() === preserveLower)
      : categoryItems;

    const l1Parents = visibleItems.filter(c => !c.parentName);
    const childrenByParent = new Map<string, CategoryItem[]>();
    const orphans: CategoryItem[] = [];

    for (const c of visibleItems) {
      if (c.parentName) {
        const key = c.parentName.toLowerCase();
        const hasParent = l1Parents.some(p => p.name.toLowerCase() === key);
        if (hasParent) {
          const arr = childrenByParent.get(key) ?? [];
          arr.push(c);
          childrenByParent.set(key, arr);
        } else {
          orphans.push(c);
        }
      }
    }

    for (const parent of l1Parents) {
      const pCount = opts?.counts?.[parent.name];
      options.push({
        value: parent.name,
        label: parent.name,
        sublabel: !parent.isActive ? 'Nonaktif' : parent.skuPrefix ? `Induk · Prefix ${parent.skuPrefix}` : 'Kategori Utama',
        badge: pCount !== undefined ? `${pCount} SKU` : undefined,
      });

      const children = childrenByParent.get(parent.name.toLowerCase()) ?? [];
      for (const child of children) {
        const cCount = opts?.counts?.[child.name];
        options.push({
          value: child.name,
          label: `↳ ${child.name}`,
          sublabel: `${parent.name}${!child.isActive ? ' · Nonaktif' : child.skuPrefix ? ` · ${child.skuPrefix}` : ''}`,
          badge: cCount !== undefined ? `${cCount} SKU` : undefined,
        });
      }
    }

    for (const orphan of orphans) {
      const oCount = opts?.counts?.[orphan.name];
      options.push({
        value: orphan.name,
        label: orphan.name,
        sublabel: orphan.parentName ? `Induk: ${orphan.parentName}` : undefined,
        badge: oCount !== undefined ? `${oCount} SKU` : undefined,
      });
    }

    return options;
  }

  for (const name of opts?.fallbackNames ?? []) {
    if (name === 'Semua') continue;
    const count = opts?.counts?.[name];
    options.push({
      value: name,
      label: name,
      badge: count !== undefined ? `${count} SKU` : undefined,
    });
  }
  return options;
}
