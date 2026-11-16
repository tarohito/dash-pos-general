import Database from './sqlite-adapter.ts';
import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import type {
  AppThemeId,
  BroadcastAudienceMode,
  BroadcastCustomerAudienceItem,
  BroadcastDeliveryMode,
  BroadcastRecipientStatus,
  BuybackGoldItem,
  BuybackItem,
  BuybacksPageResponse,
  CategoriesWithStatsResponse,
  CategoryAttributeField,
  CategoryItem,
  CategoryPayload,
  CategoryStatsItem,
  Customer,
  CustomersPageResponse,
  CustomerWithStats,
  DashboardSummaryResponse,
  PaginatedResponse,
  PaymentDetails,
  Product,
  ProductsPageResponse,
  PromoBroadcastRecipient,
  PromoBroadcastRecord,
  PromoCampaign,
  PromoCouponValidationResult,
  PromosPageResponse,
  ReceiptLogoPreset,
  ReceiptPaperSize,
  ReceiptTheme,
  ShiftClosingCreatePayload,
  ShiftClosingRecord,
  ShiftClosingsPageResponse,
  ShiftLiveSummary,
  StoreSettings,
  StoreSettingsUpdatePayload,
  Tenant,
  Transaction,
  TransactionItem,
  TransactionsPageResponse,
  UserAccount,
  UserCreatePayload,
  UserRole,
  UsersPageResponse,
  UserUpdatePayload,
} from '../src/types/index.ts';
import {
  formatPromoDate,
  getTodayWibDateStr,
} from '../src/utils/promoDuration.ts';
import {
  compactSeedTo5V1,
  migrateHolidayPromosV1,
  expandProductsAndTransactionsV1,
} from './seedExpand100.ts';
import { migrateShopeeCategoriesV1 } from './shopeeCategorySeed.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'epaper-pos.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('cache_size = -64000'); // 64 MB memory page cache
db.pragma('temp_store = MEMORY'); // Sorting & temp tables in RAM
db.pragma('mmap_size = 268435456'); // 256 MB memory-mapped I/O for ultra fast reads

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    branchName TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    plan TEXT NOT NULL,
    cashierCount INTEGER NOT NULL DEFAULT 1,
    productCount INTEGER NOT NULL DEFAULT 0,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    slug TEXT NOT NULL,
    logoInitial TEXT NOT NULL,
    databaseSchema TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Aktif'
  );

  CREATE TABLE IF NOT EXISTS categories (
    name TEXT PRIMARY KEY,
    sortOrder INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId TEXT NOT NULL DEFAULT 'tenant-tms-001',
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    berat REAL NOT NULL,
    harga INTEGER NOT NULL,
    hpp INTEGER NOT NULL DEFAULT 0,
    stok INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT 'No Brand',
    kondisi TEXT NOT NULL DEFAULT 'Baru',
    deskripsi TEXT NOT NULL DEFAULT '',
    panjang REAL NOT NULL DEFAULT 0,
    lebar REAL NOT NULL DEFAULT 0,
    tinggi REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Aktif',
    image TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    invoiceNo TEXT UNIQUE NOT NULL,
    dateTime TEXT NOT NULL,
    dateStr TEXT NOT NULL,
    timeStr TEXT NOT NULL,
    cashier TEXT NOT NULL,
    customerName TEXT NOT NULL,
    totalQty INTEGER NOT NULL,
    totalBerat REAL NOT NULL,
    subtotal INTEGER NOT NULL,
    tax INTEGER NOT NULL,
    grandTotal INTEGER NOT NULL,
    paymentMethod TEXT NOT NULL,
    paymentDetailsJson TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS transaction_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transactionId TEXT NOT NULL,
    productId INTEGER NOT NULL,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    berat REAL NOT NULL,
    harga INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    image TEXT,
    FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS buybacks (
    id TEXT PRIMARY KEY,
    invoiceNo TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    timeStr TEXT,
    branchName TEXT,
    cashierName TEXT,
    customerName TEXT NOT NULL,
    customerPhone TEXT NOT NULL,
    customerNik TEXT,
    customerNpwp TEXT,
    customerAddress TEXT,
    sourceNote TEXT NOT NULL DEFAULT '-',
    itemType TEXT NOT NULL,
    kadar TEXT NOT NULL,
    beratKotor REAL NOT NULL,
    potonganBatu REAL NOT NULL DEFAULT 0,
    beratBersih REAL NOT NULL,
    hargaPerGram INTEGER NOT NULL,
    biayaLebur INTEGER NOT NULL DEFAULT 0,
    kondisi TEXT NOT NULL,
    totalKotor INTEGER,
    potonganBiaya INTEGER,
    pph22 INTEGER,
    totalBayar INTEGER NOT NULL,
    paymentMethod TEXT NOT NULL,
    bankName TEXT,
    accountNo TEXT,
    accountHolder TEXT,
    catatan TEXT,
    fotoKtp TEXT,
    fotoEmas TEXT,
    ttdNasabah TEXT,
    ttdPetugas TEXT,
    isAgreedLegal INTEGER NOT NULL DEFAULT 1,
    itemsJson TEXT
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    memberCode TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    nik TEXT,
    type TEXT NOT NULL,
    address TEXT,
    preferredKadar TEXT,
    ringSize TEXT,
    notes TEXT,
    createdAt TEXT NOT NULL,
    totalSpent INTEGER NOT NULL DEFAULT 0,
    totalTransactions INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS promos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    discountPercent REAL NOT NULL,
    label TEXT NOT NULL,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    productIdsJson TEXT NOT NULL DEFAULT '[]',
    isActive INTEGER NOT NULL DEFAULT 1,
    minPurchase INTEGER,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    fullName TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'branch_manager', 'cashier')),
    shiftLabel TEXT NOT NULL DEFAULT 'Shift 1 (08:00 - 16:00)',
    allowedTenantIdsJson TEXT NOT NULL DEFAULT '[]',
    defaultTenantId TEXT,
    isActive INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    lastLoginAt TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    activeTenantId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS store_settings (
    tenantId TEXT PRIMARY KEY,
    ppnPercent REAL NOT NULL DEFAULT 11,
    enablePpn INTEGER NOT NULL DEFAULT 1,
    goldPrice24kBuyback INTEGER NOT NULL DEFAULT 2350000,
    goldPrice22kBuyback INTEGER NOT NULL DEFAULT 1950000,
    goldPrice18kBuyback INTEGER NOT NULL DEFAULT 1420000,
    goldPrice16kBuyback INTEGER NOT NULL DEFAULT 1180000,
    receiptTagline TEXT NOT NULL DEFAULT '',
    receiptFooterNote TEXT NOT NULL DEFAULT 'Terima kasih telah berbelanja di {TOKO}.',
    receiptSaleTitle TEXT NOT NULL DEFAULT '',
    receiptBuybackTitle TEXT NOT NULL DEFAULT 'SURAT PEMBELIAN KEMBALI',
    receiptHeaderExtra TEXT NOT NULL DEFAULT '',
    receiptTheme TEXT NOT NULL DEFAULT 'midnight_navy',
    receiptDefaultPaperSize TEXT NOT NULL DEFAULT 'a5',
    receiptLogoPreset TEXT NOT NULL DEFAULT 'monogram',
    receiptCustomLogoUrl TEXT NOT NULL DEFAULT '',
    receiptShowWatermark INTEGER NOT NULL DEFAULT 0,
    receiptWatermarkOpacity INTEGER NOT NULL DEFAULT 6,
    receiptShowStoreAddress INTEGER NOT NULL DEFAULT 1,
    receiptShowBarcode INTEGER NOT NULL DEFAULT 0,
    receiptShowQrCode INTEGER NOT NULL DEFAULT 0,
    receiptShowPhoto INTEGER NOT NULL DEFAULT 0,
    receiptShowItemSku INTEGER NOT NULL DEFAULT 0,
    receiptShowTaxLine INTEGER NOT NULL DEFAULT 1,
    receiptShowCashierName INTEGER NOT NULL DEFAULT 1,
    receiptShowTerms INTEGER NOT NULL DEFAULT 0,
    receiptTermsTitle TEXT NOT NULL DEFAULT 'Catatan:',
    receiptTermsText TEXT NOT NULL DEFAULT '',
    receiptShowSignatures INTEGER NOT NULL DEFAULT 0,
    receiptSignatureGreeting TEXT NOT NULL DEFAULT 'Hormat Kami,',
    receiptCustomerSignLabel TEXT NOT NULL DEFAULT 'Pelanggan',
    receiptCashierSignLabel TEXT NOT NULL DEFAULT 'Kasir',
    autoPrintReceipt INTEGER NOT NULL DEFAULT 0,
    requireCustomerOnSale INTEGER NOT NULL DEFAULT 0,
    updatedAt TEXT NOT NULL,
    updatedBy TEXT
  );

  CREATE TABLE IF NOT EXISTS shift_closings (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    shiftCode TEXT UNIQUE NOT NULL,
    shiftDate TEXT NOT NULL,
    shiftLabel TEXT NOT NULL,
    cashierId TEXT NOT NULL,
    cashierName TEXT NOT NULL,
    openingCash INTEGER NOT NULL DEFAULT 0,
    totalSalesCount INTEGER NOT NULL DEFAULT 0,
    totalSalesAmount INTEGER NOT NULL DEFAULT 0,
    totalSalesGrams REAL NOT NULL DEFAULT 0,
    salesCash INTEGER NOT NULL DEFAULT 0,
    salesDebit INTEGER NOT NULL DEFAULT 0,
    salesTransfer INTEGER NOT NULL DEFAULT 0,
    salesQris INTEGER NOT NULL DEFAULT 0,
    totalBuybackCount INTEGER NOT NULL DEFAULT 0,
    totalBuybackAmount INTEGER NOT NULL DEFAULT 0,
    totalBuybackGrams REAL NOT NULL DEFAULT 0,
    buybackCash INTEGER NOT NULL DEFAULT 0,
    buybackTransfer INTEGER NOT NULL DEFAULT 0,
    voidSalesCount INTEGER NOT NULL DEFAULT 0,
    voidBuybackCount INTEGER NOT NULL DEFAULT 0,
    expectedCash INTEGER NOT NULL DEFAULT 0,
    actualCash INTEGER NOT NULL DEFAULT 0,
    cashVariance INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'closed',
    closedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_products_sku_lower ON products(LOWER(sku));
  CREATE INDEX IF NOT EXISTS idx_products_name_lower ON products(LOWER(name));
  CREATE INDEX IF NOT EXISTS idx_transactions_datetime ON transactions(dateTime DESC);
  CREATE INDEX IF NOT EXISTS idx_transactions_method ON transactions(paymentMethod);
  CREATE INDEX IF NOT EXISTS idx_transactions_customer_lower ON transactions(LOWER(customerName));
  CREATE INDEX IF NOT EXISTS idx_tx_items_txid ON transaction_items(transactionId);
  CREATE INDEX IF NOT EXISTS idx_buybacks_method ON buybacks(paymentMethod);
  CREATE INDEX IF NOT EXISTS idx_buybacks_customer_lower ON buybacks(LOWER(customerName));
  CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(type);
  CREATE INDEX IF NOT EXISTS idx_customers_name_lower ON customers(LOWER(name));
  CREATE INDEX IF NOT EXISTS idx_promos_active ON promos(isActive);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId);
  CREATE INDEX IF NOT EXISTS idx_shift_closings_tenant ON shift_closings(tenantId);
  CREATE INDEX IF NOT EXISTS idx_shift_closings_date ON shift_closings(shiftDate DESC);
  CREATE INDEX IF NOT EXISTS idx_shift_closings_cashier ON shift_closings(cashierId);

  CREATE TABLE IF NOT EXISTS promo_broadcasts (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    promoId TEXT NOT NULL,
    promoName TEXT NOT NULL,
    promoCode TEXT NOT NULL,
    discountPercent REAL NOT NULL DEFAULT 0,
    audienceMode TEXT NOT NULL,
    audienceSegment TEXT,
    deliveryMode TEXT NOT NULL,
    messageTemplate TEXT NOT NULL,
    totalRecipients INTEGER NOT NULL DEFAULT 0,
    sentCount INTEGER NOT NULL DEFAULT 0,
    failedCount INTEGER NOT NULL DEFAULT 0,
    createdBy TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS promo_broadcast_recipients (
    id TEXT PRIMARY KEY,
    broadcastId TEXT NOT NULL,
    customerId TEXT NOT NULL,
    customerName TEXT NOT NULL,
    memberCode TEXT NOT NULL,
    customerType TEXT NOT NULL,
    phone TEXT NOT NULL,
    waPhone TEXT NOT NULL,
    personalizedMessage TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    errorMessage TEXT,
    sentAt TEXT,
    FOREIGN KEY (broadcastId) REFERENCES promo_broadcasts(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_promo_broadcasts_tenant ON promo_broadcasts(tenantId, createdAt DESC);
  CREATE INDEX IF NOT EXISTS idx_promo_broadcast_recipients_bid ON promo_broadcast_recipients(broadcastId, status);
`);

function ensureColumn(table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('users', 'themePreference', "TEXT NOT NULL DEFAULT 'system'");

ensureColumn('transactions', 'status', "TEXT NOT NULL DEFAULT 'completed'");
ensureColumn('transactions', 'voidReason', 'TEXT');
ensureColumn('transactions', 'voidedAt', 'TEXT');
ensureColumn('transactions', 'customerId', 'TEXT');
ensureColumn('transactions', 'promoCode', 'TEXT');
ensureColumn('transactions', 'promoName', 'TEXT');
ensureColumn('transactions', 'discountAmount', 'INTEGER NOT NULL DEFAULT 0');

ensureColumn('buybacks', 'status', "TEXT NOT NULL DEFAULT 'completed'");
ensureColumn('buybacks', 'voidReason', 'TEXT');
ensureColumn('buybacks', 'voidedAt', 'TEXT');
ensureColumn('buybacks', 'customerId', 'TEXT');
ensureColumn('buybacks', 'createdAt', 'TEXT');

ensureColumn('customers', 'npwp', 'TEXT');
ensureColumn('customers', 'goldColor', 'TEXT');
ensureColumn('customers', 'braceletSize', 'TEXT');
ensureColumn('customers', 'birthDate', 'TEXT');

ensureColumn('products', 'tenantId', "TEXT NOT NULL DEFAULT 'tenant-tms-001'");
ensureColumn('products', 'brand', "TEXT NOT NULL DEFAULT 'No Brand'");
ensureColumn('products', 'kondisi', "TEXT NOT NULL DEFAULT 'Baru'");
ensureColumn('products', 'deskripsi', "TEXT NOT NULL DEFAULT ''");
ensureColumn('products', 'hpp', "INTEGER NOT NULL DEFAULT 0");
ensureColumn('products', 'panjang', "REAL NOT NULL DEFAULT 0");
ensureColumn('products', 'lebar', "REAL NOT NULL DEFAULT 0");
ensureColumn('products', 'tinggi', "REAL NOT NULL DEFAULT 0");
ensureColumn('products', 'status', "TEXT NOT NULL DEFAULT 'Aktif'");
ensureColumn('products', 'createdAt', 'TEXT');
ensureColumn('products', 'attributesJson', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn('categories', 'createdAt', 'TEXT');
ensureColumn('categories', 'parentName', 'TEXT');
ensureColumn('categories', 'icon', "TEXT NOT NULL DEFAULT 'category'");
ensureColumn('categories', 'skuPrefix', "TEXT NOT NULL DEFAULT ''");
ensureColumn('categories', 'isActive', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('categories', 'description', "TEXT NOT NULL DEFAULT ''");
ensureColumn('categories', 'attributeFieldsJson', "TEXT NOT NULL DEFAULT '[]'");
ensureColumn('transactions', 'tenantId', "TEXT NOT NULL DEFAULT 'tenant-tms-001'");
ensureColumn('buybacks', 'tenantId', "TEXT NOT NULL DEFAULT 'tenant-tms-001'");
ensureColumn('promos', 'tenantId', "TEXT NOT NULL DEFAULT 'tenant-tms-001'");
ensureColumn('promos', 'createdAt', 'TEXT');
ensureColumn('tenants', 'logoUrl', "TEXT NOT NULL DEFAULT ''");
ensureColumn('tenants', 'createdAt', 'TEXT');

// Backfill buybacks.createdAt from invoiceNo (BB-YYYYMMDD-xxx) for historical rows
const nullCreatedBuybacks = db
  .prepare("SELECT id, invoiceNo FROM buybacks WHERE createdAt IS NULL OR TRIM(createdAt) = ''")
  .all() as Array<{ id: string; invoiceNo: string }>;
if (nullCreatedBuybacks.length > 0) {
  const updCreated = db.prepare('UPDATE buybacks SET createdAt = ? WHERE id = ?');
  for (const b of nullCreatedBuybacks) {
    const m = /^BB-(\d{4})(\d{2})(\d{2})-/.exec(b.invoiceNo || '');
    const iso = m ? `${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z` : '2026-11-11T12:00:00.000Z';
    updCreated.run(iso, b.id);
  }
}
db.exec('CREATE INDEX IF NOT EXISTS idx_buybacks_created_at ON buybacks(createdAt);');

function migrateMultiTenantSchema(): void {
  const migratedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('migrated_multitenant_v1') as
    | { value: string }
    | undefined;
  if (migratedRow?.value === '1') {
    return;
  }

  db.pragma('foreign_keys = OFF');
  const migrateTx = db.transaction(() => {
    // Recreate products without global UNIQUE(sku) so each outlet can maintain its own SKUs
    db.exec(`
      CREATE TABLE products_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenantId TEXT NOT NULL DEFAULT 'tenant-tms-001',
        sku TEXT NOT NULL,
        name TEXT NOT NULL,
        berat REAL NOT NULL,
        harga INTEGER NOT NULL,
        stok INTEGER NOT NULL DEFAULT 0,
        category TEXT NOT NULL,
        image TEXT NOT NULL
      );
      INSERT INTO products_new (id, tenantId, sku, name, berat, harga, stok, category, image)
      SELECT id, COALESCE(NULLIF(TRIM(tenantId), ''), 'tenant-tms-001'), sku, name, berat, harga, stok, category, image
      FROM products;
      DROP TABLE products;
      ALTER TABLE products_new RENAME TO products;

      CREATE TABLE promos_new (
        id TEXT PRIMARY KEY,
        tenantId TEXT NOT NULL DEFAULT 'tenant-tms-001',
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        discountPercent REAL NOT NULL,
        label TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        productIdsJson TEXT NOT NULL DEFAULT '[]',
        isActive INTEGER NOT NULL DEFAULT 1,
        minPurchase INTEGER,
        description TEXT
      );
      INSERT INTO promos_new (id, tenantId, name, code, discountPercent, label, startDate, endDate, productIdsJson, isActive, minPurchase, description)
      SELECT id, COALESCE(NULLIF(TRIM(tenantId), ''), 'tenant-tms-001'), name, code, discountPercent, label, startDate, endDate, productIdsJson, isActive, minPurchase, description
      FROM promos;
      DROP TABLE promos;
      ALTER TABLE promos_new RENAME TO promos;
    `);

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('migrated_multitenant_v1', '1');
  });

  try {
    migrateTx();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

migrateMultiTenantSchema();

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenantId);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_products_sku_lower ON products(LOWER(sku));
  CREATE INDEX IF NOT EXISTS idx_products_name_lower ON products(LOWER(name));
  CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_sku_lower ON products(tenantId, LOWER(sku));
  CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON transactions(tenantId);
  CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customerId);
  CREATE INDEX IF NOT EXISTS idx_buybacks_tenant ON buybacks(tenantId);
  CREATE INDEX IF NOT EXISTS idx_buybacks_customer_id ON buybacks(customerId);
  CREATE INDEX IF NOT EXISTS idx_promos_tenant ON promos(tenantId);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_promos_tenant_code_lower ON promos(tenantId, LOWER(code));
  CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_nik_unique ON customers(nik) WHERE nik IS NOT NULL AND TRIM(nik) != '';
`);

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const RETAIL_IMG = {
  parfum: '/assets/products/parfum.jpg',
  serum: '/assets/products/serum.jpg',
  cream: '/assets/products/cream.jpg',
  bodycare: '/assets/products/bodycare.jpg',
  makeup: '/assets/products/makeup.jpg',
};

const RETAIL_CATEGORIES = [
  'Parfum',
  'Skincare',
  'Body Care',
  'Make Up',
  'Hair Care',
  'Paket Bundling',
  'Aksesoris',
];

const RETAIL_PRODUCTS: Array<Omit<Product, 'isPromo' | 'promoDiscountPercent' | 'promoLabel'>> = [
  // Parfum (1 - 8)
  { id: 1, sku: 'PF-001', name: 'Eau de Parfum Vanilla Noir 50ml', berat: 50, harga: 285000, stok: 18, category: 'Parfum', image: RETAIL_IMG.parfum },
  { id: 2, sku: 'PF-002', name: 'Eau de Parfum White Musk 100ml', berat: 100, harga: 395000, stok: 12, category: 'Parfum', image: RETAIL_IMG.parfum },
  { id: 3, sku: 'PF-003', name: 'Eau de Parfum Oud & Amber 50ml', berat: 50, harga: 345000, stok: 9, category: 'Parfum', image: RETAIL_IMG.parfum },
  { id: 4, sku: 'PF-004', name: 'Eau de Parfum Bergamot Cedar 30ml', berat: 30, harga: 195000, stok: 24, category: 'Parfum', image: RETAIL_IMG.parfum },
  { id: 5, sku: 'PF-005', name: 'Extrait de Parfum Velvet Rose 50ml', berat: 50, harga: 450000, stok: 7, category: 'Parfum', image: RETAIL_IMG.parfum },
  { id: 6, sku: 'PF-006', name: 'Eau de Toilette Fresh Neroli 100ml', berat: 100, harga: 265000, stok: 14, category: 'Parfum', image: RETAIL_IMG.parfum },
  { id: 7, sku: 'PF-007', name: 'Body Mist Sakura Bloom 150ml', berat: 150, harga: 115000, stok: 30, category: 'Parfum', image: RETAIL_IMG.parfum },
  { id: 8, sku: 'PF-008', name: 'Unisex Parfum Woody Vetiver 50ml', berat: 50, harga: 325000, stok: 11, category: 'Parfum', image: RETAIL_IMG.parfum },

  // Skincare (9 - 18)
  { id: 9, sku: 'SK-001', name: 'Niacinamide 10% + Zinc Serum 30ml', berat: 30, harga: 139000, stok: 26, category: 'Skincare', image: RETAIL_IMG.serum },
  { id: 10, sku: 'SK-002', name: 'Vitamin C Brightening Serum 30ml', berat: 30, harga: 159000, stok: 22, category: 'Skincare', image: RETAIL_IMG.serum },
  { id: 11, sku: 'SK-003', name: 'Encapsulated Retinol Night Serum 20ml', berat: 20, harga: 175000, stok: 15, category: 'Skincare', image: RETAIL_IMG.serum },
  { id: 12, sku: 'SK-004', name: 'Hyaluronic Acid Hydration Serum 30ml', berat: 30, harga: 145000, stok: 19, category: 'Skincare', image: RETAIL_IMG.serum },
  { id: 13, sku: 'SK-005', name: '5X Ceramide Barrier Moisturizer 50g', berat: 50, harga: 149000, stok: 28, category: 'Skincare', image: RETAIL_IMG.cream },
  { id: 14, sku: 'SK-006', name: 'Centella Asiatica Soothing Gel 80g', berat: 80, harga: 125000, stok: 20, category: 'Skincare', image: RETAIL_IMG.cream },
  { id: 15, sku: 'SK-007', name: 'UV Shield Aqua Sunscreen SPF 50 PA++++ 40ml', berat: 40, harga: 118000, stok: 32, category: 'Skincare', image: RETAIL_IMG.cream },
  { id: 16, sku: 'SK-008', name: 'Amino Acid Low pH Facial Wash 100ml', berat: 100, harga: 89000, stok: 25, category: 'Skincare', image: RETAIL_IMG.bodycare },
  { id: 17, sku: 'SK-009', name: 'Hydro Essence Soothing Toner 120ml', berat: 120, harga: 112000, stok: 16, category: 'Skincare', image: RETAIL_IMG.serum },
  { id: 18, sku: 'SK-010', name: 'Mugwort Clay Pore Clarifying Mask 60g', berat: 60, harga: 109000, stok: 14, category: 'Skincare', image: RETAIL_IMG.cream },

  // Body Care (19 - 23)
  { id: 19, sku: 'BC-001', name: 'Botanical Shea Body Lotion 250ml', berat: 250, harga: 129000, stok: 18, category: 'Body Care', image: RETAIL_IMG.bodycare },
  { id: 20, sku: 'BC-002', name: 'Coffee & Almond Brightening Body Scrub 200g', berat: 200, harga: 98000, stok: 21, category: 'Body Care', image: RETAIL_IMG.cream },
  { id: 21, sku: 'BC-003', name: 'Eucalyptus Relaxing Shower Gel 300ml', berat: 300, harga: 95000, stok: 17, category: 'Body Care', image: RETAIL_IMG.bodycare },
  { id: 22, sku: 'BC-004', name: 'Intensive Rose Hand & Nail Cream 50g', berat: 50, harga: 68000, stok: 28, category: 'Body Care', image: RETAIL_IMG.cream },
  { id: 23, sku: 'BC-005', name: 'Niacinamide Brightening Body Serum 180ml', berat: 180, harga: 119000, stok: 15, category: 'Body Care', image: RETAIL_IMG.bodycare },

  // Make Up (24 - 28)
  { id: 24, sku: 'MU-001', name: 'Velvet Matte Lip Tint - Rosewood 4g', berat: 4, harga: 85000, stok: 30, category: 'Make Up', image: RETAIL_IMG.makeup },
  { id: 25, sku: 'MU-002', name: 'Silk Cushion Matte Foundation SPF 35 15g', berat: 15, harga: 189000, stok: 16, category: 'Make Up', image: RETAIL_IMG.makeup },
  { id: 26, sku: 'MU-003', name: 'Micro-Blur Translucent Loose Powder 20g', berat: 20, harga: 135000, stok: 19, category: 'Make Up', image: RETAIL_IMG.makeup },
  { id: 27, sku: 'MU-004', name: 'Soft Cream Cheek Blush - Peach Nude 10g', berat: 10, harga: 99000, stok: 22, category: 'Make Up', image: RETAIL_IMG.makeup },
  { id: 28, sku: 'MU-005', name: 'Volume Curl Waterproof Mascara 8g', berat: 8, harga: 108000, stok: 0, category: 'Make Up', image: RETAIL_IMG.makeup },

  // Hair Care (29 - 31)
  { id: 29, sku: 'HC-001', name: 'Moroccan Argan Hair Repair Serum 60ml', berat: 60, harga: 142000, stok: 14, category: 'Hair Care', image: RETAIL_IMG.serum },
  { id: 30, sku: 'HC-002', name: 'Keratin Smooth Intensive Hair Mask 200g', berat: 200, harga: 128000, stok: 12, category: 'Hair Care', image: RETAIL_IMG.cream },
  { id: 31, sku: 'HC-003', name: 'Ginseng & Rosemary Hair Tonic 100ml', berat: 100, harga: 115000, stok: 17, category: 'Hair Care', image: RETAIL_IMG.bodycare },

  // Paket Bundling (32 - 34)
  { id: 32, sku: 'PB-001', name: 'Signature Gift Hampers Parfum + Lotion', berat: 300, harga: 389000, stok: 8, category: 'Paket Bundling', image: RETAIL_IMG.parfum },
  { id: 33, sku: 'PB-002', name: 'Glowing Basic Skincare 3-Step Set', berat: 180, harga: 359000, stok: 11, category: 'Paket Bundling', image: RETAIL_IMG.serum },
  { id: 34, sku: 'PB-003', name: 'Fragrance Discovery Travel Set (4x10ml)', berat: 40, harga: 249000, stok: 15, category: 'Paket Bundling', image: RETAIL_IMG.parfum },

  // Aksesoris (35 - 36)
  { id: 35, sku: 'AK-001', name: 'Refillable Perfume Travel Atomizer 10ml', berat: 10, harga: 49000, stok: 35, category: 'Aksesoris', image: RETAIL_IMG.parfum },
  { id: 36, sku: 'AK-002', name: 'Pro Blending Sponge & Brush Pouch Set', berat: 45, harga: 79000, stok: 0, category: 'Aksesoris', image: RETAIL_IMG.makeup },
];

const RETAIL_CUSTOMERS: Customer[] = [
  {
    id: 'CUST-001',
    memberCode: 'MBR-001',
    name: 'Hj. Siti Rahmah',
    phone: '081234567890',
    nik: '3201124508780001',
    type: 'VIP',
    address: 'Jl. Riau No. 45, Bandung',
    preferredKadar: 'Parfum EDP',
    ringSize: '-',
    notes: 'Pelanggan langganan parfum Vanilla Noir & paket hampers.',
    createdAt: '2026-01-15',
    totalSpent: 4850000,
    totalTransactions: 6,
  },
  {
    id: 'CUST-002',
    memberCode: 'MBR-002',
    name: 'Bpk. Hendra Wijaya',
    phone: '081298765432',
    nik: '3171051906800002',
    type: 'VIP',
    address: 'Apartemen Sudirman Park Tower B-12, Jakarta',
    preferredKadar: 'Parfum Unisex',
    ringSize: '-',
    notes: 'Kolektor parfum Woody Vetiver, Oud & Amber.',
    createdAt: '2026-03-20',
    totalSpent: 5400000,
    totalTransactions: 4,
  },
  {
    id: 'CUST-003',
    memberCode: 'MBR-003',
    name: 'Ibu Ratna Dewi',
    phone: '085612349876',
    nik: '3273016405850003',
    type: 'Reguler',
    address: 'Komplek Permata Buah Batu Blok C-8, Bandung',
    preferredKadar: 'Skincare Ceramide',
    ringSize: '-',
    notes: 'Rutin belanja Ceramide Moisturizer dan Aqua Sunscreen.',
    createdAt: '2026-05-10',
    totalSpent: 1850000,
    totalTransactions: 3,
  },
  {
    id: 'CUST-004',
    memberCode: 'MBR-004',
    name: 'Budi Santoso',
    phone: '081987654321',
    nik: '3204101202880004',
    type: 'Reguler',
    address: 'Jl. Cihanjuang No. 102, Cimahi',
    preferredKadar: 'Body Care',
    ringSize: '-',
    notes: 'Suka shower gel eucalyptus & hair tonic ginseng.',
    createdAt: '2026-07-02',
    totalSpent: 960000,
    totalTransactions: 2,
  },
  {
    id: 'CUST-005',
    memberCode: 'MBR-005',
    name: 'Butik Cantik Nusantara (Bpk. Chandra)',
    phone: '081322334455',
    nik: '3578010504750005',
    type: 'Mitra / Toko',
    address: 'Pasar Atom Tahap 2 Lt. Dasar No. 18, Surabaya',
    preferredKadar: 'Paket Grosir',
    ringSize: '-',
    notes: 'Mitra reseller parfum EDP, skincare serum, dan gift hampers.',
    createdAt: '2026-02-11',
    totalSpent: 18500000,
    totalTransactions: 12,
  },
  {
    id: 'CUST-006',
    memberCode: 'MBR-006',
    name: 'Ibu Wulandari Kartika',
    phone: '081277665544',
    nik: '3174095403830006',
    type: 'VIP',
    address: 'Jl. Kemang Timur No. 19, Jakarta Selatan',
    preferredKadar: 'Skincare Brightening',
    ringSize: '-',
    notes: 'Pembeli rutin Vitamin C Serum & Silk Cushion Foundation.',
    createdAt: '2026-04-05',
    totalSpent: 3920000,
    totalTransactions: 5,
  },
  {
    id: 'CUST-007',
    memberCode: 'MBR-007',
    name: 'Sdr. Bagus Pratama',
    phone: '085788991122',
    nik: '3173041109940007',
    type: 'Reguler',
    address: 'Jl. Tanjung Duren Barat IV No. 8, Jakarta Barat',
    preferredKadar: 'Parfum Citrus',
    ringSize: '-',
    notes: 'Suka EDP Bergamot Cedar & facial wash low pH.',
    createdAt: '2026-06-18',
    totalSpent: 840000,
    totalTransactions: 2,
  },
  {
    id: 'CUST-008',
    memberCode: 'MBR-008',
    name: 'Ny. Melati Kusuma',
    phone: '081399887766',
    nik: '3171034807790008',
    type: 'VIP',
    address: 'Menteng Residence Blok A-3, Jakarta Pusat',
    preferredKadar: 'Extrait Parfum',
    ringSize: '-',
    notes: 'Pelanggan prioritas Extrait Velvet Rose & Retinol Night Serum.',
    createdAt: '2026-01-28',
    totalSpent: 6400000,
    totalTransactions: 7,
  },
  {
    id: 'CUST-009',
    memberCode: 'MBR-009',
    name: 'Ibu Nurhayati',
    phone: '082144556677',
    nik: '3275026108860009',
    type: 'Reguler',
    address: 'Perum Harapan Indah Blok EF-12, Bekasi',
    preferredKadar: 'Make Up Daily',
    ringSize: '-',
    notes: 'Suka velvet lip tint, loose powder, & body lotion shea.',
    createdAt: '2026-08-12',
    totalSpent: 720000,
    totalTransactions: 2,
  },
  {
    id: 'CUST-010',
    memberCode: 'MBR-010',
    name: 'dr. Karina Maharani',
    phone: '081122334455',
    nik: '3174045211900010',
    type: 'VIP',
    address: 'Jl. Senopati Raya No. 64, Kebayoran Baru, Jakarta Selatan',
    preferredKadar: 'Skincare Sensitive',
    ringSize: '-',
    notes: 'Preferensi produk skincare bebas alkohol & Centella Soothing Gel.',
    createdAt: '2026-03-09',
    totalSpent: 3420000,
    totalTransactions: 4,
  },
  {
    id: 'CUST-011',
    memberCode: 'MBR-011',
    name: 'Bpk. Agus Salim',
    phone: '081566778899',
    nik: '3671011505810011',
    type: 'Reguler',
    address: 'Jl. Daan Mogot KM 12 No. 55, Tangerang',
    preferredKadar: 'Parfum Travel',
    ringSize: '-',
    notes: 'Sering membeli Fragrance Discovery Set untuk dinas luar kota.',
    createdAt: '2026-07-24',
    totalSpent: 1280000,
    totalTransactions: 3,
  },
  {
    id: 'CUST-012',
    memberCode: 'MBR-012',
    name: 'Siti Aminah',
    phone: '085233445566',
    nik: '3175064304960012',
    type: 'Reguler',
    address: 'Jl. Rawamangun Muka No. 21, Jakarta Timur',
    preferredKadar: 'Body Mist & Lip Tint',
    ringSize: '-',
    notes: 'Sering beli Body Mist Sakura Bloom & kado ulang tahun.',
    createdAt: '2026-09-03',
    totalSpent: 650000,
    totalTransactions: 2,
  },
  {
    id: 'CUST-013',
    memberCode: 'MBR-013',
    name: 'CV Berkah Kosmetik Nusantara',
    phone: '081788990011',
    nik: '3172021801740013',
    type: 'Mitra / Toko',
    address: 'Jl. Cikini Raya No. 88, Jakarta Pusat',
    preferredKadar: 'Skincare & Body Care',
    ringSize: '-',
    notes: 'Mitra distributor produk perawatan kulit & paket bundling.',
    createdAt: '2026-02-25',
    totalSpent: 14200000,
    totalTransactions: 9,
  },
  {
    id: 'CUST-014',
    memberCode: 'MBR-014',
    name: 'Ibu Yuniarti Susilo',
    phone: '081855443322',
    nik: '3276035906840014',
    type: 'Reguler',
    address: 'Pesona Khayangan Blok D-10, Depok',
    preferredKadar: 'Hair Care',
    ringSize: '-',
    notes: 'Langganan Moroccan Argan Hair Serum & Keratin Hair Mask.',
    createdAt: '2026-06-29',
    totalSpent: 1140000,
    totalTransactions: 2,
  },
  {
    id: 'CUST-015',
    memberCode: 'MBR-015',
    name: 'Rizky Ramadhan & Nabila',
    phone: '081266554433',
    nik: '3174012208930015',
    type: 'VIP',
    address: 'Jl. Tebet Barat Dalam IX No. 14, Jakarta Selatan',
    preferredKadar: 'Gift Hampers',
    ringSize: '-',
    notes: 'Pembeli paket hampers seserahan parfum & skincare glowing set.',
    createdAt: '2026-10-14',
    totalSpent: 2650000,
    totalTransactions: 2,
  },
  {
    id: 'CUST-016',
    memberCode: 'MBR-016',
    name: 'Hj. Fatimah Az-Zahra',
    phone: '081344556611',
    nik: '3175016702760016',
    type: 'VIP',
    address: 'Jl. Matraman Raya No. 112, Jakarta Timur',
    preferredKadar: 'Parfum Oud & Body Care',
    ringSize: '-',
    notes: 'Kolektor parfum Oud & Amber serta Botanical Shea Body Lotion.',
    createdAt: '2026-01-19',
    totalSpent: 5200000,
    totalTransactions: 5,
  },
];

const RETAIL_PROMOS: PromoCampaign[] = [
  {
    id: 'PRM-001',
    name: 'Promo Signature Parfum 15%',
    code: 'PARFUM15',
    discountPercent: 15,
    label: 'Diskon 15%',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    productIds: [1, 2, 3, 5],
    isActive: true,
    minPurchase: 250000,
    description: 'Potongan spesial 15% untuk koleksi Eau de Parfum & Extrait pilihan.',
  },
  {
    id: 'PRM-002',
    name: 'Skincare Glowing Week',
    code: 'GLOW10',
    discountPercent: 10,
    label: 'Diskon 10%',
    startDate: '2026-11-05',
    endDate: '2026-11-25',
    productIds: [9, 10, 13, 15],
    isActive: true,
    minPurchase: 150000,
    description: 'Diskon 10% untuk rangkaian serum pencerah, ceramide moisturizer, dan sunscreen.',
  },
  {
    id: 'PRM-003',
    name: 'Self-Care Body & Hair Treats',
    code: 'BODYCARE8',
    discountPercent: 8,
    label: 'Diskon 8%',
    startDate: '2026-11-10',
    endDate: '2026-11-28',
    productIds: [19, 20, 29, 30],
    isActive: true,
    minPurchase: 100000,
    description: 'Potongan langsung untuk produk body lotion, body scrub, dan hair care pilihan.',
  },
  {
    id: 'PRM-004',
    name: 'Flawless Make Up Promo',
    code: 'BEAUTY12',
    discountPercent: 12,
    label: 'Diskon 12%',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    productIds: [24, 25, 26],
    isActive: true,
    description: 'Harga spesial untuk koleksi lip tint, cushion foundation, dan loose powder.',
  },
  {
    id: 'PRM-005',
    name: 'Gift Hampers & Bundling Hemat',
    code: 'HAMPERS10',
    discountPercent: 10,
    label: 'Diskon 10%',
    startDate: '2026-11-08',
    endDate: '2026-11-24',
    productIds: [32, 33, 34],
    isActive: true,
    description: 'Diskon paket bundling kado parfum, skincare set, dan travel discovery set.',
  },
  {
    id: 'PRM-006',
    name: 'Promo Payday Oktober',
    code: 'PAYDAY5',
    discountPercent: 5,
    label: 'Diskon 5%',
    startDate: '2026-10-25',
    endDate: '2026-10-31',
    productIds: [4, 7, 16],
    isActive: false,
    minPurchase: 100000,
    description: 'Program promo gajian akhir bulan Oktober (periode selesai).',
  },
];

function buildRetailSeedTransactions(): Transaction[] {
  const prodMap = new Map(RETAIL_PRODUCTS.map(p => [p.id, p]));
  const buildTx = (cfg: {
    id: string;
    invoiceNo: string;
    isoDate: string;
    cashier: string;
    customerName: string;
    lines: Array<{ productId: number; qty: number }>;
    paymentMethod: 'cash' | 'debit' | 'transfer' | 'qris';
    paymentDetails: PaymentDetails;
  }): Transaction => {
    const d = new Date(cfg.isoDate);
    const items: TransactionItem[] = cfg.lines.map(l => {
      const p = prodMap.get(l.productId)!;
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        berat: p.berat,
        harga: p.harga,
        qty: l.qty,
        subtotal: p.harga * l.qty,
        image: p.image,
      };
    });
    const subtotal = items.reduce((s, it) => s + it.subtotal, 0);
    const tax = Math.round(subtotal * 0.11);
    const grandTotal = subtotal + tax;
    const totalQty = items.reduce((s, it) => s + it.qty, 0);
    const totalBerat = parseFloat(items.reduce((s, it) => s + it.berat * it.qty, 0).toFixed(2));
    const paymentDetails: PaymentDetails =
      cfg.paymentMethod === 'cash' && cfg.paymentDetails.cashReceived !== undefined
        ? {
            ...cfg.paymentDetails,
            cashChange: Math.max(0, cfg.paymentDetails.cashReceived - grandTotal),
          }
        : cfg.paymentDetails;

    return {
      id: cfg.id,
      invoiceNo: cfg.invoiceNo,
      dateTime: d.toISOString(),
      dateStr: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      timeStr: d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      cashier: cfg.cashier,
      customerName: cfg.customerName,
      items,
      totalQty,
      totalBerat,
      subtotal,
      tax,
      grandTotal,
      paymentMethod: cfg.paymentMethod,
      paymentDetails,
    };
  };

  return [
    buildTx({
      id: 'TRX-20261101-001',
      invoiceNo: 'TRX-20261101-001',
      isoDate: '2026-11-01T10:15:00',
      cashier: 'Siti Nurhaliza (Kasir 1)',
      customerName: 'Ibu Wulandari Kartika',
      lines: [
        { productId: 10, qty: 1 },
        { productId: 25, qty: 1 },
      ],
      paymentMethod: 'transfer',
      paymentDetails: { transferBank: 'BCA', transferAccountNo: '5400192831', transferRef: 'TRF-261101-8812' },
    }),
    buildTx({
      id: 'TRX-20261102-001',
      invoiceNo: 'TRX-20261102-001',
      isoDate: '2026-11-02T14:20:00',
      cashier: 'Dewi Lestari (Kasir 2)',
      customerName: 'Siti Aminah',
      lines: [
        { productId: 7, qty: 1 },
        { productId: 24, qty: 1 },
      ],
      paymentMethod: 'transfer',
      paymentDetails: { transferBank: 'BCA', transferRef: 'TRF-261102-4410' },
    }),
    buildTx({
      id: 'TRX-20261103-001',
      invoiceNo: 'TRX-20261103-001',
      isoDate: '2026-11-03T11:40:00',
      cashier: 'Siti Nurhaliza (Kasir 1)',
      customerName: 'Hj. Siti Rahmah',
      lines: [
        { productId: 1, qty: 1 },
        { productId: 32, qty: 1 },
      ],
      paymentMethod: 'transfer',
      paymentDetails: { transferBank: 'Mandiri', transferRef: 'TRF-261103-4102' },
    }),
    buildTx({
      id: 'TRX-20261105-001',
      invoiceNo: 'TRX-20261105-001',
      isoDate: '2026-11-05T16:05:00',
      cashier: 'Dewi Lestari (Kasir 2)',
      customerName: 'dr. Karina Maharani',
      lines: [
        { productId: 14, qty: 1 },
        { productId: 15, qty: 2 },
      ],
      paymentMethod: 'cash',
      paymentDetails: { cashReceived: 450000 },
    }),
    buildTx({
      id: 'TRX-20261106-001',
      invoiceNo: 'TRX-20261106-001',
      isoDate: '2026-11-06T13:30:00',
      cashier: 'Siti Nurhaliza (Kasir 1)',
      customerName: 'Ibu Nurhayati',
      lines: [
        { productId: 13, qty: 2 },
        { productId: 22, qty: 1 },
      ],
      paymentMethod: 'cash',
      paymentDetails: { cashReceived: 450000 },
    }),
    buildTx({
      id: 'TRX-20261107-001',
      invoiceNo: 'TRX-20261107-001',
      isoDate: '2026-11-07T19:15:00',
      cashier: 'Andi Pratama (Supervisor)',
      customerName: 'Rizky Ramadhan & Nabila',
      lines: [
        { productId: 32, qty: 1 },
        { productId: 33, qty: 1 },
      ],
      paymentMethod: 'transfer',
      paymentDetails: { transferBank: 'BCA', transferAccountNo: '8812093412', transferRef: 'TRF-261107-5501' },
    }),
    buildTx({
      id: 'TRX-20261108-001',
      invoiceNo: 'TRX-20261108-001',
      isoDate: '2026-11-08T15:45:00',
      cashier: 'Dewi Lestari (Kasir 2)',
      customerName: 'Bpk. Agus Salim',
      lines: [
        { productId: 34, qty: 1 },
        { productId: 35, qty: 2 },
      ],
      paymentMethod: 'transfer',
      paymentDetails: { transferBank: 'BRI', transferAccountNo: '002301928371', transferRef: 'TRF-261108-1924' },
    }),
    buildTx({
      id: 'TRX-20261109-001',
      invoiceNo: 'TRX-20261109-001',
      isoDate: '2026-11-09T11:10:00',
      cashier: 'Siti Nurhaliza (Kasir 1)',
      customerName: 'Ibu Yuniarti Susilo',
      lines: [
        { productId: 29, qty: 1 },
        { productId: 30, qty: 1 },
      ],
      paymentMethod: 'transfer',
      paymentDetails: { transferBank: 'BRI', transferRef: 'TRF-261109-8821' },
    }),
    buildTx({
      id: 'TRX-20261110-001',
      invoiceNo: 'TRX-20261110-001',
      isoDate: '2026-11-10T17:25:00',
      cashier: 'Andi Pratama (Supervisor)',
      customerName: 'Ny. Melati Kusuma',
      lines: [
        { productId: 5, qty: 1 },
        { productId: 11, qty: 1 },
      ],
      paymentMethod: 'transfer',
      paymentDetails: { transferBank: 'Mandiri', transferAccountNo: '122009812731', transferRef: 'TRF-261110-3302' },
    }),
    buildTx({
      id: 'TRX-20261110-002',
      invoiceNo: 'TRX-20261110-002',
      isoDate: '2026-11-10T19:50:00',
      cashier: 'Dewi Lestari (Kasir 2)',
      customerName: 'Sdr. Bagus Pratama',
      lines: [
        { productId: 4, qty: 1 },
        { productId: 16, qty: 1 },
      ],
      paymentMethod: 'cash',
      paymentDetails: { cashReceived: 400000 },
    }),
    buildTx({
      id: 'TRX-20261111-001',
      invoiceNo: 'TRX-20261111-001',
      isoDate: '2026-11-11T10:35:00',
      cashier: 'Siti Nurhaliza (Kasir 1)',
      customerName: 'Hj. Fatimah Az-Zahra',
      lines: [
        { productId: 3, qty: 1 },
        { productId: 19, qty: 1 },
      ],
      paymentMethod: 'transfer',
      paymentDetails: { transferBank: 'BCA', transferAccountNo: '7740192884', transferRef: 'TRF-261111-7019' },
    }),
    buildTx({
      id: 'TRX-20261111-002',
      invoiceNo: 'TRX-20261111-002',
      isoDate: '2026-11-11T14:55:00',
      cashier: 'Dewi Lestari (Kasir 2)',
      customerName: 'Ibu Ratna Dewi',
      lines: [
        { productId: 9, qty: 1 },
        { productId: 17, qty: 1 },
      ],
      paymentMethod: 'cash',
      paymentDetails: { cashReceived: 350000 },
    }),
    buildTx({
      id: 'TRX-20261112-002',
      invoiceNo: 'TRX-20261112-002',
      isoDate: '2026-11-12T09:45:00',
      cashier: 'Siti Nurhaliza (Kasir 1)',
      customerName: 'Bpk. Hendra Wijaya',
      lines: [
        { productId: 8, qty: 1 },
        { productId: 2, qty: 1 },
      ],
      paymentMethod: 'transfer',
      paymentDetails: { transferBank: 'BCA', transferRef: 'TRF-261112-2814' },
    }),
    buildTx({
      id: 'TRX-20261112-003',
      invoiceNo: 'TRX-20261112-003',
      isoDate: '2026-11-12T12:15:00',
      cashier: 'Andi Pratama (Supervisor)',
      customerName: 'CV Berkah Kosmetik Nusantara',
      lines: [
        { productId: 32, qty: 2 },
        { productId: 33, qty: 2 },
      ],
      paymentMethod: 'transfer',
      paymentDetails: { transferBank: 'Mandiri', transferAccountNo: '103009482711', transferRef: 'TRF-261112-2041' },
    }),
    buildTx({
      id: 'TRX-20261112-004',
      invoiceNo: 'TRX-20261112-004',
      isoDate: '2026-11-12T15:20:00',
      cashier: 'Dewi Lestari (Kasir 2)',
      customerName: 'Ibu Wulandari Kartika',
      lines: [
        { productId: 24, qty: 2 },
        { productId: 35, qty: 1 },
      ],
      paymentMethod: 'cash',
      paymentDetails: { cashReceived: 250000 },
    }),
    buildTx({
      id: 'TRX-20261112-005',
      invoiceNo: 'TRX-20261112-005',
      isoDate: '2026-11-12T18:40:00',
      cashier: 'Siti Nurhaliza (Kasir 1)',
      customerName: 'dr. Karina Maharani',
      lines: [
        { productId: 6, qty: 1 },
        { productId: 12, qty: 1 },
      ],
      paymentMethod: 'transfer',
      paymentDetails: { transferBank: 'BNI', transferRef: 'TRF-261112-9103' },
    }),
  ];
}

function seedSecondaryOutletsIfNeeded(): void {
  const alreadySeeded = db.prepare('SELECT value FROM settings WHERE key = ?').get('seeded_multitenant_outlets_v1') as
    | { value: string }
    | undefined;
  if (alreadySeeded?.value === '1') {
    return;
  }

  const secondaryTx = db.transaction(() => {
    const insertProd = db.prepare(`
      INSERT INTO products (tenantId, sku, name, berat, harga, stok, category, image)
      VALUES (@tenantId, @sku, @name, @berat, @harga, @stok, @category, @image)
    `);

    const tmjProducts = [
      { tenantId: 'tenant-tmj-002', sku: 'MJ-PF-01', name: 'Eau de Parfum Paris Bloom 50ml', berat: 50, harga: 295000, stok: 14, category: 'Parfum', image: RETAIL_IMG.parfum },
      { tenantId: 'tenant-tmj-002', sku: 'MJ-SK-02', name: 'Glow Peptide Repair Serum 30ml', berat: 30, harga: 165000, stok: 18, category: 'Skincare', image: RETAIL_IMG.serum },
      { tenantId: 'tenant-tmj-002', sku: 'MJ-SK-03', name: 'Moisture Lock Night Cream 50g', berat: 50, harga: 152000, stok: 16, category: 'Skincare', image: RETAIL_IMG.cream },
      { tenantId: 'tenant-tmj-002', sku: 'MJ-BC-04', name: 'Almond Milk Body Lotion 250ml', berat: 250, harga: 125000, stok: 20, category: 'Body Care', image: RETAIL_IMG.bodycare },
      { tenantId: 'tenant-tmj-002', sku: 'MJ-MU-05', name: 'Satin Velvet Lip Cream - Berry 4g', berat: 4, harga: 89000, stok: 25, category: 'Make Up', image: RETAIL_IMG.makeup },
      { tenantId: 'tenant-tmj-002', sku: 'MJ-AK-06', name: 'Mini Travel Atomizer Case 10ml', berat: 10, harga: 48000, stok: 30, category: 'Aksesoris', image: RETAIL_IMG.parfum },
    ];

    const lkeProducts = [
      { tenantId: 'tenant-lke-003', sku: 'LKE-SK-01', name: 'Brightening Vitamin C Serum 30ml (SBY)', berat: 30, harga: 158000, stok: 16, category: 'Skincare', image: RETAIL_IMG.serum },
      { tenantId: 'tenant-lke-003', sku: 'LKE-PF-02', name: 'Eau de Parfum Amber Wood 100ml', berat: 100, harga: 410000, stok: 10, category: 'Parfum', image: RETAIL_IMG.parfum },
      { tenantId: 'tenant-lke-003', sku: 'LKE-SK-03', name: 'Daily Barrier Gel Moisturizer 50g', berat: 50, harga: 145000, stok: 22, category: 'Skincare', image: RETAIL_IMG.cream },
      { tenantId: 'tenant-lke-003', sku: 'LKE-BC-04', name: 'Lavender Spa Body Wash 300ml', berat: 300, harga: 96000, stok: 19, category: 'Body Care', image: RETAIL_IMG.bodycare },
      { tenantId: 'tenant-lke-003', sku: 'LKE-MU-05', name: 'Matte Cushion Compact SPF 35 15g', berat: 15, harga: 192000, stok: 14, category: 'Make Up', image: RETAIL_IMG.makeup },
      { tenantId: 'tenant-lke-003', sku: 'LKE-PB-06', name: 'Gift Set Parfum & Body Care Duo', berat: 300, harga: 399000, stok: 9, category: 'Paket Bundling', image: RETAIL_IMG.parfum },
    ];

    const tmjIds: number[] = [];
    const existingTmjCount = (db.prepare('SELECT COUNT(*) as cnt FROM products WHERE tenantId = ?').get('tenant-tmj-002') as { cnt: number }).cnt;
    if (existingTmjCount === 0) {
      for (const p of tmjProducts) {
        const info = insertProd.run(p);
        tmjIds.push(Number(info.lastInsertRowid));
      }
    }

    const lkeIds: number[] = [];
    const existingLkeCount = (db.prepare('SELECT COUNT(*) as cnt FROM products WHERE tenantId = ?').get('tenant-lke-003') as { cnt: number }).cnt;
    if (existingLkeCount === 0) {
      for (const p of lkeProducts) {
        const info = insertProd.run(p);
        lkeIds.push(Number(info.lastInsertRowid));
      }
    }

    // Starter Promos per Outlet
    const insertPromo = db.prepare(`
      INSERT OR IGNORE INTO promos (id, tenantId, name, code, discountPercent, label, startDate, endDate, productIdsJson, isActive, minPurchase, description)
      VALUES (@id, @tenantId, @name, @code, @discountPercent, @label, @startDate, @endDate, @productIdsJson, @isActive, @minPurchase, @description)
    `);
    if (tmjIds.length > 0) {
      insertPromo.run({
        id: 'PRM-TMJ-001',
        tenantId: 'tenant-tmj-002',
        name: 'Promo Opening PVJ Bandung',
        code: 'PVJGLOW10',
        discountPercent: 10,
        label: 'Diskon 10%',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        productIdsJson: JSON.stringify([tmjIds[0], tmjIds[1]].filter(Boolean)),
        isActive: 1,
        minPurchase: 150000,
        description: 'Promo khusus cabang Paris Van Java Bandung untuk koleksi parfum & serum.',
      });
    }
    if (lkeIds.length > 0) {
      insertPromo.run({
        id: 'PRM-LKE-001',
        tenantId: 'tenant-lke-003',
        name: 'Special Beauty Tunjungan Plaza',
        code: 'TP3BEAUTY',
        discountPercent: 10,
        label: 'Diskon 10%',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        productIdsJson: JSON.stringify([lkeIds[0], lkeIds[4]].filter(Boolean)),
        isActive: 1,
        minPurchase: 150000,
        description: 'Potongan spesial cabang Tunjungan Plaza Surabaya untuk skincare & make up.',
      });
    }

    // Starter Transactions per Outlet
    const insertTx = db.prepare(`
      INSERT OR IGNORE INTO transactions (id, tenantId, invoiceNo, dateTime, dateStr, timeStr, cashier, customerId, customerName, totalQty, totalBerat, subtotal, tax, grandTotal, paymentMethod, paymentDetailsJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTxItem = db.prepare(`
      INSERT INTO transaction_items (transactionId, productId, sku, name, berat, harga, qty, subtotal, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    if (tmjIds.length >= 2) {
      const p0 = tmjProducts[0];
      const sub0 = p0.harga;
      const tax0 = Math.round(sub0 * 0.11);
      const txId = 'TRX-TMJ-20261111-001';
      if (!db.prepare('SELECT id FROM transactions WHERE id = ?').get(txId)) {
        insertTx.run(
          txId,
          'tenant-tmj-002',
          'TRX-20261111-101',
          '2026-11-11T10:15:00.000Z',
          '11 Nov 2026',
          '10:15:00',
          'Rina Kasir (PVJ)',
          'CUST-001',
          'Hj. Siti Rahmah',
          1,
          p0.berat,
          sub0,
          tax0,
          sub0 + tax0,
          'transfer',
          JSON.stringify({ transferBank: 'BCA', transferRef: 'TRF-PVJ-001' })
        );
        insertTxItem.run(txId, tmjIds[0], p0.sku, p0.name, p0.berat, p0.harga, 1, sub0, p0.image);
      }
    }

    if (lkeIds.length >= 2) {
      const p0 = lkeProducts[1];
      const sub0 = p0.harga;
      const tax0 = Math.round(sub0 * 0.11);
      const txId = 'TRX-LKE-20261111-001';
      if (!db.prepare('SELECT id FROM transactions WHERE id = ?').get(txId)) {
        insertTx.run(
          txId,
          'tenant-lke-003',
          'TRX-20261111-201',
          '2026-11-11T11:40:00.000Z',
          '11 Nov 2026',
          '11:40:00',
          'Budi Kasir (TP3)',
          'CUST-002',
          'Bpk. Hendra Wijaya',
          1,
          p0.berat,
          sub0,
          tax0,
          sub0 + tax0,
          'transfer',
          JSON.stringify({ transferBank: 'BCA', transferRef: 'TRF-SBY-8821' })
        );
        insertTxItem.run(txId, lkeIds[1], p0.sku, p0.name, p0.berat, p0.harga, 1, sub0, p0.image);
      }
    }

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_multitenant_outlets_v1', '1');
  });

  secondaryTx();
}

function migrateToGeneralRetailCatalogV1(): void {
  const alreadyMigrated = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('migrated_general_retail_v1') as { value: string } | undefined;
  if (alreadyMigrated?.value === '1') {
    return;
  }

  const migrateTx = db.transaction(() => {
    const seededTenants = ['tenant-tms-001', 'tenant-tmj-002', 'tenant-lke-003'];
    const placeholders = seededTenants.map(() => '?').join(', ');

    // 1. Replace categories with general retail categories
    db.prepare('DELETE FROM categories').run();
    const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, sortOrder) VALUES (?, ?)');
    RETAIL_CATEGORIES.forEach((cat, idx) => insertCat.run(cat, idx + 1));

    // 2. Remove old gold/jewelry seeded data from all 3 seeded outlets
    db.prepare(
      `DELETE FROM transaction_items WHERE transactionId IN (SELECT id FROM transactions WHERE tenantId IN (${placeholders}))`
    ).run(...seededTenants);
    db.prepare(`DELETE FROM transactions WHERE tenantId IN (${placeholders})`).run(...seededTenants);
    db.prepare(`DELETE FROM promos WHERE tenantId IN (${placeholders})`).run(...seededTenants);
    db.prepare(`DELETE FROM products WHERE tenantId IN (${placeholders})`).run(...seededTenants);
    db.prepare(`DELETE FROM buybacks WHERE tenantId IN (${placeholders})`).run(...seededTenants);
    db.prepare("DELETE FROM shift_closings WHERE id IN ('SHF-SEED-TMS-001', 'SHF-SEED-TMJ-001')").run();

    // 3. Re-seed primary outlet retail products (IDs 1..36)
    const insertProd = db.prepare(`
      INSERT OR REPLACE INTO products (id, tenantId, sku, name, berat, harga, stok, category, image)
      VALUES (@id, 'tenant-tms-001', @sku, @name, @berat, @harga, @stok, @category, @image)
    `);
    for (const p of RETAIL_PRODUCTS) {
      insertProd.run(p);
    }

    // 4. Re-seed primary outlet promos
    const insertPromo = db.prepare(`
      INSERT OR REPLACE INTO promos (id, tenantId, name, code, discountPercent, label, startDate, endDate, productIdsJson, isActive, minPurchase, description)
      VALUES (@id, 'tenant-tms-001', @name, @code, @discountPercent, @label, @startDate, @endDate, @productIdsJson, @isActive, @minPurchase, @description)
    `);
    for (const pr of RETAIL_PROMOS) {
      insertPromo.run({
        id: pr.id,
        name: pr.name,
        code: pr.code,
        discountPercent: pr.discountPercent,
        label: pr.label,
        startDate: pr.startDate,
        endDate: pr.endDate,
        productIdsJson: JSON.stringify(pr.productIds),
        isActive: pr.isActive ? 1 : 0,
        minPurchase: pr.minPurchase ?? null,
        description: pr.description ?? null,
      });
    }

    // 5. Re-seed primary outlet transactions & line items
    const insertTx = db.prepare(`
      INSERT OR REPLACE INTO transactions (id, tenantId, invoiceNo, dateTime, dateStr, timeStr, cashier, customerName, totalQty, totalBerat, subtotal, tax, grandTotal, paymentMethod, paymentDetailsJson)
      VALUES (@id, 'tenant-tms-001', @invoiceNo, @dateTime, @dateStr, @timeStr, @cashier, @customerName, @totalQty, @totalBerat, @subtotal, @tax, @grandTotal, @paymentMethod, @paymentDetailsJson)
    `);
    const insertTxItem = db.prepare(`
      INSERT INTO transaction_items (transactionId, productId, sku, name, berat, harga, qty, subtotal, image)
      VALUES (@transactionId, @productId, @sku, @name, @berat, @harga, @qty, @subtotal, @image)
    `);
    for (const tx of buildRetailSeedTransactions()) {
      insertTx.run({
        id: tx.id,
        invoiceNo: tx.invoiceNo,
        dateTime: tx.dateTime,
        dateStr: tx.dateStr,
        timeStr: tx.timeStr,
        cashier: tx.cashier,
        customerName: tx.customerName,
        totalQty: tx.totalQty,
        totalBerat: tx.totalBerat,
        subtotal: tx.subtotal,
        tax: tx.tax,
        grandTotal: tx.grandTotal,
        paymentMethod: tx.paymentMethod,
        paymentDetailsJson: JSON.stringify(tx.paymentDetails),
      });
      for (const item of tx.items) {
        insertTxItem.run({
          transactionId: tx.id,
          productId: item.id,
          sku: item.sku,
          name: item.name,
          berat: item.berat,
          harga: item.harga,
          qty: item.qty,
          subtotal: item.subtotal,
          image: item.image ?? null,
        });
      }
    }

    // 6. Update seeded customer notes & preferences
    const updateCust = db.prepare(`
      UPDATE customers
      SET name = @name, preferredKadar = @preferredKadar, ringSize = @ringSize, notes = @notes, totalSpent = @totalSpent
      WHERE id = @id
    `);
    for (const c of RETAIL_CUSTOMERS) {
      updateCust.run(c);
    }

    // 7. Reset secondary outlets flag so seedSecondaryOutletsIfNeeded re-populates retail catalog
    db.prepare('DELETE FROM settings WHERE key = ?').run('seeded_multitenant_outlets_v1');
    db.prepare('UPDATE tenants SET productCount = 36 WHERE id = ?').run('tenant-tms-001');
    db.prepare('UPDATE tenants SET productCount = 6 WHERE id = ?').run('tenant-tmj-002');
    db.prepare('UPDATE tenants SET productCount = 6 WHERE id = ?').run('tenant-lke-003');

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('migrated_general_retail_v1', '1');
  });

  migrateTx();
}

function migratePaymentMethodsTwoOptionsV1(): void {
  const alreadyMigrated = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('migrated_payment_methods_2opts_v1') as { value: string } | undefined;
  if (alreadyMigrated?.value === '1') {
    return;
  }

  const txRows = db
    .prepare("SELECT id, paymentMethod, paymentDetailsJson FROM transactions WHERE paymentMethod IN ('debit', 'qris')")
    .all() as Array<{ id: string; paymentMethod: string; paymentDetailsJson: string }>;

  const migrateTx = db.transaction(() => {
    const upd = db.prepare('UPDATE transactions SET paymentMethod = ?, paymentDetailsJson = ? WHERE id = ?');
    for (const row of txRows) {
      const details = safeJsonParse<PaymentDetails>(row.paymentDetailsJson, {});
      const nextDetails: PaymentDetails = {
        transferBank: details.transferBank || details.debitBank || 'BCA',
        transferRef:
          details.transferRef || details.debitApprovalCode || details.qrisRrn || undefined,
      };
      upd.run('transfer', JSON.stringify(nextDetails), row.id);
    }
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'migrated_payment_methods_2opts_v1',
      '1'
    );
  });

  migrateTx();
}

export function seedInitialDataIfEmpty(): void {
  const seededV3Row = db.prepare('SELECT value FROM settings WHERE key = ?').get('seeded_v3') as
    | { value: string }
    | undefined;
  if (seededV3Row?.value === '1') {
    migrateGeneralPosBrandingIfNeeded();
    migrateStoreNamesMkiIfNeeded();
    migrateGeneralRetailReceiptFormatV1();
    migrateSimpleRetailReceiptV2();
    migrateReceiptHeaderLogoV3();
    migrateToGeneralRetailCatalogV1();
    migratePaymentMethodsTwoOptionsV1();
    seedSecondaryOutletsIfNeeded();
    seedUsersIfNeeded();
    compactSeedTo5V1(db, hashPassword);
    migrateHolidayPromosV1(db);
    expandProductsAndTransactionsV1(db);
    migrateShopeeCategoriesV1(db);
    return;
  }

  const seedTx = db.transaction(() => {
    // 1. Categories (Katalog Retail Umum: Parfum, Skincare, Body Care, dll.)
    const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, sortOrder) VALUES (?, ?)');
    RETAIL_CATEGORIES.forEach((cat, idx) => insertCat.run(cat, idx + 1));

    // 2. Products (36 Produk Katalog Retail Umum: Parfum, Skincare, Body Care, Make Up, Hair Care, Paket Bundling, Aksesoris)
    const insertProd = db.prepare(`
      INSERT OR IGNORE INTO products (id, sku, name, berat, harga, stok, category, image)
      VALUES (@id, @sku, @name, @berat, @harga, @stok, @category, @image)
    `);
    for (const p of RETAIL_PRODUCTS) {
      insertProd.run(p);
    }

    // 3. Tenants
    const initialTenants: Tenant[] = [
      {
        id: 'tenant-tms-001',
        name: 'MKI (Maklon Kosmetik Indonesia)',
        code: 'MKI-01',
        branchName: 'Cabang Utama (Grand City Mall Lt. 1)',
        address: 'Jl. Pemuda No. 108, Mall Grand City Lt. 1 No. 22',
        city: 'Jakarta Pusat',
        plan: 'Enterprise Multi-Tenant',
        cashierCount: 4,
        productCount: 36,
        phone: '0812-8899-7766',
        email: 'admin@mki-kosmetik.id',
        slug: 'mki.kasirpos.id',
        logoInitial: 'MK',
        databaseSchema: 'tenant_db_mki_01',
        status: 'Aktif',
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
        productCount: 24,
        phone: '0813-2233-4455',
        email: 'kontak@amulia.id',
        slug: 'amulia.kasirpos.id',
        logoInitial: 'AM',
        databaseSchema: 'tenant_db_amulia_02',
        status: 'Aktif',
      },
      {
        id: 'tenant-lke-003',
        name: 'Blimey',
        code: 'BLM-03',
        branchName: 'Cabang Tunjungan Plaza 3',
        address: 'Jl. Basuki Rahmat No. 8-12, TP 3 Lt. 2',
        city: 'Surabaya',
        plan: 'Enterprise Multi-Tenant',
        cashierCount: 5,
        productCount: 42,
        phone: '0819-7788-9900',
        email: 'hello@blimey.id',
        slug: 'blimey.kasirpos.id',
        logoInitial: 'BL',
        databaseSchema: 'tenant_db_blimey_03',
        status: 'Aktif',
      },
    ];
    const insertTenant = db.prepare(`
      INSERT OR IGNORE INTO tenants (id, name, code, branchName, address, city, plan, cashierCount, productCount, phone, email, slug, logoInitial, databaseSchema, status)
      VALUES (@id, @name, @code, @branchName, @address, @city, @plan, @cashierCount, @productCount, @phone, @email, @slug, @logoInitial, @databaseSchema, @status)
    `);
    for (const t of initialTenants) {
      insertTenant.run(t);
    }
    db.prepare('UPDATE tenants SET productCount = 36 WHERE id = ? AND productCount < 36').run('tenant-tms-001');
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('activeTenantId', 'tenant-tms-001');

    // 4. Customers (16 Pelanggan Aktif)
    const insertCust = db.prepare(`
      INSERT OR IGNORE INTO customers (id, memberCode, name, phone, nik, type, address, preferredKadar, ringSize, notes, createdAt, totalSpent, totalTransactions)
      VALUES (@id, @memberCode, @name, @phone, @nik, @type, @address, @preferredKadar, @ringSize, @notes, @createdAt, @totalSpent, @totalTransactions)
    `);
    for (const c of RETAIL_CUSTOMERS) {
      insertCust.run(c);
    }

    // 5. Promos
    const insertPromo = db.prepare(`
      INSERT OR IGNORE INTO promos (id, name, code, discountPercent, label, startDate, endDate, productIdsJson, isActive, minPurchase, description)
      VALUES (@id, @name, @code, @discountPercent, @label, @startDate, @endDate, @productIdsJson, @isActive, @minPurchase, @description)
    `);
    for (const pr of RETAIL_PROMOS) {
      insertPromo.run({
        id: pr.id,
        name: pr.name,
        code: pr.code,
        discountPercent: pr.discountPercent,
        label: pr.label,
        startDate: pr.startDate,
        endDate: pr.endDate,
        productIdsJson: JSON.stringify(pr.productIds),
        isActive: pr.isActive ? 1 : 0,
        minPurchase: pr.minPurchase ?? null,
        description: pr.description ?? null,
      });
    }

    // 6. Transactions (16 Transaksi Riil Produk Retail di Nov 2026)
    const realisticTransactions = buildRetailSeedTransactions();
    const insertTx = db.prepare(`
      INSERT OR IGNORE INTO transactions (id, invoiceNo, dateTime, dateStr, timeStr, cashier, customerName, totalQty, totalBerat, subtotal, tax, grandTotal, paymentMethod, paymentDetailsJson)
      VALUES (@id, @invoiceNo, @dateTime, @dateStr, @timeStr, @cashier, @customerName, @totalQty, @totalBerat, @subtotal, @tax, @grandTotal, @paymentMethod, @paymentDetailsJson)
    `);
    const updateTxTime = db.prepare(`
      UPDATE transactions SET dateTime = @dateTime, dateStr = @dateStr, timeStr = @timeStr WHERE id = @id
    `);
    const insertTxItem = db.prepare(`
      INSERT INTO transaction_items (transactionId, productId, sku, name, berat, harga, qty, subtotal, image)
      VALUES (@transactionId, @productId, @sku, @name, @berat, @harga, @qty, @subtotal, @image)
    `);

    for (const tx of realisticTransactions) {
      const res = insertTx.run({
        id: tx.id,
        invoiceNo: tx.invoiceNo,
        dateTime: tx.dateTime,
        dateStr: tx.dateStr,
        timeStr: tx.timeStr,
        cashier: tx.cashier,
        customerName: tx.customerName,
        totalQty: tx.totalQty,
        totalBerat: tx.totalBerat,
        subtotal: tx.subtotal,
        tax: tx.tax,
        grandTotal: tx.grandTotal,
        paymentMethod: tx.paymentMethod,
        paymentDetailsJson: JSON.stringify(tx.paymentDetails),
      });
      if (res.changes > 0) {
        for (const item of tx.items) {
          insertTxItem.run({
            transactionId: tx.id,
            productId: item.id,
            sku: item.sku,
            name: item.name,
            berat: item.berat,
            harga: item.harga,
            qty: item.qty,
            subtotal: item.subtotal,
            image: item.image ?? null,
          });
        }
      } else {
        updateTxTime.run({ id: tx.id, dateTime: tx.dateTime, dateStr: tx.dateStr, timeStr: tx.timeStr });
      }
    }

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_v1', '1');
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_v2', '1');
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_v3', '1');
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('migrated_general_retail_v1', '1');
  });

  seedTx();
  seedSecondaryOutletsIfNeeded();
  seedUsersIfNeeded();
  migrateGeneralPosBrandingIfNeeded();
  migrateStoreNamesMkiIfNeeded();
  migrateGeneralRetailReceiptFormatV1();
  migrateSimpleRetailReceiptV2();
  migrateReceiptHeaderLogoV3();
  compactSeedTo5V1(db, hashPassword);
  migrateHolidayPromosV1(db);
  expandProductsAndTransactionsV1(db);
  migrateShopeeCategoriesV1(db);
}

