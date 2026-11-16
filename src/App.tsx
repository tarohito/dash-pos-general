import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { GoogleIcon } from './components/common/GoogleIcon';
import { TooltipProvider } from './components/Tooltip';
import { useToast } from './contexts/ToastContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { PosView } from './components/pos/PosView';
import { PrintableReceipt } from './components/pos/PrintableReceipt';
import { ScanFeedbackToast } from './components/pos/ScanFeedbackToast';
import { FallbackView } from './components/common/FallbackView';
import { LoginPage } from './components/auth/LoginPage';

import {
  AppThemeId,
  AuthLoginResponse,
  Product,
  CartItem,
  Transaction,
  PromoCampaign,
  Tenant,
  UserAccount,
  UserRole,
  StoreSettings,
  ReceiptPaperSize,
} from './types';
import { APP_THEME_STORAGE_KEY, normalizeAppTheme } from './constants/themes';
import { playScannerBeep, playCashRegisterChime } from './utils/audio';
import { extractBarcodeValue } from './utils/barcode';
import {
  clearAuthToken,
  getAuthToken,
  posApi,
  setUnauthorizedHandler,
} from './services/api';

// Code splitting (Lazy load secondary views & modals so Kasir POS initial load is fast & lightweight)
const DashboardView = lazy(() =>
  import('./components/dashboard/DashboardView').then(m => ({ default: m.DashboardView }))
);
const DailyTransactionsView = lazy(() =>
  import('./components/transactions/DailyTransactionsView').then(m => ({ default: m.DailyTransactionsView }))
);
const PromoManagementView = lazy(() =>
  import('./components/promo/PromoManagementView').then(m => ({ default: m.PromoManagementView }))
);
const ProductListView = lazy(() =>
  import('./components/inventory/ProductListView').then(m => ({ default: m.ProductListView }))
);
const CategoryListView = lazy(() =>
  import('./components/inventory/CategoryListView').then(m => ({ default: m.CategoryListView }))
);
const TenantManagementView = lazy(() =>
  import('./components/tenant/TenantManagementView').then(m => ({ default: m.TenantManagementView }))
);
const UserManagementView = lazy(() =>
  import('./components/users/UserManagementView').then(m => ({ default: m.UserManagementView }))
);
const StoreSettingsView = lazy(() =>
  import('./components/settings/StoreSettingsView').then(m => ({ default: m.StoreSettingsView }))
);

function getInitialStoredTheme(): AppThemeId {
  try {
    return normalizeAppTheme(localStorage.getItem(APP_THEME_STORAGE_KEY));
  } catch {
    return 'zinc_classic';
  }
}

const DEFAULT_STORE_SETTINGS: StoreSettings = {
  tenantId: 'tenant-tms-001',
  ppnPercent: 11,
  enablePpn: true,
  appTheme: getInitialStoredTheme(),
  goldPrice24kBuyback: 2350000,
  goldPrice22kBuyback: 1950000,
  goldPrice18kBuyback: 1420000,
  goldPrice16kBuyback: 1180000,
  receiptTagline: '',
  receiptFooterNote: 'Terima kasih telah berbelanja di {TOKO}.',
  receiptSaleTitle: '',
  receiptBuybackTitle: 'SURAT PEMBELIAN KEMBALI',
  receiptHeaderExtra: '',
  receiptTheme: 'midnight_navy',
  receiptDefaultPaperSize: 'a5',
  receiptLogoPreset: 'monogram',
  receiptCustomLogoUrl: '',
  receiptShowWatermark: false,
  receiptWatermarkOpacity: 6,
  receiptShowStoreAddress: true,
  receiptShowBarcode: false,
  receiptShowQrCode: false,
  receiptShowPhoto: false,
  receiptShowItemSku: false,
  receiptShowTaxLine: true,
  receiptShowCashierName: true,
  receiptShowTerms: false,
  receiptTermsTitle: 'Catatan:',
  receiptTermsText: [
    'Simpan struk ini sebagai bukti pembayaran yang sah dari {TOKO}.',
    'Penukaran produk dalam kemasan tersegel berlaku maksimal 3 hari.',
  ].join('\n'),
  receiptShowSignatures: false,
  receiptSignatureGreeting: 'Hormat Kami,',
  receiptCustomerSignLabel: 'Pelanggan',
  receiptCashierSignLabel: 'Kasir',
  autoPrintReceipt: false,
  requireCustomerOnSale: false,
  updatedAt: '',
};

const BarcodeScannerModal = lazy(() =>
  import('./components/pos/BarcodeScannerModal').then(m => ({ default: m.BarcodeScannerModal }))
);
const PaymentModal = lazy(() =>
  import('./components/pos/PaymentModal').then(m => ({ default: m.PaymentModal }))
);
const ReceiptModal = lazy(() =>
  import('./components/pos/ReceiptModal').then(m => ({ default: m.ReceiptModal }))
);
const AddProductModal = lazy(() =>
  import('./components/inventory/AddProductModal').then(m => ({ default: m.AddProductModal }))
);
const AddCategoryModal = lazy(() =>
  import('./components/inventory/AddCategoryModal').then(m => ({ default: m.AddCategoryModal }))
);
const RegisterTenantModal = lazy(() =>
  import('./components/tenant/RegisterTenantModal').then(m => ({ default: m.RegisterTenantModal }))
);

