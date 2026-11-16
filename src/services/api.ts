import type {
  AuthLoginResponse,
  BootstrapPayload,
  BroadcastCustomerAudienceItem,
  BroadcastRecipientStatus,
  BuybackCreatePayload,
  BuybackItem,
  BuybacksPageResponse,
  CategoriesWithStatsResponse,
  CategoryItem,
  CategoryPayload,
  Customer,
  CustomersPageResponse,
  DashboardSummaryResponse,
  PaymentDetails,
  Product,
  ProductsPageResponse,
  PromoBroadcastConfig,
  PromoBroadcastCreatePayload,
  PromoBroadcastRecord,
  PromoCampaign,
  PromoCouponValidationResult,
  PromosPageResponse,
  ShiftClosingCreatePayload,
  ShiftClosingRecord,
  ShiftClosingsPageResponse,
  ShiftLiveSummary,
  StoreSettings,
  StoreSettingsUpdatePayload,
  Tenant,
  Transaction,
  TransactionExportFormat,
  TransactionExportPeriod,
  TransactionExportPreview,
  TransactionExportStatus,
  TransactionsPageResponse,
  UserAccount,
  UserCreatePayload,
  UsersPageResponse,
  UserUpdatePayload,
} from '../types';

const LEGACY_AUTH_TOKEN_KEY = 'epaper_auth_token';
const MUTATING_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Keep CSRF & optional iframe-cookie-blocked fallback ONLY in private module RAM (never localStorage/sessionStorage/cookie)
let memoryCsrfToken: string | null = null;
let memoryFallbackToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