export function parseProductAttributes(rawJson?: string | null): Record<string, string> {
  if (!rawJson || typeof rawJson !== 'string') return {};
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const cleanKey = String(k).trim();
      const cleanVal = String(v ?? '').trim();
      if (cleanKey && cleanVal) {
        out[cleanKey] = cleanVal;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function normalizeCategoryAttributesInput(fields?: CategoryAttributeField[]): CategoryAttributeField[] {
  if (!Array.isArray(fields)) return [];
  const seen = new Set<string>();
  const normalized: CategoryAttributeField[] = [];
  for (const f of fields) {
    if (!f || typeof f !== 'object') continue;
    const label = String(f.label ?? '').trim();
    const rawKey = String(f.key ?? label)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!rawKey || !label || seen.has(rawKey)) continue;
    seen.add(rawKey);
    const type = f.type === 'select' || f.type === 'number' || f.type === 'date' ? f.type : 'text';
    const options = Array.isArray(f.options)
      ? f.options.map(o => String(o).trim()).filter(Boolean)
      : undefined;
    normalized.push({
      key: rawKey,
      label,
      type,
      placeholder: f.placeholder ? String(f.placeholder).trim() : undefined,
      required: Boolean(f.required),
      options: options && options.length > 0 ? options : undefined,
    });
  }
  return normalized;
}

function suggestServerSkuPrefix(name: string): string {
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

function parseCategoryRow(row: {
  name: string;
  parentName?: string | null;
  icon?: string | null;
  skuPrefix?: string | null;
  sortOrder?: number | null;
  isActive?: number | null;
  description?: string | null;
  attributeFieldsJson?: string | null;
  createdAt?: string | null;
}): CategoryItem {
  let attributeFields: CategoryAttributeField[] = [];
  if (row.attributeFieldsJson) {
    try {
      const parsed = JSON.parse(row.attributeFieldsJson) as CategoryAttributeField[];
      if (Array.isArray(parsed)) attributeFields = normalizeCategoryAttributesInput(parsed);
    } catch {
      attributeFields = [];
    }
  }
  return {
    name: row.name,
    parentName: row.parentName ? row.parentName.trim() : null,
    icon: (row.icon ?? '').trim() || 'category',
    skuPrefix: (row.skuPrefix ?? '').trim().toUpperCase() || suggestServerSkuPrefix(row.name),
    sortOrder: Number.isFinite(row.sortOrder) ? Number(row.sortOrder) : 0,
    isActive: row.isActive === undefined || row.isActive === null ? true : Number(row.isActive) === 1,
    description: (row.description ?? '').trim(),
    attributeFields,
    createdAt: row.createdAt ?? undefined,
  };
}

export function getAllCategoryItems(): CategoryItem[] {
  const rawRows = db
    .prepare(
      `SELECT name, parentName, icon, skuPrefix, sortOrder, isActive, description, attributeFieldsJson, createdAt
       FROM categories
       ORDER BY sortOrder ASC, LOWER(name) ASC`
    )
    .all() as Array<{
    name: string;
    parentName?: string | null;
    icon?: string | null;
    skuPrefix?: string | null;
    sortOrder?: number | null;
    isActive?: number | null;
    description?: string | null;
    attributeFieldsJson?: string | null;
    createdAt?: string | null;
  }>;

  const parsed = rawRows.map(parseCategoryRow);
  const parents = parsed.filter(c => !c.parentName);
  const parentNameSet = new Set(parents.map(p => p.name.toLowerCase()));
  const childrenByParent = new Map<string, CategoryItem[]>();
  const orphans: CategoryItem[] = [];

  for (const item of parsed) {
    if (item.parentName) {
      const key = item.parentName.toLowerCase();
      if (parentNameSet.has(key)) {
        const list = childrenByParent.get(key) ?? [];
        list.push(item);
        childrenByParent.set(key, list);
      } else {
        orphans.push(item);
      }
    }
  }

  const ordered: CategoryItem[] = [];
  for (const parent of parents) {
    ordered.push(parent);
    const children = childrenByParent.get(parent.name.toLowerCase()) ?? [];
    ordered.push(...children);
  }
  ordered.push(...orphans);
  return ordered;
}

// Query Helpers
export function getAllProducts(tenantId: string = getActiveTenantId()): Product[] {
  const rows = db
    .prepare(
      `SELECT id, sku, name, berat, harga, COALESCE(hpp, 0) AS hpp, stok, category, image,
              COALESCE(brand, 'No Brand') AS brand,
              COALESCE(kondisi, 'Baru') AS kondisi,
              COALESCE(deskripsi, '') AS deskripsi,
              COALESCE(panjang, 0) AS panjang,
              COALESCE(lebar, 0) AS lebar,
              COALESCE(tinggi, 0) AS tinggi,
              COALESCE(status, 'Aktif') AS status,
              COALESCE(attributesJson, '{}') AS attributesJson,
              createdAt
       FROM products WHERE tenantId = ? ORDER BY id DESC`
    )
    .all(tenantId) as Array<Product & { attributesJson?: string }>;
  return rows.map(({ attributesJson, ...rest }) => ({
    ...rest,
    attributes: parseProductAttributes(attributesJson),
  }));
}

export function getAllCategories(): string[] {
  return getAllCategoryItems().map(c => c.name);
}

export function getAllTransactions(tenantId: string = getActiveTenantId()): Transaction[] {
  const txRows = db
    .prepare(
      'SELECT id, invoiceNo, dateTime, dateStr, timeStr, cashier, customerName, totalQty, totalBerat, subtotal, tax, grandTotal, paymentMethod, paymentDetailsJson FROM transactions WHERE tenantId = ? ORDER BY dateTime DESC'
    )
    .all(tenantId) as Array<{
    id: string;
    invoiceNo: string;
    dateTime: string;
    dateStr: string;
    timeStr: string;
    cashier: string;
    customerName: string;
    totalQty: number;
    totalBerat: number;
    subtotal: number;
    tax: number;
    grandTotal: number;
    paymentMethod: 'cash' | 'debit' | 'transfer' | 'qris';
    paymentDetailsJson: string;
  }>;

  const itemRows = db
    .prepare('SELECT transactionId, productId, sku, name, berat, harga, qty, subtotal, image FROM transaction_items ORDER BY id ASC')
    .all() as Array<{
    transactionId: string;
    productId: number;
    sku: string;
    name: string;
    berat: number;
    harga: number;
    qty: number;
    subtotal: number;
    image: string | null;
  }>;

  const itemsByTx = new Map<string, TransactionItem[]>();
  for (const row of itemRows) {
    const list = itemsByTx.get(row.transactionId) ?? [];
    list.push({
      id: row.productId,
      sku: row.sku,
      name: row.name,
      berat: row.berat,
      harga: row.harga,
      qty: row.qty,
      subtotal: row.subtotal,
      image: row.image ?? undefined,
    });
    itemsByTx.set(row.transactionId, list);
  }

  return txRows.map(tx => ({
    id: tx.id,
    invoiceNo: tx.invoiceNo,
    dateTime: tx.dateTime,
    dateStr: tx.dateStr,
    timeStr: tx.timeStr,
    cashier: tx.cashier,
    customerName: tx.customerName,
    items: itemsByTx.get(tx.id) ?? [],
    totalQty: tx.totalQty,
    totalBerat: tx.totalBerat,
    subtotal: tx.subtotal,
    tax: tx.tax,
    grandTotal: tx.grandTotal,
    paymentMethod: tx.paymentMethod,
    paymentDetails: safeJsonParse<PaymentDetails>(tx.paymentDetailsJson, {}),
  }));
}

export function getAllBuybacks(tenantId: string = getActiveTenantId()): BuybackItem[] {
  const rows = db.prepare('SELECT * FROM buybacks WHERE tenantId = ? ORDER BY rowid DESC').all(tenantId) as Array<{
    id: string;
    invoiceNo: string;
    date: string;
    timeStr: string | null;
    branchName: string | null;
    cashierName: string | null;
    customerName: string;
    customerPhone: string;
    customerNik: string | null;
    customerNpwp: string | null;
    customerAddress: string | null;
    sourceNote: string;
    itemType: string;
    kadar: string;
    beratKotor: number;
    potonganBatu: number;
    beratBersih: number;
    hargaPerGram: number;
    biayaLebur: number;
    kondisi: string;
    totalKotor: number | null;
    potonganBiaya: number | null;
    pph22: number | null;
    totalBayar: number;
    paymentMethod: 'cash' | 'transfer';
    bankName: string | null;
    accountNo: string | null;
    accountHolder: string | null;
    catatan: string | null;
    fotoKtp: string | null;
    fotoEmas: string | null;
    ttdNasabah: string | null;
    ttdPetugas: string | null;
    isAgreedLegal: number;
    itemsJson: string | null;
  }>;

  return rows.map(r => ({
    id: r.id,
    invoiceNo: r.invoiceNo,
    date: r.date,
    timeStr: r.timeStr ?? undefined,
    branchName: r.branchName ?? undefined,
    cashierName: r.cashierName ?? undefined,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerNik: r.customerNik ?? undefined,
    customerNpwp: r.customerNpwp ?? undefined,
    customerAddress: r.customerAddress ?? undefined,
    sourceNote: r.sourceNote,
    itemType: r.itemType,
    kadar: r.kadar,
    beratKotor: r.beratKotor,
    potonganBatu: r.potonganBatu,
    beratBersih: r.beratBersih,
    hargaPerGram: r.hargaPerGram,
    biayaLebur: r.biayaLebur,
    kondisi: r.kondisi,
    totalKotor: r.totalKotor ?? undefined,
    potonganBiaya: r.potonganBiaya ?? undefined,
    pph22: r.pph22 ?? undefined,
    totalBayar: r.totalBayar,
    paymentMethod: r.paymentMethod,
    bankName: r.bankName ?? undefined,
    accountNo: r.accountNo ?? undefined,
    accountHolder: r.accountHolder ?? undefined,
    catatan: r.catatan ?? undefined,
    fotoKtp: r.fotoKtp ?? undefined,
    fotoEmas: r.fotoEmas ?? undefined,
    ttdNasabah: r.ttdNasabah ?? undefined,
    ttdPetugas: r.ttdPetugas ?? undefined,
    isAgreedLegal: Boolean(r.isAgreedLegal),
    items: r.itemsJson ? safeJsonParse<BuybackGoldItem[]>(r.itemsJson, []) : undefined,
  }));
}

export function getAllCustomers(): Customer[] {
  const rows = db.prepare('SELECT * FROM customers ORDER BY rowid DESC').all() as Array<{
    id: string;
    memberCode: string;
    name: string;
    phone: string;
    nik: string | null;
    npwp: string | null;
    type: 'Reguler' | 'VIP' | 'Mitra / Toko';
    address: string | null;
    preferredKadar: string | null;
    goldColor: string | null;
    ringSize: string | null;
    braceletSize: string | null;
    birthDate: string | null;
    notes: string | null;
    createdAt: string;
    totalSpent: number;
    totalTransactions: number;
  }>;

  return rows.map(r => ({
    id: r.id,
    memberCode: r.memberCode,
    name: r.name,
    phone: r.phone,
    nik: r.nik ?? undefined,
    npwp: r.npwp ?? undefined,
    type: r.type,
    address: r.address ?? undefined,
    preferredKadar: r.preferredKadar ?? undefined,
    goldColor: r.goldColor ?? undefined,
    ringSize: r.ringSize ?? undefined,
    braceletSize: r.braceletSize ?? undefined,
    birthDate: r.birthDate ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.createdAt,
    totalSpent: r.totalSpent,
    totalTransactions: r.totalTransactions,
  }));
}

export function generateNextMemberCode(): string {
  const rows = db.prepare("SELECT memberCode FROM customers WHERE memberCode LIKE 'MBR-%'").all() as Array<{
    memberCode: string;
  }>;
  let maxSeq = 0;
  for (const row of rows) {
    const match = /^MBR-(\d+)$/i.exec(row.memberCode.trim());
    if (match && match[1].length <= 3) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > maxSeq) {
        maxSeq = n;
      }
    }
  }
  let next = maxSeq + 1;
  let candidate = `MBR-${String(next).padStart(3, '0')}`;
  while (db.prepare('SELECT 1 FROM customers WHERE memberCode = ?').get(candidate)) {
    next += 1;
    candidate = `MBR-${String(next).padStart(3, '0')}`;
  }
  return candidate;
}

