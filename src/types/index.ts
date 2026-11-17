export type ProductStatus = 'Aktif' | 'Nonaktif';

export interface Product {
  id: number;
  sku: string;
  name: string;
  berat: number; // Berat / Netto paket dalam gram (standar ongkir Shopee)
  harga: number; // Harga Jual (Rp)
  hpp?: number; // Harga Pokok Penjualan / Modal (Rp)
  stok: number; // Stok persediaan barang (pcs)
  category: string; // Kategori produk
  brand?: string; // Merek / Brand (Standar Shopee: e.g. "No Brand" atau nama merek)
  deskripsi?: string; // Deskripsi detail / spesifikasi produk
  panjang?: number; // Dimensi paket P (cm)
  lebar?: number; // Dimensi paket L (cm)
  tinggi?: number; // Dimensi paket T (cm)
  status?: ProductStatus; // Status katalog (Aktif / Nonaktif)
  image: string;
  attributes?: Record<string, string>; // Atribut spesifikasi dinamis sesuai kategori Shopee
  isPromo?: boolean;
  promoDiscountPercent?: number;
  promoLabel?: string;
  salesCount?: number;
  createdAt?: string;
}

export interface CategoryAttributeField {
  key: string;
  label: string;
  type?: 'text' | 'select' | 'number' | 'date';
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface CategoryItem {
  name: string;
  parentName?: string | null;
  icon: string;
  skuPrefix: string;
  sortOrder: number;
  isActive: boolean;
  description: string;
  attributeFields: CategoryAttributeField[];
  createdAt?: string;
}

export interface CategoryPayload {
  name: string;
  parentName?: string | null;
  icon?: string;
  skuPrefix?: string;
  sortOrder?: number;
  isActive?: boolean;
  description?: string;
  attributeFields?: CategoryAttributeField[];
}

export interface PromoCampaign {
  id: string;
  name: string;
  code: string;
  discountPercent: number;
  label: string;
  startDate: string;
  endDate: string;
  productIds: number[];
  isActive: boolean;
  minPurchase?: number;
  description?: string;
  createdAt?: string;
}

export interface CartItem extends Product {
  qty: number;
}

export interface TransactionItem {
  id: number;
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  hpp?: number;
  panjang?: number;
  lebar?: number;
  tinggi?: number;
  berat: number;
  harga: number;
  qty: number;
  subtotal: number;
  image?: string;
}

export interface PaymentDetails {
  cashReceived?: number;
  cashChange?: number;
  debitBank?: string;
  debitCardLast4?: string;
  debitApprovalCode?: string;
  transferBank?: string;
  transferAccountNo?: string;
  transferRef?: string;
  qrisNmid?: string;
  qrisRrn?: string;
}

export interface Transaction {
  id: string;
  invoiceNo: string;
  dateTime: string;
  dateStr: string;
  timeStr: string;
  cashier: string;
  customerId?: string;
  customerMemberCode?: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: TransactionItem[];
  totalQty: number;
  totalBerat: number;
  subtotal: number;
  discountAmount?: number;
  promoCode?: string;
  promoName?: string;
  tax: number;
  grandTotal: number;
  paymentMethod: 'cash' | 'debit' | 'transfer' | 'qris';
  paymentDetails: PaymentDetails;
  status?: 'completed' | 'void';
  voidReason?: string;
  voidedAt?: string;
}

export interface BuybackGoldItem {
  id: string;
  category: 'Logam Mulia Batangan' | 'Perhiasan';
  brandType: string;
  kadar: string;
  berat: number;
  serialNumber?: string;
  certYear?: string;
  kondisi: 'Baik / Utuh' | 'Kemasan Rusak' | 'Tanpa Sertifikat / Nota' | 'Patah / Cacat';
  hargaPerGram: number;
  subtotal: number;
}

export interface BuybackItem {
  id: string;
  invoiceNo: string;
  date: string;
  timeStr?: string;
  branchName?: string;
  cashierName?: string;
  customerId?: string;
  customerMemberCode?: string;
  customerName: string;
  customerPhone: string;
  customerNik?: string;
  customerNpwp?: string;
  customerAddress?: string;
  sourceNote: string;
  itemType: string;
  kadar: string;
  beratKotor: number;
  potonganBatu: number;
  beratBersih: number;
  hargaPerGram: number;
  biayaLebur: number;
  kondisi: string;
  totalKotor?: number;
  potonganBiaya?: number;
  pph22?: number;
  totalBayar: number;
  paymentMethod: 'cash' | 'transfer';
  bankName?: string;
  accountNo?: string;
  accountHolder?: string;
  catatan?: string;
  fotoKtp?: string;
  fotoEmas?: string;
  ttdNasabah?: string;
  ttdPetugas?: string;
  isAgreedLegal?: boolean;
  items?: BuybackGoldItem[];
  status?: 'completed' | 'void';
  voidReason?: string;
  voidedAt?: string;
}

export type BuybackCreatePayload = Omit<BuybackItem, 'id' | 'invoiceNo' | 'date'> & {
  saveToCustomerMaster?: boolean;
};

export interface Tenant {
  id: string;
  name: string;
  code: string;
  branchName: string;
  address: string;
  city: string;
  plan: 'Basic Single-Store' | 'Pro Multi-Outlet' | 'Enterprise Multi-Tenant';
  cashierCount: number;
  productCount: number;
  transactionCount?: number;
  phone: string;
  email: string;
  slug: string;
  logoInitial: string;
  logoUrl?: string;
  databaseSchema: string;
  status: 'Aktif' | 'Trial' | 'Nonaktif';
  createdAt?: string;
}

export interface Customer {
  id: string;
  memberCode: string;
  name: string;
  phone: string;
  nik?: string;
  npwp?: string;
  type: 'Reguler' | 'VIP' | 'Mitra / Toko';
  address?: string;
  preferredKadar?: string;
  goldColor?: string;
  ringSize?: string;
  braceletSize?: string;
  birthDate?: string;
  notes?: string;
  createdAt: string;
  totalSpent?: number;
  totalTransactions?: number;
}

export interface CustomerWithStats extends Customer {
  computedSpent: number;
  computedTx: number;
  buybackCount: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductsPageResponse extends PaginatedResponse<Product> {
  promoCount: number;
  categoryCounts: Record<string, number>;
  categoryDetails?: CategoryItem[];
  brandCounts?: Record<string, number>;
  totalAllProducts: number;
  activeCount?: number;
  inactiveCount?: number;
  lowStockCount?: number;
  outOfStockCount?: number;
  totalStockQty?: number;
  totalWeightGrams?: number;
  totalInventoryValue?: number;
}

export interface TransactionStatsSummary {
  totalOmzetPenjualan: number;
  totalBeratTerjual: number;
  totalQtyTerjual?: number;
  totalTransaksi: number;
  voidCount?: number;
  avgPerTransaksi: number;
}

export interface TransactionsPageResponse extends PaginatedResponse<Transaction> {
  stats: TransactionStatsSummary;
  cashiers?: string[];
}

export type TransactionExportPeriod = 'monthly' | 'daily' | 'custom' | 'yearly' | 'all';
export type TransactionExportStatus = 'completed' | 'all' | 'void';
export type TransactionExportFormat = 'xlsx' | 'csv';

export interface TransactionExportPreview {
  count: number;
  completedCount: number;
  voidCount: number;
  totalQty: number;
  totalBerat: number;
  totalOmzet: number;
  periodLabel: string;
  filename: string;
}

export interface BuybackStatsSummary {
  totalDanaDicairkan: number;
  totalBeratDiterima: number;
  totalTransaksi: number;
  avgPerTransaksi: number;
}

export interface BuybacksPageResponse extends PaginatedResponse<BuybackItem> {
  stats: BuybackStatsSummary;
}

export interface CustomerStatsSummary {
  totalPelanggan: number;
  totalVip: number;
  totalAkumulasiBelanja: number;
}

export interface CustomersPageResponse extends PaginatedResponse<CustomerWithStats> {
  stats: CustomerStatsSummary;
}

export interface PromoStatsSummary {
  totalPromos: number;
  activeCount: number;
  scheduledCount?: number;
  expiredCount?: number;
  inactiveCount?: number;
  totalPromoProducts: number;
  avgDiscount: number;
}

export interface PromosPageResponse extends PaginatedResponse<PromoCampaign> {
  stats: PromoStatsSummary;
}

export interface PromoCouponValidationResult {
  valid: boolean;
  promo: PromoCampaign;
  grossSubtotal: number;
  eligibleSubtotal: number;
  discountAmount: number;
  netSubtotal: number;
  eligibleProductIds: number[];
}

export interface CategoryStatsItem {
  count: number;
  totalStok: number;
  totalGram: number;
  directCount?: number;
  directStok?: number;
  directGram?: number;
  childrenCount?: number;
}

export interface CategoriesWithStatsResponse {
  categories: string[];
  items?: CategoryItem[];
  stats: Record<string, CategoryStatsItem>;
  categoryCreatedAt?: Record<string, string>;
  totalUniqueProducts?: number;
  totalUniqueStok?: number;
}

export interface DashboardTopItem {
  name: string;
  subtitle?: string;
  qty: number;
  sales: number;
}

export interface DashboardPaymentBreakdownItem {
  key: string;
  label: string;
  amount: number;
  count: number;
  percent: number;
}

export interface DashboardSummaryResponse {
  period: 'HARI' | 'BULAN';
  displayTotalPenjualan: number;
  displayPenjualanKotor: number;
  displayLabaKotor: number;
  displayPenerimaan: number;
  displayTransaksi: number;
  displayProduk: number;
  totalTax?: number;
  enablePpn?: boolean;
  ppnPercent?: number;
  marginPercent?: number;
  avgPerTransaksi?: number;
  cashPercent?: number;
  transferPercent?: number;
  voidCount?: number;
  activeSkuCount?: number;
  lowStockCount?: number;
  activeLabels: string[];
  salesData: number[];
  trxData: number[];
  topProducts?: DashboardTopItem[];
  topCategories?: DashboardTopItem[];
  paymentBreakdown?: DashboardPaymentBreakdownItem[];
}

export type UserRole = 'owner' | 'branch_manager' | 'cashier';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  shiftLabel: string;
  allowedTenantIds: string[];
  defaultTenantId?: string;
  isActive: boolean;
  themePreference?: ThemeMode;
  createdAt: string;
  lastLoginAt?: string;
}

export interface UserCreatePayload {
  username: string;
  email: string;
  fullName: string;
  password: string;
  role: UserRole;
  shiftLabel: string;
  allowedTenantIds: string[];
  defaultTenantId?: string;
  isActive: boolean;
  themePreference?: ThemeMode;
}

export interface UserUpdatePayload {
  email?: string;
  fullName?: string;
  password?: string;
  role?: UserRole;
  shiftLabel?: string;
  allowedTenantIds?: string[];
  defaultTenantId?: string;
  isActive?: boolean;
  themePreference?: ThemeMode;
}

export interface UsersPageResponse extends PaginatedResponse<UserAccount> {
  stats: {
    totalUsers: number;
    activeUsers: number;
    ownerCount?: number;
    managerCount: number;
    cashierCount: number;
  };
}

export interface AuthLoginResponse {
  csrfToken: string;
  user: UserAccount;
  tenants: Tenant[];
  activeTenantId: string;
}

export type AppThemeId =
  | 'zinc_classic'
  | 'ocean_slate'
  | 'emerald_mint'
  | 'rose_blossom'
  | 'indigo_night'
  | 'espresso_cream';

export type ReceiptPaperSize = 'a5' | 'a6' | '80mm';
export type ReceiptTheme =
  | 'classic_gold'
  | 'royal_emerald'
  | 'midnight_navy'
  | 'rose_gold'
  | 'monochrome';
export type ReceiptLogoPreset = 'monogram' | 'bag' | 'sparkles' | 'custom' | 'none' | 'crown' | 'diamond';

export interface StoreSettings {
  tenantId: string;
  ppnPercent: number;
  enablePpn: boolean;
  appTheme: AppThemeId;
  goldPrice24kBuyback: number;
  goldPrice22kBuyback: number;
  goldPrice18kBuyback: number;
  goldPrice16kBuyback: number;
  receiptTagline: string;
  receiptFooterNote: string;
  receiptSaleTitle: string;
  receiptBuybackTitle: string;
  receiptHeaderExtra: string;
  receiptTheme: ReceiptTheme;
  receiptDefaultPaperSize: ReceiptPaperSize;
  receiptLogoPreset: ReceiptLogoPreset;
  receiptCustomLogoUrl: string;
  receiptShowWatermark: boolean;
  receiptWatermarkOpacity: number;
  receiptShowStoreAddress: boolean;
  receiptShowBarcode: boolean;
  receiptShowQrCode: boolean;
  receiptShowPhoto: boolean;
  receiptShowItemSku: boolean;
  receiptShowTaxLine: boolean;
  receiptShowCashierName: boolean;
  receiptShowTerms: boolean;
  receiptTermsTitle: string;
  receiptTermsText: string;
  receiptShowSignatures: boolean;
  receiptSignatureGreeting: string;
  receiptCustomerSignLabel: string;
  receiptCashierSignLabel: string;
  autoPrintReceipt: boolean;
  requireCustomerOnSale: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export interface StoreSettingsUpdatePayload {
  tenantProfile?: {
    name?: string;
    branchName?: string;
    address?: string;
    city?: string;
    phone?: string;
    email?: string;
    status?: 'Aktif' | 'Trial' | 'Nonaktif';
  };
  settings: Partial<Omit<StoreSettings, 'tenantId' | 'updatedAt' | 'updatedBy'>>;
}

export interface ShiftLiveSummary {
  date: string;
  scope: 'my' | 'outlet';
  cashierName?: string;
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
  netCashMovement: number;
  alreadyClosedCount: number;
}

export interface ShiftClosingRecord {
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
  notes?: string;
  status: 'closed';
  closedAt: string;
}

export interface ShiftClosingCreatePayload {
  shiftDate: string;
  shiftLabel?: string;
  scope?: 'my' | 'outlet';
  openingCash: number;
  actualCash: number;
  notes?: string;
}

export interface ShiftClosingsPageResponse extends PaginatedResponse<ShiftClosingRecord> {
  stats: {
    totalClosings: number;
    exactMatchCount: number;
    totalRecordedSales: number;
    totalVariance: number;
  };
}

export interface BootstrapPayload {
  csrfToken?: string;
  user: UserAccount;
  categories: string[];
  categoryDetails?: CategoryItem[];
  tenants: Tenant[];
  activeTenantId: string;
  activePromos: PromoCampaign[];
  storeSettings: StoreSettings;
}

export type AuditSeverity = 'info' | 'warning' | 'critical';

export type AuditEntityType =
  | 'auth'
  | 'transaction'
  | 'product'
  | 'category'
  | 'promo'
  | 'tenant'
  | 'user'
  | 'settings'
  | 'backup';

export interface AuditLogRecord {
  id: string;
  tenantId?: string;
  tenantName?: string;
  actorId?: string;
  actorName: string;
  actorRole: UserRole | 'system';
  action: string;
  entityType: AuditEntityType | string;
  entityId?: string;
  entityLabel?: string;
  severity: AuditSeverity;
  summary: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface AuditLogsStatsSummary {
  totalLogs: number;
  todayLogs: number;
  warningAndCriticalLogs: number;
  uniqueActors: number;
}

export interface AuditLogsPageResponse extends PaginatedResponse<AuditLogRecord> {
  stats: AuditLogsStatsSummary;
}

export interface BackupTableStat {
  tableName: string;
  label: string;
  rowCount: number;
}

export interface BackupDatabaseInfo {
  fileName: string;
  fileSizeBytes: number;
  walSizeBytes: number;
  journalMode: string;
  totalRecords: number;
  tables: BackupTableStat[];
  lastBackupAt?: string;
  lastBackupBy?: string;
  lastBackupFormat?: string;
  generatedAt: string;
}