// Clean up any legacy token previously stored in localStorage
try {
  window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
} catch {
  // Ignore if storage unavailable
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function clearClientSessionState(): void {
  memoryCsrfToken = null;
  memoryFallbackToken = null;
  try {
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  } catch {
    // Ignore if storage unavailable
  }
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') {
      sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string> | undefined) ?? {}),
  };

  if (memoryFallbackToken && !headers['X-Session-Token']) {
    headers['X-Session-Token'] = memoryFallbackToken;
  }

  if (MUTATING_HTTP_METHODS.has(method) && memoryCsrfToken && !headers['X-CSRF-Token']) {
    headers['X-CSRF-Token'] = memoryCsrfToken;
  }

  const res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth/login')) {
      clearClientSessionState();
      unauthorizedHandler?.();
    }
    const message = (data as { error?: string }).error || `Request gagal (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const posApi = {
  // Authentication & Session (HttpOnly Cookie + In-Memory CSRF Synchronizer Token)
  login: async (identifier: string, password: string): Promise<AuthLoginResponse> => {
    memoryFallbackToken = null;
    const rawRes = await requestJson<AuthLoginResponse & { fallbackToken?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    memoryCsrfToken = rawRes.csrfToken || null;

    // Verify whether the browser accepted and returns the HttpOnly session cookie
    if (rawRes.fallbackToken) {
      try {
        const probe = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (probe.ok) {
          // HttpOnly cookie works — discard fallback token so JS holds zero session tokens
          memoryFallbackToken = null;
        } else {
          // Browser/iframe blocked cookies — hold token strictly in private closure RAM (never localStorage)
          memoryFallbackToken = rawRes.fallbackToken;
        }
      } catch {
        memoryFallbackToken = rawRes.fallbackToken;
      }
      delete rawRes.fallbackToken;
    }

    return rawRes;
  },
  logout: async (): Promise<void> => {
    try {
      await requestJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    } catch {
      // Tetap bersihkan state CSRF lokal meskipun sesi server sudah berakhir
    } finally {
      clearClientSessionState();
    }
  },
  getMe: async () => {
    const res = await requestJson<{ csrfToken?: string; user: UserAccount; tenants: Tenant[]; activeTenantId: string }>(
      '/api/auth/me'
    );
    if (res.csrfToken) {
      memoryCsrfToken = res.csrfToken;
    }
    return res;
  },

  bootstrap: async () => {
    const res = await requestJson<BootstrapPayload>('/api/bootstrap');
    if (res.csrfToken) {
      memoryCsrfToken = res.csrfToken;
    }
    return res;
  },

  // Users CRUD (Owner only)
  getUsers: (
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      role?: string;
      status?: 'all' | 'active' | 'inactive';
      tenantId?: string;
      shift?: 'all' | 'shift_1' | 'shift_2' | 'full_day';
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
    } = {},
    signal?: AbortSignal
  ) =>
    requestJson<UsersPageResponse>(
      `/api/users${toQueryString({
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
        search: params.search,
        role: params.role,
        status: params.status && params.status !== 'all' ? params.status : undefined,
        tenantId: params.tenantId && params.tenantId !== 'all' ? params.tenantId : undefined,
        shift: params.shift && params.shift !== 'all' ? params.shift : undefined,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      })}`,
      { signal }
    ),
  createUser: (payload: UserCreatePayload) =>
    requestJson<UserAccount>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateUser: (id: string, payload: UserUpdatePayload) =>
    requestJson<UserAccount>(`/api/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteUser: (id: string) =>
    requestJson<{ deletedId: string }>(`/api/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Dashboard Summary (Server-side aggregation)
  getDashboardSummary: (period: 'HARI' | 'BULAN', signal?: AbortSignal) =>
    requestJson<DashboardSummaryResponse>(`/api/dashboard/summary?period=${period}`, { signal }),

  // Products (Paginated + Lookup)
  getProducts: (
    params: {
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
    } = {},
    signal?: AbortSignal
  ) =>
    requestJson<ProductsPageResponse>(
      `/api/products${toQueryString({
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
        search: params.search,
        category: params.category,
        brand: params.brand && params.brand !== 'Semua' ? params.brand : undefined,
        promoOnly: params.promoOnly ? 'true' : undefined,
        filterTab: params.filterTab,
        statusFilter: params.statusFilter && params.statusFilter !== 'all' ? params.statusFilter : undefined,
        stockFilter: params.stockFilter && params.stockFilter !== 'all' ? params.stockFilter : undefined,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      })}`,
      { signal }
    ),
  lookupProductByCode: (code: string) =>
    requestJson<Product>(`/api/products/lookup${toQueryString({ code })}`),
  checkProductSku: (sku: string, excludeId?: number, signal?: AbortSignal) =>
    requestJson<{
      available: boolean;
      sku: string;
      conflictProduct?: { id: number; name: string; sku: string };
    }>(
      `/api/products/check-sku${toQueryString({
        sku,
        excludeId: excludeId !== undefined ? excludeId : undefined,
      })}`,
      { signal }
    ),
  getNextUniqueSku: (category: string, currentSku?: string, signal?: AbortSignal) =>
    requestJson<{ sku: string }>(
      `/api/products/next-sku${toQueryString({
        category,
        currentSku: currentSku || undefined,
      })}`,
      { signal }
    ),
  createProduct: (product: Omit<Product, 'id'>) =>
    requestJson<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(product),
    }),
  updateProduct: (id: number, product: Partial<Omit<Product, 'id'>>) =>
    requestJson<Product>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    }),
  deleteProduct: (id: number) =>
    requestJson<{ deletedId: number }>(`/api/products/${id}`, {
      method: 'DELETE',
    }),

  // Categories
  getCategoriesWithStats: (signal?: AbortSignal) =>
    requestJson<CategoriesWithStatsResponse>('/api/categories?withStats=true', { signal }),
  getCategoryDetails: (signal?: AbortSignal) =>
    requestJson<CategoryItem[]>('/api/categories?detailed=true', { signal }),
  createCategory: (payload: string | CategoryPayload) => {
    const body: CategoryPayload = typeof payload === 'string' ? { name: payload } : payload;
    return requestJson<{
      name: string;
      item: CategoryItem;
      categories: string[];
      categoryDetails: CategoryItem[];
    }>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateCategory: (oldName: string, payload: CategoryPayload) =>
    requestJson<{
      oldName: string;
      newName: string;
      item: CategoryItem;
      categories: string[];
      categoryDetails: CategoryItem[];
    }>(`/api/categories/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  renameCategory: (oldName: string, newName: string) =>
    requestJson<{
      oldName: string;
      newName: string;
      item: CategoryItem;
      categories: string[];
      categoryDetails: CategoryItem[];
    }>(`/api/categories/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      body: JSON.stringify({ name: newName }),
    }),
  toggleCategoryStatus: (name: string, isActive: boolean) =>
    requestJson<{
      item: CategoryItem;
      categories: string[];
      categoryDetails: CategoryItem[];
    }>(`/api/categories/${encodeURIComponent(name)}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),
  deleteCategory: (name: string) =>
    requestJson<{
      deletedName: string;
      categories: string[];
      categoryDetails: CategoryItem[];
    }>(`/api/categories/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    }),

  // Transactions (Paginated)
  getTransactions: (
    params: {
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
    } = {},
    signal?: AbortSignal
  ) =>
    requestJson<TransactionsPageResponse>(
      `/api/transactions${toQueryString({
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
        search: params.search,
        method: params.method,
        status: params.status && params.status !== 'all' ? params.status : undefined,
        cashier: params.cashier && params.cashier !== 'all' ? params.cashier : undefined,
        promoFilter: params.promoFilter && params.promoFilter !== 'all' ? params.promoFilter : undefined,
        dateFrom: params.dateFrom || undefined,
        dateTo: params.dateTo || undefined,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      })}`,
      { signal }
    ),
  getTransactionById: (id: string) =>
    requestJson<Transaction>(`/api/transactions/${encodeURIComponent(id)}`),
  createTransaction: (payload: {
    cashier: string;
    customerId?: string;
    customerName: string;
    items: Array<{ id: number; qty: number }>;
    paymentMethod: 'cash' | 'debit' | 'transfer' | 'qris';
    paymentDetails: PaymentDetails;
    promoCode?: string;
  }) =>
    requestJson<{ transaction: Transaction }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  voidTransaction: (id: string, payload: { reason?: string; restoreStock?: boolean } = {}) =>
    requestJson<Transaction>(`/api/transactions/${encodeURIComponent(id)}/void`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getTransactionsExportPreview: (
    params: {
      period: TransactionExportPeriod;
      month?: number;
      year?: number;
      date?: string;
      dateFrom?: string;
      dateTo?: string;
      method?: string;
      statusFilter?: TransactionExportStatus;
      search?: string;
      format?: TransactionExportFormat;
    },
    signal?: AbortSignal
  ) =>
    requestJson<TransactionExportPreview>(
      `/api/transactions/export-preview${toQueryString({
        period: params.period,
        month: params.month,
        year: params.year,
        date: params.date,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        method: params.method,
        statusFilter: params.statusFilter,
        search: params.search,
        format: params.format,
      })}`,
      { signal }
    ),
  downloadTransactionsExport: async (params: {
    period: TransactionExportPeriod;
    month?: number;
    year?: number;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    method?: string;
    statusFilter?: TransactionExportStatus;
    search?: string;
    format?: TransactionExportFormat;
  }): Promise<{ blob: Blob; filename: string }> => {
    const url = `/api/transactions/export${toQueryString({
      period: params.period,
      month: params.month,
      year: params.year,
      date: params.date,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      method: params.method,
      statusFilter: params.statusFilter,
      search: params.search,
      format: params.format,
    })}`;
    const headers: Record<string, string> = {};
    if (memoryFallbackToken) {
      headers['X-Session-Token'] = memoryFallbackToken;
    }
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers,
    });
    if (!res.ok) {
      if (res.status === 401) {
        clearClientSessionState();
        unauthorizedHandler?.();
      }
      const errData = await res.json().catch(() => ({}));
      throw new ApiError((errData as { error?: string }).error || `Ekspor gagal (${res.status})`, res.status);
    }
    const headerName = res.headers.get('X-Export-Filename');
    const disp = res.headers.get('Content-Disposition') || '';
    const dispMatch = /filename="?([^"]+)"?/i.exec(disp);
    const filename = headerName || dispMatch?.[1] || `Laporan_Transaksi.${params.format ?? 'xlsx'}`;
    const blob = await res.blob();
    return { blob, filename };
  },

  // Buybacks (Paginated lightweight list + On-demand detail)
  getBuybacks: (
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      method?: string;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
    } = {},
    signal?: AbortSignal
  ) =>
    requestJson<BuybacksPageResponse>(
      `/api/buybacks${toQueryString({
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
        search: params.search,
        method: params.method,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      })}`,
      { signal }
    ),
  getBuybackById: (id: string) =>
    requestJson<BuybackItem>(`/api/buybacks/${encodeURIComponent(id)}`),
  createBuyback: (payload: BuybackCreatePayload) =>
    requestJson<BuybackItem>('/api/buybacks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  voidBuyback: (id: string, payload: { reason?: string } = {}) =>
    requestJson<BuybackItem>(`/api/buybacks/${encodeURIComponent(id)}/void`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Customers (Paginated)
  getCustomers: (
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      type?: string;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
    } = {},
    signal?: AbortSignal
  ) =>
    requestJson<CustomersPageResponse>(
      `/api/customers${toQueryString({
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
        search: params.search,
        type: params.type,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      })}`,
      { signal }
    ),
  createCustomer: (payload: Customer) =>
    requestJson<Customer>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCustomer: (id: string, payload: Partial<Customer>) =>
    requestJson<Customer>(`/api/customers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteCustomer: (id: string) =>
    requestJson<{ deletedId: string }>(`/api/customers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Promos (Paginated)
  getPromos: (
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: string;
      discountRange?: 'all' | 'under_10' | '10_to_15' | 'over_15';
      minPurchaseFilter?: 'all' | 'no_min' | 'has_min';
      scopeFilter?: 'all' | 'selected_sku' | 'all_sku';
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
    } = {},
    signal?: AbortSignal
  ) =>
    requestJson<PromosPageResponse>(
      `/api/promos${toQueryString({
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
        search: params.search,
        status: params.status,
        discountRange: params.discountRange && params.discountRange !== 'all' ? params.discountRange : undefined,
        minPurchaseFilter:
          params.minPurchaseFilter && params.minPurchaseFilter !== 'all' ? params.minPurchaseFilter : undefined,
        scopeFilter: params.scopeFilter && params.scopeFilter !== 'all' ? params.scopeFilter : undefined,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      })}`,
      { signal }
    ),
  createPromo: (payload: PromoCampaign) =>
    requestJson<PromoCampaign>('/api/promos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePromo: (id: string, payload: Partial<PromoCampaign>) =>
    requestJson<PromoCampaign>(`/api/promos/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  togglePromoStatus: (id: string) =>
    requestJson<PromoCampaign>(`/api/promos/${encodeURIComponent(id)}/toggle`, {
      method: 'PATCH',
    }),
  deletePromo: (id: string) =>
    requestJson<{ deletedId: string }>(`/api/promos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  getActivePromos: (signal?: AbortSignal) =>
    requestJson<PromoCampaign[]>('/api/promos/active', { signal }),
  validatePromoCode: (code: string, items: Array<{ id: number; qty: number }>) =>
    requestJson<PromoCouponValidationResult>('/api/promos/validate', {
      method: 'POST',
      body: JSON.stringify({ code, items }),
    }),
  getPromoBroadcastConfig: (signal?: AbortSignal) =>
    requestJson<PromoBroadcastConfig>('/api/promos/broadcast-config', { signal }),
  getPromoBroadcastAudience: (signal?: AbortSignal) =>
    requestJson<BroadcastCustomerAudienceItem[]>('/api/promos/broadcast-audience', { signal }),
  getPromoBroadcasts: (signal?: AbortSignal) =>
    requestJson<PromoBroadcastRecord[]>('/api/promos/broadcasts', { signal }),
  getPromoBroadcastById: (broadcastId: string, signal?: AbortSignal) =>
    requestJson<PromoBroadcastRecord>(`/api/promos/broadcasts/${encodeURIComponent(broadcastId)}`, { signal }),
  createPromoBroadcast: (promoId: string, payload: PromoBroadcastCreatePayload) =>
    requestJson<PromoBroadcastRecord>(`/api/promos/${encodeURIComponent(promoId)}/broadcast`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePromoBroadcastRecipient: (
    broadcastId: string,
    recipientId: string,
    status: BroadcastRecipientStatus,
    errorMessage?: string
  ) =>
    requestJson<PromoBroadcastRecord>(
      `/api/promos/broadcasts/${encodeURIComponent(broadcastId)}/recipients/${encodeURIComponent(recipientId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, errorMessage }),
      }
    ),
  cancelPromoBroadcast: (broadcastId: string) =>
    requestJson<PromoBroadcastRecord>(
      `/api/promos/broadcasts/${encodeURIComponent(broadcastId)}/cancel`,
      {
        method: 'POST',
      }
    ),

  // Tenants
  getTenants: () => requestJson<Tenant[]>('/api/tenants'),
  registerTenant: (payload: Tenant) =>
    requestJson<Tenant>('/api/tenants', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTenant: (id: string, payload: Partial<Tenant>) =>
    requestJson<Tenant>(`/api/tenants/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  toggleTenantStatus: (id: string, status: 'Aktif' | 'Nonaktif') =>
    requestJson<Tenant>(`/api/tenants/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteTenant: (id: string) =>
    requestJson<{ deletedId: string }>(`/api/tenants/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  setActiveTenant: (tenantId: string) =>
    requestJson<{ activeTenantId: string }>('/api/tenants/active', {
      method: 'PATCH',
      body: JSON.stringify({ tenantId }),
    }),

  // Store Settings (Tahap 3)
  getStoreSettings: (signal?: AbortSignal) =>
    requestJson<{ tenant: Tenant | null; storeSettings: StoreSettings }>('/api/settings', { signal }),
  updateStoreSettings: (payload: StoreSettingsUpdatePayload) =>
    requestJson<{ tenant: Tenant; storeSettings: StoreSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Shift Closing / Rekap Shift (Tahap 3)
  getShiftSummary: (params: { date?: string; scope?: 'my' | 'outlet' } = {}, signal?: AbortSignal) =>
    requestJson<ShiftLiveSummary>(
      `/api/shifts/summary${toQueryString({
        date: params.date,
        scope: params.scope,
      })}`,
      { signal }
    ),
  getShiftClosings: (
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      varianceFilter?: string;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
    } = {},
    signal?: AbortSignal
  ) =>
    requestJson<ShiftClosingsPageResponse>(
      `/api/shifts${toQueryString({
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
        search: params.search,
        varianceFilter: params.varianceFilter,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      })}`,
      { signal }
    ),
  closeShift: (payload: ShiftClosingCreatePayload) =>
    requestJson<ShiftClosingRecord>('/api/shifts/close', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