type PromoDbRow = {
  id: string;
  name: string;
  code: string;
  discountPercent: number;
  label: string;
  startDate: string;
  endDate: string;
  productIdsJson: string;
  isActive: number;
  minPurchase: number | null;
  description: string | null;
  createdAt?: string | null;
};

function mapPromoRow(r: PromoDbRow): PromoCampaign {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    discountPercent: r.discountPercent,
    label: r.label,
    startDate: r.startDate,
    endDate: r.endDate,
    productIds: safeJsonParse<number[]>(r.productIdsJson, []),
    isActive: Boolean(r.isActive),
    minPurchase: r.minPurchase ?? undefined,
    description: r.description ?? undefined,
    createdAt: r.createdAt ?? undefined,
  };
}

export function syncExpiredPromos(tenantId?: string): string {
  const today = getTodayWibDateStr();
  if (tenantId) {
    db.prepare('UPDATE promos SET isActive = 0 WHERE tenantId = ? AND isActive = 1 AND endDate < ?').run(
      tenantId,
      today
    );
  } else {
    db.prepare('UPDATE promos SET isActive = 0 WHERE isActive = 1 AND endDate < ?').run(today);
  }
  return today;
}

export function getAllPromos(tenantId: string = getActiveTenantId()): PromoCampaign[] {
  syncExpiredPromos(tenantId);
  const rows = db.prepare('SELECT * FROM promos WHERE tenantId = ? ORDER BY rowid DESC').all(tenantId) as PromoDbRow[];
  return rows.map(mapPromoRow);
}

export function getAllTenants(): Tenant[] {
  const tenants = db.prepare('SELECT * FROM tenants ORDER BY rowid ASC').all() as Array<
    Tenant & { createdAt?: string | null }
  >;
  const counts = db
    .prepare('SELECT tenantId, COUNT(*) as cnt FROM products GROUP BY tenantId')
    .all() as Array<{ tenantId: string; cnt: number }>;
  const countMap = new Map(counts.map(c => [c.tenantId, c.cnt]));

  const staffRows = db
    .prepare("SELECT role, allowedTenantIdsJson FROM users WHERE isActive = 1 AND role != 'owner'")
    .all() as Array<{ role: UserRole; allowedTenantIdsJson: string }>;
  const staffCountMap = new Map<string, number>();
  for (const s of staffRows) {
    const allowed = safeJsonParse<string[]>(s.allowedTenantIdsJson, []);
    for (const tid of allowed) {
      staffCountMap.set(tid, (staffCountMap.get(tid) ?? 0) + 1);
    }
  }

  const mapped = tenants.map(t => ({
    ...t,
    logoUrl: t.logoUrl || '',
    cashierCount: staffCountMap.get(t.id) ?? 0,
    productCount: countMap.get(t.id) ?? 0,
    createdAt: t.createdAt ?? undefined,
  }));

  const now = Date.now();
  const recentWindowMs = 5 * 60 * 1000;
  const isFresh = (createdAt?: string) => {
    if (!createdAt) return false;
    const ms = Date.parse(createdAt);
    return !Number.isNaN(ms) && now - ms < recentWindowMs && now - ms >= -60_000;
  };
  const fresh = mapped
    .filter(t => isFresh(t.createdAt))
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
  const older = mapped.filter(t => !isFresh(t.createdAt));
  return [...fresh, ...older];
}

export function getActiveTenantId(): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('activeTenantId') as
    | { value: string }
    | undefined;
  return row?.value ?? 'tenant-tms-001';
}

export function getActivePromos(tenantId: string = getActiveTenantId()): PromoCampaign[] {
  const today = syncExpiredPromos(tenantId);
  const rows = db
    .prepare(
      'SELECT * FROM promos WHERE tenantId = ? AND isActive = 1 AND startDate <= ? AND endDate >= ? ORDER BY rowid DESC'
    )
    .all(tenantId, today, today) as PromoDbRow[];

  return rows.map(mapPromoRow);
}

export function validatePromoCouponForCart(
  tenantId: string,
  rawCode: string,
  cartItems: Array<{ id: number; qty: number }>
): PromoCouponValidationResult {
  const cleanCode = (rawCode || '').trim().toUpperCase();
  if (!cleanCode) {
    throw new Error('Masukkan kode kupon promo terlebih dahulu.');
  }

  const today = syncExpiredPromos(tenantId);
  const row = db
    .prepare('SELECT * FROM promos WHERE tenantId = ? AND LOWER(code) = LOWER(?) LIMIT 1')
    .get(tenantId, cleanCode) as PromoDbRow | undefined;

  if (!row) {
    throw new Error(`Kode kupon "${cleanCode}" tidak ditemukan di outlet aktif.`);
  }

  const promo = mapPromoRow(row);

  if (promo.endDate < today) {
    throw new Error(
      `Kupon "${promo.code}" sudah kedaluwarsa (berakhir ${formatPromoDate(promo.endDate)}).`
    );
  }
  if (!promo.isActive) {
    throw new Error(`Kupon "${promo.code}" sedang dinonaktifkan.`);
  }
  if (promo.startDate > today) {
    throw new Error(
      `Kupon "${promo.code}" belum berlaku (aktif mulai ${formatPromoDate(promo.startDate)}).`
    );
  }

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error('Keranjang belanja masih kosong.');
  }

  let grossSubtotal = 0;
  let eligibleSubtotal = 0;
  const eligibleProductIds: number[] = [];
  const promoIdSet = new Set(promo.productIds);

  for (const item of cartItems) {
    const prod = db
      .prepare('SELECT id, harga FROM products WHERE id = ? AND tenantId = ?')
      .get(item.id, tenantId) as { id: number; harga: number } | undefined;
    if (!prod) continue;
    const qty = Math.max(0, Math.round(Number(item.qty) || 0));
    if (qty <= 0) continue;

    const lineSubtotal = prod.harga * qty;
    grossSubtotal += lineSubtotal;

    const isEligible = promoIdSet.size === 0 || promoIdSet.has(prod.id);
    if (isEligible) {
      eligibleSubtotal += lineSubtotal;
      if (!eligibleProductIds.includes(prod.id)) {
        eligibleProductIds.push(prod.id);
      }
    }
  }

  if (eligibleSubtotal <= 0) {
    throw new Error(
      `Kupon "${promo.code}" tidak berlaku untuk produk yang ada di keranjang saat ini.`
    );
  }

  if (promo.minPurchase && promo.minPurchase > 0 && grossSubtotal < promo.minPurchase) {
    const formattedMin = `Rp ${promo.minPurchase.toLocaleString('id-ID')}`;
    throw new Error(
      `Minimal belanja ${formattedMin} untuk menggunakan kupon "${promo.code}".`
    );
  }

  const discountAmount = Math.max(
    0,
    Math.min(eligibleSubtotal, Math.round(eligibleSubtotal * (promo.discountPercent / 100)))
  );
  const netSubtotal = Math.max(0, grossSubtotal - discountAmount);

  return {
    valid: true,
    promo,
    grossSubtotal,
    eligibleSubtotal,
    discountAmount,
    netSubtotal,
    eligibleProductIds,
  };
}

function buildActivePromoMap(tenantId: string = getActiveTenantId()): Map<number, PromoCampaign> {
  const activePromos = getActivePromos(tenantId);
  const map = new Map<number, PromoCampaign>();
  for (const promo of activePromos) {
    for (const prodId of promo.productIds) {
      if (!map.has(prodId)) {
        map.set(prodId, promo);
      }
    }
  }
  return map;
}