const ViewLoadingFallback: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-zinc-200 p-8 text-zinc-500 min-h-[280px]">
    <GoogleIcon name="progress_activity" size={24} className="animate-spin text-primary mb-2" />
    <p className="text-xs font-medium text-zinc-500">Memuat tampilan...</p>
  </div>
);

function isMenuAllowedForRole(menu: string, role: UserRole): boolean {
  if (menu === 'Manajemen User') return role === 'owner';
  if (
    menu === 'Dashboard' ||
    menu === 'Promo' ||
    menu === 'Daftar Kategori' ||
    menu === 'Multi-Outlet' ||
    menu === 'Multi-Tenant' ||
    menu === 'Multi-Tenant & Outlet' ||
    menu === 'Pengaturan'
  ) {
    return role === 'owner' || role === 'branch_manager';
  }
  return true;
}

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Navigation & Layout State
  const [activeMenu, setActiveMenu] = useState('Kasir POS (Penjualan)');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProdukExpanded, setIsProdukExpanded] = useState(true);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [activeMenu]);

  // Lightweight bootstrap metadata state (full tables are paginated per-view)
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string>('tenant-tms-001');
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [receiptPaperSize, setReceiptPaperSize] = useState<ReceiptPaperSize>('a5');

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-app-theme');
  }, []);

  useEffect(() => {
    if (storeSettings.updatedAt) {
      try {
        localStorage.setItem(APP_THEME_STORAGE_KEY, normalizeAppTheme(storeSettings.appTheme));
      } catch {
        // Abaikan jika storage tidak tersedia
      }
    }
  }, [storeSettings.appTheme, storeSettings.updatedAt]);

  useEffect(() => {
    if (storeSettings.receiptDefaultPaperSize) {
      setReceiptPaperSize(storeSettings.receiptDefaultPaperSize);
    }
  }, [storeSettings.receiptDefaultPaperSize, storeSettings.tenantId]);

  // View-level invalidation counters so only active/affected views refresh from SQLite
  const [productsRefreshKey, setProductsRefreshKey] = useState(0);
  const [categoriesRefreshKey, setCategoriesRefreshKey] = useState(0);
  const [transactionsRefreshKey, setTransactionsRefreshKey] = useState(0);
  const [promosRefreshKey, setPromosRefreshKey] = useState(0);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  // Toast feedback state from global ToastContext
  const { showToast } = useToast();

  const resetAuthSession = useCallback(() => {
    clearAuthToken();
    setCurrentUser(null);
    setCart([]);
    setCustomerName('Pelanggan Umum');
    setIsAdminMenuOpen(false);
    setIsPaymentModalOpen(false);
    setIsReceiptModalOpen(false);
    setIsAddProductModalOpen(false);
    setIsAddCategoryModalOpen(false);
    setIsRegisterTenantOpen(false);
    setIsScanModalOpen(false);
    setIsCheckingAuth(false);
    setIsLoadingData(false);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(resetAuthSession);
    return () => setUnauthorizedHandler(null);
  }, [resetAuthSession]);

  // Load lightweight bootstrap metadata (authenticated user, categories, accessible tenants, active tenant)
  const fetchBootstrapData = useCallback(async () => {
    if (!getAuthToken()) {
      setCurrentUser(null);
      setIsCheckingAuth(false);
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    setLoadError(null);
    try {
      const data = await posApi.bootstrap();
      setCurrentUser(data.user);
      setCategories(data.categories);
      setTenants(data.tenants);
      setActiveTenantId(data.activeTenantId);
      if (data.storeSettings) {
        setStoreSettings(data.storeSettings);
      }
      setActiveMenu(prev =>
        isMenuAllowedForRole(prev, data.user.role) ? prev : 'Kasir POS (Penjualan)'
      );
    } catch (err) {
      if (!getAuthToken()) {
        setCurrentUser(null);
      } else {
        const msg = err instanceof Error ? err.message : 'Gagal memuat data dari database SQLite.';
        setLoadError(msg);
        showToast('error', msg);
      }
    } finally {
      setIsCheckingAuth(false);
      setIsLoadingData(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchBootstrapData();
  }, [fetchBootstrapData]);

  // Preload secondary views in background after login during idle time for instant tab switching
  useEffect(() => {
    if (!currentUser) return;
    const idleTimer = window.setTimeout(() => {
      void import('./components/inventory/ProductListView');
      void import('./components/transactions/DailyTransactionsView');
      void import('./components/users/UserManagementView');
      void import('./components/inventory/CategoryListView');
      void import('./components/promo/PromoManagementView');
      void import('./components/settings/StoreSettingsView');
      void import('./components/dashboard/DashboardView');
      void import('./components/tenant/TenantManagementView');
    }, 400);
    return () => window.clearTimeout(idleTimer);
  }, [currentUser]);

  const handleLoginSuccess = useCallback(
    async (auth: AuthLoginResponse) => {
      setCurrentUser(auth.user);
      setTenants(auth.tenants);
      setActiveTenantId(auth.activeTenantId);
      setActiveMenu('Kasir POS (Penjualan)');
      setCart([]);
      setCustomerName('Pelanggan Umum');
      // Fetch fresh categories and settings silently in background without full-screen loading flash
      try {
        const data = await posApi.bootstrap();
        setCategories(data.categories);
        setTenants(data.tenants);
        setActiveTenantId(data.activeTenantId);
        if (data.storeSettings) {
          setStoreSettings(data.storeSettings);
        }
      } catch {
        // Fallback silently if bootstrap background fetch fails
      }
    },
    []
  );

  const handleLogout = useCallback(async () => {
    await posApi.logout();
    resetAuthSession();
    showToast('success', 'Anda telah keluar dari sesi.');
  }, [resetAuthSession, showToast]);

  // Multi-Tenant CRUD
  const [isRegisterTenantOpen, setIsRegisterTenantOpen] = useState(false);
  const activeTenant = tenants.find(t => t.id === activeTenantId) || tenants[0];

  const refreshActiveOutletViews = useCallback(() => {
    setProductsRefreshKey(k => k + 1);
    setCategoriesRefreshKey(k => k + 1);
    setTransactionsRefreshKey(k => k + 1);
    setPromosRefreshKey(k => k + 1);
    setDashboardRefreshKey(k => k + 1);
  }, []);

  const refreshTenantsMetadata = useCallback(async () => {
    try {
      const latest = await posApi.getTenants();
      setTenants(latest);
    } catch {
      // Abaikan jika refresh metadata tenant gagal sementara
    }
  }, []);

  const handleSelectTenant = async (tenantId: string) => {
    if (tenantId === activeTenantId) return;
    const prevId = activeTenantId;
    setActiveTenantId(tenantId);
    try {
      await posApi.setActiveTenant(tenantId);
      setCart([]);
      setCustomerName('Pelanggan Umum');
      refreshActiveOutletViews();
      void refreshTenantsMetadata();
      void posApi.getStoreSettings().then(res => setStoreSettings(res.storeSettings)).catch(() => {});
      const selected = tenants.find(t => t.id === tenantId);
      showToast('success', `Berhasil beralih ke outlet "${selected?.name || tenantId}".`);
    } catch (err) {
      setActiveTenantId(prevId);
      showToast('error', err instanceof Error ? err.message : 'Gagal memilih outlet aktif.');
    }
  };

  const handleRegisterTenant = async (newTenant: Tenant) => {
    try {
      const created = await posApi.registerTenant(newTenant);
      setTenants(prev => [created, ...prev]);
      setActiveTenantId(created.id);
      setCart([]);
      setCustomerName('Pelanggan Umum');
      refreshActiveOutletViews();
      void posApi.getStoreSettings().then(res => setStoreSettings(res.storeSettings)).catch(() => {});
      setIsRegisterTenantOpen(false);
      showToast('success', `Outlet "${created.name}" berhasil didaftarkan & diaktifkan.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mendaftarkan outlet.');
      throw err;
    }
  };

  // Promo CRUD
  const handleSavePromo = async (savedPromo: PromoCampaign, isEdit?: boolean) => {
    try {
      if (isEdit) {
        const updated = await posApi.updatePromo(savedPromo.id, savedPromo);
        showToast('success', `Promo "${updated.name}" diperbarui.`);
      } else {
        const created = await posApi.createPromo(savedPromo);
        showToast('success', `Promo "${created.name}" ditambahkan.`);
      }
      setPromosRefreshKey(k => k + 1);
      setProductsRefreshKey(k => k + 1);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan promo.');
      throw err;
    }
  };

  const handleDeletePromo = async (id: string) => {
    try {
      await posApi.deletePromo(id);
      setPromosRefreshKey(k => k + 1);
      setProductsRefreshKey(k => k + 1);
      showToast('success', 'Promo berhasil dihapus.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menghapus promo.');
      throw err;
    }
  };

  const handleTogglePromoStatus = async (id: string) => {
    try {
      const updated = await posApi.togglePromoStatus(id);
      setPromosRefreshKey(k => k + 1);
      setProductsRefreshKey(k => k + 1);
      showToast(
        'success',
        updated.isActive
          ? `Promo "${updated.name}" diaktifkan.`
          : `Promo "${updated.name}" dinonaktifkan.`
      );
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mengubah status promo.');
    }
  };

  // Cart & POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [scanCount, setScanCount] = useState(0);
  const [scanFeedback, setScanFeedback] = useState<{ product: Product; time: string } | null>(null);

  // Payment & Receipts Modals State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('Pelanggan Umum');
  const [selectedReceipt, setSelectedReceipt] = useState<Transaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Inventory Modals State (Create & Edit)
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.harga * item.qty, 0), [cart]);
  const tax = useMemo(
    () => (storeSettings.enablePpn ? Math.round(subtotal * (storeSettings.ppnPercent / 100)) : 0),
    [subtotal, storeSettings.enablePpn, storeSettings.ppnPercent]
  );
  const taxLabel = useMemo(
    () => (storeSettings.enablePpn ? `PPN (${storeSettings.ppnPercent}%)` : 'PPN (0% / Non-PKP)'),
    [storeSettings.enablePpn, storeSettings.ppnPercent]
  );
  const grandTotal = useMemo(() => subtotal + tax, [subtotal, tax]);

  const triggerIsolatedPrint = useCallback((modeClass: 'printing-sale') => {
    document.body.classList.remove('printing-sale', 'printing-buyback', 'printing-shift', 'printing-barcode');
    document.body.classList.add(modeClass);
    const cleanup = () => {
      document.body.classList.remove(modeClass);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
        setTimeout(cleanup, 1200);
      }, 80);
    });
  }, []);

  const handlePrintSaleReceipt = useCallback(() => {
    triggerIsolatedPrint('printing-sale');
  }, [triggerIsolatedPrint]);

  // Cart Handlers
  const handleAddToCart = useCallback(
    (product: Product) => {
      if (product.stok <= 0) {
        showToast('error', `Stok produk ${product.name} habis.`);
        return;
      }

      setCart(prev => {
        const existing = prev.find(item => item.id === product.id);
        if (existing) {
          if (existing.qty >= product.stok) {
            showToast('error', `Jumlah melebihi stok yang tersedia (${product.stok} pcs).`);
            return prev;
          }
          return prev.map(item => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
        }
        return [...prev, { ...product, qty: 1 }];
      });
    },
    [showToast]
  );

  const handleUpdateQty = (id: number, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.id === id) {
            const maxStok = item.stok;
            const newQty = item.qty + delta;
            if (delta > 0 && newQty > maxStok) {
              showToast('error', `Jumlah maksimal sesuai stok adalah ${maxStok} pcs.`);
              return item;
            }
            return newQty > 0 ? { ...item, qty: newQty } : item;
          }
          return item;
        })
        .filter(item => item.qty > 0)
    );
  };

  const handleRemoveItem = (id: number) => {
    const removed = cart.find(c => c.id === id);
    setCart(prev => prev.filter(item => item.id !== id));
    if (removed) {
      showToast('success', `"${removed.name}" dihapus dari keranjang.`);
    }
  };

  const handleClearCart = () => {
    setCart([]);
    showToast('success', 'Keranjang pesanan berhasil dikosongkan.');
  };

  // Indexed SQLite Lookup for Barcode / SKU / QR / Name Scan
  const handleAutoScanCode = useCallback(
    async (code: string): Promise<Product | null> => {
      const clean = extractBarcodeValue(code);
      if (!clean) {
        showToast('warning', 'Masukkan kode barcode atau SKU produk terlebih dahulu.');
        return null;
      }

      try {
        const found = await posApi.lookupProductByCode(clean);
        if (found.stok <= 0) {
          showToast('error', `Stok produk "${found.name}" (${found.sku}) sedang habis.`);
          return null;
        }
        handleAddToCart(found);
        playScannerBeep(isSoundEnabled);
        setScanCount(prev => prev + 1);
        setScanFeedback({
          product: found,
          time: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        });
        setTimeout(() => setScanFeedback(null), 3000);
        setSearchQuery('');
        return found;
      } catch (err) {
        showToast(
          'error',
          err instanceof Error ? err.message : `Kode barcode / SKU "${clean}" tidak ditemukan.`
        );
        return null;
      }
    },
    [handleAddToCart, isSoundEnabled, showToast]
  );

  // Global Hardware Barcode Scanner Listener
  useEffect(() => {
    if (!currentUser) return;
    let scanBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const now = Date.now();
      const interval = now - lastKeyTime;
      lastKeyTime = now;

      const targetTag = (e.target as HTMLElement | null)?.tagName;
      const isInputFocused =
        targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT';

      if (e.key === 'Enter') {
        if (scanBuffer.length >= 3) {
          e.preventDefault();
          void handleAutoScanCode(scanBuffer.trim());
        } else if (!isInputFocused && searchQuery.trim()) {
          void handleAutoScanCode(searchQuery.trim());
        }
        scanBuffer = '';
      } else if (e.key.length === 1) {
        if (interval > 80) {
          scanBuffer = e.key;
        } else {
          scanBuffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser, searchQuery, handleAutoScanCode]);

  // Payment Confirmation Handler (SQLite Atomic Checkout + Stock Deduction)
  const handleConfirmPayment = async (paymentData: {
    method: 'cash' | 'debit' | 'transfer' | 'qris';
    cashReceived?: number;
    debitBank?: string;
    debitCardLast4?: string;
    debitApprovalCode?: string;
    transferBank?: string;
    transferRef?: string;
  }) => {
    try {
      const result = await posApi.createTransaction({
        cashier: currentUser?.fullName || 'Kasir',
        customerName: customerName.trim() || 'Pelanggan Umum',
        items: cart.map(item => ({ id: item.id, qty: item.qty })),
        paymentMethod: paymentData.method,
        paymentDetails: {
          cashReceived: paymentData.cashReceived,
          debitBank: paymentData.debitBank,
          debitCardLast4: paymentData.debitCardLast4,
          debitApprovalCode: paymentData.debitApprovalCode,
          transferBank: paymentData.transferBank,
          transferRef: paymentData.transferRef,
        },
      });

      setCart([]);
      setCustomerName('Pelanggan Umum');
      setProductsRefreshKey(k => k + 1);
      setTransactionsRefreshKey(k => k + 1);
      setDashboardRefreshKey(k => k + 1);
      playCashRegisterChime(isSoundEnabled);
      setIsPaymentModalOpen(false);
      setSelectedReceipt(result.transaction);
      setIsReceiptModalOpen(true);
      showToast('success', `Transaksi ${result.transaction.invoiceNo} berhasil disimpan.`);
      if (storeSettings.autoPrintReceipt) {
        setTimeout(() => {
          handlePrintSaleReceipt();
        }, 250);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal memproses pembayaran.');
      throw err;
    }
  };

  // Transaction Void (Immutable Financial Ledger — Edit & Hard Delete Prohibited)
  const handleVoidTransaction = async (id: string, reason: string, restoreStock: boolean) => {
    try {
      const voided = await posApi.voidTransaction(id, { reason, restoreStock });
      setTransactionsRefreshKey(k => k + 1);
      if (restoreStock) {
        setProductsRefreshKey(k => k + 1);
      }
      setDashboardRefreshKey(k => k + 1);
      showToast(
        'success',
        restoreStock
          ? `Transaksi ${voided.invoiceNo} di-void & stok barang dikembalikan ke inventaris.`
          : `Transaksi ${voided.invoiceNo} berhasil di-void.`
      );
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mem-void transaksi.');
      throw err;
    }
  };

  // Inventory Product CRUD
  const handleSaveProduct = async (productData: Omit<Product, 'id'>, editId?: number) => {
    try {
      if (editId !== undefined) {
        const updated = await posApi.updateProduct(editId, productData);
        if (!categories.includes(updated.category)) {
          setCategories(prev => [...prev, updated.category]);
        }
        setProductsRefreshKey(k => k + 1);
        setCategoriesRefreshKey(k => k + 1);
        setDashboardRefreshKey(k => k + 1);
        setEditingProduct(null);
        setIsAddProductModalOpen(false);
        showToast('success', `Barang "${updated.name}" berhasil diperbarui.`);
      } else {
        const created = await posApi.createProduct(productData);
        if (!categories.includes(created.category)) {
          setCategories(prev => [...prev, created.category]);
        }
        setProductsRefreshKey(k => k + 1);
        setCategoriesRefreshKey(k => k + 1);
        setDashboardRefreshKey(k => k + 1);
        void refreshTenantsMetadata();
        setIsAddProductModalOpen(false);
        showToast('success', `Barang "${created.name}" ditambahkan ke inventaris.`);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan data barang.');
      throw err;
    }
  };

  const handleDeleteProduct = async (id: number) => {
    try {
      await posApi.deleteProduct(id);
      setCart(prev => prev.filter(c => c.id !== id));
      setProductsRefreshKey(k => k + 1);
      setCategoriesRefreshKey(k => k + 1);
      setDashboardRefreshKey(k => k + 1);
      void refreshTenantsMetadata();
      showToast('success', 'Barang berhasil dihapus dari inventaris.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menghapus barang.');
      throw err;
    }
  };

  // Inventory Category CRUD
  const handleSaveCategory = async (categoryName: string, oldName?: string) => {
    try {
      if (oldName) {
        const res = await posApi.renameCategory(oldName, categoryName);
        setCategories(res.categories);
        setCategoriesRefreshKey(k => k + 1);
        setProductsRefreshKey(k => k + 1);
        setEditingCategory(null);
        setIsAddCategoryModalOpen(false);
        showToast('success', `Kategori "${oldName}" diubah menjadi "${res.newName}".`);
      } else {
        const res = await posApi.createCategory(categoryName);
        setCategories(res.categories);
        setCategoriesRefreshKey(k => k + 1);
        setIsAddCategoryModalOpen(false);
        showToast('success', `Kategori "${res.name}" berhasil ditambahkan.`);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan kategori.');
      throw err;
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    try {
      const res = await posApi.deleteCategory(categoryName);
      setCategories(res.categories);
      setCategoriesRefreshKey(k => k + 1);
      showToast('success', `Kategori "${categoryName}" berhasil dihapus.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menghapus kategori.');
      throw err;
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white rounded-xl border border-zinc-200 px-8 py-6 flex flex-col items-center">
          <GoogleIcon name="progress_activity" size={28} className="animate-spin text-primary mb-3" />
          <p className="text-sm font-semibold text-zinc-700">Memeriksa sesi login...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const isOwner = currentUser.role === 'owner';
  const canManageOperations = currentUser.role === 'owner' || currentUser.role === 'branch_manager';

  const handleGuardedSelectMenu = (menu: string) => {
    if (!isMenuAllowedForRole(menu, currentUser.role)) {
      showToast('warning', 'Menu tersebut hanya dapat diakses oleh Owner atau Kepala Cabang.');
      return;
    }
    setActiveMenu(menu);
  };

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col h-full h-[100dvh] font-sans overflow-hidden bg-white text-zinc-800">
        {/* Main Horizontal Shell: Full-height Sidebar + Inset Rounded Content Container */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar */}
          <Sidebar
            activeMenu={activeMenu}
            onSelectMenu={handleGuardedSelectMenu}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isProdukExpanded={isProdukExpanded}
            onToggleProdukExpanded={() => {
              if (isSidebarCollapsed) {
                setIsSidebarCollapsed(false);
                setIsProdukExpanded(true);
              } else {
                setIsProdukExpanded(!isProdukExpanded);
              }
            }}
            tenants={tenants}
            activeTenantId={activeTenantId}
            onSelectTenant={handleSelectTenant}
            onOpenRegisterModal={() => setIsRegisterTenantOpen(true)}
            userRole={currentUser.role}
            currentUser={currentUser}
            onLogout={handleLogout}
          />

          {/* Right Outer Frame: Selalu fixed & overflow-hidden agar background kontainer tidak ikut discroll */}
          <div className="flex-1 min-h-0 min-w-0 flex flex-col px-2 pt-2 pb-0 sm:px-3 sm:pt-3 sm:pb-0 lg:pl-2 lg:pr-3 lg:pt-2.5 overflow-hidden">
            <div className="main-content-shell flex-1 min-h-0 flex flex-col rounded-t-2xl sm:rounded-t-[22px] rounded-b-none border-t border-x border-b-0 overflow-hidden relative bg-zinc-50 border-zinc-200/80">
              {/* Background Gradient: Terkunci fix di atas, tidak bisa di-scroll */}
              <div
                aria-hidden="true"
                className="main-container-top-gradient pointer-events-none absolute inset-x-0 top-0 h-52 sm:h-64 z-0 rounded-t-2xl sm:rounded-t-[22px]"
              />

              {/* Mobile Drawer Top Header: Terkunci di atas */}
              <Header
                onSelectMenu={handleGuardedSelectMenu}
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              />

              {/* Main Content Area: Hanya konten di dalam sini yang bergulir */}
              <main
                ref={mainScrollRef}
                className={`relative z-10 flex-1 min-h-0 flex flex-col px-3.5 sm:px-5 lg:px-6 pt-4 sm:pt-5 lg:pt-6 ${
                  !isLoadingData &&
                  !loadError &&
                  (activeMenu === 'Kasir POS (Penjualan)' || activeMenu === 'Kasir POS')
                    ? 'pb-2.5 sm:pb-3.5 lg:pb-4 overflow-hidden'
                    : 'pb-20 sm:pb-8 overflow-y-auto overflow-x-hidden'
                }`}
              >
                {isLoadingData ? (
                  <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-zinc-200 p-8 text-zinc-500">
                    <GoogleIcon name="progress_activity" size={28} className="animate-spin text-primary mb-3" />
                    <p className="text-sm font-semibold text-zinc-700">Memuat data dari database SQLite...</p>
                  </div>
                ) : loadError ? (
                  <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-red-200 p-8 text-center">
                    <GoogleIcon name="error" size={32} className="text-red-500 mb-2" />
                    <p className="text-sm font-bold text-zinc-900">Gagal terhubung ke database SQLite</p>
                    <p className="text-xs text-zinc-500 mt-1 mb-4">{loadError}</p>
                    <button
                      type="button"
                      onClick={fetchBootstrapData}
                      className="h-9 px-4 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-full cursor-pointer transition-colors"
                    >
                      Coba Muat Ulang
                    </button>
                  </div>
                ) : activeMenu === 'Kasir POS (Penjualan)' || activeMenu === 'Kasir POS' ? (
                  <PosView
                    categories={categories}
                    refreshTrigger={productsRefreshKey}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onAutoScanCode={handleAutoScanCode}
                    onOpenScanModal={() => setIsScanModalOpen(true)}
                    cart={cart}
                    onAddToCart={handleAddToCart}
                    onUpdateQty={handleUpdateQty}
                    onRemoveItem={handleRemoveItem}
                    onClearCart={handleClearCart}
                    subtotal={subtotal}
                    tax={tax}
                    taxLabel={taxLabel}
                    grandTotal={grandTotal}
                    onOpenPaymentModal={() => setIsPaymentModalOpen(true)}
                  />
                ) : (
                  <Suspense fallback={<ViewLoadingFallback />}>
                    {activeMenu === 'Transaksi' || activeMenu === 'Transaksi Harian' ? (
                      <DailyTransactionsView
                        refreshTrigger={transactionsRefreshKey}
                        onSelectReceipt={tx => {
                          setSelectedReceipt(tx);
                          setIsReceiptModalOpen(true);
                        }}
                        onVoidTransaction={handleVoidTransaction}
                        onNavigateToPos={() => setActiveMenu('Kasir POS (Penjualan)')}
                        canVoid={canManageOperations}
                      />
                    ) : activeMenu === 'Promo' && canManageOperations ? (
                      <PromoManagementView
                        refreshTrigger={promosRefreshKey}
                        storeName={activeTenant?.name}
                        onSavePromo={handleSavePromo}
                        onDeletePromo={handleDeletePromo}
                        onTogglePromoStatus={handleTogglePromoStatus}
                      />
                    ) : activeMenu === 'Daftar Barang' ? (
                      <ProductListView
                        refreshTrigger={productsRefreshKey}
                        onOpenAddModal={() => {
                          setEditingProduct(null);
                          setIsAddProductModalOpen(true);
                        }}
                        onEditProduct={product => {
                          setEditingProduct(product);
                          setIsAddProductModalOpen(true);
                        }}
                        onDeleteProduct={handleDeleteProduct}
                        canManageInventory={canManageOperations}
                      />
                    ) : activeMenu === 'Daftar Kategori' && canManageOperations ? (
                      <CategoryListView
                        refreshTrigger={categoriesRefreshKey}
                        onOpenAddCategoryModal={() => {
                          setEditingCategory(null);
                          setIsAddCategoryModalOpen(true);
                        }}
                        onEditCategory={cat => {
                          setEditingCategory(cat);
                          setIsAddCategoryModalOpen(true);
                        }}
                        onDeleteCategory={handleDeleteCategory}
                      />
                    ) : activeMenu === 'Dashboard' && canManageOperations ? (
                      <DashboardView
                        refreshTrigger={dashboardRefreshKey}
                        activeTenant={activeTenant}
                        onNavigateTo={handleGuardedSelectMenu}
                        onOpenRegisterTenant={() => setIsRegisterTenantOpen(true)}
                      />
                    ) : (activeMenu === 'Multi-Tenant & Outlet' ||
                        activeMenu === 'Multi-Outlet' ||
                        activeMenu === 'Multi-Tenant') &&
                      canManageOperations ? (
                      <TenantManagementView
                        tenants={tenants}
                        activeTenantId={activeTenantId}
                        onSelectTenant={handleSelectTenant}
                        onOpenRegisterModal={() => setIsRegisterTenantOpen(true)}
                        onNavigateToPos={() => setActiveMenu('Kasir POS (Penjualan)')}
                        canCreateOutlet={isOwner}
                      />
                    ) : activeMenu === 'Manajemen User' && isOwner ? (
                      <UserManagementView
                        currentUser={currentUser}
                        tenants={tenants}
                        onUpdateCurrentUser={setCurrentUser}
                      />
                    ) : activeMenu === 'Pengaturan' && canManageOperations ? (
                      <StoreSettingsView
                        activeTenant={activeTenant}
                        storeSettings={storeSettings}
                        userRole={currentUser.role}
                        onSettingsSaved={({ tenant, storeSettings: saved }) => {
                          setTenants(prev => prev.map(t => (t.id === tenant.id ? tenant : t)));
                          setStoreSettings(saved);
                        }}
                      />
                    ) : (
                      <FallbackView title={activeMenu} onBackToPos={() => setActiveMenu('Kasir POS (Penjualan)')} />
                    )}
                  </Suspense>
                )}
                  </main>
            </div>
          </div>
        </div>

        {/* Bottom Navigation for Tablet & Mobile (lg:hidden) */}
        <nav className="lg:hidden shrink-0 border-t px-1.5 sm:px-3 py-0.5 flex items-center justify-around z-30 min-h-[48px] bg-white border-zinc-200 text-zinc-700">
          <button
            type="button"
            onClick={() => setActiveMenu('Kasir POS (Penjualan)')}
            className={`flex flex-col items-center justify-center py-0.5 px-1.5 rounded-lg transition-colors min-w-[48px] min-h-[40px] cursor-pointer active:scale-95 ${
              activeMenu === 'Kasir POS (Penjualan)' || activeMenu === 'Kasir POS'
                ? 'text-primary font-semibold bg-primary/12'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <div className="relative">
              <GoogleIcon
                name="shopping_cart"
                size={18}
                filled={activeMenu === 'Kasir POS (Penjualan)' || activeMenu === 'Kasir POS'}
                className={
                  activeMenu === 'Kasir POS (Penjualan)' || activeMenu === 'Kasir POS'
                    ? 'text-primary'
                    : 'text-zinc-500'
                }
              />
              {cart.reduce((a, b) => a + b.qty, 0) > 0 && (
                <span className="absolute -top-1 -right-2.5 w-4 h-4 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center font-mono">
                  {cart.reduce((a, b) => a + b.qty, 0)}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold mt-0.5 leading-none">Kasir</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMenu('Transaksi')}
            className={`flex flex-col items-center justify-center py-0.5 px-1.5 rounded-lg transition-all min-w-[48px] min-h-[40px] cursor-pointer active:scale-95 ${
              activeMenu === 'Transaksi' || activeMenu === 'Transaksi Harian'
                ? 'text-primary font-semibold bg-primary/12'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <GoogleIcon
              name="receipt_long"
              size={18}
              filled={activeMenu === 'Transaksi' || activeMenu === 'Transaksi Harian'}
              className={
                activeMenu === 'Transaksi' || activeMenu === 'Transaksi Harian'
                  ? 'text-primary'
                  : 'text-zinc-500'
              }
            />
            <span className="text-xs font-semibold mt-0.5 leading-none">Transaksi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMenu('Daftar Barang')}
            className={`flex flex-col items-center justify-center py-0.5 px-1.5 rounded-lg transition-all min-w-[48px] min-h-[40px] cursor-pointer active:scale-95 ${
              activeMenu === 'Daftar Barang'
                ? 'text-primary font-semibold bg-primary/12'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <GoogleIcon
              name="shopping_bag"
              size={18}
              filled={activeMenu === 'Daftar Barang'}
              className={activeMenu === 'Daftar Barang' ? 'text-primary' : 'text-zinc-500'}
            />
            <span className="text-xs font-semibold mt-0.5 leading-none">Barang</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(false)}
            className="flex flex-col items-center justify-center py-0.5 px-1.5 rounded-lg transition-all text-zinc-500 hover:text-zinc-900 min-w-[48px] min-h-[40px] cursor-pointer active:scale-95"
          >
            <GoogleIcon name="menu" size={18} />
            <span className="text-xs font-semibold mt-0.5 leading-none">Menu</span>
          </button>
        </nav>

        {/* Lazy Global Modals (only loaded on demand when opened) */}
        <Suspense fallback={null}>
          {isScanModalOpen && (
            <BarcodeScannerModal
              isOpen={isScanModalOpen}
              onClose={() => setIsScanModalOpen(false)}
              onScanCode={handleAutoScanCode}
              isSoundEnabled={isSoundEnabled}
              onToggleSound={() => setIsSoundEnabled(!isSoundEnabled)}
              scanCount={scanCount}
              totalCartQty={cart.reduce((acc, it) => acc + it.qty, 0)}
            />
          )}

          {isPaymentModalOpen && (
            <PaymentModal
              isOpen={isPaymentModalOpen}
              onClose={() => setIsPaymentModalOpen(false)}
              cart={cart}
              subtotal={subtotal}
              tax={tax}
              taxLabel={taxLabel}
              grandTotal={grandTotal}
              customerName={customerName}
              onCustomerChange={cust => {
                setCustomerName(cust.name);
              }}
              onConfirmPayment={handleConfirmPayment}
            />
          )}

          {isReceiptModalOpen && (
            <ReceiptModal
              isOpen={isReceiptModalOpen}
              onClose={() => setIsReceiptModalOpen(false)}
              receipt={selectedReceipt}
              activeTenant={activeTenant}
              storeSettings={storeSettings}
              paperSize={receiptPaperSize}
              onPaperSizeChange={setReceiptPaperSize}
              onPrint={handlePrintSaleReceipt}
              onViewDailyTransactions={() => setActiveMenu('Transaksi')}
            />
          )}

          {isAddProductModalOpen && (
            <AddProductModal
              isOpen={isAddProductModalOpen}
              onClose={() => {
                setIsAddProductModalOpen(false);
                setEditingProduct(null);
              }}
              categories={categories}
              editingProduct={editingProduct}
              onSaveProduct={handleSaveProduct}
            />
          )}

          {isAddCategoryModalOpen && (
            <AddCategoryModal
              isOpen={isAddCategoryModalOpen}
              onClose={() => {
                setIsAddCategoryModalOpen(false);
                setEditingCategory(null);
              }}
              editingCategory={editingCategory}
              onSaveCategory={handleSaveCategory}
            />
          )}

          {isRegisterTenantOpen && (
            <RegisterTenantModal
              isOpen={isRegisterTenantOpen}
              onClose={() => setIsRegisterTenantOpen(false)}
              onSaveTenant={handleRegisterTenant}
            />
          )}
        </Suspense>

        <ScanFeedbackToast feedback={scanFeedback} />

        {/* Hidden Printable Elements for Thermal Printer (@media print) */}
        <PrintableReceipt
          receipt={selectedReceipt}
          activeTenant={activeTenant}
          storeSettings={storeSettings}
          paperSize={receiptPaperSize}
        />
      </div>
    </TooltipProvider>
  );
};

export default App;
