import type Database from 'better-sqlite3';

interface FlatCategoryPreset {
  name: string;
  sortOrder: number;
}

const SIMPLE_UNIVERSAL_CATEGORIES: FlatCategoryPreset[] = [
  { name: 'Parfum', sortOrder: 1 },
  { name: 'Skincare', sortOrder: 2 },
  { name: 'Body Care', sortOrder: 3 },
  { name: 'Make Up', sortOrder: 4 },
  { name: 'Hair Care', sortOrder: 5 },
  { name: 'Elektronik', sortOrder: 6 },
  { name: 'Fashion', sortOrder: 7 },
  { name: 'Makanan & Minuman', sortOrder: 8 },
  { name: 'Perlengkapan Rumah', sortOrder: 9 },
  { name: 'Kesehatan', sortOrder: 10 },
  { name: 'Ibu & Bayi', sortOrder: 11 },
  { name: 'Olahraga & Outdoor', sortOrder: 12 },
  { name: 'Otomotif', sortOrder: 13 },
  { name: 'Buku & Alat Tulis', sortOrder: 14 },
  { name: 'Hobi & Koleksi', sortOrder: 15 },
];

// Sub-categories added solely for the multi-level tree that should be cleaned up if unused by products
const REDUNDANT_TREE_SUBCATEGORIES = [
  'Perawatan & Kecantikan',
  'Handphone & Aksesoris',
  'Komputer & Aksesoris',
  'Audio & Elektronik Rumah',
  'Fashion Wanita',
  'Pakaian & Hijab Wanita',
  'Tas & Sepatu Wanita',
  'Fashion Pria',
  'Pakaian Pria',
  'Tas & Sepatu Pria',
  'Makanan Ringan & Sembako',
  'Minuman & Kopi',
  'Peralatan Dapur',
  'Dekorasi & Kebersihan',
  'Suplemen & Vitamin',
  'Alat Kesehatan',
  'Perlengkapan Bayi',
  'Alat Olahraga & Fitness',
  'Aksesoris Kendaraan',
  'Alat Tulis & Kantor',
  'Mainan & Koleksi',
];

export function migrateShopeeCategoriesV1(db: Database.Database): void {
  const doneRow = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('simplified_categories_v1') as { value: string } | undefined;
  if (doneRow?.value === '1') {
    return;
  }

  const now = new Date().toISOString();
  const upsertStmt = db.prepare(`
    INSERT INTO categories (
      name, sortOrder, parentName, icon, skuPrefix, isActive, description, attributeFieldsJson, createdAt
    ) VALUES (?, ?, NULL, 'category', '', 1, '', '[]', ?)
    ON CONFLICT(name) DO UPDATE SET
      sortOrder = excluded.sortOrder,
      parentName = NULL,
      isActive = 1
  `);

  const tx = db.transaction(() => {
    // Flatten any existing categories
    db.prepare("UPDATE categories SET parentName = NULL, isActive = 1, attributeFieldsJson = '[]'").run();

    // Remove unused multi-level preset sub-categories so list stays clean & simple
    const checkUsed = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE category = ?');
    const delStmt = db.prepare('DELETE FROM categories WHERE name = ?');
    for (const oldTreeCat of REDUNDANT_TREE_SUBCATEGORIES) {
      const cnt = (checkUsed.get(oldTreeCat) as { cnt: number }).cnt;
      if (cnt === 0) {
        delStmt.run(oldTreeCat);
      }
    }

    // Ensure clean 15 universal flat categories exist
    for (const cat of SIMPLE_UNIVERSAL_CATEGORIES) {
      upsertStmt.run(cat.name, cat.sortOrder, now);
    }

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'simplified_categories_v1',
      '1'
    );
  });

  tx();
}