function attachPromoFlags(
  product: Product & { attributesJson?: string },
  promoMap: Map<number, PromoCampaign>
): Product {
  const { attributesJson, attributes, ...rest } = product;
  const resolvedAttributes =
    attributes && Object.keys(attributes).length > 0
      ? attributes
      : parseProductAttributes(attributesJson);
  const promo = promoMap.get(product.id);
  if (!promo) {
    return {
      ...rest,
      attributes: resolvedAttributes,
      isPromo: false,
      promoDiscountPercent: undefined,
      promoLabel: undefined,
    };
  }
  return {
    ...rest,
    attributes: resolvedAttributes,
    isPromo: true,
    promoDiscountPercent: promo.discountPercent,
    promoLabel: promo.label,
  };
}

function normalizeSortDir(dir?: string): 'ASC' | 'DESC' {
  return dir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
}

export function queryProducts(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  brand?: string;
  promoOnly?: boolean;
  filterTab?: 'all' | 'active' | 'inactive' | 'promo' | 'low_stock';
  statusFilter?: 'all' | 'Aktif' | 'Nonaktif';
  stockFilter?: 'all' | 'available' | 'low' | 'out';
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  tenantId?: string;
}): ProductsPageResponse {
  const tenantId = opts.tenantId ?? getActiveTenantId();
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize ?? 10)));
  const search = (opts.search ?? '').trim().toLowerCase();
  const category = (opts.category ?? '').trim();
  const brand = (opts.brand ?? '').trim();
  const filterTab = opts.filterTab ?? (opts.promoOnly ? 'promo' : 'all');
  const statusFilter = opts.statusFilter ?? 'all';
  const stockFilter = opts.stockFilter ?? 'all';
  const promoOnly = Boolean(opts.promoOnly) || filterTab === 'promo';
  const sortDir = normalizeSortDir(opts.sortDir);

  let orderBySql = `id ${sortDir}`;
  switch (opts.sortBy) {
    case 'harga':
      orderBySql = `harga ${sortDir}, id DESC`;
      break;
    case 'berat':
      orderBySql = `berat ${sortDir}, id DESC`;
      break;
    case 'stok':
      orderBySql = `stok ${sortDir}, id DESC`;
      break;
    case 'name':
      orderBySql = `LOWER(name) ${sortDir}, id DESC`;
      break;
    case 'sku':
      orderBySql = `LOWER(sku) ${sortDir}, id DESC`;
      break;
    case 'brand':
      orderBySql = `LOWER(brand) ${sortDir}, id DESC`;
      break;
    case 'sales':
    case 'salesCount':
      orderBySql = `salesCount ${sortDir}, id DESC`;
      break;
    case 'newest':
    default:
      orderBySql = `id ${sortDir}`;
      break;
  }

  const promoMap = buildActivePromoMap(tenantId);
  const promoProductIds = Array.from(promoMap.keys());

  const conditions: string[] = ['tenantId = ?'];
  const params: Array<string | number> = [tenantId];

  if (search) {
    const like = `%${search}%`;
    const orClauses = [
      'LOWER(name) LIKE ?',
      'LOWER(sku) LIKE ?',
      'LOWER(category) LIKE ?',
      "LOWER(COALESCE(brand, '')) LIKE ?",
      "LOWER(COALESCE(kondisi, 'Baru')) LIKE ?",
      search === 'aktif' || search === 'nonaktif'
        ? "LOWER(COALESCE(status, 'Aktif')) = ?"
        : "LOWER(COALESCE(status, 'Aktif')) LIKE ?",
      "LOWER(COALESCE(deskripsi, '')) LIKE ?",
      "LOWER(COALESCE(attributesJson, '')) LIKE ?",
    ];
    const searchParams: Array<string | number> = [
      like,
      like,
      like,
      like,
      like,
      search === 'aktif' || search === 'nonaktif' ? search : like,
      like,
      like,
    ];

    if (search.includes('promo') || search.includes('diskon')) {
      if (promoProductIds.length > 0) {
        orClauses.push(`id IN (${promoProductIds.map(() => '?').join(', ')})`);
        searchParams.push(...promoProductIds);
      }
    } else {
      const matchedPromoIds = Array.from(promoMap.entries())
        .filter(
          ([, promo]) =>
            promo.name.toLowerCase().includes(search) ||
            promo.code.toLowerCase().includes(search) ||
            (promo.label || '').toLowerCase().includes(search)
        )
        .map(([pid]) => pid);
      if (matchedPromoIds.length > 0) {
        orClauses.push(`id IN (${matchedPromoIds.map(() => '?').join(', ')})`);
        searchParams.push(...matchedPromoIds);
      }
    }

    conditions.push(`(${orClauses.join(' OR ')})`);
    params.push(...searchParams);
  }

  if (category && category !== 'Semua') {
    const childCats = db
      .prepare("SELECT name FROM categories WHERE LOWER(COALESCE(parentName, '')) = LOWER(?)")
      .all(category) as Array<{ name: string }>;
    const catTargets = Array.from(new Set([category, ...childCats.map(c => c.name)]));
    if (catTargets.length === 1) {
      conditions.push('category = ?');
      params.push(catTargets[0]);
    } else {
      conditions.push(`category IN (${catTargets.map(() => '?').join(', ')})`);
      params.push(...catTargets);
    }
  }

  if (brand && brand !== 'Semua') {
    conditions.push("COALESCE(NULLIF(TRIM(brand), ''), 'No Brand') = ?");
    params.push(brand);
  }

  if (filterTab === 'active' || statusFilter === 'Aktif') {
    conditions.push("COALESCE(status, 'Aktif') = 'Aktif'");
  } else if (filterTab === 'inactive' || statusFilter === 'Nonaktif') {
    conditions.push("COALESCE(status, 'Aktif') = 'Nonaktif'");
  }

  if (filterTab === 'low_stock') {
    conditions.push('stok <= 5');
  }

  if (stockFilter === 'available') {
    conditions.push('stok > 5');
  } else if (stockFilter === 'low') {
    conditions.push('stok > 0 AND stok <= 5');
  } else if (stockFilter === 'out') {
    conditions.push('stok <= 0');
  }

  if (promoOnly) {
    if (promoProductIds.length === 0) {
      conditions.push('1 = 0');
    } else {
      conditions.push(`id IN (${promoProductIds.map(() => '?').join(', ')})`);
      params.push(...promoProductIds);
    }
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const totalRow = db
    .prepare(`SELECT COUNT(*) as cnt FROM products ${whereSql}`)
    .get(...params) as { cnt: number };
  const total = totalRow.cnt;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const rows = db
    .prepare(
      `SELECT p.id, p.sku, p.name, p.berat, p.harga, p.stok, p.category, p.image,
              COALESCE(p.hpp, 0) AS hpp,
              COALESCE(p.brand, 'No Brand') AS brand,
              COALESCE(p.kondisi, 'Baru') AS kondisi,
              COALESCE(p.deskripsi, '') AS deskripsi,
              COALESCE(p.panjang, 0) AS panjang,
              COALESCE(p.lebar, 0) AS lebar,
              COALESCE(p.tinggi, 0) AS tinggi,
              COALESCE(p.status, 'Aktif') AS status,
              COALESCE(p.attributesJson, '{}') AS attributesJson,
              p.createdAt AS createdAt,
              COALESCE(si.cnt, 0) AS salesCount
       FROM products p
       LEFT JOIN (
         SELECT productId, COUNT(*) AS cnt
         FROM transaction_items
         GROUP BY productId
       ) si ON si.productId = p.id
       ${whereSql.replace(/\b(tenantId|name|sku|category|brand|status|stok|id|attributesJson)\b/g, 'p.$1')}
       ORDER BY ${orderBySql.replace(/\b(harga|berat|stok|id)\b/g, 'p.$1').replace(/LOWER\((name|sku|brand)\)/g, 'LOWER(p.$1)')}
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as Array<Product & { attributesJson?: string; salesCount: number }>;

  const catRows = db
    .prepare(
      'SELECT category, COUNT(*) as cnt, COALESCE(SUM(stok), 0) as stokSum, COALESCE(SUM(berat * stok), 0) as weightSum, COALESCE(SUM(harga * stok), 0) as assetSum FROM products WHERE tenantId = ? GROUP BY category'
    )
    .all(tenantId) as Array<{
    category: string;
    cnt: number;
    stokSum: number;
    weightSum: number;
    assetSum: number;
  }>;

  let totalAllProducts = 0;
  let totalStockQty = 0;
  let totalWeightGrams = 0;
  let totalInventoryValue = 0;
  const directCatCounts: Record<string, number> = {};
  for (const r of catRows) {
    directCatCounts[r.category] = r.cnt;
    totalAllProducts += r.cnt;
    totalStockQty += r.stokSum;
    totalWeightGrams += r.weightSum;
    totalInventoryValue += r.assetSum;
  }

  const categoryDetails = getAllCategoryItems();
  const categoryCounts: Record<string, number> = { ...directCatCounts };
  for (const item of categoryDetails) {
    if (!item.parentName) {
      const children = categoryDetails.filter(
        c => c.parentName && c.parentName.toLowerCase() === item.name.toLowerCase()
      );
      const childSum = children.reduce((acc, c) => acc + (directCatCounts[c.name] ?? 0), 0);
      categoryCounts[item.name] = (directCatCounts[item.name] ?? 0) + childSum;
    } else if (categoryCounts[item.name] === undefined) {
      categoryCounts[item.name] = 0;
    }
  }
  categoryCounts['Semua'] = totalAllProducts;

  const brandRows = db
    .prepare(
      "SELECT COALESCE(NULLIF(TRIM(brand), ''), 'No Brand') as brandName, COUNT(*) as cnt FROM products WHERE tenantId = ? GROUP BY brandName ORDER BY cnt DESC, LOWER(brandName) ASC"
    )
    .all(tenantId) as Array<{ brandName: string; cnt: number }>;
  const brandCounts: Record<string, number> = {};
  for (const br of brandRows) {
    brandCounts[br.brandName] = br.cnt;
  }

  const statusAgg = db
    .prepare(
      `SELECT SUM(CASE WHEN COALESCE(status, 'Aktif') = 'Aktif' THEN 1 ELSE 0 END) as activeCount,
              SUM(CASE WHEN COALESCE(status, 'Aktif') = 'Nonaktif' THEN 1 ELSE 0 END) as inactiveCount,
              SUM(CASE WHEN stok <= 5 THEN 1 ELSE 0 END) as lowStockCount,
              SUM(CASE WHEN stok <= 0 THEN 1 ELSE 0 END) as outOfStockCount
       FROM products WHERE tenantId = ?`
    )
    .get(tenantId) as {
    activeCount: number | null;
    inactiveCount: number | null;
    lowStockCount: number | null;
    outOfStockCount: number | null;
  };

  let promoCount = 0;
  if (promoProductIds.length > 0) {
    promoCount = (
      db
        .prepare(`SELECT COUNT(*) as cnt FROM products WHERE tenantId = ? AND id IN (${promoProductIds.map(() => '?').join(', ')})`)
        .get(tenantId, ...promoProductIds) as { cnt: number }
    ).cnt;
  }

  return {
    items: rows.map(p => attachPromoFlags(p, promoMap)),
    total,
    page: safePage,
    pageSize,
    totalPages,
    promoCount,
    categoryCounts,
    categoryDetails,
    brandCounts,
    totalAllProducts,
    activeCount: statusAgg.activeCount ?? 0,
    inactiveCount: statusAgg.inactiveCount ?? 0,
    lowStockCount: statusAgg.lowStockCount ?? 0,
    outOfStockCount: statusAgg.outOfStockCount ?? 0,
    totalStockQty,
    totalWeightGrams: Number(totalWeightGrams.toFixed(2)),
    totalInventoryValue,
  };
}

function normalizeBarcodePayload(rawCode: string): string {
  let clean = rawCode.trim();
  if (!clean) return '';
  if (clean.startsWith('{') && clean.endsWith('}')) {
    try {
      const parsed = JSON.parse(clean) as { sku?: string; code?: string; id?: string | number };
      if (parsed.sku) clean = String(parsed.sku).trim();
      else if (parsed.code) clean = String(parsed.code).trim();
      else if (parsed.id !== undefined) clean = String(parsed.id).trim();
    } catch {
      // Abaikan jika bukan JSON
    }
  }
  const prefixMatch = clean.match(/^(?:SKU|BARCODE|CODE)\s*[:=]\s*(.+)$/i);
  if (prefixMatch) {
    clean = prefixMatch[1].trim();
  }
  if (clean.includes('|')) {
    clean = clean.split('|')[0]?.trim() || clean;
  }
  return clean.toLowerCase();
}

export function lookupProductByCode(rawCode: string, tenantId: string = getActiveTenantId()): Product | null {
  const clean = normalizeBarcodePayload(rawCode);
  if (!clean) return null;

  const productCols = `
    id, sku, name, berat, harga, COALESCE(hpp, 0) AS hpp, stok, category, image,
    COALESCE(brand, 'No Brand') AS brand,
    COALESCE(kondisi, 'Baru') AS kondisi,
    COALESCE(deskripsi, '') AS deskripsi,
    COALESCE(panjang, 0) AS panjang,
    COALESCE(lebar, 0) AS lebar,
    COALESCE(tinggi, 0) AS tinggi,
    COALESCE(status, 'Aktif') AS status,
    COALESCE(attributesJson, '{}') AS attributesJson,
    createdAt
  `;

  let product = db
    .prepare(`SELECT ${productCols} FROM products WHERE tenantId = ? AND LOWER(sku) = ? LIMIT 1`)
    .get(tenantId, clean) as Product | undefined;

  if (!product && /^\d+$/.test(clean)) {
    product = db
      .prepare(`SELECT ${productCols} FROM products WHERE tenantId = ? AND id = ? LIMIT 1`)
      .get(tenantId, Number(clean)) as Product | undefined;
  }

  if (!product) {
    product = db
      .prepare(`SELECT ${productCols} FROM products WHERE tenantId = ? AND LOWER(name) = ? LIMIT 1`)
      .get(tenantId, clean) as Product | undefined;
  }

  if (!product) {
    const alphaNum = clean.replace(/[^a-z0-9]/g, '');
    if (alphaNum.length >= 3) {
      const allSkus = db
        .prepare(`SELECT ${productCols} FROM products WHERE tenantId = ?`)
        .all(tenantId) as Product[];
      product = allSkus.find(p => p.sku.toLowerCase().replace(/[^a-z0-9]/g, '') === alphaNum);
    }
  }

  if (!product) return null;
  return attachPromoFlags(product, buildActivePromoMap(tenantId));
}

const SKU_CATEGORY_PREFIX_MAP: Record<string, string> = {
  parfum: 'PF',
  skincare: 'SK',
  'body care': 'BC',
  'make up': 'MU',
  makeup: 'MU',
  'hair care': 'HC',
  'paket bundling': 'PB',
  aksesoris: 'AK',
  minuman: 'MN',
  makanan: 'MK',
  elektronik: 'EL',
  umum: 'UM',
};

export function checkProductSkuAvailability(
  rawSku: string,
  tenantId: string = getActiveTenantId(),
  excludeId?: number
): {
  available: boolean;
  sku: string;
  conflictProduct?: { id: number; name: string; sku: string };
} {
  const cleanSku = rawSku.trim().toUpperCase();
  if (!cleanSku) {
    return { available: false, sku: '' };
  }
  const conflict =
    excludeId !== undefined && Number.isInteger(excludeId)
      ? (db
          .prepare('SELECT id, name, sku FROM products WHERE tenantId = ? AND LOWER(sku) = LOWER(?) AND id != ? LIMIT 1')
          .get(tenantId, cleanSku, excludeId) as { id: number; name: string; sku: string } | undefined)
      : (db
          .prepare('SELECT id, name, sku FROM products WHERE tenantId = ? AND LOWER(sku) = LOWER(?) LIMIT 1')
          .get(tenantId, cleanSku) as { id: number; name: string; sku: string } | undefined);

  return conflict
    ? { available: false, sku: cleanSku, conflictProduct: conflict }
    : { available: true, sku: cleanSku };
}

export function generateUniqueProductSku(
  category: string,
  tenantId: string = getActiveTenantId(),
  currentSku?: string
): string {
  const catRow = db
    .prepare('SELECT skuPrefix FROM categories WHERE LOWER(name) = LOWER(?) LIMIT 1')
    .get(category.trim()) as { skuPrefix?: string | null } | undefined;
  const dbPrefix = (catRow?.skuPrefix ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  const normalizedCat = category.trim().toLowerCase();
  let prefix = dbPrefix || SKU_CATEGORY_PREFIX_MAP[normalizedCat];
  if (!prefix) {
    prefix = suggestServerSkuPrefix(category);
  }

  const rows = db
    .prepare('SELECT LOWER(sku) AS skuLower FROM products WHERE tenantId = ?')
    .all(tenantId) as Array<{ skuLower: string }>;
  const used = new Set(rows.map(r => r.skuLower));

  const prefixRegex = new RegExp(`^${prefix.toLowerCase()}-(\\d+)$`);
  let maxSeq = 0;
  for (const s of used) {
    const match = prefixRegex.exec(s);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
  }

  const currentLower = currentSku?.trim().toLowerCase();
  if (currentLower) used.add(currentLower);

  let seq = maxSeq + 1;
  for (let i = 0; i < 200; i++) {
    const candidate = `${prefix}-${String(seq + i).padStart(3, '0')}`;
    if (!used.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  for (let i = 0; i < 100; i++) {
    const rnd = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${prefix}-${rnd}`;
    if (!used.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

export function getCategoriesWithStats(tenantId: string = getActiveTenantId()): CategoriesWithStatsResponse {
  const items = getAllCategoryItems();
  const categories = items.map(c => c.name);
  const categoryCreatedAt: Record<string, string> = {};
  for (const c of items) {
    if (c.createdAt) categoryCreatedAt[c.name] = c.createdAt;
  }

  const rows = db
    .prepare(
      'SELECT category, COUNT(*) as count, COALESCE(SUM(stok), 0) as totalStok, COALESCE(SUM(berat * stok), 0) as totalGram FROM products WHERE tenantId = ? GROUP BY category'
    )
    .all(tenantId) as Array<{ category: string; count: number; totalStok: number; totalGram: number }>;

  const directMap = new Map<string, { count: number; totalStok: number; totalGram: number }>();
  let totalUniqueProducts = 0;
  let totalUniqueStok = 0;
  for (const r of rows) {
    directMap.set(r.category, {
      count: r.count,
      totalStok: r.totalStok,
      totalGram: r.totalGram,
    });
    totalUniqueProducts += r.count;
    totalUniqueStok += r.totalStok;
  }

  const childrenByParent = new Map<string, CategoryItem[]>();
  for (const c of items) {
    if (c.parentName) {
      const key = c.parentName.toLowerCase();
      const arr = childrenByParent.get(key) ?? [];
      arr.push(c);
      childrenByParent.set(key, arr);
    }
  }

  const stats: Record<string, CategoryStatsItem> = {};
  for (const c of items) {
    const direct = directMap.get(c.name) ?? { count: 0, totalStok: 0, totalGram: 0 };
    const children = !c.parentName ? (childrenByParent.get(c.name.toLowerCase()) ?? []) : [];
    let rolledCount = direct.count;
    let rolledStok = direct.totalStok;
    let rolledGram = direct.totalGram;
    for (const child of children) {
      const cs = directMap.get(child.name) ?? { count: 0, totalStok: 0, totalGram: 0 };
      rolledCount += cs.count;
      rolledStok += cs.totalStok;
      rolledGram += cs.totalGram;
    }
    stats[c.name] = {
      count: rolledCount,
      totalStok: rolledStok,
      totalGram: Number(rolledGram.toFixed(2)),
      directCount: direct.count,
      directStok: direct.totalStok,
      directGram: Number(direct.totalGram.toFixed(2)),
      childrenCount: children.length,
    };
  }

  return {
    categories,
    items,
    stats,
    categoryCreatedAt,
    totalUniqueProducts,
    totalUniqueStok,
  };
}

export function createCategoryItem(payload: CategoryPayload): CategoryItem {
  const name = String(payload.name ?? '').trim();
  if (!name || name.length < 2) {
    throw new Error('Nama kategori wajib diisi minimal 2 karakter.');
  }
  const existing = db.prepare('SELECT name FROM categories WHERE LOWER(name) = LOWER(?)').get(name);
  if (existing) {
    throw new Error(`Kategori "${name}" sudah ada.`);
  }

  const parentName = payload.parentName ? String(payload.parentName).trim() : null;
  if (parentName) {
    if (parentName.toLowerCase() === name.toLowerCase()) {
      throw new Error('Kategori tidak dapat menjadi induk bagi dirinya sendiri.');
    }
    const parentRow = db
      .prepare('SELECT name, parentName FROM categories WHERE LOWER(name) = LOWER(?)')
      .get(parentName) as { name: string; parentName?: string | null } | undefined;
    if (!parentRow) {
      throw new Error(`Kategori induk "${parentName}" tidak ditemukan.`);
    }
    if (parentRow.parentName) {
      throw new Error('Sub-kategori hanya dapat ditempatkan di bawah Kategori Utama (Level 1).');
    }
  }

  const icon = String(payload.icon ?? 'category').trim() || 'category';
  const rawPrefix = String(payload.skuPrefix ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 5);
  const skuPrefix = rawPrefix || suggestServerSkuPrefix(name);
  const isActive = payload.isActive === false ? 0 : 1;
  const description = String(payload.description ?? '').trim();
  const attributeFields = normalizeCategoryAttributesInput(payload.attributeFields);
  const maxOrder = (
    db.prepare('SELECT COALESCE(MAX(sortOrder), 0) as m FROM categories').get() as { m: number }
  ).m;
  const sortOrder =
    payload.sortOrder !== undefined && Number.isFinite(Number(payload.sortOrder)) && Number(payload.sortOrder) > 0
      ? Math.round(Number(payload.sortOrder))
      : maxOrder + 1;
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO categories (
      name, sortOrder, parentName, icon, skuPrefix, isActive, description, attributeFieldsJson, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    sortOrder,
    parentName,
    icon,
    skuPrefix,
    isActive,
    description,
    JSON.stringify(attributeFields),
    createdAt
  );

  return parseCategoryRow({
    name,
    sortOrder,
    parentName,
    icon,
    skuPrefix,
    isActive,
    description,
    attributeFieldsJson: JSON.stringify(attributeFields),
    createdAt,
  });
}

export function updateCategoryItem(oldName: string, payload: CategoryPayload): { oldName: string; item: CategoryItem } {
  const cleanOld = oldName.trim();
  const existingRow = db
    .prepare(
      'SELECT name, parentName, icon, skuPrefix, sortOrder, isActive, description, attributeFieldsJson, createdAt FROM categories WHERE name = ?'
    )
    .get(cleanOld) as
    | {
        name: string;
        parentName?: string | null;
        icon?: string | null;
        skuPrefix?: string | null;
        sortOrder?: number | null;
        isActive?: number | null;
        description?: string | null;
        attributeFieldsJson?: string | null;
        createdAt?: string | null;
      }
    | undefined;
  if (!existingRow) {
    throw new Error('Kategori tidak ditemukan.');
  }

  const newName = String(payload.name ?? existingRow.name).trim();
  if (!newName || newName.length < 2) {
    throw new Error('Nama kategori baru minimal 2 karakter.');
  }
  if (cleanOld.toLowerCase() !== newName.toLowerCase()) {
    const clash = db.prepare('SELECT name FROM categories WHERE LOWER(name) = LOWER(?)').get(newName);
    if (clash) {
      throw new Error(`Kategori "${newName}" sudah terdaftar.`);
    }
  }

  let nextParent = existingRow.parentName ? existingRow.parentName.trim() : null;
  if (payload.parentName !== undefined) {
    nextParent = payload.parentName ? String(payload.parentName).trim() : null;
  }

  if (nextParent) {
    if (nextParent.toLowerCase() === cleanOld.toLowerCase() || nextParent.toLowerCase() === newName.toLowerCase()) {
      throw new Error('Kategori tidak dapat menjadi induk bagi dirinya sendiri.');
    }
    const childCount = (
      db
        .prepare("SELECT COUNT(*) as cnt FROM categories WHERE LOWER(COALESCE(parentName, '')) = LOWER(?)")
        .get(cleanOld) as { cnt: number }
    ).cnt;
    if (childCount > 0) {
      throw new Error(
        `Kategori "${cleanOld}" memiliki ${childCount} sub-kategori sehingga tetap harus menjadi Kategori Utama.`
      );
    }
    const parentRow = db
      .prepare('SELECT name, parentName FROM categories WHERE LOWER(name) = LOWER(?)')
      .get(nextParent) as { name: string; parentName?: string | null } | undefined;
    if (!parentRow) {
      throw new Error(`Kategori induk "${nextParent}" tidak ditemukan.`);
    }
    if (parentRow.parentName) {
      throw new Error('Sub-kategori hanya dapat ditempatkan di bawah Kategori Utama (Level 1).');
    }
    nextParent = parentRow.name;
  }

  const icon =
    payload.icon !== undefined ? (String(payload.icon).trim() || 'category') : (existingRow.icon ?? 'category');
  const rawPrefix =
    payload.skuPrefix !== undefined
      ? String(payload.skuPrefix).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
      : (existingRow.skuPrefix ?? '');
  const skuPrefix = rawPrefix || suggestServerSkuPrefix(newName);
  const isActive =
    payload.isActive !== undefined ? (payload.isActive ? 1 : 0) : (existingRow.isActive ?? 1);
  const description =
    payload.description !== undefined ? String(payload.description).trim() : (existingRow.description ?? '');
  const sortOrder =
    payload.sortOrder !== undefined && Number.isFinite(Number(payload.sortOrder))
      ? Math.max(0, Math.round(Number(payload.sortOrder)))
      : (existingRow.sortOrder ?? 0);
  const attributeFieldsJson =
    payload.attributeFields !== undefined
      ? JSON.stringify(normalizeCategoryAttributesInput(payload.attributeFields))
      : (existingRow.attributeFieldsJson ?? '[]');

  const updateTx = db.transaction(() => {
    db.prepare(`
      UPDATE categories
      SET name = ?, parentName = ?, icon = ?, skuPrefix = ?, isActive = ?, description = ?, sortOrder = ?, attributeFieldsJson = ?
      WHERE name = ?
    `).run(newName, nextParent, icon, skuPrefix, isActive, description, sortOrder, attributeFieldsJson, cleanOld);

    if (cleanOld !== newName) {
      db.prepare('UPDATE products SET category = ? WHERE category = ?').run(newName, cleanOld);
      db.prepare('UPDATE categories SET parentName = ? WHERE parentName = ?').run(newName, cleanOld);
    }
  });
  updateTx();

  return {
    oldName: cleanOld,
    item: parseCategoryRow({
      name: newName,
      parentName: nextParent,
      icon,
      skuPrefix,
      isActive,
      description,
      sortOrder,
      attributeFieldsJson,
      createdAt: existingRow.createdAt,
    }),
  };
}

export function toggleCategoryItemActive(name: string, isActive: boolean): CategoryItem {
  const existingRow = db
    .prepare(
      'SELECT name, parentName, icon, skuPrefix, sortOrder, isActive, description, attributeFieldsJson, createdAt FROM categories WHERE name = ?'
    )
    .get(name.trim()) as
    | {
        name: string;
        parentName?: string | null;
        icon?: string | null;
        skuPrefix?: string | null;
        sortOrder?: number | null;
        isActive?: number | null;
        description?: string | null;
        attributeFieldsJson?: string | null;
        createdAt?: string | null;
      }
    | undefined;
  if (!existingRow) {
    throw new Error('Kategori tidak ditemukan.');
  }
  const flag = isActive ? 1 : 0;
  db.prepare('UPDATE categories SET isActive = ? WHERE name = ?').run(flag, existingRow.name);
  return parseCategoryRow({ ...existingRow, isActive: flag });
}

export function deleteCategoryItem(name: string): string {
  const cleanName = name.trim();
  const usedCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM products WHERE category = ?').get(cleanName) as { cnt: number }
  ).cnt;
  if (usedCount > 0) {
    throw new Error(
      `Kategori "${cleanName}" masih digunakan oleh ${usedCount} barang. Ubah kategori barang terkait terlebih dahulu.`
    );
  }
  const childCount = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM categories WHERE LOWER(COALESCE(parentName, '')) = LOWER(?)")
      .get(cleanName) as { cnt: number }
  ).cnt;
  if (childCount > 0) {
    throw new Error(
      `Kategori "${cleanName}" masih memiliki ${childCount} sub-kategori. Hapus atau pindahkan sub-kategori terkait terlebih dahulu.`
    );
  }
  const result = db.prepare('DELETE FROM categories WHERE name = ?').run(cleanName);
  if (result.changes === 0) {
    throw new Error('Kategori tidak ditemukan.');
  }
  return cleanName;
}

export function queryTransactions(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  method?: string;
  status?: 'all' | 'completed' | 'void';
  cashier?: string;
  promoFilter?: 'all' | 'with_promo' | 'no_promo';
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  tenantId?: string;
}): TransactionsPageResponse {
  const tenantId = opts.tenantId ?? getActiveTenantId();
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize ?? 10)));
  const search = (opts.search ?? '').trim().toLowerCase();
  const method = (opts.method ?? 'semua').trim();
  const status = (opts.status ?? 'all').trim();
  const cashier = (opts.cashier ?? '').trim();
  const promoFilter = (opts.promoFilter ?? 'all').trim();
  const dateFrom = (opts.dateFrom ?? '').trim();
  const dateTo = (opts.dateTo ?? '').trim();
  const sortDir = normalizeSortDir(opts.sortDir);

  let orderBySql = `t.dateTime ${sortDir}, t.rowid ${sortDir}`;
  switch (opts.sortBy) {
    case 'grandTotal':
      orderBySql = `t.grandTotal ${sortDir}, t.dateTime DESC`;
      break;
    case 'totalBerat':
      orderBySql = `t.totalBerat ${sortDir}, t.dateTime DESC`;
      break;
    case 'customerName':
      orderBySql = `LOWER(t.customerName) ${sortDir}, t.dateTime DESC`;
      break;
    case 'invoiceNo':
      orderBySql = `t.invoiceNo ${sortDir}, t.rowid DESC`;
      break;
    case 'paymentMethod':
      orderBySql = `t.paymentMethod ${sortDir}, t.dateTime DESC`;
      break;
    case 'newest':
    default:
      orderBySql = `t.dateTime ${sortDir}, t.rowid ${sortDir}`;
      break;
  }

  const conditions: string[] = ['t.tenantId = ?'];
  const params: Array<string | number> = [tenantId];

  if (search) {
    const like = `%${search}%`;
    const orClauses = [
      'LOWER(t.invoiceNo) LIKE ?',
      'LOWER(t.customerName) LIKE ?',
      'LOWER(t.cashier) LIKE ?',
      "LOWER(COALESCE(c.memberCode, '')) LIKE ?",
      "LOWER(COALESCE(t.promoCode, '')) LIKE ?",
      "LOWER(COALESCE(t.promoName, '')) LIKE ?",
      'LOWER(t.dateStr) LIKE ?',
      'LOWER(t.dateTime) LIKE ?',
      'LOWER(t.paymentMethod) LIKE ?',
      "LOWER(COALESCE(t.paymentDetailsJson, '')) LIKE ?",
      "LOWER(COALESCE(t.status, 'completed')) LIKE ?",
      "EXISTS (SELECT 1 FROM transaction_items ti LEFT JOIN products p ON p.id = ti.productId WHERE ti.transactionId = t.id AND (LOWER(ti.name) LIKE ? OR LOWER(ti.sku) LIKE ? OR LOWER(COALESCE(p.category, '')) LIKE ?))",
    ];
    const searchParams: Array<string | number> = [
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
    ];

    if (search === 'tunai' || 'tunai'.includes(search)) {
      orClauses.push("t.paymentMethod = 'cash'");
    }
    if (search === 'void' || search === 'batal' || search === 'dibatalkan' || 'dibatalkan'.includes(search)) {
      orClauses.push("COALESCE(t.status, 'completed') = 'void'");
    }
    if (search === 'lunas' || search === 'sukses' || search === 'selesai') {
      orClauses.push("COALESCE(t.status, 'completed') != 'void'");
    }

    conditions.push(`(${orClauses.join(' OR ')})`);
    params.push(...searchParams);
  }

  if (method && method !== 'semua') {
    conditions.push('t.paymentMethod = ?');
    params.push(method);
  }

  if (status === 'completed') {
    conditions.push("COALESCE(t.status, 'completed') != 'void'");
  } else if (status === 'void') {
    conditions.push("COALESCE(t.status, 'completed') = 'void'");
  }

  if (cashier && cashier !== 'all') {
    conditions.push('t.cashier = ?');
    params.push(cashier);
  }

  if (promoFilter === 'with_promo') {
    conditions.push("(COALESCE(t.discountAmount, 0) > 0 OR COALESCE(TRIM(t.promoCode), '') != '')");
  } else if (promoFilter === 'no_promo') {
    conditions.push("COALESCE(t.discountAmount, 0) <= 0 AND COALESCE(TRIM(t.promoCode), '') = ''");
  }

  if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    conditions.push('substr(t.dateTime, 1, 10) >= ?');
    params.push(dateFrom);
  }

  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    conditions.push('substr(t.dateTime, 1, 10) <= ?');
    params.push(dateTo);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (
    db
      .prepare(`SELECT COUNT(*) as cnt FROM transactions t LEFT JOIN customers c ON c.id = t.customerId ${whereSql}`)
      .get(...params) as { cnt: number }
  ).cnt;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const txRows = db
    .prepare(
      `SELECT t.id, t.invoiceNo, t.dateTime, t.dateStr, t.timeStr, t.cashier, t.customerId,
              c.memberCode AS customerMemberCode, t.customerName,
              c.phone AS customerPhone, c.address AS customerAddress,
              t.totalQty, t.totalBerat, t.subtotal,
              COALESCE(t.discountAmount, 0) AS discountAmount, t.promoCode, t.promoName,
              t.tax, t.grandTotal, t.paymentMethod, t.paymentDetailsJson,
              COALESCE(t.status, 'completed') AS status, t.voidReason, t.voidedAt
       FROM transactions t
       LEFT JOIN customers c ON c.id = t.customerId
       ${whereSql} ORDER BY ${orderBySql} LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as Array<{
    id: string;
    invoiceNo: string;
    dateTime: string;
    dateStr: string;
    timeStr: string;
    cashier: string;
    customerId: string | null;
    customerMemberCode: string | null;
    customerName: string;
    customerPhone: string | null;
    customerAddress: string | null;
    totalQty: number;
    totalBerat: number;
    subtotal: number;
    discountAmount: number;
    promoCode: string | null;
    promoName: string | null;
    tax: number;
    grandTotal: number;
    paymentMethod: 'cash' | 'debit' | 'transfer' | 'qris';
    paymentDetailsJson: string;
    status: 'completed' | 'void';
    voidReason: string | null;
    voidedAt: string | null;
  }>;

  const itemsByTx = new Map<string, TransactionItem[]>();
  if (txRows.length > 0) {
    const ids = txRows.map(t => t.id);
    const placeholders = ids.map(() => '?').join(', ');
    const itemRows = db
      .prepare(
        `SELECT ti.transactionId, ti.productId, ti.sku, ti.name, p.category AS category,
                COALESCE(p.brand, 'No Brand') AS brand,
                COALESCE(p.kondisi, 'Baru') AS kondisi,
                COALESCE(p.hpp, 0) AS hpp,
                COALESCE(p.panjang, 0) AS panjang,
                COALESCE(p.lebar, 0) AS lebar,
                COALESCE(p.tinggi, 0) AS tinggi,
                ti.berat, ti.harga, ti.qty, ti.subtotal, COALESCE(ti.image, p.image) AS image
         FROM transaction_items ti
         LEFT JOIN products p ON p.id = ti.productId
         WHERE ti.transactionId IN (${placeholders}) ORDER BY ti.id ASC`
      )
      .all(...ids) as Array<{
      transactionId: string;
      productId: number;
      sku: string;
      name: string;
      category: string | null;
      brand: string | null;
      kondisi: string | null;
      hpp: number;
      panjang: number;
      lebar: number;
      tinggi: number;
      berat: number;
      harga: number;
      qty: number;
      subtotal: number;
      image: string | null;
    }>;

    for (const row of itemRows) {
      const list = itemsByTx.get(row.transactionId) ?? [];
      list.push({
        id: row.productId,
        sku: row.sku,
        name: row.name,
        category: row.category ?? undefined,
        brand: row.brand ?? 'No Brand',
        kondisi: row.kondisi === 'Bekas' ? 'Bekas' : 'Baru',
        hpp: row.hpp ?? 0,
        panjang: row.panjang ?? 0,
        lebar: row.lebar ?? 0,
        tinggi: row.tinggi ?? 0,
        berat: row.berat,
        harga: row.harga,
        qty: row.qty,
        subtotal: row.subtotal,
        image: row.image ?? undefined,
      });
      itemsByTx.set(row.transactionId, list);
    }
  }

  const agg = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN grandTotal ELSE 0 END), 0) as totalOmzet,
              COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN totalBerat ELSE 0 END), 0) as totalBerat,
              COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN totalQty ELSE 0 END), 0) as totalQtyTerjual,
              SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN 1 ELSE 0 END) as totalCount,
              SUM(CASE WHEN COALESCE(status, 'completed') = 'void' THEN 1 ELSE 0 END) as voidCount
       FROM transactions WHERE tenantId = ?`
    )
    .get(tenantId) as {
    totalOmzet: number;
    totalBerat: number;
    totalQtyTerjual: number;
    totalCount: number | null;
    voidCount: number | null;
  };
  const completedCount = agg.totalCount ?? 0;

  const cashierRows = db
    .prepare("SELECT DISTINCT cashier FROM transactions WHERE tenantId = ? AND TRIM(cashier) != '' ORDER BY LOWER(cashier) ASC")
    .all(tenantId) as Array<{ cashier: string }>;

  return {
    items: txRows.map(tx => ({
      id: tx.id,
      invoiceNo: tx.invoiceNo,
      dateTime: tx.dateTime,
      dateStr: tx.dateStr,
      timeStr: tx.timeStr,
      cashier: tx.cashier,
      customerId: tx.customerId ?? undefined,
      customerMemberCode: tx.customerMemberCode ?? undefined,
      customerName: tx.customerName,
      customerPhone: tx.customerPhone ?? undefined,
      customerAddress: tx.customerAddress ?? undefined,
      items: itemsByTx.get(tx.id) ?? [],
      totalQty: tx.totalQty,
      totalBerat: tx.totalBerat,
      subtotal: tx.subtotal,
      discountAmount: tx.discountAmount > 0 ? tx.discountAmount : undefined,
      promoCode: tx.promoCode ?? undefined,
      promoName: tx.promoName ?? undefined,
      tax: tx.tax,
      grandTotal: tx.grandTotal,
      paymentMethod: tx.paymentMethod,
      paymentDetails: safeJsonParse<PaymentDetails>(tx.paymentDetailsJson, {}),
      status: tx.status === 'void' ? 'void' : 'completed',
      voidReason: tx.voidReason ?? undefined,
      voidedAt: tx.voidedAt ?? undefined,
    })),
    total,
    page: safePage,
    pageSize,
    totalPages,
    cashiers: cashierRows.map(r => r.cashier),
    stats: {
      totalOmzetPenjualan: agg.totalOmzet,
      totalBeratTerjual: agg.totalBerat,
      totalQtyTerjual: agg.totalQtyTerjual,
      totalTransaksi: completedCount,
      voidCount: agg.voidCount ?? 0,
      avgPerTransaksi: completedCount > 0 ? Math.round(agg.totalOmzet / completedCount) : 0,
    },
  };
}

