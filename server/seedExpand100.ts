import type BetterSqlite3 from 'better-sqlite3';
import { getTodayWibDateStr } from '../src/utils/promoDuration.ts';

const RETAIL_IMG_POOL = {
  parfum: '/assets/products/parfum.jpg',
  serum: '/assets/products/serum.jpg',
  cream: '/assets/products/cream.jpg',
  bodycare: '/assets/products/bodycare.jpg',
  makeup: '/assets/products/makeup.jpg',
} as const;

const KEPT_CATEGORIES = [
  'Parfum',
  'Skincare',
  'Body Care',
  'Make Up',
  'Hair Care',
] as const;

type KeptCategory = (typeof KEPT_CATEGORIES)[number];

const KEPT_TENANT_IDS = [
  'tenant-tms-001',
  'tenant-tmj-002',
  'tenant-lke-003',
  'tenant-out-004',
  'tenant-out-005',
] as const;

const KEPT_USER_IDS = [
  'USR-001',
  'USR-002',
  'USR-003',
  'USR-004',
  'USR-005',
] as const;

const KEPT_CUSTOMER_IDS = [
  'CUST-001',
  'CUST-002',
  'CUST-003',
  'CUST-004',
  'CUST-005',
] as const;

const BRAND_NAMES = [
  'Lumina Lab',
  'Botanica Pure',
  'Aura Botanics',
  'Velvet & Co',
  'Amulia Beauty',
  'MKI Atelier',
  'Blimey Studio',
  'Kirei Derma',
  'Scentoria',
  'Nusantara Care',
] as const;

const SKU_PREFIX_BY_CAT: Record<KeptCategory, string> = {
  Parfum: 'PF',
  Skincare: 'SK',
  'Body Care': 'BC',
  'Make Up': 'MU',
  'Hair Care': 'HC',
};

const CATALOG_TEMPLATES_BY_CAT: Record<
  KeptCategory,
  Array<{ base: string; variants: string[]; unit: 'ml' | 'g'; sizes: number[]; basePrice: number; img: string }>