export function getTransactionById(id: string, tenantId?: string): Transaction | null {
  const txQuery = `SELECT t.id, t.invoiceNo, t.dateTime, t.dateStr, t.timeStr, t.cashier, t.customerId,
                          c.memberCode AS customerMemberCode, t.customerName,
                          c.phone AS customerPhone, c.address AS customerAddress,
                          t.totalQty, t.totalBerat, t.subtotal,
                          COALESCE(t.discountAmount, 0) AS discountAmount, t.promoCode, t.promoName,
                          t.tax, t.grandTotal, t.paymentMethod, t.paymentDetailsJson,
                          COALESCE(t.status, 'completed') AS status, t.voidReason, t.voidedAt
                   FROM transactions t
                   LEFT JOIN customers c ON c.id = t.customerId
                   WHERE t.id = ?${tenantId ? ' AND t.tenantId = ?' : ''}`;
  const tx = (
    tenantId ? db.prepare(txQuery).get(id, tenantId) : db.prepare(txQuery).get(id)
  ) as
    | {
        id: string;
        invoiceNo: string;
        dateTime: string;
        dateStr: string;
        timeStr: string;
        cashier: string;
        customerId: string | null;
        customerMemberCode: string | null;
        customerName: string;
        customerPhone: string | null;
        customerAddress: string | null;
        totalQty: number;
        totalBerat: number;
        subtotal: number;
        discountAmount: number;
        promoCode: string | null;
        promoName: string | null;
        tax: number;
        grandTotal: number;
        paymentMethod: 'cash' | 'debit' | 'transfer' | 'qris';
        paymentDetailsJson: string;
        status: 'completed' | 'void';
        voidReason: string | null;
        voidedAt: string | null;
      }
    | undefined;

  if (!tx) return null;

  const itemRows = db
    .prepare(
      `SELECT ti.productId, ti.sku, ti.name, p.category AS category,
              COALESCE(p.brand, 'No Brand') AS brand,
              COALESCE(p.kondisi, 'Baru') AS kondisi,
              COALESCE(p.hpp, 0) AS hpp,
              COALESCE(p.panjang, 0) AS panjang,
              COALESCE(p.lebar, 0) AS lebar,
              COALESCE(p.tinggi, 0) AS tinggi,
              ti.berat, ti.harga, ti.qty, ti.subtotal, COALESCE(ti.image, p.image) AS image
       FROM transaction_items ti
       LEFT JOIN products p ON p.id = ti.productId
       WHERE ti.transactionId = ? ORDER BY ti.id ASC`
    )
    .all(id) as Array<{
    productId: number;
    sku: string;
    name: string;
    category: string | null;
    brand: string | null;
    kondisi: string | null;
    hpp: number;
    panjang: number;
    lebar: number;
    tinggi: number;
    berat: number;
    harga: number;
    qty: number;
    subtotal: number;
    image: string | null;
  }>;

  return {
    id: tx.id,
    invoiceNo: tx.invoiceNo,
    dateTime: tx.dateTime,
    dateStr: tx.dateStr,
    timeStr: tx.timeStr,
    cashier: tx.cashier,
    customerId: tx.customerId ?? undefined,
    customerMemberCode: tx.customerMemberCode ?? undefined,
    customerName: tx.customerName,
    customerPhone: tx.customerPhone ?? undefined,
    customerAddress: tx.customerAddress ?? undefined,
    items: itemRows.map(r => ({
      id: r.productId,
      sku: r.sku,
      name: r.name,
      category: r.category ?? undefined,
      brand: r.brand ?? 'No Brand',
      kondisi: r.kondisi === 'Bekas' ? 'Bekas' : 'Baru',
      hpp: r.hpp ?? 0,
      panjang: r.panjang ?? 0,
      lebar: r.lebar ?? 0,
      tinggi: r.tinggi ?? 0,
      berat: r.berat,
      harga: r.harga,
      qty: r.qty,
      subtotal: r.subtotal,
      image: r.image ?? undefined,
    })),
    totalQty: tx.totalQty,
    totalBerat: tx.totalBerat,
    subtotal: tx.subtotal,
    discountAmount: tx.discountAmount > 0 ? tx.discountAmount : undefined,
    promoCode: tx.promoCode ?? undefined,
    promoName: tx.promoName ?? undefined,
    tax: tx.tax,
    grandTotal: tx.grandTotal,
    paymentMethod: tx.paymentMethod,
    paymentDetails: safeJsonParse<PaymentDetails>(tx.paymentDetailsJson, {}),
    status: tx.status === 'void' ? 'void' : 'completed',
    voidReason: tx.voidReason ?? undefined,
    voidedAt: tx.voidedAt ?? undefined,
  };
}

function getTxLocalDateParts(dateTime: string, invoiceNo: string): { year: number; month: number; day: number; ymd: string } | null {
  if (dateTime) {
    const d = new Date(dateTime);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const ymd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { year, month, day, ymd };
    }
  }
  const m = /^TRX-(\d{4})(\d{2})(\d{2})-/.exec(invoiceNo || '');
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    return { year, month, day, ymd: `${m[1]}-${m[2]}-${m[3]}` };
  }
  return null;
}

export function queryTransactionsForExport(opts: {
  period?: 'monthly' | 'daily' | 'custom' | 'yearly' | 'all';
  month?: number;
  year?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  method?: string;
  statusFilter?: 'completed' | 'all' | 'void';
  search?: string;
  tenantId?: string;
}): { transactions: Transaction[]; tenant: Tenant | null } {
  const tenantId = opts.tenantId ?? getActiveTenantId();
  const period = opts.period ?? 'monthly';
  const method = (opts.method ?? 'semua').trim();
  const statusFilter = opts.statusFilter ?? 'completed';
  const search = (opts.search ?? '').trim().toLowerCase();

  const conditions: string[] = ['t.tenantId = ?'];
  const params: Array<string | number> = [tenantId];

  if (search) {
    const like = `%${search}%`;
    conditions.push(
      `(LOWER(t.invoiceNo) LIKE ? OR LOWER(t.customerName) LIKE ? OR LOWER(t.cashier) LIKE ? OR EXISTS (SELECT 1 FROM transaction_items ti WHERE ti.transactionId = t.id AND (LOWER(ti.name) LIKE ? OR LOWER(ti.sku) LIKE ?)))`
    );
    params.push(like, like, like, like, like);
  }

  if (method && method !== 'semua') {
    conditions.push('t.paymentMethod = ?');
    params.push(method);
  }

  if (statusFilter === 'completed') {
    conditions.push("COALESCE(t.status, 'completed') != 'void'");
  } else if (statusFilter === 'void') {
    conditions.push("COALESCE(t.status, 'completed') = 'void'");
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const txRows = db
    .prepare(
      `SELECT t.id, t.invoiceNo, t.dateTime, t.dateStr, t.timeStr, t.cashier, t.customerId,
              c.memberCode AS customerMemberCode, t.customerName,
              c.phone AS customerPhone, c.address AS customerAddress,
              t.totalQty, t.totalBerat, t.subtotal, t.tax, t.grandTotal, t.paymentMethod, t.paymentDetailsJson,
              COALESCE(t.status, 'completed') AS status, t.voidReason, t.voidedAt
       FROM transactions t
       LEFT JOIN customers c ON c.id = t.customerId
       ${whereSql} ORDER BY t.dateTime DESC, t.rowid DESC`
    )
    .all(...params) as Array<{
    id: string;
    invoiceNo: string;
    dateTime: string;
    dateStr: string;
    timeStr: string;
    cashier: string;
    customerId: string | null;
    customerMemberCode: string | null;
    customerName: string;
    customerPhone: string | null;
    customerAddress: string | null;
    totalQty: number;
    totalBerat: number;
    subtotal: number;
    tax: number;
    grandTotal: number;
    paymentMethod: 'cash' | 'debit' | 'transfer' | 'qris';
    paymentDetailsJson: string;
    status: 'completed' | 'void';
    voidReason: string | null;
    voidedAt: string | null;
  }>;

  const now = new Date();
  const targetYear = opts.year || now.getFullYear();
  const targetMonth = opts.month || now.getMonth() + 1;
  const targetDate = (opts.date || '').trim() || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const rawFrom = (opts.dateFrom || '').trim() || targetDate;
  const rawTo = (opts.dateTo || '').trim() || rawFrom;
  const [dateFrom, dateTo] = rawFrom <= rawTo ? [rawFrom, rawTo] : [rawTo, rawFrom];

  const filteredTxRows = txRows.filter(tx => {
    if (period === 'all') return true;
    const parts = getTxLocalDateParts(tx.dateTime, tx.invoiceNo);
    if (!parts) return false;
    switch (period) {
      case 'monthly':
        return parts.year === targetYear && parts.month === targetMonth;
      case 'daily':
        return parts.ymd === targetDate;
      case 'custom':
        return parts.ymd >= dateFrom && parts.ymd <= dateTo;
      case 'yearly':
        return parts.year === targetYear;
      default:
        return true;
    }
  });

  const itemsByTx = new Map<string, TransactionItem[]>();
  if (filteredTxRows.length > 0) {
    const ids = filteredTxRows.map(t => t.id);
    // Chunk IN queries to stay safely below SQLite's parameter limit
    const CHUNK_SIZE = 400;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(', ');
      const itemRows = db
        .prepare(
          `SELECT ti.transactionId, ti.productId, ti.sku, ti.name, p.category AS category,
                  COALESCE(p.brand, 'No Brand') AS brand,
                  COALESCE(p.kondisi, 'Baru') AS kondisi,
                  COALESCE(p.hpp, 0) AS hpp,
                  COALESCE(p.panjang, 0) AS panjang,
                  COALESCE(p.lebar, 0) AS lebar,
                  COALESCE(p.tinggi, 0) AS tinggi,
                  ti.berat, ti.harga, ti.qty, ti.subtotal, COALESCE(ti.image, p.image) AS image
           FROM transaction_items ti
           LEFT JOIN products p ON p.id = ti.productId
           WHERE ti.transactionId IN (${placeholders}) ORDER BY ti.id ASC`
        )
        .all(...chunk) as Array<{
        transactionId: string;
        productId: number;
        sku: string;
        name: string;
        category: string | null;
        brand: string | null;
        kondisi: string | null;
        hpp: number;
        panjang: number;
        lebar: number;
        tinggi: number;
        berat: number;
        harga: number;
        qty: number;
        subtotal: number;
        image: string | null;
      }>;

      for (const row of itemRows) {
        const list = itemsByTx.get(row.transactionId) ?? [];
        list.push({
          id: row.productId,
          sku: row.sku,
          name: row.name,
          category: row.category ?? undefined,
          brand: row.brand ?? 'No Brand',
          kondisi: row.kondisi === 'Bekas' ? 'Bekas' : 'Baru',
          hpp: row.hpp ?? 0,
          panjang: row.panjang ?? 0,
          lebar: row.lebar ?? 0,
          tinggi: row.tinggi ?? 0,
          berat: row.berat,
          harga: row.harga,
          qty: row.qty,
          subtotal: row.subtotal,
          image: row.image ?? undefined,
        });
        itemsByTx.set(row.transactionId, list);
      }
    }
  }

  const tenantRow = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as Tenant | undefined;
  const tenant = tenantRow ? { ...tenantRow, logoUrl: tenantRow.logoUrl || '' } : null;

  return {
    tenant,
    transactions: filteredTxRows.map(tx => ({
      id: tx.id,
      invoiceNo: tx.invoiceNo,
      dateTime: tx.dateTime,
      dateStr: tx.dateStr,
      timeStr: tx.timeStr,
      cashier: tx.cashier,
      customerId: tx.customerId ?? undefined,
      customerMemberCode: tx.customerMemberCode ?? undefined,
      customerName: tx.customerName,
      customerPhone: tx.customerPhone ?? undefined,
      customerAddress: tx.customerAddress ?? undefined,
      items: itemsByTx.get(tx.id) ?? [],
      totalQty: tx.totalQty,
      totalBerat: tx.totalBerat,
      subtotal: tx.subtotal,
      tax: tx.tax,
      grandTotal: tx.grandTotal,
      paymentMethod: tx.paymentMethod,
      paymentDetails: safeJsonParse<PaymentDetails>(tx.paymentDetailsJson, {}),
      status: tx.status === 'void' ? 'void' : 'completed',
      voidReason: tx.voidReason ?? undefined,
      voidedAt: tx.voidedAt ?? undefined,
    })),
  };
}

function mapBuybackRow(r: {
  id: string;
  invoiceNo: string;
  date: string;
  timeStr: string | null;
  branchName: string | null;
  cashierName: string | null;
  customerId?: string | null;
  customerMemberCode?: string | null;
  customerName: string;
  customerPhone: string;
  customerNik: string | null;
  customerNpwp: string | null;
  customerAddress: string | null;
  sourceNote: string;
  itemType: string;
  kadar: string;
  beratKotor: number;
  potonganBatu: number;
  beratBersih: number;
  hargaPerGram: number;
  biayaLebur: number;
  kondisi: string;
  totalKotor: number | null;
  potonganBiaya: number | null;
  pph22: number | null;
  totalBayar: number;
  paymentMethod: 'cash' | 'transfer';
  bankName: string | null;
  accountNo: string | null;
  accountHolder: string | null;
  catatan: string | null;
  fotoKtp?: string | null;
  fotoEmas?: string | null;
  ttdNasabah?: string | null;
  ttdPetugas?: string | null;
  isAgreedLegal: number;
  itemsJson?: string | null;
  status?: string | null;
  voidReason?: string | null;
  voidedAt?: string | null;
}): BuybackItem {
  return {
    id: r.id,
    invoiceNo: r.invoiceNo,
    date: r.date,
    timeStr: r.timeStr ?? undefined,
    branchName: r.branchName ?? undefined,
    cashierName: r.cashierName ?? undefined,
    customerId: r.customerId ?? undefined,
    customerMemberCode: r.customerMemberCode ?? undefined,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerNik: r.customerNik ?? undefined,
    customerNpwp: r.customerNpwp ?? undefined,
    customerAddress: r.customerAddress ?? undefined,
    sourceNote: r.sourceNote,
    itemType: r.itemType,
    kadar: r.kadar,
    beratKotor: r.beratKotor,
    potonganBatu: r.potonganBatu,
    beratBersih: r.beratBersih,
    hargaPerGram: r.hargaPerGram,
    biayaLebur: r.biayaLebur,
    kondisi: r.kondisi,
    totalKotor: r.totalKotor ?? undefined,
    potonganBiaya: r.potonganBiaya ?? undefined,
    pph22: r.pph22 ?? undefined,
    totalBayar: r.totalBayar,
    paymentMethod: r.paymentMethod,
    bankName: r.bankName ?? undefined,
    accountNo: r.accountNo ?? undefined,
    accountHolder: r.accountHolder ?? undefined,
    catatan: r.catatan ?? undefined,
    fotoKtp: r.fotoKtp ?? undefined,
    fotoEmas: r.fotoEmas ?? undefined,
    ttdNasabah: r.ttdNasabah ?? undefined,
    ttdPetugas: r.ttdPetugas ?? undefined,
    isAgreedLegal: Boolean(r.isAgreedLegal),
    items: r.itemsJson ? safeJsonParse<BuybackGoldItem[]>(r.itemsJson, []) : undefined,
    status: r.status === 'void' ? 'void' : 'completed',
    voidReason: r.voidReason ?? undefined,
    voidedAt: r.voidedAt ?? undefined,
  };
}

export function queryBuybacks(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  method?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  tenantId?: string;
}): BuybacksPageResponse {
  const tenantId = opts.tenantId ?? getActiveTenantId();
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize ?? 10)));
  const search = (opts.search ?? '').trim().toLowerCase();
  const method = (opts.method ?? 'all').trim();
  const sortDir = normalizeSortDir(opts.sortDir);

  let orderBySql = `b.rowid ${sortDir}`;
  switch (opts.sortBy) {
    case 'totalBayar':
      orderBySql = `b.totalBayar ${sortDir}, b.rowid DESC`;
      break;
    case 'beratBersih':
      orderBySql = `b.beratBersih ${sortDir}, b.rowid DESC`;
      break;
    case 'customerName':
      orderBySql = `LOWER(b.customerName) ${sortDir}, b.rowid DESC`;
      break;
    case 'invoiceNo':
      orderBySql = `b.invoiceNo ${sortDir}, b.rowid DESC`;
      break;
    case 'itemType':
      orderBySql = `LOWER(b.itemType) ${sortDir}, b.rowid DESC`;
      break;
    case 'newest':
    default:
      orderBySql = `b.rowid ${sortDir}`;
      break;
  }

  const conditions: string[] = ['b.tenantId = ?'];
  const params: Array<string | number> = [tenantId];

  if (search) {
    const like = `%${search}%`;
    conditions.push(
      '(LOWER(b.invoiceNo) LIKE ? OR LOWER(b.customerName) LIKE ? OR LOWER(b.customerPhone) LIKE ? OR LOWER(COALESCE(b.customerNik, \'\')) LIKE ? OR LOWER(b.itemType) LIKE ? OR LOWER(b.kadar) LIKE ?)'
    );
    params.push(like, like, like, like, like, like);
  }

  if (method && method !== 'all') {
    conditions.push('b.paymentMethod = ?');
    params.push(method);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (
    db.prepare(`SELECT COUNT(*) as cnt FROM buybacks b ${whereSql}`).get(...params) as { cnt: number }
  ).cnt;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  // Omit heavy base64 columns (fotoKtp, fotoEmas, ttdNasabah, ttdPetugas, itemsJson) on list load
  const rows = db
    .prepare(
      `SELECT b.id, b.invoiceNo, b.date, b.timeStr, b.branchName, b.cashierName,
              b.customerId, c.memberCode AS customerMemberCode, b.customerName, b.customerPhone, b.customerNik, b.customerNpwp, b.customerAddress,
              b.sourceNote, b.itemType, b.kadar, b.beratKotor, b.potonganBatu, b.beratBersih,
              b.hargaPerGram, b.biayaLebur, b.kondisi, b.totalKotor, b.potonganBiaya, b.pph22,
              b.totalBayar, b.paymentMethod, b.bankName, b.accountNo, b.accountHolder,
              b.catatan, b.isAgreedLegal, COALESCE(b.status, 'completed') AS status, b.voidReason, b.voidedAt
       FROM buybacks b
       LEFT JOIN customers c ON c.id = b.customerId
       ${whereSql} ORDER BY ${orderBySql} LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as Array<Parameters<typeof mapBuybackRow>[0]>;

  const agg = db
    .prepare(
      "SELECT COALESCE(SUM(totalBayar), 0) as totalDana, COALESCE(SUM(beratBersih), 0) as totalBerat, COUNT(*) as totalCount FROM buybacks WHERE tenantId = ? AND COALESCE(status, 'completed') != 'void'"
    )
    .get(tenantId) as { totalDana: number; totalBerat: number; totalCount: number };

  return {
    items: rows.map(mapBuybackRow),
    total,
    page: safePage,
    pageSize,
    totalPages,
    stats: {
      totalDanaDicairkan: agg.totalDana,
      totalBeratDiterima: agg.totalBerat,
      totalTransaksi: agg.totalCount,
      avgPerTransaksi: agg.totalCount > 0 ? Math.round(agg.totalDana / agg.totalCount) : 0,
    },
  };
}

export function getBuybackById(id: string, tenantId?: string): BuybackItem | null {
  const query = `SELECT b.*, c.memberCode AS customerMemberCode
                 FROM buybacks b
                 LEFT JOIN customers c ON c.id = b.customerId
                 WHERE b.id = ?${tenantId ? ' AND b.tenantId = ?' : ''}`;
  const row = (
    tenantId ? db.prepare(query).get(id, tenantId) : db.prepare(query).get(id)
  ) as Parameters<typeof mapBuybackRow>[0] | undefined;
  return row ? mapBuybackRow(row) : null;
}

export function queryCustomers(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): CustomersPageResponse {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize ?? 10)));
  const search = (opts.search ?? '').trim().toLowerCase();
  const type = (opts.type ?? 'semua').trim();
  const sortDir = normalizeSortDir(opts.sortDir);

  let orderBySql = `c.rowid ${sortDir}`;
  switch (opts.sortBy) {
    case 'computedSpent':
      orderBySql = `computedSpent ${sortDir}, c.rowid DESC`;
      break;
    case 'computedTx':
      orderBySql = `computedTx ${sortDir}, c.rowid DESC`;
      break;
    case 'name':
      orderBySql = `LOWER(c.name) ${sortDir}, c.rowid DESC`;
      break;
    case 'preferredKadar':
      orderBySql = `LOWER(COALESCE(c.preferredKadar, '')) ${sortDir}, c.rowid DESC`;
      break;
    case 'newest':
    default:
      orderBySql = `c.rowid ${sortDir}`;
      break;
  }

  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    const like = `%${search}%`;
    conditions.push(
      '(LOWER(c.name) LIKE ? OR LOWER(c.phone) LIKE ? OR LOWER(c.memberCode) LIKE ? OR LOWER(COALESCE(c.nik, \'\')) LIKE ? OR LOWER(COALESCE(c.npwp, \'\')) LIKE ? OR LOWER(COALESCE(c.address, \'\')) LIKE ?)'
    );
    params.push(like, like, like, like, like, like);
  }

  if (type && type !== 'semua') {
    const mappedType = type === 'Mitra' ? 'Mitra / Toko' : type;
    conditions.push('c.type = ?');
    params.push(mappedType);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (
    db.prepare(`SELECT COUNT(*) as cnt FROM customers c ${whereSql}`).get(...params) as { cnt: number }
  ).cnt;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const rows = db
    .prepare(
      `SELECT c.*,
              (COALESCE(c.totalSpent, 0) + COALESCE((
                SELECT SUM(t.grandTotal) FROM transactions t
                WHERE COALESCE(t.status, 'completed') != 'void'
                  AND (t.customerId = c.id OR (t.customerId IS NULL AND LOWER(t.customerName) = LOWER(c.name)))
              ), 0)) AS computedSpent,
              (COALESCE(c.totalTransactions, 0) + COALESCE((
                SELECT COUNT(*) FROM transactions t
                WHERE COALESCE(t.status, 'completed') != 'void'
                  AND (t.customerId = c.id OR (t.customerId IS NULL AND LOWER(t.customerName) = LOWER(c.name)))
              ), 0) + COALESCE((
                SELECT COUNT(*) FROM buybacks b
                WHERE COALESCE(b.status, 'completed') != 'void'
                  AND (b.customerId = c.id OR (b.customerId IS NULL AND LOWER(b.customerName) = LOWER(c.name)))
              ), 0)) AS computedTx,
              COALESCE((
                SELECT COUNT(*) FROM buybacks b
                WHERE COALESCE(b.status, 'completed') != 'void'
                  AND (b.customerId = c.id OR (b.customerId IS NULL AND LOWER(b.customerName) = LOWER(c.name)))
              ), 0) AS buybackCount
       FROM customers c
       ${whereSql}
       ORDER BY ${orderBySql}
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as Array<{
    id: string;
    memberCode: string;
    name: string;
    phone: string;
    nik: string | null;
    npwp: string | null;
    type: 'Reguler' | 'VIP' | 'Mitra / Toko';
    address: string | null;
    preferredKadar: string | null;
    goldColor: string | null;
    ringSize: string | null;
    braceletSize: string | null;
    birthDate: string | null;
    notes: string | null;
    createdAt: string;
    totalSpent: number;
    totalTransactions: number;
    computedSpent: number;
    computedTx: number;
    buybackCount: number;
  }>;

  const items: CustomerWithStats[] = rows.map(r => ({
    id: r.id,
    memberCode: r.memberCode,
    name: r.name,
    phone: r.phone,
    nik: r.nik ?? undefined,
    npwp: r.npwp ?? undefined,
    type: r.type,
    address: r.address ?? undefined,
    preferredKadar: r.preferredKadar ?? undefined,
    goldColor: r.goldColor ?? undefined,
    ringSize: r.ringSize ?? undefined,
    braceletSize: r.braceletSize ?? undefined,
    birthDate: r.birthDate ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.createdAt,
    totalSpent: r.totalSpent,
    totalTransactions: r.totalTransactions,
    computedSpent: r.computedSpent,
    computedTx: r.computedTx,
    buybackCount: r.buybackCount,
  }));

  // Global KPI totals in SQL
  const custSummary = db
    .prepare(
      `SELECT COUNT(*) as totalPelanggan,
              SUM(CASE WHEN type = 'VIP' THEN 1 ELSE 0 END) as totalVip,
              COALESCE(SUM(totalSpent), 0) as baseSpent
       FROM customers`
    )
    .get() as { totalPelanggan: number; totalVip: number | null; baseSpent: number };

  const extraTxRow = db
    .prepare(
      `SELECT COALESCE(SUM(t.grandTotal), 0) as extraSpent
       FROM transactions t
       WHERE COALESCE(t.status, 'completed') != 'void'
         AND EXISTS (
           SELECT 1 FROM customers c
           WHERE t.customerId = c.id OR (t.customerId IS NULL AND LOWER(t.customerName) = LOWER(c.name))
         )`
    )
    .get() as { extraSpent: number };

  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages,
    stats: {
      totalPelanggan: custSummary.totalPelanggan,
      totalVip: custSummary.totalVip ?? 0,
      totalAkumulasiBelanja: custSummary.baseSpent + extraTxRow.extraSpent,
    },
  };
}

export function queryPromos(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  discountRange?: 'all' | 'under_10' | '10_to_15' | 'over_15';
  minPurchaseFilter?: 'all' | 'no_min' | 'has_min';
  scopeFilter?: 'all' | 'selected_sku' | 'all_sku';
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  tenantId?: string;
}): PromosPageResponse {
  const tenantId = opts.tenantId ?? getActiveTenantId();
  const today = syncExpiredPromos(tenantId);
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize ?? 10)));
  const search = (opts.search ?? '').trim().toLowerCase();
  const status = (opts.status ?? 'all').trim();
  const discountRange = opts.discountRange ?? 'all';
  const minPurchaseFilter = opts.minPurchaseFilter ?? 'all';
  const scopeFilter = opts.scopeFilter ?? 'all';
  const sortDir = opts.sortDir === 'asc' ? 'ASC' : 'DESC';

  const sortMap: Record<string, string> = {
    newest: 'rowid',
    discountPercent: 'discountPercent',
    name: 'LOWER(name)',
    isActive: 'isActive',
    endDate: 'endDate',
  };
  const sortCol = sortMap[opts.sortBy ?? 'newest'] ?? 'rowid';

  const conditions: string[] = ['tenantId = ?'];
  const params: Array<string | number> = [tenantId];

  if (search) {
    const like = `%${search}%`;
    const cleanPercent = search.replace('%', '').trim();
    const orClauses = [
      'LOWER(name) LIKE ?',
      'LOWER(code) LIKE ?',
      "LOWER(COALESCE(label, '')) LIKE ?",
      "LOWER(COALESCE(description, '')) LIKE ?",
      'CAST(discountPercent AS TEXT) LIKE ?',
    ];
    const searchParams: Array<string | number> = [
      like,
      like,
      like,
      like,
      `%${cleanPercent || search}%`,
    ];

    if (search === 'aktif' || search === 'active') {
      orClauses.push('(isActive = 1 AND startDate <= ? AND endDate >= ?)');
      searchParams.push(today, today);
    } else if (search === 'terjadwal' || search === 'scheduled') {
      orClauses.push('(isActive = 1 AND startDate > ? AND endDate >= ?)');
      searchParams.push(today, today);
    } else if (search === 'berakhir' || search === 'expired') {
      orClauses.push('(endDate < ?)');
      searchParams.push(today);
    } else if (search === 'nonaktif' || search === 'inactive') {
      orClauses.push('(isActive = 0 AND endDate >= ?)');
      searchParams.push(today);
    }

    conditions.push(`(${orClauses.join(' OR ')})`);
    params.push(...searchParams);
  }

  if (status === 'active') {
    conditions.push('isActive = 1 AND startDate <= ? AND endDate >= ?');
    params.push(today, today);
  } else if (status === 'scheduled') {
    conditions.push('isActive = 1 AND startDate > ? AND endDate >= ?');
    params.push(today, today);
  } else if (status === 'expired') {
    conditions.push('endDate < ?');
    params.push(today);
  } else if (status === 'inactive') {
    conditions.push('isActive = 0 AND endDate >= ?');
    params.push(today);
  }

  if (discountRange === 'under_10') {
    conditions.push('discountPercent < 10');
  } else if (discountRange === '10_to_15') {
    conditions.push('discountPercent >= 10 AND discountPercent <= 15');
  } else if (discountRange === 'over_15') {
    conditions.push('discountPercent > 15');
  }

  if (minPurchaseFilter === 'no_min') {
    conditions.push('COALESCE(minPurchase, 0) <= 0');
  } else if (minPurchaseFilter === 'has_min') {
    conditions.push('COALESCE(minPurchase, 0) > 0');
  }

  if (scopeFilter === 'selected_sku') {
    conditions.push("COALESCE(TRIM(productIdsJson), '[]') != '[]' AND COALESCE(TRIM(productIdsJson), '') != ''");
  } else if (scopeFilter === 'all_sku') {
    conditions.push("(COALESCE(TRIM(productIdsJson), '[]') = '[]' OR COALESCE(TRIM(productIdsJson), '') = '')");
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (
    db.prepare(`SELECT COUNT(*) as cnt FROM promos ${whereSql}`).get(...params) as { cnt: number }
  ).cnt;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const rows = db
    .prepare(`SELECT * FROM promos ${whereSql} ORDER BY ${sortCol} ${sortDir}, rowid DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as PromoDbRow[];

  const allActive = getActivePromos(tenantId);
  const lifecycleAgg = db
    .prepare(
      `SELECT COUNT(*) as totalPromos,
              SUM(CASE WHEN isActive = 1 AND startDate > ? AND endDate >= ? THEN 1 ELSE 0 END) as scheduledCount,
              SUM(CASE WHEN endDate < ? THEN 1 ELSE 0 END) as expiredCount,
              SUM(CASE WHEN isActive = 0 AND endDate >= ? THEN 1 ELSE 0 END) as inactiveCount
       FROM promos WHERE tenantId = ?`
    )
    .get(today, today, today, today, tenantId) as {
    totalPromos: number;
    scheduledCount: number | null;
    expiredCount: number | null;
    inactiveCount: number | null;
  };
  const existingProductIds = new Set(
    (db.prepare('SELECT id FROM products WHERE tenantId = ?').all(tenantId) as Array<{ id: number }>).map(p => p.id)
  );
  const productSet = new Set<number>();
  let discountSum = 0;
  for (const p of allActive) {
    discountSum += p.discountPercent;
    for (const pid of p.productIds) {
      if (existingProductIds.has(pid)) {
        productSet.add(pid);
      }
    }
  }

  return {
    items: rows.map(mapPromoRow),
    total,
    page: safePage,
    pageSize,
    totalPages,
    stats: {
      totalPromos: lifecycleAgg.totalPromos ?? 0,
      activeCount: allActive.length,
      scheduledCount: lifecycleAgg.scheduledCount ?? 0,
      expiredCount: lifecycleAgg.expiredCount ?? 0,
      inactiveCount: lifecycleAgg.inactiveCount ?? 0,
      totalPromoProducts: productSet.size,
      avgDiscount: allActive.length > 0 ? Math.round(discountSum / allActive.length) : 0,
    },
  };
}

export function getDashboardSummary(period: 'HARI' | 'BULAN', tenantId: string = getActiveTenantId()): DashboardSummaryResponse {
  const settings = getStoreSettings(tenantId);

  const txAgg = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN grandTotal ELSE 0 END), 0) as totalOmzet,
              COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN subtotal ELSE 0 END), 0) as totalSubtotal,
              COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN COALESCE(discountAmount, 0) ELSE 0 END), 0) as totalDiscount,
              COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN tax ELSE 0 END), 0) as totalTax,
              COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN totalQty ELSE 0 END), 0) as totalProduk,
              COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' AND paymentMethod = 'cash' THEN grandTotal ELSE 0 END), 0) as cashTotal,
              SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN 1 ELSE 0 END) as countTransaksi,
              SUM(CASE WHEN COALESCE(status, 'completed') = 'void' THEN 1 ELSE 0 END) as voidCount
       FROM transactions WHERE tenantId = ?`
    )
    .get(tenantId) as {
    totalOmzet: number;
    totalSubtotal: number;
    totalDiscount: number;
    totalTax: number;
    totalProduk: number;
    cashTotal: number;
    countTransaksi: number | null;
    voidCount: number | null;
  };

  const profitAgg = db
    .prepare(
      `SELECT COALESCE(SUM(
                CASE WHEN COALESCE(p.hpp, 0) > 0
                  THEN (ti.harga - p.hpp) * ti.qty
                  ELSE ROUND(ti.subtotal * 0.25)
                END
              ), 0) as grossProfit
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transactionId
       LEFT JOIN products p ON p.id = ti.productId
       WHERE t.tenantId = ? AND COALESCE(t.status, 'completed') != 'void'`
    )
    .get(tenantId) as { grossProfit: number };

  const invAgg = db
    .prepare(
      `SELECT SUM(CASE WHEN COALESCE(status, 'Aktif') = 'Aktif' THEN 1 ELSE 0 END) as activeSkuCount,
              SUM(CASE WHEN stok <= 5 THEN 1 ELSE 0 END) as lowStockCount
       FROM products WHERE tenantId = ?`
    )
    .get(tenantId) as { activeSkuCount: number | null; lowStockCount: number | null };

  const totalPenjualan = txAgg.totalOmzet;
  const penjualanKotor = txAgg.totalSubtotal > 0 ? txAgg.totalSubtotal : txAgg.totalOmzet;
  const labaKotor = Math.max(0, Math.round(profitAgg.grossProfit - (txAgg.totalDiscount ?? 0)));
  const marginPercent = penjualanKotor > 0 ? Number(((labaKotor / penjualanKotor) * 100).toFixed(1)) : 0;
  const penerimaan = txAgg.totalOmzet;
  const countTransaksi = txAgg.countTransaksi ?? 0;
  const voidCount = txAgg.voidCount ?? 0;
  const avgPerTransaksi = countTransaksi > 0 ? Math.round(totalPenjualan / countTransaksi) : 0;
  const cashPercent = totalPenjualan > 0 ? Math.round((txAgg.cashTotal / totalPenjualan) * 100) : 0;
  const transferPercent = totalPenjualan > 0 ? Math.max(0, 100 - cashPercent) : 0;

  const dayLabels = [
    '00:00', '02:00', '04:00', '06:00', '08:00', '10:00',
    '12:00', '14:00', '16:00', '18:00', '20:00', '22:00',
  ];
  const monthLabels = ['Tgl 1', 'Tgl 5', 'Tgl 10', 'Tgl 15', 'Tgl 20', 'Tgl 25', 'Tgl 30'];
  const labels = period === 'HARI' ? dayLabels : monthLabels;
  const salesArr = Array<number>(labels.length).fill(0);
  const trxArr = Array<number>(labels.length).fill(0);

  const txTimes = db
    .prepare("SELECT dateTime, timeStr, grandTotal FROM transactions WHERE tenantId = ? AND COALESCE(status, 'completed') != 'void'")
    .all(tenantId) as Array<{ dateTime: string; timeStr: string; grandTotal: number }>;

  if (period === 'HARI') {
    for (const tx of txTimes) {
      let hour = 11;
      if (tx.dateTime) {
        const d = new Date(tx.dateTime);
        if (!isNaN(d.getTime())) hour = d.getHours();
      } else if (tx.timeStr) {
        const h = parseInt(tx.timeStr.split(':')[0], 10);
        if (!isNaN(h)) hour = h;
      }
      const slot = Math.min(11, Math.max(0, Math.floor(hour / 2)));
      salesArr[slot] += tx.grandTotal;
      trxArr[slot] += 1;
    }

    const totalRec = salesArr.reduce((a, b) => a + b, 0);
    if (totalRec === 0 && totalPenjualan > 0) {
      salesArr[5] = Math.round(totalPenjualan * 0.4);
      salesArr[6] = Math.round(totalPenjualan * 0.6);
      trxArr[5] = 1;
      trxArr[6] = Math.max(1, countTransaksi - 1);
    }
  } else {
    for (const tx of txTimes) {
      let day = 15;
      if (tx.dateTime) {
        const d = new Date(tx.dateTime);
        if (!isNaN(d.getTime())) day = d.getDate();
      }
      const slot = Math.min(6, Math.max(0, Math.floor((day - 1) / 5)));
      salesArr[slot] += tx.grandTotal;
      trxArr[slot] += 1;
    }

    const totalRec = salesArr.reduce((a, b) => a + b, 0);
    if (totalRec === 0 && totalPenjualan > 0) {
      salesArr[2] = totalPenjualan;
      trxArr[2] = countTransaksi || 1;
    }
  }

  return {
    period,
    displayTotalPenjualan: totalPenjualan,
    displayPenjualanKotor: penjualanKotor,
    displayLabaKotor: labaKotor,
    displayPenerimaan: penerimaan,
    displayTransaksi: countTransaksi,
    displayProduk: txAgg.totalProduk,
    totalTax: txAgg.totalTax,
    enablePpn: settings.enablePpn,
    ppnPercent: settings.ppnPercent,
    marginPercent,
    avgPerTransaksi,
    cashPercent,
    transferPercent,
    voidCount,
    activeSkuCount: invAgg.activeSkuCount ?? 0,
    lowStockCount: invAgg.lowStockCount ?? 0,
    activeLabels: labels,
    salesData: salesArr,
    trxData: trxArr,
  };
}

// ============================================================
// AUTHENTICATION, SESSIONS & USER MANAGEMENT (RBAC)
// ============================================================
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const keyBuf = Buffer.from(keyHex, 'hex');
    const derived = crypto.scryptSync(password, salt, 64);
    if (keyBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuf, derived);
  } catch {
    return false;
  }
}

interface UserDbRow {
  id: string;
  username: string;
  email: string;
  fullName: string;
  passwordHash: string;
  role: UserRole;
  shiftLabel: string;
  allowedTenantIdsJson: string;
  defaultTenantId: string | null;
  isActive: number;
  themePreference?: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

function mapUserRow(row: UserDbRow): UserAccount {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    shiftLabel: row.shiftLabel,
    allowedTenantIds: safeJsonParse<string[]>(row.allowedTenantIdsJson, []),
    defaultTenantId: row.defaultTenantId ?? undefined,
    isActive: Boolean(row.isActive),
    themePreference: (row.themePreference as any) || 'system',
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt ?? undefined,
  };
}