> = {
  Parfum: [
    { base: 'Eau de Parfum', variants: ['Vanilla Noir', 'White Musk', 'Oud & Amber', 'Bergamot Cedar', 'Jasmine Mist', 'Saffron Rose'], unit: 'ml', sizes: [30, 50, 100], basePrice: 245000, img: RETAIL_IMG_POOL.parfum },
    { base: 'Extrait de Parfum', variants: ['Velvet Rose', 'Royal Oud', 'Cedar Silk', 'Ambergris Wood', 'Midnight Iris'], unit: 'ml', sizes: [35, 50, 75], basePrice: 365000, img: RETAIL_IMG_POOL.parfum },
    { base: 'Eau de Toilette', variants: ['Fresh Neroli', 'Citrus Blossom', 'Ocean Breeze', 'Green Tea Mint', 'Peony Bloom'], unit: 'ml', sizes: [50, 100], basePrice: 175000, img: RETAIL_IMG_POOL.parfum },
    { base: 'Body Mist', variants: ['Chamomile Breeze', 'Sweet Berry', 'Cotton Cloud', 'Mandarin Zest', 'Sakura Dew'], unit: 'ml', sizes: [100, 150, 200], basePrice: 95000, img: RETAIL_IMG_POOL.parfum },
  ],
  Skincare: [
    { base: 'Brightening Serum', variants: ['Alpha Arbutin 2%', 'Niacinamide 10%', 'Vitamin C 15%', 'Tranexamic Glow', 'Licorice Drops'], unit: 'ml', sizes: [20, 30, 50], basePrice: 145000, img: RETAIL_IMG_POOL.serum },
    { base: 'Barrier Moisturizer', variants: ['5X Ceramide Gel', 'Marine Collagen', 'Squalane Rich', 'Panthenol Calming', 'Centella Soothing'], unit: 'g', sizes: [30, 50, 80], basePrice: 138000, img: RETAIL_IMG_POOL.cream },
    { base: 'Night Renewal Cream', variants: ['Encapsulated Retinol', 'Bakuchiol Peptide', 'Propolis Repair', 'Caviar Youth'], unit: 'g', sizes: [30, 45, 60], basePrice: 179000, img: RETAIL_IMG_POOL.cream },
    { base: 'Aqua Sunscreen SPF 50+', variants: ['Matte Oil-Control', 'Dewy Tone-Up', 'Sensitive Mineral', 'Hyalu UV Gel'], unit: 'ml', sizes: [30, 40, 50], basePrice: 118000, img: RETAIL_IMG_POOL.cream },
    { base: 'Hydrating Essence Toner', variants: ['Hyaluronic 7D', 'Mugwort Pore', 'Galactomyces', 'Rosewater Mist'], unit: 'ml', sizes: [100, 120, 150], basePrice: 109000, img: RETAIL_IMG_POOL.serum },
  ],
  'Body Care': [
    { base: 'Silky Body Lotion', variants: ['Shea & Almond', 'Goat Milk Glow', 'White Musk', 'Vanilla Oat', 'Cherry Blossom'], unit: 'ml', sizes: [180, 250, 350], basePrice: 115000, img: RETAIL_IMG_POOL.bodycare },
    { base: 'Exfoliating Body Scrub', variants: ['Coffee & Almond', 'Rosehip & Milk', 'Bengkoang Bright', 'Matcha Sea Salt', 'Turmeric Honey'], unit: 'g', sizes: [150, 200, 300], basePrice: 92000, img: RETAIL_IMG_POOL.cream },
    { base: 'Relaxing Shower Gel', variants: ['Eucalyptus Spa', 'Lavender Calm', 'Peppermint Cool', 'Yuzu Citrus', 'Sandalwood'], unit: 'ml', sizes: [250, 300, 500], basePrice: 88000, img: RETAIL_IMG_POOL.bodycare },
    { base: 'Nourishing Body Serum', variants: ['Niacinamide 5%', 'Collagen Firm', 'AHA Smooth', 'Vitamin E Glow'], unit: 'ml', sizes: [150, 180, 220], basePrice: 129000, img: RETAIL_IMG_POOL.bodycare },
  ],
  'Make Up': [
    { base: 'Satin Cushion SPF 35', variants: ['01 Ivory', '02 Light Beige', '03 Natural Warm', '04 Honey Tan', '05 Caramel'], unit: 'g', sizes: [15], basePrice: 189000, img: RETAIL_IMG_POOL.makeup },
    { base: 'Velvet Lip Cream', variants: ['Rosewood', 'Terracotta', 'Berry Mauve', 'Nude Caramel', 'Ruby Brick', 'Coral Peach'], unit: 'g', sizes: [4, 5], basePrice: 85000, img: RETAIL_IMG_POOL.makeup },
    { base: 'Micro-Blur Loose Powder', variants: ['Translucent', 'Warm Ivory', 'Soft Beige', 'Medium Sand'], unit: 'g', sizes: [15, 20], basePrice: 132000, img: RETAIL_IMG_POOL.makeup },
    { base: 'Silky Cheek Blush', variants: ['Peach Nude', 'Dusty Rose', 'Coral Sunset', 'Plum Flush'], unit: 'g', sizes: [8, 10], basePrice: 98000, img: RETAIL_IMG_POOL.makeup },
    { base: 'Waterproof Mascara & Brow', variants: ['Volume Curl Black', 'Lengthening Espresso', 'Ash Brown Brow', 'Clear Lash Lift'], unit: 'g', sizes: [6, 8], basePrice: 105000, img: RETAIL_IMG_POOL.makeup },
  ],
  'Hair Care': [
    { base: 'Hair Repair Serum', variants: ['Moroccan Argan', 'Camellia Keratin', 'Jojoba Shine', 'Macadamia Silk', 'Blackberry Gloss'], unit: 'ml', sizes: [50, 60, 100], basePrice: 139000, img: RETAIL_IMG_POOL.serum },
    { base: 'Intensive Hair Mask', variants: ['Keratin Smooth', 'Avocado Deep', 'Argan Moisture', 'Milk Protein'], unit: 'g', sizes: [180, 200, 300], basePrice: 124000, img: RETAIL_IMG_POOL.cream },
    { base: 'Scalp Revitalizing Tonic', variants: ['Ginseng Rosemary', 'Biotin Peptide', 'Aloe Mint Cool', 'Candlenut Dense'], unit: 'ml', sizes: [90, 100, 150], basePrice: 115000, img: RETAIL_IMG_POOL.bodycare },
    { base: 'Botanical Daily Shampoo', variants: ['Anti-Hairfall', 'Silk Volume', 'Tea Tree Fresh', 'Color Protect'], unit: 'ml', sizes: [250, 350, 500], basePrice: 98000, img: RETAIL_IMG_POOL.bodycare },
  ],
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function addDays(baseIso: string, offsetDays: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function buildHolidayPromoSeeds(todayStr: string) {
  const thisYear = Number(todayStr.slice(0, 4)) || 2026;
  const lastYear = thisYear - 1;
  const nextYear = thisYear + 1;

  const novStart = `${thisYear}-11-11`;
  const novEnd = `${thisYear}-11-22`;
  const isWithinNov = todayStr >= novStart && todayStr <= novEnd;

  return [
    {
      suffix: '001',
      codeBase: 'MERDEKA17',
      name: `Promo Kemerdekaan 17 Agustus (${lastYear})`,
      disc: 17,
      startDate: `${lastYear}-08-16`,
      endDate: `${lastYear}-08-18`,
      isActive: 0,
      minPurchase: null as number | null,
      prodIndices: [0, 30],
      desc: `Promo Hari Kemerdekaan RI tahun ${lastYear} (periode telah berakhir).`,
    },
    {
      suffix: '002',
      codeBase: 'CANTIK11',
      name: `Promo Tanggal Cantik 11.11 (${thisYear})`,
      disc: 11,
      startDate: isWithinNov ? novStart : addDays(todayStr, -4),
      endDate: isWithinNov ? novEnd : addDays(todayStr, 7),
      isActive: 1,
      minPurchase: 150000,
      prodIndices: [0, 1, 30, 60, 90],
      desc: `Promo spesial Tanggal Cantik 11.11 tahun ${thisYear} yang sedang berlangsung.`,
    },
    {
      suffix: '003',
      codeBase: 'HARBOLNAS12',
      name: `Promo Tanggal Cantik 12.12 (${thisYear})`,
      disc: 12,
      startDate: `${thisYear}-12-12`,
      endDate: `${thisYear}-12-14`,
      isActive: 0,
      minPurchase: 100000,
      prodIndices: [90, 120],
      desc: `Draft promo Tanggal Cantik 12.12 tahun ${thisYear} (status nonaktif/dijeda).`,
    },
    {
      suffix: '004',
      codeBase: 'NATAL15',
      name: `Promo Hari Raya Natal (${thisYear})`,
      disc: 15,
      startDate: `${thisYear}-12-24`,
      endDate: `${thisYear}-12-26`,
      isActive: 1,
      minPurchase: 250000,
      prodIndices: [],
      desc: `Promo terjadwal Hari Raya Natal ${thisYear} berlaku untuk semua produk.`,
    },
    {
      suffix: '005',
      codeBase: 'NEWYEAR27',
      name: `Promo Tahun Baru 1.1 (${nextYear})`,
      disc: 20,
      startDate: `${nextYear}-01-01`,
      endDate: `${nextYear}-01-05`,
      isActive: 1,
      minPurchase: 300000,
      prodIndices: [],
      desc: `Promo terjadwal Tahun Baru & Tanggal Cantik 1.1 tahun ${nextYear} untuk semua produk.`,
    },
  ];
}

function generate150ProductsForOutlet(
  db: BetterSqlite3.Database,
  tenantId: string,
  tag: string
): number[] {
  const existingRows = db
    .prepare('SELECT id, sku, category FROM products WHERE tenantId = ? ORDER BY id ASC')
    .all(tenantId) as Array<{ id: number; sku: string; category: string }>;

  const usedSkus = new Set(existingRows.map(r => r.sku.toLowerCase()));
  const keptIds: number[] = [];

  // Keep existing valid products up to 30 per category, normalize category if needed
  const countByCat: Record<KeptCategory, number> = {
    Parfum: 0,
    Skincare: 0,
    'Body Care': 0,
    'Make Up': 0,
    'Hair Care': 0,
  };

  for (const r of existingRows) {
    if ((KEPT_CATEGORIES as readonly string[]).includes(r.category)) {
      const c = r.category as KeptCategory;
      if (countByCat[c] < 30) {
        countByCat[c] += 1;
        keptIds.push(r.id);
      }
    }
  }

  const insertProd = db.prepare(`
    INSERT INTO products (
      tenantId, sku, name, berat, harga, hpp, stok, category, image,
      brand, kondisi, deskripsi, panjang, lebar, tinggi, status, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Baru', ?, ?, ?, ?, ?, ?)
  `);

  const tenantSeedOffset = KEPT_TENANT_IDS.indexOf(tenantId as (typeof KEPT_TENANT_IDS)[number]);

  for (const cat of KEPT_CATEGORIES) {
    const templates = CATALOG_TEMPLATES_BY_CAT[cat];
    const prefix = SKU_PREFIX_BY_CAT[cat];
    let seq = 1;

    // Build deterministic 30 real products per category (5 * 30 = 150 products per outlet)
    const combinations: Array<{
      name: string;
      berat: number;
      harga: number;
      img: string;
      brand: string;
    }> = [];

    for (const tpl of templates) {
      for (const variant of tpl.variants) {
        for (const size of tpl.sizes) {
          const sizeMultiplier = tpl.sizes.length > 1 ? 1 + (size - tpl.sizes[0]) / (tpl.sizes[0] * 2.2) : 1;
          const harga = Math.round((tpl.basePrice * sizeMultiplier) / 1000) * 1000;
          const brand = BRAND_NAMES[(combinations.length + tenantSeedOffset) % BRAND_NAMES.length];
          combinations.push({
            name: `${tpl.base} ${variant} ${size}${tpl.unit}`,
            berat: size,
            harga,
            img: tpl.img,
            brand,
          });
        }
      }
    }

    let comboIdx = 0;
    while (countByCat[cat] < 30) {
      const candidateSku = `${prefix}-${pad3(seq)}`;
      seq += 1;
      if (usedSkus.has(candidateSku.toLowerCase())) {
        continue;
      }

      const item = combinations[comboIdx % combinations.length];
      comboIdx += 1;
      const globalIdx = keptIds.length;
      const hpp = Math.round((item.harga * (0.58 + (globalIdx % 4) * 0.02)) / 1000) * 1000;

      // Realistic stock: ~82% available (8..44), ~12% low stock (1..5), ~6% out of stock (0)
      let stok = 10 + ((globalIdx * 7 + tenantSeedOffset * 3) % 35);
      if (globalIdx % 9 === 4) stok = 2 + (globalIdx % 4);
      if (globalIdx % 17 === 10) stok = 0;

      const status = globalIdx % 13 === 11 ? 'Nonaktif' : 'Aktif';
      const createdAt = `2026-${globalIdx % 2 === 0 ? '09' : '10'}-${pad2(1 + (globalIdx % 28))}T09:00:00.000Z`;
      const desc = `${item.name} dari ${item.brand} (${tag}), formulasi lembut kategori ${cat} untuk pemakaian rutin harian.`;

      const info = insertProd.run(
        tenantId,
        candidateSku,
        item.name,
        item.berat,
        item.harga,
        hpp,
        stok,
        cat,
        item.img,
        item.brand,
        desc,
        6 + (globalIdx % 6),
        5 + (globalIdx % 5),
        10 + (globalIdx % 9),
        status,
        createdAt
      );

      usedSkus.add(candidateSku.toLowerCase());
      keptIds.push(Number(info.lastInsertRowid));
      countByCat[cat] += 1;
    }
  }

  // Delete any stray products beyond the 150 kept items for this outlet
  const idPlaceholders = keptIds.map(() => '?').join(', ');
  db.prepare(`DELETE FROM products WHERE tenantId = ? AND id NOT IN (${idPlaceholders})`).run(
    tenantId,
    ...keptIds
  );

  // Backfill any empty fields on older kept products
  db.prepare(
    `UPDATE products
     SET brand = CASE WHEN brand IS NULL OR TRIM(brand) = '' OR brand = 'No Brand' THEN 'Lumina Lab' ELSE brand END,
         hpp = CASE WHEN COALESCE(hpp, 0) = 0 THEN CAST(ROUND(harga * 0.6 / 1000.0) * 1000 AS INTEGER) ELSE hpp END,
         deskripsi = CASE WHEN deskripsi IS NULL OR TRIM(deskripsi) = '' THEN name || ' kualitas premium untuk perawatan harian.' ELSE deskripsi END,
         createdAt = COALESCE(createdAt, '2026-10-01T09:00:00.000Z')
     WHERE tenantId = ?`
  ).run(tenantId);

  db.prepare('UPDATE tenants SET productCount = ? WHERE id = ?').run(keptIds.length, tenantId);
  return keptIds;
}

function generate150TransactionsForAllOutlets(
  db: BetterSqlite3.Database,
  todayStr: string
): void {
  db.prepare('DELETE FROM transaction_items').run();
  db.prepare('DELETE FROM transactions').run();

  const customers = db
    .prepare('SELECT id, name FROM customers ORDER BY rowid ASC')
    .all() as Array<{ id: string; name: string }>;

  const users = db
    .prepare('SELECT fullName, role, allowedTenantIdsJson FROM users WHERE isActive = 1')
    .all() as Array<{ fullName: string; role: string; allowedTenantIdsJson: string }>;

  const insertTx = db.prepare(`
    INSERT INTO transactions (
      id, tenantId, invoiceNo, dateTime, dateStr, timeStr, cashier, customerId,
      customerName, totalQty, totalBerat, subtotal, discountAmount, promoCode,
      promoName, tax, grandTotal, paymentMethod, paymentDetailsJson, status,
      voidReason, voidedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTxItem = db.prepare(`
    INSERT INTO transaction_items (
      transactionId, productId, sku, name, berat, harga, qty, subtotal, image
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tenantTags: Record<(typeof KEPT_TENANT_IDS)[number], string> = {
    'tenant-tms-001': 'MKI',
    'tenant-tmj-002': 'AML',
    'tenant-lke-003': 'BLM',
    'tenant-out-004': 'T004',
    'tenant-out-005': 'T005',
  };

  const banks = ['BCA', 'Mandiri', 'BRI', 'BNI'];
  let invCounter = 1000;

  for (const tId of KEPT_TENANT_IDS) {
    const tag = tenantTags[tId];
    const tenantProducts = db
      .prepare(
        "SELECT id, sku, name, berat, harga, image FROM products WHERE tenantId = ? AND COALESCE(status, 'Aktif') = 'Aktif' ORDER BY id ASC"
      )
      .all(tId) as Array<{
      id: number;
      sku: string;
      name: string;
      berat: number;
      harga: number;
      image: string;
    }>;

    if (tenantProducts.length === 0 || customers.length === 0) continue;

    // Resolve cashiers strictly from real users in DB
    const outletUsers = users.filter(u => {
      if (u.role === 'owner') return true;
      try {
        const allowed = JSON.parse(u.allowedTenantIdsJson) as string[];
        return allowed.includes(tId);
      } catch {
        return false;
      }
    });
    const cashierNames = outletUsers.map(u => u.fullName);
    if (cashierNames.length === 0) cashierNames.push('Andi Pratama');

    // Active promo from DB for this outlet
    const activePromo = db
      .prepare('SELECT code, name, discountPercent, startDate, endDate FROM promos WHERE tenantId = ? AND isActive = 1 AND startDate <= ? AND endDate >= ? LIMIT 1')
      .get(tId, todayStr, todayStr) as
      | { code: string; name: string; discountPercent: number; startDate: string; endDate: string }
      | undefined;

    const storePpnRow = db
      .prepare('SELECT enablePpn, ppnPercent FROM store_settings WHERE tenantId = ?')
      .get(tId) as { enablePpn: number; ppnPercent: number } | undefined;
    const enablePpn = storePpnRow ? Boolean(storePpnRow.enablePpn) : true;
    const ppnRate = enablePpn ? (storePpnRow?.ppnPercent ?? 11) / 100 : 0;

    // Generate 150 realistic transactions spanning past 28 days up to todayStr
    for (let idx = 0; idx < 150; idx++) {
      invCounter += 1;

      // First 15 transactions on todayStr (for Hari Ini & HARI chart), remaining spread over past 27 days
      const dayOffset = idx < 15 ? 0 : -(1 + ((idx - 15) % 27));
      const txIsoDate = addDays(todayStr, dayOffset);
      const dateCompact = txIsoDate.replace(/-/g, '');
      const [y, m, d] = txIsoDate.split('-').map(Number);

      // Spread hours realistically from 09:00 to 21:45 in local time
      const hour = 9 + ((idx * 3 + (idx % 5)) % 12);
      const minute = (idx * 11) % 60;
      const second = (idx * 17) % 60;
      const dt = new Date(y, m - 1, d, hour, minute, second);
      const dateTime = dt.toISOString();
      const dateStr = dt.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const timeStr = dt.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const txId = `TRX-${tag}-${dateCompact}-${pad3(idx + 1)}`;
      const invoiceNo = `TRX-${dateCompact}-${pad3(invCounter)}`;
      const cust = customers[idx % customers.length];
      const cashier = cashierNames[idx % cashierNames.length];

      // Pick 1..3 real products from DB
      const lineCount = 1 + (idx % 3);
      let grossSubtotal = 0;
      let totalQty = 0;
      let totalBerat = 0;
      const lines: Array<{
        prod: (typeof tenantProducts)[number];
        qty: number;
        subtotal: number;
      }> = [];

      const pickedIndices = new Set<number>();
      for (let k = 0; k < lineCount; k++) {
        const pIdx = (idx * 7 + k * 29) % tenantProducts.length;
        if (pickedIndices.has(pIdx)) continue;
        pickedIndices.add(pIdx);
        const prod = tenantProducts[pIdx];
        const qty = 1 + ((idx + k) % 3 === 0 ? 1 : 0);
        const lineSub = prod.harga * qty;
        lines.push({ prod, qty, subtotal: lineSub });
        grossSubtotal += lineSub;
        totalQty += qty;
        totalBerat += prod.berat * qty;
      }

      // Apply real active promo if transaction date is within promo validity window (~25% of recent txs)
      let discountAmount = 0;
      let promoCode: string | null = null;
      let promoName: string | null = null;
      if (
        activePromo &&
        txIsoDate >= activePromo.startDate &&
        txIsoDate <= activePromo.endDate &&
        idx % 4 === 0
      ) {
        discountAmount = Math.round(grossSubtotal * (activePromo.discountPercent / 100));
        promoCode = activePromo.code;
        promoName = activePromo.name;
      }

      const subtotal = Math.max(0, grossSubtotal - discountAmount);
      const tax = Math.round(subtotal * ppnRate);
      const grandTotal = subtotal + tax;

      const method = idx % 2 === 0 ? 'cash' : 'transfer';
      const roundedCash = Math.ceil(grandTotal / 50000) * 50000;
      const paymentDetails =
        method === 'cash'
          ? { cashReceived: roundedCash, cashChange: Math.max(0, roundedCash - grandTotal) }
          : {
              transferBank: banks[idx % banks.length],
              transferAccountNo: `5400${pad3(idx + 100)}921`,
              transferRef: `TRF-${dateCompact}-${pad3(invCounter)}`,
            };

      const isVoid = idx % 18 === 17;
      const status = isVoid ? 'void' : 'completed';

      insertTx.run(
        txId,
        tId,
        invoiceNo,
        dateTime,
        dateStr,
        timeStr,
        cashier,
        cust.id,
        cust.name,
        totalQty,
        Number(totalBerat.toFixed(2)),
        subtotal,
        discountAmount,
        promoCode,
        promoName,
        tax,
        grandTotal,
        method,
        JSON.stringify(paymentDetails),
        status,
        isVoid ? 'Salah input metode pembayaran oleh kasir' : null,
        isVoid ? new Date(dt.getTime() + 10 * 60_000).toISOString() : null
      );

      for (const l of lines) {
        insertTxItem.run(
          txId,
          l.prod.id,
          l.prod.sku,
          l.prod.name,
          l.prod.berat,
          l.prod.harga,
          l.qty,
          l.subtotal,
          l.prod.image
        );
      }
    }
  }
}

function rebuild5ShiftClosingsFromRealTransactions(
  db: BetterSqlite3.Database,
  todayStr: string
): void {
  db.prepare('DELETE FROM shift_closings').run();

  const insertShift = db.prepare(`
    INSERT INTO shift_closings (
      id, tenantId, shiftCode, shiftDate, shiftLabel, cashierId, cashierName,
      openingCash, totalSalesCount, totalSalesAmount, totalSalesGrams,
      salesCash, salesDebit, salesTransfer, salesQris,
      totalBuybackCount, totalBuybackAmount, totalBuybackGrams,
      buybackCash, buybackTransfer, voidSalesCount, voidBuybackCount,
      expectedCash, actualCash, cashVariance, notes, status, closedAt
    ) VALUES (?, 'tenant-tms-001', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 0, 0, 0, 0, 0, ?, 0, ?, ?, 0, ?, 'closed', ?)
  `);

  const shiftDays = [0, -1, -2, -3, -4];
  shiftDays.forEach((offset, i) => {
    const shiftDate = addDays(todayStr, offset);
    const shiftId = `SHF-REAL-00${i + 1}`;
    const shiftCode = `SHF-${shiftDate.replace(/-/g, '')}-00${i + 1}`;
    const openingCash = 1000000;

    // Aggregate actual transactions on this shift date from SQLite
    const agg = db
      .prepare(
        `SELECT
           SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN 1 ELSE 0 END) AS salesCount,
           COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN grandTotal ELSE 0 END), 0) AS totalSalesAmount,
           COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN totalBerat ELSE 0 END), 0) AS totalSalesGrams,
           COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' AND paymentMethod = 'cash' THEN grandTotal ELSE 0 END), 0) AS salesCash,
           COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' AND paymentMethod = 'transfer' THEN grandTotal ELSE 0 END), 0) AS salesTransfer,
           SUM(CASE WHEN COALESCE(status, 'completed') = 'void' THEN 1 ELSE 0 END) AS voidSalesCount
         FROM transactions
         WHERE tenantId = 'tenant-tms-001'
           AND substr(dateTime, 1, 10) = ?`
      )
      .get(shiftDate) as {
      salesCount: number | null;
      totalSalesAmount: number;
      totalSalesGrams: number;
      salesCash: number;
      salesTransfer: number;
      voidSalesCount: number | null;
    };

    const isShift1 = i % 2 === 0;
    const expectedCash = openingCash + agg.salesCash;
    insertShift.run(
      shiftId,
      shiftCode,
      shiftDate,
      isShift1 ? 'Shift 1 (08:00 - 16:00)' : 'Shift 2 (13:00 - 21:00)',
      isShift1 ? 'USR-003' : 'USR-002',
      isShift1 ? 'Andi Pratama' : 'Dewi Lestari',
      openingCash,
      agg.salesCount ?? 0,
      agg.totalSalesAmount,
      Number((agg.totalSalesGrams ?? 0).toFixed(2)),
      agg.salesCash,
      agg.salesTransfer,
      agg.voidSalesCount ?? 0,
      expectedCash,
      expectedCash,
      'Rekap shift otomatis sesuai data transaksi real di database.',
      `${shiftDate}T21:30:00.000Z`
    );
  });
}

function sync5PromosPerOutlet(db: BetterSqlite3.Database, todayStr: string): void {
  const promoSeeds = buildHolidayPromoSeeds(todayStr);

  const tenantTags: Record<(typeof KEPT_TENANT_IDS)[number], string> = {
    'tenant-tms-001': 'MKI',
    'tenant-tmj-002': 'AML',
    'tenant-lke-003': 'BLM',
    'tenant-out-004': 'T004',
    'tenant-out-005': 'T005',
  };

  db.prepare('DELETE FROM promos').run();

  const insertPromo = db.prepare(`
    INSERT INTO promos (
      id, tenantId, name, code, discountPercent, label, startDate, endDate,
      productIdsJson, isActive, minPurchase, description, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const tId of KEPT_TENANT_IDS) {
    const tag = tenantTags[tId];
    const prodIds = (
      db.prepare('SELECT id FROM products WHERE tenantId = ? ORDER BY id ASC').all(tId) as Array<{ id: number }>
    ).map(r => r.id);

    for (const ps of promoSeeds) {
      const promoId = tId === 'tenant-tms-001' ? `PRM-${ps.suffix}` : `PRM-${tag}-${ps.suffix}`;
      const code = tId === 'tenant-tms-001' ? ps.codeBase : `${tag}${ps.codeBase}`;
      const linkedProdIds = ps.prodIndices
        .map(i => prodIds[i])
        .filter((v): v is number => typeof v === 'number');

      insertPromo.run(
        promoId,
        tId,
        ps.name,
        code,
        ps.disc,
        `Diskon ${ps.disc}%`,
        ps.startDate,
        ps.endDate,
        JSON.stringify(linkedProdIds),
        ps.isActive,
        ps.minPurchase,
        ps.desc,
        '2026-10-25T10:00:00.000Z'
      );
    }
  }
}

export function compactSeedTo5V1(
  db: BetterSqlite3.Database,
  hashPassword: (password: string) => string
): void {
  const alreadyFlag = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('seeded_compact_5_v1') as { value: string } | undefined;
  if (alreadyFlag?.value === '1') {
    return;
  }

  const todayStr = getTodayWibDateStr();
  const ownerHash = hashPassword('owner123');

  const compactTx = db.transaction(() => {
    // 1. TENANTS / OUTLETS -> EXACTLY 5 OUTLETS
    const ensureTenant = db.prepare(`
      INSERT OR IGNORE INTO tenants (
        id, name, code, branchName, address, city, plan, cashierCount, productCount,
        phone, email, slug, logoInitial, logoUrl, databaseSchema, status, createdAt
      ) VALUES (
        @id, @name, @code, @branchName, @address, @city, @plan, @cashierCount, @productCount,
        @phone, @email, @slug, @logoInitial, @logoUrl, @databaseSchema, @status, @createdAt
      )
    `);

    const defaultFiveOutlets = [
      {
        id: 'tenant-tms-001',
        name: 'MKI (Maklon Kosmetik Indonesia)',
        code: 'MKI-01',
        branchName: 'Cabang Utama (Grand City Mall Lt. 1)',
        address: 'Jl. Pemuda No. 108, Mall Grand City Lt. 1 No. 22',
        city: 'Jakarta Pusat',
        plan: 'Enterprise Multi-Tenant',
        cashierCount: 3,
        productCount: 150,
        phone: '0812-8899-7766',
        email: 'admin@mki-kosmetik.id',
        slug: 'mki.kasirpos.id',
        logoInitial: 'MK',
        logoUrl: '',
        databaseSchema: 'tenant_db_mki_01',
        status: 'Aktif',
        createdAt: '2026-10-01T08:00:00.000Z',
      },
      {
        id: 'tenant-tmj-002',
        name: 'AMULIA',
        code: 'AML-02',
        branchName: 'Cabang Paris Van Java (PVJ)',
        address: 'Jl. Sukajadi No. 131, Resort Level B-15',
        city: 'Bandung',
        plan: 'Pro Multi-Outlet',
        cashierCount: 2,
        productCount: 150,
        phone: '0813-2233-4455',
        email: 'kontak@amulia.id',
        slug: 'amulia.kasirpos.id',
        logoInitial: 'AM',
        logoUrl: '',
        databaseSchema: 'tenant_db_amulia_02',
        status: 'Aktif',
        createdAt: '2026-10-02T08:00:00.000Z',
      },
      {
        id: 'tenant-lke-003',
        name: 'Blimey',
        code: 'BLM-03',
        branchName: 'Cabang Tunjungan Plaza 3',
        address: 'Jl. Basuki Rahmat No. 8-12, TP 3 Lt. 2',
        city: 'Surabaya',
        plan: 'Enterprise Multi-Tenant',
        cashierCount: 2,
        productCount: 150,
        phone: '0819-7788-9900',
        email: 'hello@blimey.id',
        slug: 'blimey.kasirpos.id',
        logoInitial: 'BL',
        logoUrl: '',
        databaseSchema: 'tenant_db_blimey_03',
        status: 'Aktif',
        createdAt: '2026-10-03T08:00:00.000Z',
      },
      {
        id: 'tenant-out-004',
        name: 'MKI Beauty Studio Jakarta',
        code: 'MKI-004',
        branchName: 'Cabang Plaza Senayan (Jakarta Pusat)',
        address: 'Jl. Asia Afrika No. 8, Plaza Senayan Lt. 2',
        city: 'Jakarta Pusat',
        plan: 'Pro Multi-Outlet',
        cashierCount: 2,
        productCount: 150,
        phone: '0812-3004-4001',
        email: 'outlet004@mki-kosmetik.id',
        slug: 'out004.kasirpos.id',
        logoInitial: 'MK',
        logoUrl: '',
        databaseSchema: 'tenant_db_out_004',
        status: 'Aktif',
        createdAt: '2026-10-04T08:00:00.000Z',
      },
      {
        id: 'tenant-out-005',
        name: 'AMULIA Gallery Jakarta',
        code: 'AML-005',
        branchName: 'Cabang Pondok Indah Mall (Jakarta Selatan)',
        address: 'Jl. Metro Pondok Indah Kav. IV, PIM 2 Lt. 1',
        city: 'Jakarta Selatan',
        plan: 'Pro Multi-Outlet',
        cashierCount: 2,
        productCount: 150,
        phone: '0813-5005-6002',
        email: 'outlet005@amulia.id',
        slug: 'out005.kasirpos.id',
        logoInitial: 'AM',
        logoUrl: '',
        databaseSchema: 'tenant_db_out_005',
        status: 'Aktif',
        createdAt: '2026-10-05T08:00:00.000Z',
      },
    ];

    for (const t of defaultFiveOutlets) {
      ensureTenant.run(t);
    }

    const tenantPlaceholders = KEPT_TENANT_IDS.map(() => '?').join(', ');
    db.prepare(`DELETE FROM store_settings WHERE tenantId NOT IN (${tenantPlaceholders})`).run(...KEPT_TENANT_IDS);
    db.prepare(`DELETE FROM buybacks WHERE tenantId NOT IN (${tenantPlaceholders})`).run(...KEPT_TENANT_IDS);
    db.prepare(`DELETE FROM tenants WHERE id NOT IN (${tenantPlaceholders})`).run(...KEPT_TENANT_IDS);
    db.prepare(`UPDATE sessions SET activeTenantId = 'tenant-tms-001' WHERE activeTenantId NOT IN (${tenantPlaceholders})`).run(
      ...KEPT_TENANT_IDS
    );

    const activeTenantSetting = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('activeTenantId') as { value: string } | undefined;
    if (!activeTenantSetting || !(KEPT_TENANT_IDS as readonly string[]).includes(activeTenantSetting.value)) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('activeTenantId', 'tenant-tms-001');
    }

    // 2. USERS -> EXACTLY 5 USERS WITH 2 OWNERS
    db.prepare(
      `INSERT OR IGNORE INTO users (
        id, username, email, fullName, passwordHash, role, shiftLabel,
        allowedTenantIdsJson, defaultTenantId, isActive, themePreference, createdAt
      ) VALUES (
        'USR-005', 'owner.fajar5', 'owner.fajar5@kasirpos.id', 'Fajar Fauzan',
        ?, 'owner', 'Full Day (Owner)', '[]', 'tenant-tms-001', 1, 'system', ?
      )`
    ).run(ownerHash, '2026-10-05T07:30:00.000Z');

    db.prepare(
      `UPDATE users
       SET role = 'owner',
           shiftLabel = 'Full Day (Owner)',
           allowedTenantIdsJson = '[]',
           defaultTenantId = 'tenant-tms-001',
           isActive = 1
       WHERE id IN ('USR-001', 'USR-005')`
    ).run();

    db.prepare(
      `UPDATE users
       SET role = 'branch_manager',
           allowedTenantIdsJson = ?,
           defaultTenantId = 'tenant-tms-001',
           isActive = 1
       WHERE id = 'USR-002'`
    ).run(JSON.stringify(['tenant-tms-001', 'tenant-tmj-002', 'tenant-lke-003']));

    db.prepare(
      `UPDATE users
       SET role = 'cashier',
           allowedTenantIdsJson = ?,
           defaultTenantId = 'tenant-tms-001',
           isActive = 1
       WHERE id = 'USR-003'`
    ).run(JSON.stringify(['tenant-tms-001', 'tenant-out-004']));

    db.prepare(
      `UPDATE users
       SET role = 'cashier',
           allowedTenantIdsJson = ?,
           defaultTenantId = 'tenant-tmj-002',
           isActive = 1
       WHERE id = 'USR-004'`
    ).run(JSON.stringify(['tenant-tmj-002', 'tenant-out-005']));

    const userPlaceholders = KEPT_USER_IDS.map(() => '?').join(', ');
    db.prepare(`DELETE FROM sessions WHERE userId NOT IN (${userPlaceholders})`).run(...KEPT_USER_IDS);
    db.prepare(`DELETE FROM users WHERE id NOT IN (${userPlaceholders})`).run(...KEPT_USER_IDS);

    // 3. CATEGORIES -> EXACTLY 5 CATEGORIES
    const insertCat = db.prepare(
      'INSERT OR IGNORE INTO categories (name, sortOrder, createdAt) VALUES (?, ?, ?)'
    );
    KEPT_CATEGORIES.forEach((cat, idx) => {
      insertCat.run(cat, idx + 1, '2026-10-01T08:00:00.000Z');
      db.prepare('UPDATE categories SET sortOrder = ? WHERE name = ?').run(idx + 1, cat);
    });
    const catPlaceholders = KEPT_CATEGORIES.map(() => '?').join(', ');
    db.prepare(`DELETE FROM categories WHERE name NOT IN (${catPlaceholders})`).run(...KEPT_CATEGORIES);

    // 4. CUSTOMERS -> EXACTLY 5 CUSTOMERS (ZERO HARDCODED SPENT/TX BASE)
    const defaultFiveCustomers = [
      {
        id: 'CUST-001',
        memberCode: 'MBR-001',
        name: 'Hj. Siti Rahmah',
        phone: '0812-8800-1122',
        nik: '3171045208780001',
        type: 'VIP',
        address: 'Jl. Kemang Timur No. 45, Jakarta Selatan',
        preferredKadar: 'Parfum EDP',
        notes: 'Pelanggan loyal parfum niche & gift hampers',
        createdAt: '2026-01-12',
      },
      {
        id: 'CUST-002',
        memberCode: 'MBR-002',
        name: 'Bpk. Hendra Wijaya',
        phone: '0811-9988-2211',
        nik: '3174011503800002',
        type: 'VIP',
        address: 'Jl. Pantai Indah Utara Blok C-12, Jakarta Utara',
        preferredKadar: 'Parfum EDP',
        notes: 'Kolektor parfum oud & paket hadiah VIP',
        createdAt: '2026-02-18',
      },
      {
        id: 'CUST-003',
        memberCode: 'MBR-003',
        name: 'Ibu Ratna Dewi',
        phone: '0813-4567-8901',
        nik: '3273014409850003',
        type: 'Reguler',
        address: 'Jl. Dago Pakar Barat No. 18, Bandung',
        preferredKadar: 'Skincare Serum',
        notes: 'Rutin belanja serum & krim malam bulanan',
        createdAt: '2026-03-05',
      },
      {
        id: 'CUST-004',
        memberCode: 'MBR-004',
        name: 'Budi Santoso',
        phone: '0815-7766-3344',
        nik: '3175021006900004',
        type: 'Reguler',
        address: 'Jl. Rawamangun Muka No. 10, Jakarta Timur',
        preferredKadar: 'Body Care',
        notes: 'Langganan body lotion & shower gel keluarga',
        createdAt: '2026-04-20',
      },
      {
        id: 'CUST-005',
        memberCode: 'MBR-005',
        name: 'Butik Cantik Nusantara (Bpk. Chandra)',
        phone: '0817-8899-4455',
        nik: '3172052102750005',
        type: 'Mitra / Toko',
        address: 'Ruko Mangga Dua Square Blok B-09, Jakarta Utara',
        preferredKadar: 'Make Up',
        notes: 'Reseller grosir kosmetik & skincare mingguan',
        createdAt: '2026-05-11',
      },
    ];
    const insertCust = db.prepare(`
      INSERT OR IGNORE INTO customers (
        id, memberCode, name, phone, nik, type, address, preferredKadar,
        ringSize, notes, createdAt, totalSpent, totalTransactions
      ) VALUES (
        @id, @memberCode, @name, @phone, @nik, @type, @address, @preferredKadar,
        '-', @notes, @createdAt, 0, 0
      )
    `);
    for (const c of defaultFiveCustomers) {
      insertCust.run(c);
    }
    const custPlaceholders = KEPT_CUSTOMER_IDS.map(() => '?').join(', ');
    db.prepare(`DELETE FROM customers WHERE id NOT IN (${custPlaceholders})`).run(...KEPT_CUSTOMER_IDS);
    db.prepare('UPDATE customers SET totalSpent = 0, totalTransactions = 0').run();

    // 5..8: Build 150 real products/outlet, 5 holiday promos/outlet, 150 real transactions/outlet, 5 real shift closings
    db.prepare(`DELETE FROM products WHERE tenantId NOT IN (${tenantPlaceholders})`).run(...KEPT_TENANT_IDS);
    const tenantTags: Record<(typeof KEPT_TENANT_IDS)[number], string> = {
      'tenant-tms-001': 'MKI',
      'tenant-tmj-002': 'AML',
      'tenant-lke-003': 'BLM',
      'tenant-out-004': 'T004',
      'tenant-out-005': 'T005',
    };
    for (const tId of KEPT_TENANT_IDS) {
      generate150ProductsForOutlet(db, tId, tenantTags[tId]);
    }
    sync5PromosPerOutlet(db, todayStr);
    generate150TransactionsForAllOutlets(db, todayStr);
    rebuild5ShiftClosingsFromRealTransactions(db, todayStr);

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_compact_5_v1', '1');
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_expand_100_v1', '1');
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_promo_holiday_v1', '1');
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_real_hundreds_v1', '1');
  });

  compactTx();
}

export function migrateHolidayPromosV1(db: BetterSqlite3.Database): void {
  const alreadyFlag = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('seeded_promo_holiday_v1') as { value: string } | undefined;
  if (alreadyFlag?.value === '1') {
    return;
  }

  const todayStr = getTodayWibDateStr();
  const migrateTx = db.transaction(() => {
    sync5PromosPerOutlet(db, todayStr);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_promo_holiday_v1', '1');
  });

  migrateTx();
}

export function expandProductsAndTransactionsV1(db: BetterSqlite3.Database): void {
  const alreadyFlag = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('seeded_real_hundreds_v1') as { value: string } | undefined;
  if (alreadyFlag?.value === '1') {
    return;
  }

  const todayStr = getTodayWibDateStr();
  const tenantTags: Record<(typeof KEPT_TENANT_IDS)[number], string> = {
    'tenant-tms-001': 'MKI',
    'tenant-tmj-002': 'AML',
    'tenant-lke-003': 'BLM',
    'tenant-out-004': 'T004',
    'tenant-out-005': 'T005',
  };

  const expandTx = db.transaction(() => {
    // 1. Ensure customer base counters are 0 so customer stats come 100% from real SQL transactions
    db.prepare('UPDATE customers SET totalSpent = 0, totalTransactions = 0').run();

    // 2. Populate 150 real products per outlet (750 total across 5 outlets)
    for (const tId of KEPT_TENANT_IDS) {
      generate150ProductsForOutlet(db, tId, tenantTags[tId]);
    }

    // 3. Re-sync the 5 holiday/special-date promos per outlet so productIdsJson links cleanly to real products
    sync5PromosPerOutlet(db, todayStr);

    // 4. Populate 150 real transactions per outlet (750 total across 5 outlets) derived strictly from DB rows
    generate150TransactionsForAllOutlets(db, todayStr);

    // 5. Recompute shift_closings strictly from real DB records
    rebuild5ShiftClosingsFromRealTransactions(db, todayStr);

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_promo_holiday_v1', '1');
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_real_hundreds_v1', '1');
  });

  expandTx();
}