export function seedUsersIfNeeded(): void {
  const alreadySeeded = db.prepare('SELECT value FROM settings WHERE key = ?').get('seeded_users_v1') as
    | { value: string }
    | undefined;
  if (alreadySeeded?.value === '1') {
    return;
  }

  const now = new Date().toISOString();
  const starterUsers = [
    {
      id: 'USR-001',
      username: 'owner',
      email: 'owner@kasirpos.id',
      fullName: 'H. Ahmad Fauzi',
      passwordHash: hashPassword('owner123'),
      role: 'owner' as UserRole,
      shiftLabel: 'Full Day (Owner)',
      allowedTenantIdsJson: JSON.stringify([]),
      defaultTenantId: 'tenant-tms-001',
      isActive: 1,
      createdAt: now,
    },
    {
      id: 'USR-002',
      username: 'kepala.jkt',
      email: 'kepala.jkt@kasirpos.id',
      fullName: 'Dewi Lestari',
      passwordHash: hashPassword('cabang123'),
      role: 'branch_manager' as UserRole,
      shiftLabel: 'Shift 1 (08:00 - 16:00)',
      allowedTenantIdsJson: JSON.stringify(['tenant-tms-001', 'tenant-tmj-002']),
      defaultTenantId: 'tenant-tms-001',
      isActive: 1,
      createdAt: now,
    },
    {
      id: 'USR-003',
      username: 'kasir.jkt',
      email: 'kasir.jkt@kasirpos.id',
      fullName: 'Andi Pratama',
      passwordHash: hashPassword('kasir123'),
      role: 'cashier' as UserRole,
      shiftLabel: 'Shift 1 (08:00 - 16:00)',
      allowedTenantIdsJson: JSON.stringify(['tenant-tms-001']),
      defaultTenantId: 'tenant-tms-001',
      isActive: 1,
      createdAt: now,
    },
    {
      id: 'USR-004',
      username: 'kasir.bdg',
      email: 'kasir.bdg@kasirpos.id',
      fullName: 'Rina Kusuma',
      passwordHash: hashPassword('kasir123'),
      role: 'cashier' as UserRole,
      shiftLabel: 'Shift 2 (13:00 - 21:00)',
      allowedTenantIdsJson: JSON.stringify(['tenant-tmj-002']),
      defaultTenantId: 'tenant-tmj-002',
      isActive: 1,
      createdAt: now,
    },
  ];

  const seedTx = db.transaction(() => {
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (
        id, username, email, fullName, passwordHash, role, shiftLabel, allowedTenantIdsJson, defaultTenantId, isActive, createdAt
      ) VALUES (
        @id, @username, @email, @fullName, @passwordHash, @role, @shiftLabel, @allowedTenantIdsJson, @defaultTenantId, @isActive, @createdAt
      )
    `);
    for (const u of starterUsers) {
      insertUser.run(u);
    }
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_users_v1', '1');
  });

  seedTx();
}

export function getAccessibleTenantsForUser(user: UserAccount): Tenant[] {
  const all = getAllTenants();
  if (user.role === 'owner') {
    return all;
  }
  const allowedSet = new Set(user.allowedTenantIds);
  return all.filter(t => allowedSet.has(t.id));
}

export function isTenantAllowedForUser(user: UserAccount, tenantId: string): boolean {
  const tenantExists = db.prepare('SELECT 1 FROM tenants WHERE id = ?').get(tenantId);
  if (!tenantExists) return false;
  if (user.role === 'owner') return true;
  return user.allowedTenantIds.includes(tenantId);
}

export function resolveActiveTenantForUser(user: UserAccount, requestedTenantId?: string): string {
  const accessible = getAccessibleTenantsForUser(user);
  if (requestedTenantId && accessible.some(t => t.id === requestedTenantId)) {
    return requestedTenantId;
  }
  if (user.defaultTenantId && accessible.some(t => t.id === user.defaultTenantId)) {
    return user.defaultTenantId;
  }
  return accessible[0]?.id ?? getActiveTenantId();
}

export function authenticateUser(identifier: string, password: string): UserAccount | null {
  const cleanId = identifier.trim();
  if (!cleanId || !password) return null;

  const row = db
    .prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1')
    .get(cleanId, cleanId) as UserDbRow | undefined;

  if (!row || row.isActive !== 1) return null;
  if (!verifyPassword(password, row.passwordHash)) return null;

  const nowIso = new Date().toISOString();
  db.prepare('UPDATE users SET lastLoginAt = ? WHERE id = ?').run(nowIso, row.id);
  return mapUserRow({ ...row, lastLoginAt: nowIso });
}

export function createSession(user: UserAccount): { token: string; activeTenantId: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const activeTenantId = resolveActiveTenantForUser(user);
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  db.prepare('DELETE FROM sessions WHERE expiresAt <= ?').run(now.toISOString());
  db.prepare(
    'INSERT INTO sessions (token, userId, activeTenantId, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)'
  ).run(token, user.id, activeTenantId, now.toISOString(), expires.toISOString());

  return { token, activeTenantId };
}

export function getSessionContext(token: string): { token: string; user: UserAccount; activeTenantId: string } | null {
  const cleanToken = token.trim();
  if (!cleanToken) return null;

  const sessionRow = db
    .prepare('SELECT token, userId, activeTenantId, expiresAt FROM sessions WHERE token = ?')
    .get(cleanToken) as { token: string; userId: string; activeTenantId: string; expiresAt: string } | undefined;

  if (!sessionRow) return null;
  if (sessionRow.expiresAt <= new Date().toISOString()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(cleanToken);
    return null;
  }

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(sessionRow.userId) as UserDbRow | undefined;
  if (!userRow || userRow.isActive !== 1) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(cleanToken);
    return null;
  }

  const user = mapUserRow(userRow);
  const resolvedTenantId = resolveActiveTenantForUser(user, sessionRow.activeTenantId);
  if (resolvedTenantId !== sessionRow.activeTenantId) {
    db.prepare('UPDATE sessions SET activeTenantId = ? WHERE token = ?').run(resolvedTenantId, cleanToken);
  }

  return {
    token: cleanToken,
    user,
    activeTenantId: resolvedTenantId,
  };
}

export function updateSessionTenant(token: string, tenantId: string): void {
  db.prepare('UPDATE sessions SET activeTenantId = ? WHERE token = ?').run(tenantId, token);
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function getUserById(id: string): UserAccount | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserDbRow | undefined;
  return row ? mapUserRow(row) : null;
}

export function queryUsers(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  status?: 'all' | 'active' | 'inactive';
  tenantId?: string;
  shift?: 'all' | 'shift_1' | 'shift_2' | 'full_day';
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): UsersPageResponse {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize ?? 10)));
  const search = (opts.search ?? '').trim().toLowerCase();
  const role = (opts.role ?? 'all').trim();
  const status = opts.status ?? 'all';
  const tenantId = (opts.tenantId ?? 'all').trim();
  const shift = opts.shift ?? 'all';
  const sortDir = normalizeSortDir(opts.sortDir);

  let orderBySql = `rowid ${sortDir}`;
  switch (opts.sortBy) {
    case 'fullName':
      orderBySql = `LOWER(fullName) ${sortDir}, rowid DESC`;
      break;
    case 'username':
      orderBySql = `LOWER(username) ${sortDir}, rowid DESC`;
      break;
    case 'role':
      orderBySql = `role ${sortDir}, LOWER(fullName) ASC`;
      break;
    case 'isActive':
      orderBySql = `isActive ${sortDir}, rowid DESC`;
      break;
    case 'newest':
    default:
      orderBySql = `rowid ${sortDir}`;
      break;
  }

  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    const like = `%${search}%`;
    const orClauses = [
      'LOWER(fullName) LIKE ?',
      'LOWER(username) LIKE ?',
      'LOWER(email) LIKE ?',
      'LOWER(shiftLabel) LIKE ?',
      'LOWER(role) LIKE ?',
      "EXISTS (SELECT 1 FROM tenants tn WHERE (LOWER(tn.code) LIKE ? OR LOWER(tn.name) LIKE ? OR LOWER(tn.city) LIKE ?) AND (users.role = 'owner' OR EXISTS (SELECT 1 FROM json_each(users.allowedTenantIdsJson) WHERE value = tn.id)))",
    ];
    const searchParams: Array<string | number> = [like, like, like, like, like, like, like, like];

    if ('kepala cabang'.includes(search) || search === 'cabang' || search === 'manager') {
      orClauses.push("role = 'branch_manager'");
    }
    if ('kasir'.includes(search) || 'cashier'.includes(search)) {
      orClauses.push("role = 'cashier'");
    }
    if (search === 'aktif' || search === 'active') {
      orClauses.push('isActive = 1');
    } else if (search === 'nonaktif' || search === 'inactive') {
      orClauses.push('isActive = 0');
    }

    conditions.push(`(${orClauses.join(' OR ')})`);
    params.push(...searchParams);
  }

  if (role && role !== 'all') {
    conditions.push('role = ?');
    params.push(role);
  }

  if (status === 'active') {
    conditions.push('isActive = 1');
  } else if (status === 'inactive') {
    conditions.push('isActive = 0');
  }

  if (tenantId && tenantId !== 'all') {
    conditions.push("(role = 'owner' OR EXISTS (SELECT 1 FROM json_each(allowedTenantIdsJson) WHERE value = ?))");
    params.push(tenantId);
  }

  if (shift === 'shift_1') {
    conditions.push("LOWER(shiftLabel) LIKE '%shift 1%'");
  } else if (shift === 'shift_2') {
    conditions.push("LOWER(shiftLabel) LIKE '%shift 2%'");
  } else if (shift === 'full_day') {
    conditions.push("LOWER(shiftLabel) LIKE '%full day%'");
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM users ${whereSql}`).get(...params) as { cnt: number }).cnt;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const rows = db
    .prepare(`SELECT * FROM users ${whereSql} ORDER BY ${orderBySql} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as UserDbRow[];

  const agg = db
    .prepare(
      `SELECT COUNT(*) as totalUsers,
              SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) as activeUsers,
              SUM(CASE WHEN role = 'owner' THEN 1 ELSE 0 END) as ownerCount,
              SUM(CASE WHEN role = 'branch_manager' THEN 1 ELSE 0 END) as managerCount,
              SUM(CASE WHEN role = 'cashier' THEN 1 ELSE 0 END) as cashierCount
       FROM users`
    )
    .get() as {
    totalUsers: number;
    activeUsers: number | null;
    ownerCount: number | null;
    managerCount: number | null;
    cashierCount: number | null;
  };

  return {
    items: rows.map(mapUserRow),
    total,
    page: safePage,
    pageSize,
    totalPages,
    stats: {
      totalUsers: agg.totalUsers,
      activeUsers: agg.activeUsers ?? 0,
      ownerCount: agg.ownerCount ?? 0,
      managerCount: agg.managerCount ?? 0,
      cashierCount: agg.cashierCount ?? 0,
    },
  };
}

export function createUserAccount(payload: UserCreatePayload): UserAccount {
  const username = (payload.username ?? '').trim().toLowerCase();
  const email = (payload.email ?? '').trim().toLowerCase();
  const fullName = (payload.fullName ?? '').trim();
  const password = payload.password ?? '';
  const role: UserRole = payload.role;
  const shiftLabel = (payload.shiftLabel ?? '').trim() || 'Shift 1 (08:00 - 16:00)';
  const allowedTenantIds = Array.from(new Set((payload.allowedTenantIds ?? []).filter(Boolean)));
  const isActive = payload.isActive !== false;

  if (!username || !/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error('Username wajib 3-32 karakter (huruf kecil, angka, titik, garis bawah, atau strip).');
  }
  if (!email || !email.includes('@')) {
    throw new Error('Alamat email pengguna tidak valid.');
  }
  if (!fullName) {
    throw new Error('Nama lengkap pengguna wajib diisi.');
  }
  if (password.length < 6) {
    throw new Error('Kata sandi minimal 6 karakter.');
  }
  if (!['owner', 'branch_manager', 'cashier'].includes(role)) {
    throw new Error('Role pengguna tidak valid.');
  }
  if (role !== 'owner' && allowedTenantIds.length === 0) {
    throw new Error('Pilih minimal 1 outlet yang boleh diakses oleh akun ini.');
  }

  const dupUsername = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username);
  if (dupUsername) {
    throw new Error(`Username "${username}" sudah digunakan.`);
  }
  const dupEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (dupEmail) {
    throw new Error(`Email "${email}" sudah digunakan.`);
  }

  const allTenantIds = new Set((db.prepare('SELECT id FROM tenants').all() as Array<{ id: string }>).map(t => t.id));
  const validAllowed = role === 'owner' ? [] : allowedTenantIds.filter(tid => allTenantIds.has(tid));
  if (role !== 'owner' && validAllowed.length === 0) {
    throw new Error('Outlet yang dipilih tidak ditemukan.');
  }

  const defaultTenantId =
    payload.defaultTenantId && (role === 'owner' ? allTenantIds.has(payload.defaultTenantId) : validAllowed.includes(payload.defaultTenantId))
      ? payload.defaultTenantId
      : validAllowed[0] ?? 'tenant-tms-001';

  const themePreference = payload.themePreference ?? 'system';
  const id = `USR-${Date.now().toString().slice(-6)}`;
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, username, email, fullName, passwordHash, role, shiftLabel, allowedTenantIdsJson, defaultTenantId, isActive, themePreference, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    username,
    email,
    fullName,
    hashPassword(password),
    role,
    shiftLabel,
    JSON.stringify(validAllowed),
    defaultTenantId,
    isActive ? 1 : 0,
    themePreference,
    createdAt
  );

  return getUserById(id)!;
}

export function updateUserAccount(id: string, payload: UserUpdatePayload, actorUserId: string): UserAccount {
  const existingRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserDbRow | undefined;
  if (!existingRow) {
    throw new Error('Akun pengguna tidak ditemukan.');
  }

  const nextEmail = payload.email !== undefined ? payload.email.trim().toLowerCase() : existingRow.email;
  const nextFullName = payload.fullName !== undefined ? payload.fullName.trim() : existingRow.fullName;
  const nextRole: UserRole = payload.role !== undefined ? payload.role : existingRow.role;
  const nextShift = payload.shiftLabel !== undefined ? payload.shiftLabel.trim() || existingRow.shiftLabel : existingRow.shiftLabel;
  const nextIsActive = payload.isActive !== undefined ? Boolean(payload.isActive) : Boolean(existingRow.isActive);
  const nextThemePreference = payload.themePreference !== undefined ? payload.themePreference : (existingRow.themePreference || 'system');

  if (!nextEmail || !nextEmail.includes('@')) {
    throw new Error('Alamat email pengguna tidak valid.');
  }
  if (!nextFullName) {
    throw new Error('Nama lengkap pengguna wajib diisi.');
  }
  if (!['owner', 'branch_manager', 'cashier'].includes(nextRole)) {
    throw new Error('Role pengguna tidak valid.');
  }

  if (id === actorUserId) {
    if (!nextIsActive) {
      throw new Error('Anda tidak dapat menonaktifkan akun Anda sendiri yang sedang login.');
    }
    if (existingRow.role === 'owner' && nextRole !== 'owner') {
      throw new Error('Anda tidak dapat menurunkan role Owner dari akun Anda sendiri.');
    }
  }

  if (existingRow.role === 'owner' && (nextRole !== 'owner' || !nextIsActive)) {
    const activeOwnersCount = (
      db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'owner' AND isActive = 1 AND id != ?").get(id) as {
        cnt: number;
      }
    ).cnt;
    if (activeOwnersCount === 0) {
      throw new Error('Minimal harus ada 1 akun Owner yang aktif.');
    }
  }

  const dupEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?').get(nextEmail, id);
  if (dupEmail) {
    throw new Error(`Email "${nextEmail}" sudah digunakan oleh akun lain.`);
  }

  const allTenantIds = new Set((db.prepare('SELECT id FROM tenants').all() as Array<{ id: string }>).map(t => t.id));
  const rawAllowed =
    payload.allowedTenantIds !== undefined
      ? Array.from(new Set(payload.allowedTenantIds.filter(Boolean)))
      : safeJsonParse<string[]>(existingRow.allowedTenantIdsJson, []);
  const validAllowed = nextRole === 'owner' ? [] : rawAllowed.filter(tid => allTenantIds.has(tid));

  if (nextRole !== 'owner' && validAllowed.length === 0) {
    throw new Error('Pilih minimal 1 outlet yang boleh diakses oleh akun ini.');
  }

  const candidateDefault = payload.defaultTenantId !== undefined ? payload.defaultTenantId : existingRow.defaultTenantId;
  const nextDefaultTenantId =
    candidateDefault && (nextRole === 'owner' ? allTenantIds.has(candidateDefault) : validAllowed.includes(candidateDefault))
      ? candidateDefault
      : validAllowed[0] ?? 'tenant-tms-001';

  let nextPasswordHash = existingRow.passwordHash;
  if (payload.password !== undefined && payload.password.trim().length > 0) {
    if (payload.password.trim().length < 6) {
      throw new Error('Kata sandi baru minimal 6 karakter.');
    }
    nextPasswordHash = hashPassword(payload.password.trim());
  }

  db.prepare(
    `UPDATE users
     SET email = ?, fullName = ?, passwordHash = ?, role = ?, shiftLabel = ?, allowedTenantIdsJson = ?, defaultTenantId = ?, isActive = ?, themePreference = ?
     WHERE id = ?`
  ).run(
    nextEmail,
    nextFullName,
    nextPasswordHash,
    nextRole,
    nextShift,
    JSON.stringify(validAllowed),
    nextDefaultTenantId,
    nextIsActive ? 1 : 0,
    nextThemePreference,
    id
  );

  if (!nextIsActive) {
    db.prepare('DELETE FROM sessions WHERE userId = ?').run(id);
  }

  return getUserById(id)!;
}

export function deleteUserAccount(id: string, actorUserId: string): void {
  if (id === actorUserId) {
    throw new Error('Anda tidak dapat menghapus akun yang sedang digunakan untuk login.');
  }
  const existingRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserDbRow | undefined;
  if (!existingRow) {
    throw new Error('Akun pengguna tidak ditemukan.');
  }
  if (existingRow.role === 'owner' && existingRow.isActive === 1) {
    const activeOwnersCount = (
      db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'owner' AND isActive = 1 AND id != ?").get(id) as {
        cnt: number;
      }
    ).cnt;
    if (activeOwnersCount === 0) {
      throw new Error('Minimal harus ada 1 akun Owner yang aktif.');
    }
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

// ============================================================
// STORE SETTINGS & SHIFT CLOSING (TAHAP 3)
// ============================================================
export const DEFAULT_RECEIPT_TERMS_TEXT = [
  'Simpan struk ini sebagai bukti pembayaran yang sah dari {TOKO}.',
  'Penukaran produk dalam kemasan tersegel berlaku maksimal 3 hari.',
].join('\n');

const LEGACY_JEWELRY_TERMS_TEXT = [
  'Wajib membawa surat ini saat jual kembali atau tukar tambah barang.',
  'Barang dari {TOKO} diterima kembali sesuai ketentuan harga & potongan toko.',
  'Jika rusak/cacat atau mata hilang dikenakan potongan tambahan sesuai kondisi.',
  'Pesanan khusus (custom order), batu, dan ongkos lebur tidak dapat dikembalikan.',
].join('\n');

function migrateGeneralPosBrandingIfNeeded(): void {
  const alreadyMigrated = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('migrated_general_pos_branding_v1') as { value: string } | undefined;
  if (alreadyMigrated?.value === '1') {
    return;
  }

  const migrateTx = db.transaction(() => {
    db.prepare(
      `UPDATE tenants
       SET name = 'Toko Maju Bersama',
           email = 'admin@tokomaju.id',
           slug = 'majubersama.kasirpos.id',
           logoInitial = 'TM'
       WHERE id = 'tenant-tms-001'
         AND (name = 'Toko Mas Sejahtera' OR slug = 'sejahtera.epaper.id')`
    ).run();

    db.prepare(
      `UPDATE tenants
       SET name = 'Sentosa Retail Mart',
           email = 'kontak@sentosamart.id',
           slug = 'sentosamart.kasirpos.id',
           logoInitial = 'SR'
       WHERE id = 'tenant-tmj-002'
         AND (name = 'Toko Mas Mulia Jaya' OR slug = 'muliajaya.epaper.id')`
    ).run();

    db.prepare(
      `UPDATE tenants
       SET name = 'CV Kencana Niaga',
           email = 'management@kencananiaga.co.id',
           slug = 'kencananiaga.kasirpos.id',
           logoInitial = 'KN'
       WHERE id = 'tenant-lke-003'
         AND (name = 'CV Logam Kencana Emas' OR slug = 'logamkencana.epaper.id')`
    ).run();

    db.prepare(
      `UPDATE store_settings
       SET receiptTagline = 'RETAIL & POS SYSTEM'
       WHERE receiptTagline = 'GOLD & JEWELLERY'`
    ).run();

    db.prepare(
      `UPDATE store_settings
       SET receiptSaleTitle = 'FAKTUR PENJUALAN'
       WHERE receiptSaleTitle = 'FAKTUR PENJUALAN EMAS'`
    ).run();

    db.prepare(
      `UPDATE store_settings
       SET receiptCashierSignLabel = 'Kasir / Staff'
       WHERE receiptCashierSignLabel = 'Kasir / Gold Advisor'`
    ).run();

    db.prepare(
      `UPDATE store_settings
       SET receiptFooterNote = 'Simpan struk ini sebagai bukti transaksi resmi. Barang yang sudah dibeli mengikuti ketentuan toko.'
       WHERE receiptFooterNote = 'Barang yang sudah dibeli dapat dijual kembali (buyback) dengan menyertakan surat nota resmi ini.'`
    ).run();

    db.prepare(
      `UPDATE store_settings
       SET receiptTermsText = ?
       WHERE receiptTermsText = ? OR receiptTermsText = ''`
    ).run(DEFAULT_RECEIPT_TERMS_TEXT, LEGACY_JEWELRY_TERMS_TEXT);

    db.prepare(
      `UPDATE users
       SET email = REPLACE(email, '@tokomas.id', '@kasirpos.id')
       WHERE email LIKE '%@tokomas.id'`
    ).run();

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'migrated_general_pos_branding_v1',
      '1'
    );
  });

  migrateTx();
}

function migrateStoreNamesMkiIfNeeded(): void {
  const alreadyMigrated = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('migrated_store_names_mki_v1') as { value: string } | undefined;
  if (alreadyMigrated?.value === '1') {
    return;
  }

  const migrateTx = db.transaction(() => {
    db.prepare(
      `UPDATE tenants
       SET name = 'MKI (Maklon Kosmetik Indonesia)',
           code = 'MKI-01',
           email = 'admin@mki-kosmetik.id',
           slug = 'mki.kasirpos.id',
           logoInitial = 'MK',
           databaseSchema = 'tenant_db_mki_01'
       WHERE id = 'tenant-tms-001'`
    ).run();

    db.prepare(
      `UPDATE tenants
       SET name = 'AMULIA',
           code = 'AML-02',
           email = 'kontak@amulia.id',
           slug = 'amulia.kasirpos.id',
           logoInitial = 'AM',
           databaseSchema = 'tenant_db_amulia_02'
       WHERE id = 'tenant-tmj-002'`
    ).run();

    db.prepare(
      `UPDATE tenants
       SET name = 'Blimey',
           code = 'BLM-03',
           email = 'hello@blimey.id',
           slug = 'blimey.kasirpos.id',
           logoInitial = 'BL',
           databaseSchema = 'tenant_db_blimey_03'
       WHERE id = 'tenant-lke-003'`
    ).run();

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'migrated_store_names_mki_v1',
      '1'
    );
  });

  migrateTx();
}

function migrateGeneralRetailReceiptFormatV1(): void {
  const alreadyMigrated = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('migrated_general_retail_receipt_v1') as { value: string } | undefined;
  if (alreadyMigrated?.value === '1') {
    return;
  }

  const migrateTx = db.transaction(() => {
    db.prepare(
      `UPDATE store_settings
       SET receiptSaleTitle = CASE
             WHEN receiptSaleTitle IN ('FAKTUR PENJUALAN', 'FAKTUR PENJUALAN EMAS') THEN 'NOTA PENJUALAN'
             ELSE receiptSaleTitle
           END,
           receiptTheme = CASE
             WHEN receiptTheme = 'classic_gold' THEN 'midnight_navy'
             ELSE receiptTheme
           END,
           receiptLogoPreset = CASE
             WHEN receiptLogoPreset IN ('crown', 'diamond') THEN 'monogram'
             ELSE receiptLogoPreset
           END,
           receiptShowSignatures = 0,
           receiptCustomerSignLabel = CASE
             WHEN receiptCustomerSignLabel = 'Customer' THEN 'Pelanggan'
             ELSE receiptCustomerSignLabel
           END,
           receiptCashierSignLabel = CASE
             WHEN receiptCashierSignLabel IN ('Kasir / Staff', 'Kasir / Gold Advisor') THEN 'Kasir'
             ELSE receiptCashierSignLabel
           END,
           receiptTermsText = ?,
           receiptFooterNote = 'Terima kasih telah berbelanja! Simpan struk ini sebagai bukti pembayaran yang sah.'`
    ).run(DEFAULT_RECEIPT_TERMS_TEXT);

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'migrated_general_retail_receipt_v1',
      '1'
    );
  });

  migrateTx();
}

function migrateSimpleRetailReceiptV2(): void {
  const alreadyMigrated = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('migrated_simple_retail_receipt_v2') as { value: string } | undefined;
  if (alreadyMigrated?.value === '1') {
    return;
  }

  const migrateTx = db.transaction(() => {
    db.prepare(
      `UPDATE store_settings
       SET receiptTagline = CASE
             WHEN receiptTagline IN ('RETAIL & POS SYSTEM', 'TOKO EMAS & PERHIASAN') THEN ''
             ELSE receiptTagline
           END,
           receiptSaleTitle = CASE
             WHEN receiptSaleTitle IN ('NOTA PENJUALAN', 'FAKTUR PENJUALAN', 'FAKTUR PENJUALAN EMAS') THEN ''
             ELSE receiptSaleTitle
           END,
           receiptLogoPreset = CASE
             WHEN receiptLogoPreset IN ('monogram', 'crown', 'diamond') THEN 'none'
             ELSE receiptLogoPreset
           END,
           receiptShowWatermark = 0,
           receiptShowBarcode = 0,
           receiptShowQrCode = 0,
           receiptShowPhoto = 0,
           receiptShowItemSku = 0,
           receiptShowTerms = 0,
           receiptShowSignatures = 0,
           receiptTermsTitle = 'Catatan:',
           receiptTermsText = ?,
           receiptFooterNote = 'Terima kasih telah berbelanja di {TOKO}.'`
    ).run(DEFAULT_RECEIPT_TERMS_TEXT);

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'migrated_simple_retail_receipt_v2',
      '1'
    );
  });

  migrateTx();
}

function migrateReceiptHeaderLogoV3(): void {
  const alreadyMigrated = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('migrated_receipt_header_logo_v3') as { value: string } | undefined;
  if (alreadyMigrated?.value === '1') {
    return;
  }

  const migrateTx = db.transaction(() => {
    db.prepare(
      `UPDATE store_settings
       SET receiptLogoPreset = 'monogram'
       WHERE receiptLogoPreset = 'none'`
    ).run();

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'migrated_receipt_header_logo_v3',
      '1'
    );
  });

  migrateTx();
}

const STORE_SETTINGS_EXTRA_COLUMNS: Array<{ name: string; definition: string }> = [
  { name: 'appTheme', definition: "TEXT NOT NULL DEFAULT 'zinc_classic'" },
  { name: 'receiptSaleTitle', definition: "TEXT NOT NULL DEFAULT ''" },
  { name: 'receiptBuybackTitle', definition: "TEXT NOT NULL DEFAULT 'SURAT PEMBELIAN KEMBALI'" },
  { name: 'receiptHeaderExtra', definition: "TEXT NOT NULL DEFAULT ''" },
  { name: 'receiptTheme', definition: "TEXT NOT NULL DEFAULT 'midnight_navy'" },
  { name: 'receiptDefaultPaperSize', definition: "TEXT NOT NULL DEFAULT 'a5'" },
  { name: 'receiptLogoPreset', definition: "TEXT NOT NULL DEFAULT 'monogram'" },
  { name: 'receiptCustomLogoUrl', definition: "TEXT NOT NULL DEFAULT ''" },
  { name: 'receiptShowWatermark', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'receiptWatermarkOpacity', definition: 'INTEGER NOT NULL DEFAULT 6' },
  { name: 'receiptShowStoreAddress', definition: 'INTEGER NOT NULL DEFAULT 1' },
  { name: 'receiptShowBarcode', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'receiptShowQrCode', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'receiptShowPhoto', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'receiptShowItemSku', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'receiptShowTaxLine', definition: 'INTEGER NOT NULL DEFAULT 1' },
  { name: 'receiptShowCashierName', definition: 'INTEGER NOT NULL DEFAULT 1' },
  { name: 'receiptShowTerms', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'receiptTermsTitle', definition: "TEXT NOT NULL DEFAULT 'Catatan:'" },
  { name: 'receiptTermsText', definition: "TEXT NOT NULL DEFAULT ''" },
  { name: 'receiptShowSignatures', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { name: 'receiptSignatureGreeting', definition: "TEXT NOT NULL DEFAULT 'Hormat Kami,'" },
  { name: 'receiptCustomerSignLabel', definition: "TEXT NOT NULL DEFAULT 'Pelanggan'" },
  { name: 'receiptCashierSignLabel', definition: "TEXT NOT NULL DEFAULT 'Kasir'" },
];

(function ensureStoreSettingsColumns() {
  const existingCols = new Set(
    (db.prepare('PRAGMA table_info(store_settings)').all() as Array<{ name: string }>).map(c => c.name)
  );
  for (const col of STORE_SETTINGS_EXTRA_COLUMNS) {
    if (!existingCols.has(col.name)) {
      db.exec(`ALTER TABLE store_settings ADD COLUMN ${col.name} ${col.definition}`);
    }
  }
})();

interface StoreSettingsDbRow {
  tenantId: string;
  ppnPercent: number;
  enablePpn: number;
  appTheme?: string | null;
  goldPrice24kBuyback: number;
  goldPrice22kBuyback: number;
  goldPrice18kBuyback: number;
  goldPrice16kBuyback: number;
  receiptTagline: string;
  receiptFooterNote: string;
  receiptSaleTitle?: string | null;
  receiptBuybackTitle?: string | null;
  receiptHeaderExtra?: string | null;
  receiptTheme?: string | null;
  receiptDefaultPaperSize?: string | null;
  receiptLogoPreset?: string | null;
  receiptCustomLogoUrl?: string | null;
  receiptShowWatermark?: number | null;
  receiptWatermarkOpacity?: number | null;
  receiptShowStoreAddress?: number | null;
  receiptShowBarcode?: number | null;
  receiptShowQrCode?: number | null;
  receiptShowPhoto?: number | null;
  receiptShowItemSku?: number | null;
  receiptShowTaxLine?: number | null;
  receiptShowCashierName?: number | null;
  receiptShowTerms?: number | null;
  receiptTermsTitle?: string | null;
  receiptTermsText?: string | null;
  receiptShowSignatures?: number | null;
  receiptSignatureGreeting?: string | null;
  receiptCustomerSignLabel?: string | null;
  receiptCashierSignLabel?: string | null;
  autoPrintReceipt: number;
  requireCustomerOnSale: number;
  updatedAt: string;
  updatedBy: string | null;
}

const VALID_APP_THEMES: AppThemeId[] = [
  'zinc_classic',
  'ocean_slate',
  'emerald_mint',
  'rose_blossom',
  'indigo_night',
  'espresso_cream',
];

const VALID_RECEIPT_THEMES: ReceiptTheme[] = [
  'classic_gold',
  'royal_emerald',
  'midnight_navy',
  'rose_gold',
  'monochrome',
];

const VALID_RECEIPT_PAPER_SIZES: ReceiptPaperSize[] = ['a5', 'a6', '80mm'];
const VALID_RECEIPT_LOGO_PRESETS: ReceiptLogoPreset[] = [
  'monogram',
  'bag',
  'sparkles',
  'custom',
  'none',
  'crown',
  'diamond',
];

function normalizeAppTheme(val?: string | null): AppThemeId {
  return VALID_APP_THEMES.includes(val as AppThemeId) ? (val as AppThemeId) : 'zinc_classic';
}

function normalizeReceiptTheme(val?: string | null): ReceiptTheme {
  return VALID_RECEIPT_THEMES.includes(val as ReceiptTheme) ? (val as ReceiptTheme) : 'midnight_navy';
}

function normalizeReceiptPaperSize(val?: string | null): ReceiptPaperSize {
  return VALID_RECEIPT_PAPER_SIZES.includes(val as ReceiptPaperSize) ? (val as ReceiptPaperSize) : 'a5';
}

function normalizeReceiptLogoPreset(val?: string | null): ReceiptLogoPreset {
  return VALID_RECEIPT_LOGO_PRESETS.includes(val as ReceiptLogoPreset)
    ? (val as ReceiptLogoPreset)
    : 'monogram';
}

function mapStoreSettingsRow(row: StoreSettingsDbRow): StoreSettings {
  const rawWatermarkOpacity = Number(row.receiptWatermarkOpacity ?? 6);
  const clampedWatermarkOpacity = Number.isFinite(rawWatermarkOpacity)
    ? Math.max(2, Math.min(20, Math.round(rawWatermarkOpacity)))
    : 6;

  return {
    tenantId: row.tenantId,
    ppnPercent: Number(row.ppnPercent),
    enablePpn: Boolean(row.enablePpn),
    appTheme: normalizeAppTheme(row.appTheme),
    goldPrice24kBuyback: Number(row.goldPrice24kBuyback),
    goldPrice22kBuyback: Number(row.goldPrice22kBuyback),
    goldPrice18kBuyback: Number(row.goldPrice18kBuyback),
    goldPrice16kBuyback: Number(row.goldPrice16kBuyback),
    receiptTagline: row.receiptTagline ?? '',
    receiptFooterNote: row.receiptFooterNote ?? '',
    receiptSaleTitle: row.receiptSaleTitle ?? '',
    receiptBuybackTitle: row.receiptBuybackTitle ?? 'SURAT PEMBELIAN KEMBALI',
    receiptHeaderExtra: row.receiptHeaderExtra ?? '',
    receiptTheme: normalizeReceiptTheme(row.receiptTheme),
    receiptDefaultPaperSize: normalizeReceiptPaperSize(row.receiptDefaultPaperSize),
    receiptLogoPreset: normalizeReceiptLogoPreset(row.receiptLogoPreset),
    receiptCustomLogoUrl: row.receiptCustomLogoUrl ?? '',
    receiptShowWatermark: row.receiptShowWatermark === undefined || row.receiptShowWatermark === null ? false : Boolean(row.receiptShowWatermark),
    receiptWatermarkOpacity: clampedWatermarkOpacity,
    receiptShowStoreAddress: row.receiptShowStoreAddress === undefined || row.receiptShowStoreAddress === null ? true : Boolean(row.receiptShowStoreAddress),
    receiptShowBarcode: row.receiptShowBarcode === undefined || row.receiptShowBarcode === null ? false : Boolean(row.receiptShowBarcode),
    receiptShowQrCode: row.receiptShowQrCode === undefined || row.receiptShowQrCode === null ? false : Boolean(row.receiptShowQrCode),
    receiptShowPhoto: row.receiptShowPhoto === undefined || row.receiptShowPhoto === null ? false : Boolean(row.receiptShowPhoto),
    receiptShowItemSku: row.receiptShowItemSku === undefined || row.receiptShowItemSku === null ? false : Boolean(row.receiptShowItemSku),
    receiptShowTaxLine: row.receiptShowTaxLine === undefined || row.receiptShowTaxLine === null ? true : Boolean(row.receiptShowTaxLine),
    receiptShowCashierName: row.receiptShowCashierName === undefined || row.receiptShowCashierName === null ? true : Boolean(row.receiptShowCashierName),
    receiptShowTerms: row.receiptShowTerms === undefined || row.receiptShowTerms === null ? false : Boolean(row.receiptShowTerms),
    receiptTermsTitle: row.receiptTermsTitle ?? 'Catatan:',
    receiptTermsText:
      row.receiptTermsText && row.receiptTermsText.trim().length > 0
        ? row.receiptTermsText
        : DEFAULT_RECEIPT_TERMS_TEXT,
    receiptShowSignatures: row.receiptShowSignatures === undefined || row.receiptShowSignatures === null ? false : Boolean(row.receiptShowSignatures),
    receiptSignatureGreeting: row.receiptSignatureGreeting ?? 'Hormat Kami,',
    receiptCustomerSignLabel: row.receiptCustomerSignLabel ?? 'Pelanggan',
    receiptCashierSignLabel: row.receiptCashierSignLabel ?? 'Kasir',
    autoPrintReceipt: Boolean(row.autoPrintReceipt),
    requireCustomerOnSale: Boolean(row.requireCustomerOnSale),
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy ?? undefined,
  };
}

export function getStoreSettings(tenantId: string): StoreSettings {
  const existing = db
    .prepare('SELECT * FROM store_settings WHERE tenantId = ?')
    .get(tenantId) as StoreSettingsDbRow | undefined;
  if (existing) {
    return mapStoreSettingsRow(existing);
  }

  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO store_settings (
      tenantId, ppnPercent, enablePpn, appTheme,
      goldPrice24kBuyback, goldPrice22kBuyback, goldPrice18kBuyback, goldPrice16kBuyback,
      receiptTagline, receiptFooterNote, receiptTermsTitle, receiptTermsText,
      receiptSaleTitle, receiptTheme, receiptLogoPreset,
      receiptShowWatermark, receiptShowBarcode, receiptShowQrCode, receiptShowPhoto, receiptShowItemSku,
      receiptShowTerms, receiptShowSignatures,
      receiptCustomerSignLabel, receiptCashierSignLabel,
      autoPrintReceipt, requireCustomerOnSale, updatedAt, updatedBy
    ) VALUES (?, 11, 1, 'zinc_classic', 2350000, 1950000, 1420000, 1180000, '', 'Terima kasih telah berbelanja di {TOKO}.', 'Catatan:', ?, '', 'midnight_navy', 'monogram', 0, 0, 0, 0, 0, 0, 0, 'Pelanggan', 'Kasir', 0, 0, ?, 'System')`
  ).run(tenantId, DEFAULT_RECEIPT_TERMS_TEXT, now);

  const created = db
    .prepare('SELECT * FROM store_settings WHERE tenantId = ?')
    .get(tenantId) as StoreSettingsDbRow;
  return mapStoreSettingsRow(created);
}

export function updateStoreSettings(
  tenantId: string,
  payload: StoreSettingsUpdatePayload,
  updatedBy: string
): { tenant: Tenant; storeSettings: StoreSettings } {
  const existingTenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as Tenant | undefined;
  if (!existingTenant) {
    throw new Error('Outlet tidak ditemukan.');
  }

  const currentSettings = getStoreSettings(tenantId);
  const s = payload.settings ?? {};
  const ppnPercent = s.ppnPercent !== undefined ? Number(s.ppnPercent) : currentSettings.ppnPercent;
  if (!Number.isFinite(ppnPercent) || ppnPercent < 0 || ppnPercent > 30) {
    throw new Error('Tarif PPN harus antara 0% hingga 30%.');
  }

  const next24 = s.goldPrice24kBuyback !== undefined ? Math.round(Number(s.goldPrice24kBuyback)) : currentSettings.goldPrice24kBuyback;
  const next22 = s.goldPrice22kBuyback !== undefined ? Math.round(Number(s.goldPrice22kBuyback)) : currentSettings.goldPrice22kBuyback;
  const next18 = s.goldPrice18kBuyback !== undefined ? Math.round(Number(s.goldPrice18kBuyback)) : currentSettings.goldPrice18kBuyback;
  const next16 = s.goldPrice16kBuyback !== undefined ? Math.round(Number(s.goldPrice16kBuyback)) : currentSettings.goldPrice16kBuyback;

  if ([next24, next22, next18, next16].some(v => !Number.isFinite(v) || v < 0)) {
    throw new Error('Harga acuan buyback per gram tidak valid.');
  }

  const nextEnablePpn = s.enablePpn !== undefined ? Boolean(s.enablePpn) : currentSettings.enablePpn;
  const nextAppTheme = s.appTheme !== undefined ? normalizeAppTheme(s.appTheme) : currentSettings.appTheme;
  const nextTagline =
    (s.receiptTagline !== undefined ? s.receiptTagline : currentSettings.receiptTagline).trim();
  const nextFooterNote =
    s.receiptFooterNote !== undefined ? s.receiptFooterNote.trim() : currentSettings.receiptFooterNote;
  const nextSaleTitle =
    s.receiptSaleTitle !== undefined ? s.receiptSaleTitle.trim() : currentSettings.receiptSaleTitle;
  const nextBuybackTitle =
    s.receiptBuybackTitle !== undefined ? s.receiptBuybackTitle.trim() : currentSettings.receiptBuybackTitle;
  const nextHeaderExtra =
    s.receiptHeaderExtra !== undefined ? s.receiptHeaderExtra.trim() : currentSettings.receiptHeaderExtra;
  const nextTheme =
    s.receiptTheme !== undefined ? normalizeReceiptTheme(s.receiptTheme) : currentSettings.receiptTheme;
  const nextPaperSize =
    s.receiptDefaultPaperSize !== undefined
      ? normalizeReceiptPaperSize(s.receiptDefaultPaperSize)
      : currentSettings.receiptDefaultPaperSize;
  const nextLogoPreset =
    s.receiptLogoPreset !== undefined
      ? normalizeReceiptLogoPreset(s.receiptLogoPreset)
      : currentSettings.receiptLogoPreset;

  let nextCustomLogoUrl =
    s.receiptCustomLogoUrl !== undefined ? s.receiptCustomLogoUrl.trim() : currentSettings.receiptCustomLogoUrl;
  if (nextCustomLogoUrl && !nextCustomLogoUrl.startsWith('data:image/')) {
    throw new Error('Format logo custom nota harus berupa data gambar (PNG/JPG/WebP/SVG).');
  }
  if (nextCustomLogoUrl.length > 400_000) {
    throw new Error('Ukuran file logo nota terlalu besar (maksimal 300KB).');
  }

  const nextShowWatermark =
    s.receiptShowWatermark !== undefined ? Boolean(s.receiptShowWatermark) : currentSettings.receiptShowWatermark;
  const rawWatermarkOpacity =
    s.receiptWatermarkOpacity !== undefined
      ? Number(s.receiptWatermarkOpacity)
      : currentSettings.receiptWatermarkOpacity;
  const nextWatermarkOpacity = Number.isFinite(rawWatermarkOpacity)
    ? Math.max(2, Math.min(20, Math.round(rawWatermarkOpacity)))
    : currentSettings.receiptWatermarkOpacity;

  const nextShowStoreAddress =
    s.receiptShowStoreAddress !== undefined
      ? Boolean(s.receiptShowStoreAddress)
      : currentSettings.receiptShowStoreAddress;
  const nextShowBarcode =
    s.receiptShowBarcode !== undefined ? Boolean(s.receiptShowBarcode) : currentSettings.receiptShowBarcode;
  const nextShowQrCode =
    s.receiptShowQrCode !== undefined ? Boolean(s.receiptShowQrCode) : currentSettings.receiptShowQrCode;
  const nextShowPhoto =
    s.receiptShowPhoto !== undefined ? Boolean(s.receiptShowPhoto) : currentSettings.receiptShowPhoto;
  const nextShowItemSku =
    s.receiptShowItemSku !== undefined ? Boolean(s.receiptShowItemSku) : currentSettings.receiptShowItemSku;
  const nextShowTaxLine =
    s.receiptShowTaxLine !== undefined ? Boolean(s.receiptShowTaxLine) : currentSettings.receiptShowTaxLine;
  const nextShowCashierName =
    s.receiptShowCashierName !== undefined
      ? Boolean(s.receiptShowCashierName)
      : currentSettings.receiptShowCashierName;
  const nextShowTerms =
    s.receiptShowTerms !== undefined ? Boolean(s.receiptShowTerms) : currentSettings.receiptShowTerms;
  const nextTermsTitle =
    (s.receiptTermsTitle !== undefined ? s.receiptTermsTitle : currentSettings.receiptTermsTitle).trim() ||
    'Catatan:';
  const nextTermsText =
    s.receiptTermsText !== undefined
      ? s.receiptTermsText.trim() || DEFAULT_RECEIPT_TERMS_TEXT
      : currentSettings.receiptTermsText;
  const nextShowSignatures =
    s.receiptShowSignatures !== undefined ? Boolean(s.receiptShowSignatures) : currentSettings.receiptShowSignatures;
  const nextSignatureGreeting =
    (s.receiptSignatureGreeting !== undefined
      ? s.receiptSignatureGreeting
      : currentSettings.receiptSignatureGreeting
    ).trim() || 'Hormat Kami,';
  const nextCustomerSignLabel =
    (s.receiptCustomerSignLabel !== undefined
      ? s.receiptCustomerSignLabel
      : currentSettings.receiptCustomerSignLabel
    ).trim() || 'Customer';
  const nextCashierSignLabel =
    (s.receiptCashierSignLabel !== undefined
      ? s.receiptCashierSignLabel
      : currentSettings.receiptCashierSignLabel
    ).trim() || 'Kasir / Staff';

  const nextAutoPrint =
    s.autoPrintReceipt !== undefined ? Boolean(s.autoPrintReceipt) : currentSettings.autoPrintReceipt;
  const nextRequireCust =
    s.requireCustomerOnSale !== undefined ? Boolean(s.requireCustomerOnSale) : currentSettings.requireCustomerOnSale;

  const tp = payload.tenantProfile;
  const nextTenantName = tp?.name !== undefined ? tp.name.trim() || existingTenant.name : existingTenant.name;
  const nextBranchName =
    tp?.branchName !== undefined ? tp.branchName.trim() || existingTenant.branchName : existingTenant.branchName;
  const nextAddress = tp?.address !== undefined ? tp.address.trim() : existingTenant.address;
  const nextCity = tp?.city !== undefined ? tp.city.trim() : existingTenant.city;
  const nextPhone = tp?.phone !== undefined ? tp.phone.trim() : existingTenant.phone;
  const nextEmail = tp?.email !== undefined ? tp.email.trim() : existingTenant.email;
  const nextStatus = tp?.status !== undefined ? tp.status : existingTenant.status;

  const nowIso = new Date().toISOString();

  const updateTx = db.transaction(() => {
    db.prepare(
      `UPDATE tenants
       SET name = ?, branchName = ?, address = ?, city = ?, phone = ?, email = ?, status = ?
       WHERE id = ?`
    ).run(nextTenantName, nextBranchName, nextAddress, nextCity, nextPhone, nextEmail, nextStatus, tenantId);

    db.prepare(
      `INSERT OR REPLACE INTO store_settings (
        tenantId, ppnPercent, enablePpn, appTheme,
        goldPrice24kBuyback, goldPrice22kBuyback, goldPrice18kBuyback, goldPrice16kBuyback,
        receiptTagline, receiptFooterNote,
        receiptSaleTitle, receiptBuybackTitle, receiptHeaderExtra,
        receiptTheme, receiptDefaultPaperSize, receiptLogoPreset, receiptCustomLogoUrl,
        receiptShowWatermark, receiptWatermarkOpacity,
        receiptShowStoreAddress, receiptShowBarcode, receiptShowQrCode, receiptShowPhoto,
        receiptShowItemSku, receiptShowTaxLine, receiptShowCashierName,
        receiptShowTerms, receiptTermsTitle, receiptTermsText,
        receiptShowSignatures, receiptSignatureGreeting, receiptCustomerSignLabel, receiptCashierSignLabel,
        autoPrintReceipt, requireCustomerOnSale, updatedAt, updatedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      tenantId,
      Number(ppnPercent.toFixed(2)),
      nextEnablePpn ? 1 : 0,
      nextAppTheme,
      next24,
      next22,
      next18,
      next16,
      nextTagline,
      nextFooterNote,
      nextSaleTitle,
      nextBuybackTitle,
      nextHeaderExtra,
      nextTheme,
      nextPaperSize,
      nextLogoPreset,
      nextCustomLogoUrl,
      nextShowWatermark ? 1 : 0,
      nextWatermarkOpacity,
      nextShowStoreAddress ? 1 : 0,
      nextShowBarcode ? 1 : 0,
      nextShowQrCode ? 1 : 0,
      nextShowPhoto ? 1 : 0,
      nextShowItemSku ? 1 : 0,
      nextShowTaxLine ? 1 : 0,
      nextShowCashierName ? 1 : 0,
      nextShowTerms ? 1 : 0,
      nextTermsTitle,
      nextTermsText,
      nextShowSignatures ? 1 : 0,
      nextSignatureGreeting,
      nextCustomerSignLabel,
      nextCashierSignLabel,
      nextAutoPrint ? 1 : 0,
      nextRequireCust ? 1 : 0,
      nowIso,
      updatedBy
    );
  });

  updateTx();

  const updatedTenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as Tenant;
  const updatedSettings = getStoreSettings(tenantId);
  return { tenant: updatedTenant, storeSettings: updatedSettings };
}

export function getLiveShiftSummary(opts: {
  tenantId: string;
  date?: string;
  scope?: 'my' | 'outlet';
  cashierName?: string;
  cashierId?: string;
}): ShiftLiveSummary {
  const date = (opts.date ?? '').trim() || new Date().toISOString().slice(0, 10);
  const scope: 'my' | 'outlet' = opts.scope === 'my' ? 'my' : 'outlet';

  const txConds = ['tenantId = ?'];
  const txParams: Array<string> = [opts.tenantId];
  if (date !== 'all') {
    txConds.push('substr(dateTime, 1, 10) = ?');
    txParams.push(date);
  }
  if (scope === 'my' && opts.cashierName) {
    txConds.push('LOWER(cashier) = LOWER(?)');
    txParams.push(opts.cashierName);
  }

  const txAgg = db
    .prepare(
      `SELECT
        SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN 1 ELSE 0 END) AS totalSalesCount,
        COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN grandTotal ELSE 0 END), 0) AS totalSalesAmount,
        COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN totalBerat ELSE 0 END), 0) AS totalSalesGrams,
        COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' AND paymentMethod = 'cash' THEN grandTotal ELSE 0 END), 0) AS salesCash,
        COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' AND paymentMethod = 'debit' THEN grandTotal ELSE 0 END), 0) AS salesDebit,
        COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' AND paymentMethod = 'transfer' THEN grandTotal ELSE 0 END), 0) AS salesTransfer,
        COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' AND paymentMethod = 'qris' THEN grandTotal ELSE 0 END), 0) AS salesQris,
        SUM(CASE WHEN COALESCE(status, 'completed') = 'void' THEN 1 ELSE 0 END) AS voidSalesCount
       FROM transactions
       WHERE ${txConds.join(' AND ')}`
    )
    .get(...txParams) as {
    totalSalesCount: number | null;
    totalSalesAmount: number;
    totalSalesGrams: number;
    salesCash: number;
    salesDebit: number;
    salesTransfer: number;
    salesQris: number;
    voidSalesCount: number | null;
  };

  const bbConds = ['tenantId = ?'];
  const bbParams: Array<string> = [opts.tenantId];
  if (date !== 'all') {
    bbConds.push("substr(COALESCE(createdAt, ''), 1, 10) = ?");
    bbParams.push(date);
  }
  if (scope === 'my' && opts.cashierName) {
    bbConds.push("LOWER(COALESCE(cashierName, '')) = LOWER(?)");
    bbParams.push(opts.cashierName);
  }

  const bbAgg = db
    .prepare(
      `SELECT
        SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN 1 ELSE 0 END) AS totalBuybackCount,
        COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN totalBayar ELSE 0 END), 0) AS totalBuybackAmount,
        COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' THEN beratBersih ELSE 0 END), 0) AS totalBuybackGrams,
        COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' AND paymentMethod = 'cash' THEN totalBayar ELSE 0 END), 0) AS buybackCash,
        COALESCE(SUM(CASE WHEN COALESCE(status, 'completed') != 'void' AND paymentMethod = 'transfer' THEN totalBayar ELSE 0 END), 0) AS buybackTransfer,
        SUM(CASE WHEN COALESCE(status, 'completed') = 'void' THEN 1 ELSE 0 END) AS voidBuybackCount
       FROM buybacks
       WHERE ${bbConds.join(' AND ')}`
    )
    .get(...bbParams) as {
    totalBuybackCount: number | null;
    totalBuybackAmount: number;
    totalBuybackGrams: number;
    buybackCash: number;
    buybackTransfer: number;
    voidBuybackCount: number | null;
  };

  const closeConds = ['tenantId = ?'];
  const closeParams: Array<string> = [opts.tenantId];
  if (date !== 'all') {
    closeConds.push('shiftDate = ?');
    closeParams.push(date);
  }
  if (scope === 'my' && opts.cashierId) {
    closeConds.push('cashierId = ?');
    closeParams.push(opts.cashierId);
  }

  const alreadyClosedCount = (
    db.prepare(`SELECT COUNT(*) as cnt FROM shift_closings WHERE ${closeConds.join(' AND ')}`).get(...closeParams) as {
      cnt: number;
    }
  ).cnt;

  const salesCash = txAgg.salesCash ?? 0;
  const buybackCash = bbAgg.buybackCash ?? 0;

  return {
    date,
    scope,
    cashierName: scope === 'my' ? opts.cashierName : undefined,
    totalSalesCount: txAgg.totalSalesCount ?? 0,
    totalSalesAmount: txAgg.totalSalesAmount ?? 0,
    totalSalesGrams: Number((txAgg.totalSalesGrams ?? 0).toFixed(2)),
    salesCash,
    salesDebit: txAgg.salesDebit ?? 0,
    salesTransfer: txAgg.salesTransfer ?? 0,
    salesQris: txAgg.salesQris ?? 0,
    totalBuybackCount: bbAgg.totalBuybackCount ?? 0,
    totalBuybackAmount: bbAgg.totalBuybackAmount ?? 0,
    totalBuybackGrams: Number((bbAgg.totalBuybackGrams ?? 0).toFixed(2)),
    buybackCash,
    buybackTransfer: bbAgg.buybackTransfer ?? 0,
    voidSalesCount: txAgg.voidSalesCount ?? 0,
    voidBuybackCount: bbAgg.voidBuybackCount ?? 0,
    netCashMovement: salesCash - buybackCash,
    alreadyClosedCount,
  };
}

interface ShiftClosingDbRow {
  id: string;
  tenantId: string;
  shiftCode: string;
  shiftDate: string;
  shiftLabel: string;
  cashierId: string;
  cashierName: string;
  openingCash: number;
  totalSalesCount: number;
  totalSalesAmount: number;
  totalSalesGrams: number;
  salesCash: number;
  salesDebit: number;
  salesTransfer: number;
  salesQris: number;
  totalBuybackCount: number;
  totalBuybackAmount: number;
  totalBuybackGrams: number;
  buybackCash: number;
  buybackTransfer: number;
  voidSalesCount: number;
  voidBuybackCount: number;
  expectedCash: number;
  actualCash: number;
  cashVariance: number;
  notes: string | null;
  status: string;
  closedAt: string;
}

function mapShiftClosingRow(r: ShiftClosingDbRow): ShiftClosingRecord {
  return {
    id: r.id,
    tenantId: r.tenantId,
    shiftCode: r.shiftCode,
    shiftDate: r.shiftDate,
    shiftLabel: r.shiftLabel,
    cashierId: r.cashierId,
    cashierName: r.cashierName,
    openingCash: r.openingCash,
    totalSalesCount: r.totalSalesCount,
    totalSalesAmount: r.totalSalesAmount,
    totalSalesGrams: Number(r.totalSalesGrams),
    salesCash: r.salesCash,
    salesDebit: r.salesDebit,
    salesTransfer: r.salesTransfer,
    salesQris: r.salesQris,
    totalBuybackCount: r.totalBuybackCount,
    totalBuybackAmount: r.totalBuybackAmount,
    totalBuybackGrams: Number(r.totalBuybackGrams),
    buybackCash: r.buybackCash,
    buybackTransfer: r.buybackTransfer,
    voidSalesCount: r.voidSalesCount,
    voidBuybackCount: r.voidBuybackCount,
    expectedCash: r.expectedCash,
    actualCash: r.actualCash,
    cashVariance: r.cashVariance,
    notes: r.notes ?? undefined,
    status: 'closed',
    closedAt: r.closedAt,
  };
}

export function createShiftClosing(opts: {
  tenantId: string;
  user: UserAccount;
  payload: ShiftClosingCreatePayload;
}): ShiftClosingRecord {
  const shiftDate = (opts.payload.shiftDate ?? '').trim() || new Date().toISOString().slice(0, 10);
  const openingCash = Math.round(Number(opts.payload.openingCash));
  const actualCash = Math.round(Number(opts.payload.actualCash));

  if (!Number.isFinite(openingCash) || openingCash < 0) {
    throw new Error('Modal awal kasir harus bernilai Rp 0 atau lebih.');
  }
  if (!Number.isFinite(actualCash) || actualCash < 0) {
    throw new Error('Jumlah kas fisik di laci harus bernilai Rp 0 atau lebih.');
  }

  const effectiveScope: 'my' | 'outlet' =
    opts.user.role === 'cashier' ? 'my' : opts.payload.scope === 'my' ? 'my' : 'outlet';

  const summary = getLiveShiftSummary({
    tenantId: opts.tenantId,
    date: shiftDate,
    scope: effectiveScope,
    cashierName: opts.user.fullName,
    cashierId: opts.user.id,
  });

  const expectedCash = openingCash + summary.salesCash - summary.buybackCash;
  const cashVariance = actualCash - expectedCash;
  const dateCompact = shiftDate.replace(/[^0-9]/g, '').slice(0, 8) || new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const existingCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM shift_closings WHERE shiftCode LIKE ?').get(`SHF-${dateCompact}-%`) as {
      cnt: number;
    }
  ).cnt;

  let seq = existingCount + 1;
  let shiftCode = `SHF-${dateCompact}-${String(seq).padStart(3, '0')}`;
  while (db.prepare('SELECT id FROM shift_closings WHERE shiftCode = ?').get(shiftCode)) {
    seq += 1;
    shiftCode = `SHF-${dateCompact}-${String(seq).padStart(3, '0')}`;
  }

  const id = `SHF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const shiftLabel = (opts.payload.shiftLabel ?? '').trim() || opts.user.shiftLabel || 'Shift Harian';
  const notes = (opts.payload.notes ?? '').trim() || null;
  const closedAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO shift_closings (
      id, tenantId, shiftCode, shiftDate, shiftLabel, cashierId, cashierName,
      openingCash, totalSalesCount, totalSalesAmount, totalSalesGrams,
      salesCash, salesDebit, salesTransfer, salesQris,
      totalBuybackCount, totalBuybackAmount, totalBuybackGrams,
      buybackCash, buybackTransfer, voidSalesCount, voidBuybackCount,
      expectedCash, actualCash, cashVariance, notes, status, closedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'closed', ?)`
  ).run(
    id,
    opts.tenantId,
    shiftCode,
    shiftDate,
    effectiveScope === 'outlet' ? `${shiftLabel} (Seluruh Outlet)` : shiftLabel,
    opts.user.id,
    opts.user.fullName,
    openingCash,
    summary.totalSalesCount,
    summary.totalSalesAmount,
    summary.totalSalesGrams,
    summary.salesCash,
    summary.salesDebit,
    summary.salesTransfer,
    summary.salesQris,
    summary.totalBuybackCount,
    summary.totalBuybackAmount,
    summary.totalBuybackGrams,
    summary.buybackCash,
    summary.buybackTransfer,
    summary.voidSalesCount,
    summary.voidBuybackCount,
    expectedCash,
    actualCash,
    cashVariance,
    notes,
    closedAt
  );

  const row = db.prepare('SELECT * FROM shift_closings WHERE id = ?').get(id) as ShiftClosingDbRow;
  return mapShiftClosingRow(row);
}

export function queryShiftClosings(opts: {
  tenantId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  varianceFilter?: string;
  cashierId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): ShiftClosingsPageResponse {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize ?? 10)));
  const search = (opts.search ?? '').trim().toLowerCase();
  const varianceFilter = (opts.varianceFilter ?? 'all').trim();
  const sortDir = normalizeSortDir(opts.sortDir);

  let orderBySql = `closedAt ${sortDir}, rowid DESC`;
  switch (opts.sortBy) {
    case 'shiftDate':
      orderBySql = `shiftDate ${sortDir}, closedAt DESC`;
      break;
    case 'totalSalesAmount':
      orderBySql = `totalSalesAmount ${sortDir}, closedAt DESC`;
      break;
    case 'cashVariance':
      orderBySql = `cashVariance ${sortDir}, closedAt DESC`;
      break;
    case 'cashierName':
      orderBySql = `LOWER(cashierName) ${sortDir}, closedAt DESC`;
      break;
    case 'newest':
    default:
      orderBySql = `closedAt ${sortDir}, rowid DESC`;
      break;
  }

  const baseConds: string[] = ['tenantId = ?'];
  const baseParams: Array<string | number> = [opts.tenantId];
  if (opts.cashierId) {
    baseConds.push('cashierId = ?');
    baseParams.push(opts.cashierId);
  }

  const conds = [...baseConds];
  const params = [...baseParams];

  if (search) {
    const like = `%${search}%`;
    conds.push(
      "(LOWER(shiftCode) LIKE ? OR LOWER(cashierName) LIKE ? OR LOWER(shiftLabel) LIKE ? OR LOWER(shiftDate) LIKE ? OR LOWER(COALESCE(notes, '')) LIKE ?)"
    );
    params.push(like, like, like, like, like);
  }

  if (varianceFilter === 'exact') {
    conds.push('cashVariance = 0');
  } else if (varianceFilter === 'surplus') {
    conds.push('cashVariance > 0');
  } else if (varianceFilter === 'shortage') {
    conds.push('cashVariance < 0');
  }

  const whereSql = `WHERE ${conds.join(' AND ')}`;
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM shift_closings ${whereSql}`).get(...params) as { cnt: number }).cnt;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const rows = db
    .prepare(`SELECT * FROM shift_closings ${whereSql} ORDER BY ${orderBySql} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as ShiftClosingDbRow[];

  const agg = db
    .prepare(
      `SELECT COUNT(*) as totalClosings,
              SUM(CASE WHEN cashVariance = 0 THEN 1 ELSE 0 END) as exactMatchCount,
              COALESCE(SUM(totalSalesAmount), 0) as totalRecordedSales,
              COALESCE(SUM(cashVariance), 0) as totalVariance
       FROM shift_closings
       WHERE ${baseConds.join(' AND ')}`
    )
    .get(...baseParams) as {
    totalClosings: number;
    exactMatchCount: number | null;
    totalRecordedSales: number;
    totalVariance: number;
  };

  return {
    items: rows.map(mapShiftClosingRow),
    total,
    page: safePage,
    pageSize,
    totalPages,
    stats: {
      totalClosings: agg.totalClosings,
      exactMatchCount: agg.exactMatchCount ?? 0,
      totalRecordedSales: agg.totalRecordedSales,
      totalVariance: agg.totalVariance,
    },
  };
}

export function seedShiftClosingsIfNeeded(): void {
  const alreadySeeded = db.prepare('SELECT value FROM settings WHERE key = ?').get('seeded_shift_closings_v1') as
    | { value: string }
    | undefined;
  if (alreadySeeded?.value === '1') {
    return;
  }

  const tx = db.transaction(() => {
    const insertShift = db.prepare(
      `INSERT OR IGNORE INTO shift_closings (
        id, tenantId, shiftCode, shiftDate, shiftLabel, cashierId, cashierName,
        openingCash, totalSalesCount, totalSalesAmount, totalSalesGrams,
        salesCash, salesDebit, salesTransfer, salesQris,
        totalBuybackCount, totalBuybackAmount, totalBuybackGrams,
        buybackCash, buybackTransfer, voidSalesCount, voidBuybackCount,
        expectedCash, actualCash, cashVariance, notes, status, closedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'closed', ?)`
    );

    insertShift.run(
      'SHF-SEED-TMS-001',
      'tenant-tms-001',
      'SHF-20261112-001',
      '2026-11-12',
      'Shift 1 (08:00 - 16:00)',
      'USR-003',
      'Andi Pratama',
      5000000,
      4,
      89355000,
      30.45,
      19758000,
      27528000,
      24890000,
      17179000,
      1,
      4200000,
      2.1,
      4200000,
      0,
      0,
      0,
      20558000,
      20558000,
      0,
      'Kasir laci utama klop dengan rekap nota & bukti EDC.',
      '2026-11-12T16:15:00.000Z'
    );

    insertShift.run(
      'SHF-SEED-TMJ-001',
      'tenant-tmj-002',
      'SHF-20261111-001',
      '2026-11-11',
      'Shift 2 (13:00 - 21:00)',
      'USR-004',
      'Rina Kusuma',
      3000000,
      1,
      6049500,
      2.4,
      0,
      0,
      0,
      6049500,
      1,
      6173000,
      4.4,
      0,
      6173000,
      0,
      0,
      3000000,
      3050000,
      50000,
      'Selisih lebih Rp 50.000 dari uang kembalian pecahan.',
      '2026-11-11T21:10:00.000Z'
    );

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seeded_shift_closings_v1', '1');
  });

  tx();
}

export function normalizeIndonesianWaPhone(rawPhone: string): string {
  const digits = String(rawPhone ?? '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export function getBroadcastAudienceCustomers(): BroadcastCustomerAudienceItem[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.memberCode, c.name, c.phone, c.type, c.preferredKadar,
              (COALESCE(c.totalTransactions, 0) + COALESCE((
                SELECT COUNT(*) FROM transactions t
                WHERE COALESCE(t.status, 'completed') != 'void'
                  AND (t.customerId = c.id OR (t.customerId IS NULL AND LOWER(t.customerName) = LOWER(c.name)))
              ), 0) + COALESCE((
                SELECT COUNT(*) FROM buybacks b
                WHERE COALESCE(b.status, 'completed') != 'void'
                  AND (b.customerId = c.id OR (b.customerId IS NULL AND LOWER(b.customerName) = LOWER(c.name)))
              ), 0)) AS totalTxCount
       FROM customers c
       WHERE TRIM(COALESCE(c.phone, '')) != ''
       ORDER BY CASE WHEN totalTxCount > 0 THEN 0 ELSE 1 END,
                CASE WHEN c.type = 'VIP' THEN 0 WHEN c.type = 'Mitra / Toko' THEN 1 ELSE 2 END,
                LOWER(c.name) ASC`
    )
    .all() as Array<{
    id: string;
    memberCode: string;
    name: string;
    phone: string;
    type: 'Reguler' | 'VIP' | 'Mitra / Toko';
    preferredKadar: string | null;
    totalTxCount: number;
  }>;

  const result: BroadcastCustomerAudienceItem[] = [];
  for (const row of rows) {
    const waPhone = normalizeIndonesianWaPhone(row.phone);
    if (waPhone.length < 9) continue;
    const totalTxCount = Number(row.totalTxCount) || 0;
    result.push({
      id: row.id,
      memberCode: row.memberCode,
      name: row.name,
      phone: row.phone,
      waPhone,
      type: row.type,
      preferredKadar: row.preferredKadar ?? undefined,
      totalTxCount,
      hasTransacted: totalTxCount > 0,
    });
  }
  return result;
}

const SAFE_GREETINGS = [
  'Halo',
  'Salam hangat',
  'Selamat datang kembali',
  'Halo Kak',
];

function formatRupiahSimple(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

export function renderPromoBroadcastMessage(
  template: string,
  params: {
    customerName: string;
    memberCode: string;
    promoName: string;
    promoCode: string;
    discountPercent: number;
    startDate: string;
    endDate: string;
    minPurchase?: number;
    storeName: string;
    variantIndex?: number;
  }
): string {
  const periode = `${params.startDate} s/d ${params.endDate}`;
  const minBelanja =
    params.minPurchase && params.minPurchase > 0
      ? formatRupiahSimple(params.minPurchase)
      : 'Tanpa minimal belanja';
  const greeting = SAFE_GREETINGS[(params.variantIndex ?? 0) % SAFE_GREETINGS.length];

  return template
    .replace(/\{sapaan\}/gi, greeting)
    .replace(/\{nama\}/gi, params.customerName)
    .replace(/\{kode_member\}/gi, params.memberCode)
    .replace(/\{nama_promo\}/gi, params.promoName)
    .replace(/\{kode_promo\}/gi, params.promoCode)
    .replace(/\{diskon\}/gi, `${params.discountPercent}%`)
    .replace(/\{periode\}/gi, periode)
    .replace(/\{min_belanja\}/gi, minBelanja)
    .replace(/\{nama_toko\}/gi, params.storeName);
}

interface BroadcastDbRow {
  id: string;
  tenantId: string;
  promoId: string;
  promoName: string;
  promoCode: string;
  discountPercent: number;
  audienceMode: BroadcastAudienceMode;
  audienceSegment: string | null;
  deliveryMode: BroadcastDeliveryMode;
  messageTemplate: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdBy: string;
  createdAt: string;
}

interface BroadcastRecipientDbRow {
  id: string;
  broadcastId: string;
  customerId: string;
  customerName: string;
  memberCode: string;
  customerType: string;
  phone: string;
  waPhone: string;
  personalizedMessage: string;
  status: BroadcastRecipientStatus;
  errorMessage: string | null;
  sentAt: string | null;
}

function mapBroadcastRow(row: BroadcastDbRow, recipients?: PromoBroadcastRecipient[]): PromoBroadcastRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    promoId: row.promoId,
    promoName: row.promoName,
    promoCode: row.promoCode,
    discountPercent: row.discountPercent,
    audienceMode: row.audienceMode,
    audienceSegment: row.audienceSegment ?? undefined,
    deliveryMode: row.deliveryMode,
    messageTemplate: row.messageTemplate,
    totalRecipients: row.totalRecipients,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    recipients,
  };
}

function mapBroadcastRecipientRow(row: BroadcastRecipientDbRow): PromoBroadcastRecipient {
  return {
    id: row.id,
    broadcastId: row.broadcastId,
    customerId: row.customerId,
    customerName: row.customerName,
    memberCode: row.memberCode,
    customerType: row.customerType,
    phone: row.phone,
    waPhone: row.waPhone,
    personalizedMessage: row.personalizedMessage,
    status: row.status,
    errorMessage: row.errorMessage ?? undefined,
    sentAt: row.sentAt ?? undefined,
  };
}

export function createPromoBroadcastBatch(opts: {
  tenantId: string;
  promo: {
    id: string;
    name: string;
    code: string;
    discountPercent: number;
    startDate: string;
    endDate: string;
    minPurchase?: number;
  };
  storeName: string;
  audienceMode: BroadcastAudienceMode;
  audienceSegment?: string;
  customers: BroadcastCustomerAudienceItem[];
  deliveryMode: BroadcastDeliveryMode;
  messageTemplate: string;
  createdBy: string;
}): PromoBroadcastRecord {
  const broadcastId = `BRC-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const createdAt = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO promo_broadcasts (
        id, tenantId, promoId, promoName, promoCode, discountPercent,
        audienceMode, audienceSegment, deliveryMode, messageTemplate,
        totalRecipients, sentCount, failedCount, createdBy, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
    ).run(
      broadcastId,
      opts.tenantId,
      opts.promo.id,
      opts.promo.name,
      opts.promo.code,
      opts.promo.discountPercent,
      opts.audienceMode,
      opts.audienceSegment ?? null,
      opts.deliveryMode,
      opts.messageTemplate,
      opts.customers.length,
      opts.createdBy,
      createdAt
    );

    const insertRecipient = db.prepare(
      `INSERT INTO promo_broadcast_recipients (
        id, broadcastId, customerId, customerName, memberCode, customerType,
        phone, waPhone, personalizedMessage, status, errorMessage, sentAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL)`
    );

    opts.customers.forEach((cust, idx) => {
      const recId = `BRR-${Date.now()}-${idx}-${crypto.randomBytes(2).toString('hex')}`;
      const personalizedMessage = renderPromoBroadcastMessage(opts.messageTemplate, {
        customerName: cust.name,
        memberCode: cust.memberCode,
        promoName: opts.promo.name,
        promoCode: opts.promo.code,
        discountPercent: opts.promo.discountPercent,
        startDate: opts.promo.startDate,
        endDate: opts.promo.endDate,
        minPurchase: opts.promo.minPurchase,
        storeName: opts.storeName,
        variantIndex: idx,
      });

      insertRecipient.run(
        recId,
        broadcastId,
        cust.id,
        cust.name,
        cust.memberCode,
        cust.type,
        cust.phone,
        cust.waPhone,
        personalizedMessage
      );
    });
  });

  tx();
  return getPromoBroadcastById(broadcastId, opts.tenantId)!;
}

export function listPromoBroadcasts(tenantId: string, limit = 30): PromoBroadcastRecord[] {
  const rows = db
    .prepare('SELECT * FROM promo_broadcasts WHERE tenantId = ? ORDER BY createdAt DESC LIMIT ?')
    .all(tenantId, limit) as BroadcastDbRow[];
  return rows.map(row => mapBroadcastRow(row));
}

export function getPromoBroadcastById(broadcastId: string, tenantId: string): PromoBroadcastRecord | null {
  const row = db
    .prepare('SELECT * FROM promo_broadcasts WHERE id = ? AND tenantId = ?')
    .get(broadcastId, tenantId) as BroadcastDbRow | undefined;
  if (!row) return null;

  const recipients = db
    .prepare('SELECT * FROM promo_broadcast_recipients WHERE broadcastId = ? ORDER BY rowid ASC')
    .all(broadcastId) as BroadcastRecipientDbRow[];

  return mapBroadcastRow(row, recipients.map(mapBroadcastRecipientRow));
}

export function updatePromoBroadcastRecipientStatus(opts: {
  broadcastId: string;
  recipientId: string;
  tenantId: string;
  status: BroadcastRecipientStatus;
  errorMessage?: string;
}): PromoBroadcastRecord | null {
  const parent = db
    .prepare('SELECT id FROM promo_broadcasts WHERE id = ? AND tenantId = ?')
    .get(opts.broadcastId, opts.tenantId) as { id: string } | undefined;
  if (!parent) return null;

  const sentAt = opts.status === 'sent' ? new Date().toISOString() : null;
  const errMsg = opts.status === 'failed' ? (opts.errorMessage ?? 'Pengiriman gagal') : null;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE promo_broadcast_recipients
       SET status = ?, errorMessage = ?, sentAt = ?
       WHERE id = ? AND broadcastId = ?`
    ).run(opts.status, errMsg, sentAt, opts.recipientId, opts.broadcastId);

    const counts = db
      .prepare(
        `SELECT
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sentCount,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedCount
         FROM promo_broadcast_recipients
         WHERE broadcastId = ?`
      )
      .get(opts.broadcastId) as { sentCount: number | null; failedCount: number | null };

    db.prepare('UPDATE promo_broadcasts SET sentCount = ?, failedCount = ? WHERE id = ?').run(
      counts.sentCount ?? 0,
      counts.failedCount ?? 0,
      opts.broadcastId
    );
  });

  tx();
  return getPromoBroadcastById(opts.broadcastId, opts.tenantId);
}

export function getDailyBroadcastSentCount(tenantId: string): number {
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const row = db
    .prepare(
      `SELECT COUNT(*) as cnt
       FROM promo_broadcast_recipients r
       INNER JOIN promo_broadcasts b ON b.id = r.broadcastId
       WHERE b.tenantId = ? AND r.status = 'sent' AND r.sentAt LIKE ?`
    )
    .get(tenantId, `${todayPrefix}%`) as { cnt: number };
  return row?.cnt ?? 0;
}

export function cancelPendingPromoBroadcastRecipients(
  broadcastId: string,
  tenantId: string,
  reason = 'Dihentikan oleh pengguna (Mode Aman)'
): PromoBroadcastRecord | null {
  const parent = db
    .prepare('SELECT id FROM promo_broadcasts WHERE id = ? AND tenantId = ?')
    .get(broadcastId, tenantId) as { id: string } | undefined;
  if (!parent) return null;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE promo_broadcast_recipients
       SET status = 'failed', errorMessage = ?
       WHERE broadcastId = ? AND status = 'pending'`
    ).run(reason, broadcastId);

    const counts = db
      .prepare(
        `SELECT
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sentCount,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedCount
         FROM promo_broadcast_recipients
         WHERE broadcastId = ?`
      )
      .get(broadcastId) as { sentCount: number | null; failedCount: number | null };

    db.prepare('UPDATE promo_broadcasts SET sentCount = ?, failedCount = ? WHERE id = ?').run(
      counts.sentCount ?? 0,
      counts.failedCount ?? 0,
      broadcastId
    );
  });

  tx();
  return getPromoBroadcastById(broadcastId, tenantId);
}





