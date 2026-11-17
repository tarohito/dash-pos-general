import http from 'http';
import express from 'express';
import compression from 'compression';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  BuybackCreatePayload,
  CategoryPayload,
  Customer,
  PaymentDetails,
  Product,
  PromoCampaign,
  ShiftClosingCreatePayload,
  StoreSettingsUpdatePayload,
  Tenant,
  Transaction,
  TransactionExportFormat,
  TransactionExportPeriod,
  TransactionExportStatus,
  TransactionItem,
  UserAccount,
  UserCreatePayload,
  UserRole,
  UserUpdatePayload,
} from './src/types/index.ts';
import {
  authenticateUser,
  checkLoginRateLimit,
  checkProductSkuAvailability,
  clearLoginFailures,
  createCategoryItem,
  createDatabaseBackupSnapshot,
  createSession,
  createShiftClosing,
  createUserAccount,
  db,
  deleteCategoryItem,
  deleteSession,
  deleteUserAccount,
  exportStructuredBackupJson,
  generateNextMemberCode,
  generateUniqueProductSku,
  getAccessibleTenantsForUser,
  getActivePromos,
  getAllCategories,
  getAllCategoryItems,
  getAllTenants,
  getBackupDatabaseInfo,
  getBuybackById,
  getCategoriesWithStats,
  getDashboardSummary,
  getLiveShiftSummary,
  getSessionContext,
  getStoreSettings,
  getTransactionById,
  isTenantAllowedForUser,
  lookupProductByCode,
  parseProductAttributes,
  queryAuditLogs,
  queryBuybacks,
  queryCustomers,
  queryProducts,
  queryPromos,
  queryShiftClosings,
  queryTransactions,
  queryTransactionsForExport,
  queryUsers,
  recordAuditLog,
  recordLoginFailure,
  safeTimingEqual,
  seedInitialDataIfEmpty,
  syncExpiredPromos,
  toggleCategoryItemActive,
  updateCategoryItem,
  updateSessionTenant,
  updateStoreSettings,
  updateUserAccount,
  validatePromoCouponForCart,
} from './server/db.ts';
import {
  formatPromoDate,
  getTodayWibDateStr,
  isValidIsoDateStr,
} from './src/utils/promoDuration.ts';
import {
  buildExportFilename,
  buildExportPeriodLabel,
  generateTransactionsCsvString,
  generateTransactionsExcelBuffer,
} from './server/excelExport.ts';

// Seed SQLite on startup if empty
seedInitialDataIfEmpty();

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '15mb' }));

// Global HTTP security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "object-src 'none'; base-uri 'self'; form-action 'self';");
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

interface AuthContext {
  token: string;
  csrfToken: string;
  user: UserAccount;
  activeTenantId: string;
}

type AuthenticatedRequest = express.Request & { auth?: AuthContext };

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function extractTokenFromRequest(req: express.Request): string | null {
  // Primary: HttpOnly session cookie
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === 'string' && cookieHeader.length > 0) {
    for (const part of cookieHeader.split(';')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === 'epaper_session') {
        const val = decodeURIComponent(rest.join('=')).trim();
        if (val) return val;
      }
    }
  }

  // Fallback for cross-site iframes where browser blocks 3P/partitioned cookies:
  // Accept in-memory ephemeral token via X-Session-Token only on verified same-origin requests
  const headerToken = req.headers['x-session-token'];
  if (typeof headerToken === 'string' && headerToken.trim() && verifySameOriginRequest(req)) {
    return headerToken.trim();
  }

  return null;
}

function isHttpsRequest(req: express.Request): boolean {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim().toLowerCase();
  if (proto === 'https') return true;
  const origin = String(req.headers.origin ?? '').trim().toLowerCase();
  if (origin.startsWith('https://')) return true;
  const referer = String(req.headers.referer ?? '').trim().toLowerCase();
  if (referer.startsWith('https://')) return true;
  return false;
}

function buildSessionCookie(req: express.Request, value: string, maxAgeSec: number): string {
  const encoded = encodeURIComponent(value);
  if (isHttpsRequest(req)) {
    return `epaper_session=${encoded}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=${maxAgeSec}`;
  }
  return `epaper_session=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

function verifySameOriginRequest(req: express.Request): boolean {
  const secFetchSite = String(req.headers['sec-fetch-site'] ?? '').trim().toLowerCase();
  if (secFetchSite === 'cross-site') {
    return false;
  }

  const fwdHost = String(req.headers['x-forwarded-host'] ?? '').split(',')[0].trim().toLowerCase();
  const rawHost = String(req.headers.host ?? '').trim().toLowerCase();
  const expectedHost = fwdHost || rawHost;
  if (!expectedHost) return true;

  const isInternalProxyHost =
    !fwdHost && (rawHost.startsWith('localhost:') || rawHost.startsWith('127.0.0.1:') || rawHost === 'localhost' || rawHost === '127.0.0.1');

  const originHeader = req.headers.origin;
  if (typeof originHeader === 'string' && originHeader.trim()) {
    try {
      const originUrl = new URL(originHeader.trim());
      if (isInternalProxyHost && originUrl.hostname !== 'localhost' && originUrl.hostname !== '127.0.0.1') {
        // Behind reverse proxy rewriting Host to localhost without X-Forwarded-Host: rely on Sec-Fetch-Site + JSON/CSRF checks
        return true;
      }
      return originUrl.host.toLowerCase() === expectedHost;
    } catch {
      return false;
    }
  }

  const refererHeader = req.headers.referer;
  if (typeof refererHeader === 'string' && refererHeader.trim()) {
    try {
      const refUrl = new URL(refererHeader.trim());
      if (isInternalProxyHost && refUrl.hostname !== 'localhost' && refUrl.hostname !== '127.0.0.1') {
        return true;
      }
      return refUrl.host.toLowerCase() === expectedHost;
    } catch {
      return false;
    }
  }

  return true;
}

function getClientIp(req: express.Request): string {
  const xff = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  return xff || req.ip || req.socket.remoteAddress || 'unknown';
}

function getAuth(req: express.Request): AuthContext {
  return (req as AuthenticatedRequest).auth!;
}

const requireAuth: express.RequestHandler = (req, res, next) => {
  const rawToken = extractTokenFromRequest(req);
  if (!rawToken) {
    res.status(401).json({ error: 'Silakan login terlebih dahulu untuk mengakses aplikasi.' });
    return;
  }
  const ctx = getSessionContext(rawToken, req.headers['user-agent']);
  if (!ctx) {
    res.setHeader('Set-Cookie', buildSessionCookie(req, '', 0));
    res.status(401).json({ error: 'Sesi login telah berakhir atau tidak valid. Silakan login kembali.' });
    return;
  }

  if (MUTATING_METHODS.has(req.method.toUpperCase())) {
    if (!verifySameOriginRequest(req)) {
      res.status(403).json({ error: 'Permintaan lintas-origin ditolak demi keamanan sesi.' });
      return;
    }
    const headerCsrf = String(req.headers['x-csrf-token'] ?? '').trim();
    if (!safeTimingEqual(headerCsrf, ctx.csrfToken)) {
      res.status(403).json({ error: 'Token keamanan CSRF tidak valid. Silakan muat ulang halaman.' });
      return;
    }
  }

  (req as AuthenticatedRequest).auth = ctx;
  next();
};

function requireRoles(...roles: UserRole[]): express.RequestHandler {
  return (req, res, next) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      res.status(401).json({ error: 'Autentikasi diperlukan.' });
      return;
    }
    if (!roles.includes(auth.user.role)) {
      res.status(403).json({ error: 'Anda tidak memiliki izin peran untuk melakukan tindakan ini.' });
      return;
    }
    next();
  };
}

// ============================================================
// AUTHENTICATION ROUTES (PUBLIC LOGIN / LOGOUT)
// ============================================================
app.post('/api/auth/login', (req, res) => {
  try {
    if (!verifySameOriginRequest(req)) {
      res.status(403).json({ error: 'Permintaan login lintas-origin ditolak.' });
      return;
    }
    if (!req.is('application/json')) {
      res.status(415).json({ error: 'Content-Type harus application/json.' });
      return;
    }

    const body = (req.body ?? {}) as { identifier?: unknown; username?: unknown; password?: unknown };
    const rawIdentifier = body.identifier ?? body.username;
    const rawPassword = body.password;

    if (typeof rawIdentifier !== 'string' || typeof rawPassword !== 'string') {
      res.status(400).json({ error: 'Format username/email dan kata sandi tidak valid.' });
      return;
    }

    const identifier = rawIdentifier.trim();
    const password = rawPassword;

    if (!identifier || !password) {
      res.status(400).json({ error: 'Username/email dan kata sandi wajib diisi.' });
      return;
    }

    if (identifier.length > 120 || password.length > 128) {
      res.status(400).json({ error: 'Panjang username atau kata sandi melebihi batas yang diizinkan.' });
      return;
    }

    const clientIp = getClientIp(req);
    const rateCheck = checkLoginRateLimit(identifier, clientIp);
    if (!rateCheck.allowed) {
      if (rateCheck.retryAfterSec) {
        res.setHeader('Retry-After', String(rateCheck.retryAfterSec));
      }
      recordAuditLog({
        actorName: identifier,
        actorRole: 'system',
        action: 'LOGIN_LOCKED',
        entityType: 'auth',
        entityLabel: identifier,
        severity: 'warning',
        summary: `Percobaan login diblokir sementara karena batas gagal terlampaui (${identifier})`,
        details: { identifier, retryAfterSec: rateCheck.retryAfterSec ?? null },
        ipAddress: clientIp,
      });
      res.status(429).json({
        error: rateCheck.message || 'Terlalu banyak percobaan login gagal. Silakan coba lagi nanti.',
      });
      return;
    }

    const user = authenticateUser(identifier, password);
    if (!user) {
      recordLoginFailure(identifier, clientIp);
      recordAuditLog({
        actorName: identifier,
        actorRole: 'system',
        action: 'LOGIN_FAILED',
        entityType: 'auth',
        entityLabel: identifier,
        severity: 'warning',
        summary: `Percobaan login gagal untuk kredensial "${identifier}"`,
        details: { identifier },
        ipAddress: clientIp,
      });
      res.status(401).json({ error: 'Username/email atau kata sandi salah, atau akun tidak aktif.' });
      return;
    }

    clearLoginFailures(identifier);

    // Session Rotation: invalidate any previous session cookie before issuing a new one
    const previousRawToken = extractTokenFromRequest(req);
    if (previousRawToken) {
      deleteSession(previousRawToken);
    }

    const { rawToken, csrfToken, activeTenantId } = createSession(user, req.headers['user-agent']);
    const tenants = getAccessibleTenantsForUser(user);

    recordAuditLog({
      tenantId: activeTenantId,
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'LOGIN_SUCCESS',
      entityType: 'auth',
      entityId: user.id,
      entityLabel: user.username,
      severity: 'info',
      summary: `${user.fullName} (${user.role}) berhasil login ke sistem`,
      details: { username: user.username, role: user.role, activeTenantId },
      ipAddress: clientIp,
    });

    res.setHeader('Set-Cookie', buildSessionCookie(req, rawToken, 7 * 24 * 3600));
    res.json({
      csrfToken,
      fallbackToken: rawToken,
      user,
      tenants,
      activeTenantId,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memproses login.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  try {
    if (!verifySameOriginRequest(req)) {
      res.status(403).json({ error: 'Permintaan logout lintas-origin ditolak.' });
      return;
    }

    const rawToken = extractTokenFromRequest(req);
    if (rawToken) {
      const ctx = getSessionContext(rawToken, req.headers['user-agent']);
      if (ctx) {
        const headerCsrf = String(req.headers['x-csrf-token'] ?? '').trim();
        if (!safeTimingEqual(headerCsrf, ctx.csrfToken)) {
          res.status(403).json({ error: 'Token keamanan CSRF tidak valid.' });
          return;
        }
        recordAuditLog({
          tenantId: ctx.activeTenantId,
          actorId: ctx.user.id,
          actorName: ctx.user.fullName,
          actorRole: ctx.user.role,
          action: 'LOGOUT',
          entityType: 'auth',
          entityId: ctx.user.id,
          entityLabel: ctx.user.username,
          severity: 'info',
          summary: `${ctx.user.fullName} keluar (logout) dari sesi`,
          ipAddress: getClientIp(req),
        });
      }
      deleteSession(rawToken);
    }

    res.setHeader('Set-Cookie', buildSessionCookie(req, '', 0));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal logout.' });
  }
});

// Require valid authenticated session (+ CSRF for mutating calls) for all remaining /api endpoints
app.use('/api', requireAuth);

app.get('/api/auth/me', (req, res) => {
  const auth = getAuth(req);
  res.json({
    csrfToken: auth.csrfToken,
    user: auth.user,
    tenants: getAccessibleTenantsForUser(auth.user),
    activeTenantId: auth.activeTenantId,
  });
});

// ============================================================
// BOOTSTRAP (LIGHTWEIGHT SHELL DATA ONLY)
// ============================================================
app.get('/api/bootstrap', (req, res) => {
  try {
    const auth = getAuth(req);
    res.json({
      csrfToken: auth.csrfToken,
      user: auth.user,
      categories: getAllCategories(),
      categoryDetails: getAllCategoryItems(),
      tenants: getAccessibleTenantsForUser(auth.user),
      activeTenantId: auth.activeTenantId,
      activePromos: getActivePromos(auth.activeTenantId),
      storeSettings: getStoreSettings(auth.activeTenantId),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat data awal dari SQLite.' });
  }
});

// ============================================================
// USER MANAGEMENT CRUD (OWNER ONLY)
// ============================================================
app.get('/api/users', requireRoles('owner'), (req, res) => {
  try {
    const page = Number(req.query.page ?? 1) || 1;
    const pageSize = Number(req.query.pageSize ?? 10) || 10;
    const search = String(req.query.search ?? '');
    const role = String(req.query.role ?? 'all');
    const rawStatus = String(req.query.status ?? 'all');
    const status = (['all', 'active', 'inactive'].includes(rawStatus) ? rawStatus : 'all') as
      | 'all'
      | 'active'
      | 'inactive';
    const tenantId = String(req.query.tenantId ?? 'all');
    const rawShift = String(req.query.shift ?? 'all');
    const shift = (['all', 'shift_1', 'shift_2', 'full_day'].includes(rawShift) ? rawShift : 'all') as
      | 'all'
      | 'shift_1'
      | 'shift_2'
      | 'full_day';
    const sortBy = String(req.query.sortBy ?? 'newest');
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
    res.json(queryUsers({ page, pageSize, search, role, status, tenantId, shift, sortBy, sortDir }));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat daftar pengguna.' });
  }
});

app.post('/api/users', requireRoles('owner'), (req, res) => {
  try {
    const auth = getAuth(req);
    const payload = req.body as UserCreatePayload;
    const created = createUserAccount(payload);
    recordAuditLog({
      tenantId: auth.activeTenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'CREATE_USER',
      entityType: 'user',
      entityId: created.id,
      entityLabel: `${created.fullName} (@${created.username})`,
      severity: 'info',
      summary: `Menambahkan akun pengguna baru "${created.fullName}" dengan peran ${created.role}`,
      details: { role: created.role, username: created.username, allowedTenantIds: created.allowedTenantIds },
      ipAddress: getClientIp(req),
    });
    res.status(201).json(created);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal membuat akun pengguna.';
    const status = msg.includes('sudah digunakan') ? 409 : 400;
    res.status(status).json({ error: msg });
  }
});

app.put('/api/users/:id', requireRoles('owner'), (req, res) => {
  try {
    const auth = getAuth(req);
    const payload = req.body as UserUpdatePayload;
    const prevRow = db.prepare('SELECT role, isActive FROM users WHERE id = ?').get(String(req.params.id)) as
      | { role: string; isActive: number }
      | undefined;
    const updated = updateUserAccount(String(req.params.id), payload, auth.user.id);
    const roleOrStatusChanged =
      (prevRow && prevRow.role !== updated.role) ||
      (prevRow && Boolean(prevRow.isActive) !== updated.isActive);
    recordAuditLog({
      tenantId: auth.activeTenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'UPDATE_USER',
      entityType: 'user',
      entityId: updated.id,
      entityLabel: `${updated.fullName} (@${updated.username})`,
      severity: roleOrStatusChanged ? 'warning' : 'info',
      summary: `Memperbarui akun "${updated.fullName}" (${updated.role}, ${updated.isActive ? 'Aktif' : 'Nonaktif'})`,
      details: { role: updated.role, isActive: updated.isActive, allowedTenantIds: updated.allowedTenantIds },
      ipAddress: getClientIp(req),
    });
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memperbarui akun pengguna.';
    const status = msg.includes('tidak ditemukan') ? 404 : msg.includes('sudah digunakan') ? 409 : 400;
    res.status(status).json({ error: msg });
  }
});

app.delete('/api/users/:id', requireRoles('owner'), (req, res) => {
  try {
    const auth = getAuth(req);
    const userId = String(req.params.id);
    const target = db.prepare('SELECT fullName, username, role FROM users WHERE id = ?').get(userId) as
      | { fullName: string; username: string; role: string }
      | undefined;
    deleteUserAccount(userId, auth.user.id);
    recordAuditLog({
      tenantId: auth.activeTenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'DELETE_USER',
      entityType: 'user',
      entityId: userId,
      entityLabel: target ? `${target.fullName} (@${target.username})` : userId,
      severity: 'critical',
      summary: `Menghapus permanen akun pengguna ${target ? `"${target.fullName}"` : userId}`,
      details: target ? { username: target.username, role: target.role } : undefined,
      ipAddress: getClientIp(req),
    });
    res.json({ deletedId: userId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menghapus akun pengguna.';
    const status = msg.includes('tidak ditemukan') ? 404 : 400;
    res.status(status).json({ error: msg });
  }
});

// ============================================================
// DASHBOARD SUMMARY (SERVER-SIDE AGGREGATION)
// ============================================================
app.get('/api/dashboard/summary', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const { activeTenantId } = getAuth(req);
    const period = req.query.period === 'BULAN' ? 'BULAN' : 'HARI';
    res.json(getDashboardSummary(period, activeTenantId));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat ringkasan dasbor.' });
  }
});

// ============================================================
// PRODUCTS CRUD & PAGINATION & BARCODE LOOKUP
// ============================================================
app.get('/api/products/check-sku', (req, res) => {
  try {
    const { activeTenantId } = getAuth(req);
    const sku = String(req.query.sku ?? '');
    const rawExcludeId = req.query.excludeId;
    const excludeId =
      rawExcludeId !== undefined && String(rawExcludeId).trim() !== ''
        ? Number(rawExcludeId)
        : undefined;
    res.json(
      checkProductSkuAvailability(
        sku,
        activeTenantId,
        excludeId !== undefined && Number.isInteger(excludeId) ? excludeId : undefined
      )
    );
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memeriksa ketersediaan SKU.' });
  }
});

app.get('/api/products/next-sku', (req, res) => {
  try {
    const { activeTenantId } = getAuth(req);
    const category = String(req.query.category ?? 'Parfum');
    const currentSku = req.query.currentSku ? String(req.query.currentSku) : undefined;
    res.json({ sku: generateUniqueProductSku(category, activeTenantId, currentSku) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal membuat SKU unik.' });
  }
});

app.get('/api/products/lookup', (req, res) => {
  try {
    const { activeTenantId } = getAuth(req);
    const code = String(req.query.code ?? '');
    const product = lookupProductByCode(code, activeTenantId);
    if (!product) {
      res.status(404).json({ error: 'Produk dengan kode/SKU tersebut tidak ditemukan.' });
      return;
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mencari produk.' });
  }
});

app.get('/api/products', (req, res) => {
  try {
    const { activeTenantId } = getAuth(req);
    const page = Number(req.query.page ?? 1) || 1;
    const pageSize = Number(req.query.pageSize ?? 10) || 10;
    const search = String(req.query.search ?? '');
    const category = String(req.query.category ?? 'Semua');
    const brand = String(req.query.brand ?? 'Semua');
    const promoOnly = req.query.promoOnly === 'true' || req.query.promoOnly === '1';
    const rawFilterTab = String(req.query.filterTab ?? '');
    const filterTab = (['all', 'active', 'inactive', 'promo', 'low_stock'].includes(rawFilterTab)
      ? rawFilterTab
      : promoOnly
      ? 'promo'
      : 'all') as 'all' | 'active' | 'inactive' | 'promo' | 'low_stock';
    const rawStatusFilter = String(req.query.statusFilter ?? 'all');
    const statusFilter = (['all', 'Aktif', 'Nonaktif'].includes(rawStatusFilter)
      ? rawStatusFilter
      : 'all') as 'all' | 'Aktif' | 'Nonaktif';
    const rawStockFilter = String(req.query.stockFilter ?? 'all');
    const stockFilter = (['all', 'available', 'low', 'out'].includes(rawStockFilter)
      ? rawStockFilter
      : 'all') as 'all' | 'available' | 'low' | 'out';
    const sortBy = String(req.query.sortBy ?? 'newest');
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
    res.json(
      queryProducts({
        page,
        pageSize,
        search,
        category,
        brand,
        promoOnly,
        filterTab,
        statusFilter,
        stockFilter,
        sortBy,
        sortDir,
        tenantId: activeTenantId,
      })
    );
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat produk.' });
  }
});

app.post('/api/products', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const tenantId = getAuth(req).activeTenantId;
    const body = req.body as Partial<Product>;
    const sku = (body.sku ?? '').trim().toUpperCase();
    const name = (body.name ?? '').trim();
    const category = (body.category ?? '').trim() || 'Parfum';
    const berat = Number(body.berat);
    const harga = Math.round(Number(body.harga));
    const hpp = body.hpp !== undefined && Number(body.hpp) >= 0 ? Math.round(Number(body.hpp)) : 0;
    const stok = Math.max(0, Math.round(Number(body.stok ?? 0)));
    const brand = (body.brand ?? 'No Brand').trim() || 'No Brand';
    const deskripsi = (body.deskripsi ?? '').trim();
    const panjang = Number(body.panjang) > 0 ? Number(body.panjang) : 0;
    const lebar = Number(body.lebar) > 0 ? Number(body.lebar) : 0;
    const tinggi = Number(body.tinggi) > 0 ? Number(body.tinggi) : 0;
    const status = body.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif';
    const image = (body.image ?? '').trim();

    if (!sku || !name) {
      res.status(400).json({ error: 'SKU dan nama produk wajib diisi.' });
      return;
    }
    if (!Number.isFinite(berat) || berat <= 0) {
      res.status(400).json({ error: 'Netto / berat produk harus lebih dari 0 gram.' });
      return;
    }
    if (!Number.isFinite(harga) || harga <= 0) {
      res.status(400).json({ error: 'Harga jual produk harus lebih dari Rp 0.' });
      return;
    }

    const existingSku = db
      .prepare('SELECT id, name FROM products WHERE tenantId = ? AND LOWER(sku) = LOWER(?)')
      .get(tenantId, sku) as { id: number; name: string } | undefined;
    if (existingSku) {
      res.status(409).json({
        error: `SKU "${sku}" sudah digunakan oleh produk "${existingSku.name}" di outlet ini. Silakan gunakan SKU lain.`,
      });
      return;
    }

    const rawAttrs = body.attributes;
    const cleanAttrs: Record<string, string> = {};
    if (rawAttrs && typeof rawAttrs === 'object' && !Array.isArray(rawAttrs)) {
      for (const [k, v] of Object.entries(rawAttrs)) {
        const ck = String(k).trim();
        const cv = String(v ?? '').trim();
        if (ck && cv) cleanAttrs[ck] = cv;
      }
    }
    const attributesJson = JSON.stringify(cleanAttrs);

    const createdAt = new Date().toISOString();
    const createTx = db.transaction(() => {
      db.prepare('INSERT OR IGNORE INTO categories (name, sortOrder, createdAt) VALUES (?, 99, ?)').run(category, createdAt);
      const info = db
        .prepare(`
          INSERT INTO products (
            tenantId, sku, name, berat, harga, hpp, stok, category, image,
            brand, deskripsi, panjang, lebar, tinggi, status, attributesJson, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          tenantId, sku, name, berat, harga, hpp, stok, category, image,
          brand, deskripsi, panjang, lebar, tinggi, status, attributesJson, createdAt
        );
      const row = db
        .prepare(`
          SELECT id, sku, name, berat, harga, COALESCE(hpp, 0) AS hpp, stok, category, image,
                 COALESCE(brand, 'No Brand') AS brand,
                 COALESCE(deskripsi, '') AS deskripsi,
                 COALESCE(panjang, 0) AS panjang,
                 COALESCE(lebar, 0) AS lebar,
                 COALESCE(tinggi, 0) AS tinggi,
                 COALESCE(status, 'Aktif') AS status,
                 COALESCE(attributesJson, '{}') AS attributesJson,
                 createdAt
          FROM products WHERE id = ?
        `)
        .get(info.lastInsertRowid) as Product & { attributesJson?: string };
      const { attributesJson: rowAttrs, ...rest } = row;
      return { ...rest, attributes: parseProductAttributes(rowAttrs) } as Product;
    });

    const created = createTx();
    const auth = getAuth(req);
    recordAuditLog({
      tenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'CREATE_PRODUCT',
      entityType: 'product',
      entityId: created.id,
      entityLabel: `${created.sku} • ${created.name}`,
      severity: 'info',
      summary: `Menambahkan produk "${created.name}" (${created.sku}) stok ${created.stok} pcs`,
      details: { sku: created.sku, category: created.category, harga: created.harga, stok: created.stok },
      ipAddress: getClientIp(req),
    });
    res.status(201).json(created);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan produk.';
    if (msg.includes('UNIQUE') || msg.includes('idx_products_tenant_sku_lower')) {
      res.status(409).json({ error: 'SKU / Kode Barcode sudah terdaftar pada produk lain di outlet ini.' });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

app.put('/api/products/:id', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const tenantId = getAuth(req).activeTenantId;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'ID produk tidak valid.' });
      return;
    }
    const existing = db
      .prepare('SELECT * FROM products WHERE id = ? AND tenantId = ?')
      .get(id, tenantId) as Product | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Produk tidak ditemukan di outlet aktif.' });
      return;
    }

    const body = req.body as Partial<Product>;
    const sku = (body.sku ?? existing.sku).trim().toUpperCase();
    const name = (body.name ?? existing.name).trim();
    const category = (body.category ?? existing.category).trim() || existing.category;
    const berat = body.berat !== undefined ? Number(body.berat) : existing.berat;
    const harga = body.harga !== undefined ? Math.round(Number(body.harga)) : existing.harga;
    const hpp = body.hpp !== undefined ? Math.max(0, Math.round(Number(body.hpp))) : (existing.hpp ?? 0);
    const stok = body.stok !== undefined ? Math.max(0, Math.round(Number(body.stok))) : existing.stok;
    const brand = body.brand !== undefined ? (body.brand.trim() || 'No Brand') : (existing.brand ?? 'No Brand');
    const deskripsi = body.deskripsi !== undefined ? body.deskripsi.trim() : (existing.deskripsi ?? '');
    const panjang = body.panjang !== undefined ? Math.max(0, Number(body.panjang)) : (existing.panjang ?? 0);
    const lebar = body.lebar !== undefined ? Math.max(0, Number(body.lebar)) : (existing.lebar ?? 0);
    const tinggi = body.tinggi !== undefined ? Math.max(0, Number(body.tinggi)) : (existing.tinggi ?? 0);
    const status = body.status !== undefined ? (body.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif') : (existing.status ?? 'Aktif');
    const image = body.image !== undefined ? body.image.trim() : existing.image;

    if (!sku || !name || !Number.isFinite(berat) || berat <= 0 || !Number.isFinite(harga) || harga <= 0) {
      res.status(400).json({ error: 'Data produk tidak lengkap atau tidak valid.' });
      return;
    }

    const duplicateSku = db
      .prepare('SELECT id, name FROM products WHERE tenantId = ? AND LOWER(sku) = LOWER(?) AND id != ?')
      .get(tenantId, sku, id) as { id: number; name: string } | undefined;
    if (duplicateSku) {
      res.status(409).json({
        error: `SKU "${sku}" sudah digunakan oleh produk "${duplicateSku.name}" di outlet ini. Silakan gunakan SKU lain.`,
      });
      return;
    }

    let attributesJson = (existing as Product & { attributesJson?: string }).attributesJson ?? '{}';
    if (body.attributes !== undefined) {
      const cleanAttrs: Record<string, string> = {};
      if (body.attributes && typeof body.attributes === 'object' && !Array.isArray(body.attributes)) {
        for (const [k, v] of Object.entries(body.attributes)) {
          const ck = String(k).trim();
          const cv = String(v ?? '').trim();
          if (ck && cv) cleanAttrs[ck] = cv;
        }
      }
      attributesJson = JSON.stringify(cleanAttrs);
    }

    const updateTx = db.transaction(() => {
      db.prepare('INSERT OR IGNORE INTO categories (name, sortOrder, createdAt) VALUES (?, 99, ?)').run(
        category,
        new Date().toISOString()
      );
      db.prepare(`
        UPDATE products
        SET sku = ?, name = ?, berat = ?, harga = ?, hpp = ?, stok = ?, category = ?, image = ?,
            brand = ?, deskripsi = ?, panjang = ?, lebar = ?, tinggi = ?, status = ?, attributesJson = ?
        WHERE id = ? AND tenantId = ?
      `).run(
        sku, name, berat, harga, hpp, stok, category, image,
        brand, deskripsi, panjang, lebar, tinggi, status, attributesJson,
        id, tenantId
      );
      const row = db
        .prepare(`
          SELECT id, sku, name, berat, harga, COALESCE(hpp, 0) AS hpp, stok, category, image,
                 COALESCE(brand, 'No Brand') AS brand,
                 COALESCE(deskripsi, '') AS deskripsi,
                 COALESCE(panjang, 0) AS panjang,
                 COALESCE(lebar, 0) AS lebar,
                 COALESCE(tinggi, 0) AS tinggi,
                 COALESCE(status, 'Aktif') AS status,
                 COALESCE(attributesJson, '{}') AS attributesJson,
                 createdAt
          FROM products WHERE id = ?
        `)
        .get(id) as Product & { attributesJson?: string };
      const { attributesJson: rowAttrs, ...rest } = row;
      return { ...rest, attributes: parseProductAttributes(rowAttrs) } as Product;
    });

    const updated = updateTx();
    const auth = getAuth(req);
    recordAuditLog({
      tenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'UPDATE_PRODUCT',
      entityType: 'product',
      entityId: updated.id,
      entityLabel: `${updated.sku} • ${updated.name}`,
      severity: 'info',
      summary: `Memperbarui produk "${updated.name}" (${updated.sku}) — harga Rp ${updated.harga.toLocaleString('id-ID')}, stok ${updated.stok} pcs`,
      details: { sku: updated.sku, harga: updated.harga, stok: updated.stok, status: updated.status },
      ipAddress: getClientIp(req),
    });
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memperbarui produk.';
    if (msg.includes('UNIQUE') || msg.includes('idx_products_tenant_sku_lower')) {
      res.status(409).json({ error: 'SKU / Kode Barcode sudah terdaftar pada produk lain di outlet ini.' });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

app.delete('/api/products/:id', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const tenantId = getAuth(req).activeTenantId;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'ID produk tidak valid.' });
      return;
    }
    const usedCount = (
      db.prepare('SELECT COUNT(*) as cnt FROM transaction_items WHERE productId = ?').get(id) as { cnt: number }
    ).cnt;
    if (usedCount > 0) {
      res.status(409).json({
        error: `Produk tidak dapat dihapus karena sudah tercatat pada ${usedCount} item transaksi penjualan. Atur stok menjadi 0 jika tidak dijual lagi.`,
      });
      return;
    }
    const existingProd = db
      .prepare('SELECT sku, name FROM products WHERE id = ? AND tenantId = ?')
      .get(id, tenantId) as { sku: string; name: string } | undefined;
    const result = db.prepare('DELETE FROM products WHERE id = ? AND tenantId = ?').run(id, tenantId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Produk tidak ditemukan di outlet aktif.' });
      return;
    }
    const auth = getAuth(req);
    recordAuditLog({
      tenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'DELETE_PRODUCT',
      entityType: 'product',
      entityId: id,
      entityLabel: existingProd ? `${existingProd.sku} • ${existingProd.name}` : String(id),
      severity: 'warning',
      summary: `Menghapus produk ${existingProd ? `"${existingProd.name}" (${existingProd.sku})` : `#${id}`}`,
      ipAddress: getClientIp(req),
    });
    res.json({ deletedId: id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menghapus produk.' });
  }
});

// ============================================================
// CATEGORIES CRUD (STANDAR SHOPEE MULTI-LEVEL & ATRIBUT)
// ============================================================
app.get('/api/categories', (req, res) => {
  try {
    const { activeTenantId } = getAuth(req);
    if (req.query.withStats === 'true' || req.query.withStats === '1') {
      res.json(getCategoriesWithStats(activeTenantId));
      return;
    }
    if (req.query.detailed === 'true' || req.query.detailed === '1') {
      res.json(getAllCategoryItems());
      return;
    }
    res.json(getAllCategories());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat kategori.' });
  }
});

app.post('/api/categories', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const auth = getAuth(req);
    const payload = (req.body ?? {}) as CategoryPayload;
    const item = createCategoryItem(payload);
    recordAuditLog({
      tenantId: auth.activeTenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'CREATE_CATEGORY',
      entityType: 'category',
      entityId: item.name,
      entityLabel: item.name,
      severity: 'info',
      summary: `Menambahkan kategori "${item.name}"`,
      ipAddress: getClientIp(req),
    });
    res.status(201).json({
      name: item.name,
      item,
      categories: getAllCategories(),
      categoryDetails: getAllCategoryItems(),
      createdAt: item.createdAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menambah kategori.';
    const status = msg.includes('sudah ada') ? 409 : 400;
    res.status(status).json({ error: msg });
  }
});

app.put('/api/categories/:oldName', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const auth = getAuth(req);
    const oldName = decodeURIComponent(String(req.params.oldName)).trim();
    const payload = (req.body ?? {}) as CategoryPayload;
    const { item } = updateCategoryItem(oldName, payload);
    recordAuditLog({
      tenantId: auth.activeTenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'UPDATE_CATEGORY',
      entityType: 'category',
      entityId: item.name,
      entityLabel: oldName === item.name ? item.name : `${oldName} → ${item.name}`,
      severity: 'info',
      summary: oldName === item.name ? `Memperbarui kategori "${item.name}"` : `Mengubah nama kategori "${oldName}" menjadi "${item.name}"`,
      ipAddress: getClientIp(req),
    });
    res.json({
      oldName,
      newName: item.name,
      item,
      categories: getAllCategories(),
      categoryDetails: getAllCategoryItems(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengubah kategori.';
    const status = msg.includes('tidak ditemukan')
      ? 404
      : msg.includes('sudah terdaftar')
      ? 409
      : 400;
    res.status(status).json({ error: msg });
  }
});

app.patch('/api/categories/:name/toggle', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const auth = getAuth(req);
    const name = decodeURIComponent(String(req.params.name)).trim();
    const isActive = Boolean((req.body as { isActive?: boolean })?.isActive);
    const item = toggleCategoryItemActive(name, isActive);
    recordAuditLog({
      tenantId: auth.activeTenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'TOGGLE_CATEGORY',
      entityType: 'category',
      entityId: item.name,
      entityLabel: item.name,
      severity: 'info',
      summary: `${item.isActive ? 'Mengaktifkan' : 'Menonaktifkan'} kategori "${item.name}"`,
      ipAddress: getClientIp(req),
    });
    res.json({
      item,
      categories: getAllCategories(),
      categoryDetails: getAllCategoryItems(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memperbarui status kategori.';
    const status = msg.includes('tidak ditemukan') ? 404 : 400;
    res.status(status).json({ error: msg });
  }
});

app.delete('/api/categories/:name', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const auth = getAuth(req);
    const name = decodeURIComponent(String(req.params.name)).trim();
    const deletedName = deleteCategoryItem(name);
    recordAuditLog({
      tenantId: auth.activeTenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'DELETE_CATEGORY',
      entityType: 'category',
      entityId: deletedName,
      entityLabel: deletedName,
      severity: 'warning',
      summary: `Menghapus kategori "${deletedName}"`,
      ipAddress: getClientIp(req),
    });
    res.json({
      deletedName,
      categories: getAllCategories(),
      categoryDetails: getAllCategoryItems(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menghapus kategori.';
    const status = msg.includes('tidak ditemukan')
      ? 404
      : msg.includes('masih digunakan') || msg.includes('masih memiliki')
      ? 409
      : 500;
    res.status(status).json({ error: msg });
  }
});

// ============================================================
// TRANSACTIONS CRUD (KASIR POS + HALAMAN TRANSAKSI)
// ============================================================
app.get('/api/transactions', (req, res) => {
  try {
    const { activeTenantId } = getAuth(req);
    const page = Number(req.query.page ?? 1) || 1;
    const pageSize = Number(req.query.pageSize ?? 10) || 10;
    const search = String(req.query.search ?? '');
    const method = String(req.query.method ?? 'semua');
    const rawStatus = String(req.query.status ?? 'all');
    const status = (['all', 'completed', 'void'].includes(rawStatus) ? rawStatus : 'all') as
      | 'all'
      | 'completed'
      | 'void';
    const cashier = String(req.query.cashier ?? 'all');
    const rawPromoFilter = String(req.query.promoFilter ?? 'all');
    const promoFilter = (['all', 'with_promo', 'no_promo'].includes(rawPromoFilter)
      ? rawPromoFilter
      : 'all') as 'all' | 'with_promo' | 'no_promo';
    const dateFrom = String(req.query.dateFrom ?? '').trim();
    const dateTo = String(req.query.dateTo ?? '').trim();
    const sortBy = String(req.query.sortBy ?? 'newest');
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
    res.json(
      queryTransactions({
        page,
        pageSize,
        search,
        method,
        status,
        cashier,
        promoFilter,
        dateFrom,
        dateTo,
        sortBy,
        sortDir,
        tenantId: activeTenantId,
      })
    );
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat transaksi.' });
  }
});

function parseTransactionExportParams(query: Record<string, unknown>, exportedBy: string) {
  const rawPeriod = String(query.period ?? 'monthly');
  const period = (['monthly', 'daily', 'custom', 'yearly', 'all'].includes(rawPeriod)
    ? rawPeriod
    : 'monthly') as TransactionExportPeriod;
  const now = new Date();
  const month = Number(query.month) || now.getMonth() + 1;
  const year = Number(query.year) || now.getFullYear();
  const date = String(query.date ?? '').trim();
  const dateFrom = String(query.dateFrom ?? '').trim();
  const dateTo = String(query.dateTo ?? '').trim();
  const method = String(query.method ?? 'semua').trim();
  const rawStatus = String(query.statusFilter ?? 'completed');
  const statusFilter = (['completed', 'all', 'void'].includes(rawStatus)
    ? rawStatus
    : 'completed') as TransactionExportStatus;
  const search = String(query.search ?? '').trim();
  const rawFormat = String(query.format ?? 'xlsx');
  const format = (rawFormat === 'csv' ? 'csv' : 'xlsx') as TransactionExportFormat;

  return {
    period,
    month,
    year,
    date,
    dateFrom,
    dateTo,
    method,
    statusFilter,
    search,
    format,
    exportedBy,
  };
}

app.get('/api/transactions/export-preview', (req, res) => {
  try {
    const auth = getAuth(req);
    const opts = parseTransactionExportParams(req.query as Record<string, unknown>, auth.user.fullName);
    const { transactions, tenant } = queryTransactionsForExport({
      ...opts,
      tenantId: auth.activeTenantId,
    });

    const activeTxs = transactions.filter(t => t.status !== 'void');
    const voidTxs = transactions.filter(t => t.status === 'void');
    const totalQty = activeTxs.reduce((s, t) => s + (t.totalQty || 0), 0);
    const totalBerat = Number(activeTxs.reduce((s, t) => s + (t.totalBerat || 0), 0).toFixed(2));
    const totalOmzet = activeTxs.reduce((s, t) => s + (t.grandTotal || 0), 0);

    res.json({
      count: transactions.length,
      completedCount: activeTxs.length,
      voidCount: voidTxs.length,
      totalQty,
      totalBerat,
      totalOmzet,
      periodLabel: buildExportPeriodLabel(opts),
      filename: buildExportFilename(tenant, opts, opts.format),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyiapkan pratinjau ekspor.' });
  }
});

app.get('/api/transactions/export', async (req, res) => {
  try {
    const auth = getAuth(req);
    const opts = parseTransactionExportParams(req.query as Record<string, unknown>, auth.user.fullName);
    const { transactions, tenant } = queryTransactionsForExport({
      ...opts,
      tenantId: auth.activeTenantId,
    });

    if (transactions.length === 0) {
      res.status(404).json({ error: 'Tidak ada data transaksi yang sesuai dengan periode & filter pilihan Anda.' });
      return;
    }

    const filename = buildExportFilename(tenant, opts, opts.format);

    if (opts.format === 'csv') {
      const csv = generateTransactionsCsvString(transactions);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Export-Filename', filename);
      res.send(csv);
      return;
    }

    const buffer = await generateTransactionsExcelBuffer(transactions, tenant, opts);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Filename', filename);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mengekspor laporan transaksi.' });
  }
});

app.get('/api/transactions/:id', (req, res) => {
  try {
    const { activeTenantId } = getAuth(req);
    const tx = getTransactionById(req.params.id, activeTenantId);
    if (!tx) {
      res.status(404).json({ error: 'Transaksi tidak ditemukan di outlet aktif.' });
      return;
    }
    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat detail transaksi.' });
  }
});

app.post('/api/transactions', (req, res) => {
  try {
    const auth = getAuth(req);
    const tenantId = auth.activeTenantId;
    const body = req.body as {
      cashier?: string;
      customerId?: string;
      customerName?: string;
      customerPhone?: string;
      items?: Array<{ id: number; qty: number }>;
      paymentMethod?: 'cash' | 'debit' | 'transfer' | 'qris';
      paymentDetails?: PaymentDetails;
      promoCode?: string;
    };

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: 'Keranjang transaksi kosong.' });
      return;
    }

    const paymentMethod: 'cash' | 'transfer' = body.paymentMethod === 'transfer' ? 'transfer' : 'cash';
    const cashier = auth.user.fullName || (body.cashier ?? '').trim() || 'Kasir';
    let resolvedCustomerId = (body.customerId ?? '').trim() || undefined;
    let customerName = (body.customerName ?? '').trim() || 'Pelanggan Umum';
    const rawCustomerPhone = (body.customerPhone ?? '').trim();
    let customerPhone: string | undefined;

    if (rawCustomerPhone) {
      const cleaned = rawCustomerPhone.replace(/\s+/g, '');
      const digitsOnly = cleaned.replace(/\D/g, '');
      if (!/^[+\d-]+$/.test(cleaned) || digitsOnly.length < 8 || digitsOnly.length > 16) {
        res.status(400).json({
          error: 'Nomor WhatsApp pelanggan tidak valid (masukkan 8–16 digit angka).',
        });
        return;
      }
      customerPhone = cleaned.replace(/-/g, '');
    }

    if (resolvedCustomerId) {
      const cust = db
        .prepare('SELECT id, name, phone FROM customers WHERE id = ?')
        .get(resolvedCustomerId) as { id: string; name: string; phone?: string } | undefined;
      if (cust) {
        resolvedCustomerId = cust.id;
        if (customerName === 'Pelanggan Umum') {
          customerName = cust.name;
        }
        if (!customerPhone && cust.phone) {
          customerPhone = cust.phone;
        }
      } else {
        resolvedCustomerId = undefined;
      }
    }

    const checkoutTx = db.transaction(() => {
      const resolvedItems: TransactionItem[] = [];
      let subtotal = 0;
      let totalQty = 0;
      let totalBerat = 0;

      for (const reqItem of body.items!) {
        const prod = db
          .prepare(
            "SELECT id, sku, name, berat, harga, COALESCE(hpp, 0) AS hpp, stok, category, COALESCE(brand, 'No Brand') AS brand, COALESCE(panjang, 0) AS panjang, COALESCE(lebar, 0) AS lebar, COALESCE(tinggi, 0) AS tinggi, image FROM products WHERE id = ? AND tenantId = ?"
          )
          .get(reqItem.id, tenantId) as Product | undefined;

        if (!prod) {
          throw new Error(`Produk ID ${reqItem.id} tidak ditemukan di outlet aktif.`);
        }
        const qty = Math.round(Number(reqItem.qty));
        if (!Number.isInteger(qty) || qty <= 0) {
          throw new Error(`Jumlah untuk ${prod.name} tidak valid.`);
        }
        if (prod.stok < qty) {
          throw new Error(`Stok "${prod.name}" tidak mencukupi (tersedia ${prod.stok} pcs, diminta ${qty} pcs).`);
        }

        const itemSubtotal = prod.harga * qty;
        subtotal += itemSubtotal;
        totalQty += qty;
        totalBerat += prod.berat * qty;

        resolvedItems.push({
          id: prod.id,
          sku: prod.sku,
          name: prod.name,
          category: prod.category,
          brand: prod.brand ?? 'No Brand',
          hpp: prod.hpp ?? 0,
          panjang: prod.panjang ?? 0,
          lebar: prod.lebar ?? 0,
          tinggi: prod.tinggi ?? 0,
          berat: prod.berat,
          harga: prod.harga,
          qty,
          subtotal: itemSubtotal,
          image: prod.image,
        });

        db.prepare('UPDATE products SET stok = stok - ? WHERE id = ? AND tenantId = ?').run(qty, prod.id, tenantId);
      }

      const grossSubtotal = subtotal;
      let appliedPromoCode: string | undefined;
      let appliedPromoName: string | undefined;
      let discountAmount = 0;

      if (body.promoCode && body.promoCode.trim()) {
        const couponCheck = validatePromoCouponForCart(tenantId, body.promoCode, body.items!);
        appliedPromoCode = couponCheck.promo.code;
        appliedPromoName = couponCheck.promo.name;
        discountAmount = couponCheck.discountAmount;
        subtotal = Math.max(0, grossSubtotal - discountAmount);
      }

      const storeSettings = getStoreSettings(tenantId);
      const tax = storeSettings.enablePpn ? Math.round(subtotal * (storeSettings.ppnPercent / 100)) : 0;
      const grandTotal = subtotal + tax;
      const now = new Date();
      const dateNum = now.toISOString().slice(0, 10).replace(/-/g, '');
      const todayCount = (
        db.prepare('SELECT COUNT(*) as cnt FROM transactions WHERE invoiceNo LIKE ?').get(`TRX-${dateNum}-%`) as {
          cnt: number;
        }
      ).cnt;

      let seq = todayCount + 1;
      let invoiceNo = `TRX-${dateNum}-${String(seq).padStart(3, '0')}`;
      while (db.prepare('SELECT id FROM transactions WHERE invoiceNo = ?').get(invoiceNo)) {
        seq += 1;
        invoiceNo = `TRX-${dateNum}-${String(seq).padStart(3, '0')}`;
      }

      const txId = `${invoiceNo}-${Date.now().toString().slice(-4)}`;
      const dateTime = now.toISOString();
      const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const rawDetails = body.paymentDetails ?? {};
      const paymentDetails: PaymentDetails = {
        ...rawDetails,
        cashChange:
          paymentMethod === 'cash' && rawDetails.cashReceived !== undefined
            ? Math.max(0, rawDetails.cashReceived - grandTotal)
            : rawDetails.cashChange,
      };

      const newTx: Transaction = {
        id: txId,
        invoiceNo,
        dateTime,
        dateStr,
        timeStr,
        cashier,
        customerId: resolvedCustomerId,
        customerName,
        customerPhone,
        items: resolvedItems,
        totalQty,
        totalBerat: parseFloat(totalBerat.toFixed(2)),
        subtotal,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        promoCode: appliedPromoCode,
        promoName: appliedPromoName,
        tax,
        grandTotal,
        paymentMethod,
        paymentDetails,
      };

      db.prepare(
        `INSERT INTO transactions (id, tenantId, invoiceNo, dateTime, dateStr, timeStr, cashier, customerId, customerName, customerPhone, totalQty, totalBerat, subtotal, discountAmount, promoCode, promoName, tax, grandTotal, paymentMethod, paymentDetailsJson)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        newTx.id,
        tenantId,
        newTx.invoiceNo,
        newTx.dateTime,
        newTx.dateStr,
        newTx.timeStr,
        newTx.cashier,
        newTx.customerId ?? null,
        newTx.customerName,
        newTx.customerPhone ?? null,
        newTx.totalQty,
        newTx.totalBerat,
        newTx.subtotal,
        discountAmount,
        appliedPromoCode ?? null,
        appliedPromoName ?? null,
        newTx.tax,
        newTx.grandTotal,
        newTx.paymentMethod,
        JSON.stringify(newTx.paymentDetails)
      );

      const insertItem = db.prepare(
        `INSERT INTO transaction_items (transactionId, productId, sku, name, berat, harga, qty, subtotal, image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const it of resolvedItems) {
        insertItem.run(newTx.id, it.id, it.sku, it.name, it.berat, it.harga, it.qty, it.subtotal, it.image ?? null);
      }

      return {
        transaction: newTx,
      };
    });

    const result = checkoutTx();
    const enriched = getTransactionById(result.transaction.id, tenantId) ?? result.transaction;
    res.status(201).json({ transaction: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memproses transaksi.';
    const isClientErr =
      msg.includes('tidak mencukupi') ||
      msg.includes('tidak ditemukan') ||
      msg.includes('tidak valid') ||
      msg.includes('Kupon') ||
      msg.includes('Minimal belanja');
    res.status(isClientErr ? 400 : 500).json({ error: msg });
  }
});

app.put('/api/transactions/:id', (_req, res) => {
  res.status(403).json({
    error: 'Transaksi penjualan yang sudah lunas tidak boleh diubah sesuai standar audit POS. Gunakan Void Transaksi jika terjadi kesalahan.',
  });
});

app.delete('/api/transactions/:id', (_req, res) => {
  res.status(403).json({
    error: 'Nota penjualan tidak boleh dihapus permanen agar nomor faktur & laporan kas tetap valid. Gunakan Void Transaksi.',
  });
});

app.post('/api/transactions/:id/void', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const tenantId = getAuth(req).activeTenantId;
    const { id } = req.params;
    const body = (req.body ?? {}) as { reason?: string; restoreStock?: boolean };
    const reason = (body.reason ?? '').trim();
    if (!reason) {
      res.status(400).json({ error: 'Alasan pembatalan (void) wajib diisi demi jejak audit POS.' });
      return;
    }
    const restoreStock = body.restoreStock !== false;

    const existing = db
      .prepare("SELECT id, COALESCE(status, 'completed') AS status FROM transactions WHERE id = ? AND tenantId = ?")
      .get(id, tenantId) as { id: string; status: string } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Transaksi tidak ditemukan di outlet aktif.' });
      return;
    }
    if (existing.status === 'void') {
      res.status(409).json({ error: 'Transaksi ini sudah berstatus VOID.' });
      return;
    }

    const voidedAt = new Date().toISOString();
    const voidTx = db.transaction(() => {
      db.prepare("UPDATE transactions SET status = 'void', voidReason = ?, voidedAt = ? WHERE id = ? AND tenantId = ?").run(
        reason,
        voidedAt,
        id,
        tenantId
      );

      if (restoreStock) {
        const items = db
          .prepare('SELECT productId, qty FROM transaction_items WHERE transactionId = ?')
          .all(id) as Array<{ productId: number; qty: number }>;
        const restoreStmt = db.prepare('UPDATE products SET stok = stok + ? WHERE id = ? AND tenantId = ?');
        for (const it of items) {
          restoreStmt.run(it.qty, it.productId, tenantId);
        }
      }
    });

    voidTx();
    const auth = getAuth(req);
    const updated = getTransactionById(String(id));
    recordAuditLog({
      tenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'VOID_TRANSACTION',
      entityType: 'transaction',
      entityId: String(id),
      entityLabel: updated?.invoiceNo || String(id),
      severity: 'critical',
      summary: `Membatalkan (VOID) transaksi ${updated?.invoiceNo || id} senilai Rp ${(updated?.grandTotal ?? 0).toLocaleString('id-ID')} (${restoreStock ? 'stok dikembalikan' : 'stok tidak dikembalikan'})`,
      details: { reason, restoreStock, grandTotal: updated?.grandTotal ?? 0 },
      ipAddress: getClientIp(req),
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal melakukan void transaksi.' });
  }
});

// ============================================================
// BUYBACKS CRUD (PAGINATED LIGHTWEIGHT LIST + ON-DEMAND DETAIL)
// ============================================================
app.get('/api/buybacks', (req, res) => {
  try {
    const { activeTenantId } = getAuth(req);
    const page = Number(req.query.page ?? 1) || 1;
    const pageSize = Number(req.query.pageSize ?? 10) || 10;
    const search = String(req.query.search ?? '');
    const method = String(req.query.method ?? 'all');
    const sortBy = String(req.query.sortBy ?? 'newest');
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
    res.json(queryBuybacks({ page, pageSize, search, method, sortBy, sortDir, tenantId: activeTenantId }));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat data buyback.' });
  }
});

app.get('/api/buybacks/:id', (req, res) => {
  try {
    const { activeTenantId } = getAuth(req);
    const item = getBuybackById(req.params.id, activeTenantId);
    if (!item) {
      res.status(404).json({ error: 'Data buyback tidak ditemukan di outlet aktif.' });
      return;
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat detail buyback.' });
  }
});

app.post('/api/buybacks', (req, res) => {
  try {
    const auth = getAuth(req);
    const tenantId = auth.activeTenantId;
    const activeTenantRow = db
      .prepare('SELECT branchName FROM tenants WHERE id = ?')
      .get(tenantId) as { branchName: string } | undefined;
    const body = req.body as BuybackCreatePayload;
    if (!body.customerName?.trim() || !body.customerPhone?.trim()) {
      res.status(400).json({ error: 'Nama dan nomor HP nasabah wajib diisi.' });
      return;
    }

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const datePrefix = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const existingCount = (
      db.prepare('SELECT COUNT(*) as cnt FROM buybacks WHERE invoiceNo LIKE ?').get(`BB-${datePrefix}-%`) as {
        cnt: number;
      }
    ).cnt;

    let seq = existingCount + 1;
    let invoiceNo = `BB-${datePrefix}-${seq.toString().padStart(3, '0')}`;
    while (db.prepare('SELECT id FROM buybacks WHERE invoiceNo = ?').get(invoiceNo)) {
      seq += 1;
      invoiceNo = `BB-${datePrefix}-${seq.toString().padStart(3, '0')}`;
    }

    const dateStr =
      now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ', ' +
      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const id = `bb-${Date.now()}`;
    const cleanName = body.customerName.trim();
    const cleanPhone = body.customerPhone.trim();
    const cleanNik = body.customerNik?.trim() || null;
    const cleanAddress = body.customerAddress?.trim() || null;

    const saveTx = db.transaction(() => {
      let resolvedCustomerId: string | null = (body.customerId ?? '').trim() || null;

      if (resolvedCustomerId) {
        const linked = db
          .prepare('SELECT id, nik, address FROM customers WHERE id = ?')
          .get(resolvedCustomerId) as { id: string; nik: string | null; address: string | null } | undefined;
        if (linked) {
          if ((!linked.nik && cleanNik) || (!linked.address && cleanAddress)) {
            db.prepare('UPDATE customers SET nik = COALESCE(nik, ?), address = COALESCE(address, ?) WHERE id = ?').run(
              cleanNik,
              cleanAddress,
              linked.id
            );
          }
        } else {
          resolvedCustomerId = null;
        }
      }

      if (!resolvedCustomerId && body.saveToCustomerMaster !== false) {
        let matched: { id: string; nik: string | null; address: string | null } | undefined;
        if (cleanNik) {
          matched = db
            .prepare('SELECT id, nik, address FROM customers WHERE nik = ? LIMIT 1')
            .get(cleanNik) as { id: string; nik: string | null; address: string | null } | undefined;
          if (!matched) {
            matched = db
              .prepare(
                "SELECT id, nik, address FROM customers WHERE (nik IS NULL OR TRIM(nik) = '') AND (phone = ? OR LOWER(name) = LOWER(?)) LIMIT 1"
              )
              .get(cleanPhone, cleanName) as
              | { id: string; nik: string | null; address: string | null }
              | undefined;
          }
        } else {
          matched = db
            .prepare('SELECT id, nik, address FROM customers WHERE phone = ? OR LOWER(name) = LOWER(?) LIMIT 1')
            .get(cleanPhone, cleanName) as { id: string; nik: string | null; address: string | null } | undefined;
        }

        if (matched) {
          resolvedCustomerId = matched.id;
          if ((!matched.nik && cleanNik) || (!matched.address && cleanAddress)) {
            db.prepare('UPDATE customers SET nik = COALESCE(nik, ?), address = COALESCE(address, ?) WHERE id = ?').run(
              cleanNik,
              cleanAddress,
              matched.id
            );
          }
        } else {
          const newCustId = `CUST-${Date.now()}`;
          const memberCode = generateNextMemberCode();
          db.prepare(
            `INSERT INTO customers (id, memberCode, name, phone, nik, type, address, preferredKadar, notes, createdAt, totalSpent, totalTransactions)
             VALUES (?, ?, ?, ?, ?, 'Reguler', ?, ?, 'Terdaftar otomatis via Buyback', ?, 0, 0)`
          ).run(
            newCustId,
            memberCode,
            cleanName,
            cleanPhone,
            cleanNik,
            cleanAddress,
            body.kadar || 'Umum',
            now.toISOString().slice(0, 10)
          );
          resolvedCustomerId = newCustId;
        }
      }

      db.prepare(
        `INSERT INTO buybacks (
          id, tenantId, invoiceNo, date, createdAt, timeStr, branchName, cashierName,
          customerId, customerName, customerPhone, customerNik, customerNpwp, customerAddress,
          sourceNote, itemType, kadar, beratKotor, potonganBatu, beratBersih,
          hargaPerGram, biayaLebur, kondisi, totalKotor, potonganBiaya, pph22,
          totalBayar, paymentMethod, bankName, accountNo, accountHolder,
          catatan, fotoKtp, fotoEmas, ttdNasabah, ttdPetugas, isAgreedLegal, itemsJson
        ) VALUES (
          @id, @tenantId, @invoiceNo, @date, @createdAt, @timeStr, @branchName, @cashierName,
          @customerId, @customerName, @customerPhone, @customerNik, @customerNpwp, @customerAddress,
          @sourceNote, @itemType, @kadar, @beratKotor, @potonganBatu, @beratBersih,
          @hargaPerGram, @biayaLebur, @kondisi, @totalKotor, @potonganBiaya, @pph22,
          @totalBayar, @paymentMethod, @bankName, @accountNo, @accountHolder,
          @catatan, @fotoKtp, @fotoEmas, @ttdNasabah, @ttdPetugas, @isAgreedLegal, @itemsJson
        )`
      ).run({
        id,
        tenantId,
        invoiceNo,
        date: dateStr,
        createdAt: now.toISOString(),
        timeStr: body.timeStr ?? null,
        branchName: body.branchName?.trim() || activeTenantRow?.branchName || null,
        cashierName: auth.user.fullName || body.cashierName || null,
        customerId: resolvedCustomerId,
        customerName: cleanName,
        customerPhone: cleanPhone,
        customerNik: cleanNik,
        customerNpwp: body.customerNpwp ?? null,
        customerAddress: cleanAddress,
        sourceNote: body.sourceNote || '-',
        itemType: body.itemType,
        kadar: body.kadar,
        beratKotor: Number(body.beratKotor) || 0,
        potonganBatu: Number(body.potonganBatu) || 0,
        beratBersih: Number(body.beratBersih) || 0,
        hargaPerGram: Math.round(Number(body.hargaPerGram) || 0),
        biayaLebur: Math.round(Number(body.biayaLebur) || 0),
        kondisi: body.kondisi || 'Baik / Utuh',
        totalKotor: body.totalKotor !== undefined ? Math.round(Number(body.totalKotor)) : null,
        potonganBiaya: body.potonganBiaya !== undefined ? Math.round(Number(body.potonganBiaya)) : null,
        pph22: body.pph22 !== undefined ? Math.round(Number(body.pph22)) : null,
        totalBayar: Math.round(Number(body.totalBayar) || 0),
        paymentMethod: body.paymentMethod,
        bankName: body.bankName ?? null,
        accountNo: body.accountNo ?? null,
        accountHolder: body.accountHolder ?? null,
        catatan: body.catatan ?? null,
        fotoKtp: body.fotoKtp ?? null,
        fotoEmas: body.fotoEmas ?? null,
        ttdNasabah: body.ttdNasabah ?? null,
        ttdPetugas: body.ttdPetugas ?? null,
        isAgreedLegal: body.isAgreedLegal ? 1 : 0,
        itemsJson: body.items ? JSON.stringify(body.items) : null,
      });
    });

    saveTx();
    const created = getBuybackById(id, tenantId);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan transaksi buyback.' });
  }
});

app.put('/api/buybacks/:id', (_req, res) => {
  res.status(403).json({
    error: 'Nota buyback yang sudah dibayarkan tidak boleh diubah demi menjaga validitas tanda tangan & kas keluar. Gunakan Void Buyback jika terjadi kesalahan.',
  });
});

app.delete('/api/buybacks/:id', (_req, res) => {
  res.status(403).json({
    error: 'Nota buyback tidak boleh dihapus permanen demi jejak audit KTP & pencairan dana. Gunakan Void Buyback.',
  });
});

app.post('/api/buybacks/:id/void', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const tenantId = getAuth(req).activeTenantId;
    const { id } = req.params;
    const body = (req.body ?? {}) as { reason?: string };
    const reason = (body.reason ?? '').trim();
    if (!reason) {
      res.status(400).json({ error: 'Alasan pembatalan (void) wajib diisi demi jejak audit buyback.' });
      return;
    }

    const row = db
      .prepare('SELECT id, COALESCE(status, \'completed\') as status FROM buybacks WHERE id = ? AND tenantId = ?')
      .get(id, tenantId) as { id: string; status: string } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Data buyback tidak ditemukan di outlet aktif.' });
      return;
    }
    if (row.status === 'void') {
      res.status(409).json({ error: 'Nota buyback ini sudah berstatus VOID.' });
      return;
    }

    const voidedAt = new Date().toISOString();
    db.prepare("UPDATE buybacks SET status = 'void', voidReason = ?, voidedAt = ? WHERE id = ? AND tenantId = ?").run(
      reason,
      voidedAt,
      id,
      tenantId
    );

    const updated = getBuybackById(String(id), tenantId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal melakukan void buyback.' });
  }
});

// ============================================================
// CUSTOMERS CRUD (PAGINATED)
// ============================================================
app.get('/api/customers', (req, res) => {
  try {
    const page = Number(req.query.page ?? 1) || 1;
    const pageSize = Number(req.query.pageSize ?? 10) || 10;
    const search = String(req.query.search ?? '');
    const type = String(req.query.type ?? 'semua');
    const sortBy = String(req.query.sortBy ?? 'newest');
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
    res.json(queryCustomers({ page, pageSize, search, type, sortBy, sortDir }));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat pelanggan.' });
  }
});

app.post('/api/customers', (req, res) => {
  try {
    const c = req.body as Customer;
    if (!c.name?.trim() || !c.phone?.trim()) {
      res.status(400).json({ error: 'Nama dan nomor HP pelanggan wajib diisi.' });
      return;
    }
    const cleanNik = (c.nik ?? '').trim().replace(/[^0-9]/g, '');
    if (cleanNik.length !== 16) {
      res.status(400).json({
        error: 'NIK / No. KTP wajib diisi tepat 16 digit angka sebagai identitas unik pelanggan.',
      });
      return;
    }
    const existingByNik = db
      .prepare('SELECT id, name, memberCode FROM customers WHERE nik = ? LIMIT 1')
      .get(cleanNik) as { id: string; name: string; memberCode: string } | undefined;
    if (existingByNik) {
      res.status(409).json({
        error: `NIK ${cleanNik} sudah terdaftar atas nama "${existingByNik.name}" (${existingByNik.memberCode}).`,
      });
      return;
    }

    const id = c.id || `CUST-${Date.now()}`;
    const rawCode = (c.memberCode ?? '').trim().toUpperCase();
    const memberCode = !rawCode || rawCode === 'AUTO' ? generateNextMemberCode() : rawCode;
    db.prepare(
      `INSERT INTO customers (id, memberCode, name, phone, nik, npwp, type, address, preferredKadar, goldColor, ringSize, braceletSize, birthDate, notes, createdAt, totalSpent, totalTransactions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      memberCode,
      c.name.trim(),
      c.phone.trim(),
      cleanNik,
      c.npwp ?? null,
      c.type || 'Reguler',
      c.address ?? null,
      c.preferredKadar ?? null,
      c.goldColor ?? null,
      c.ringSize ?? null,
      c.braceletSize ?? null,
      c.birthDate ?? null,
      c.notes ?? null,
      c.createdAt || new Date().toISOString().slice(0, 10),
      c.totalSpent ?? 0,
      c.totalTransactions ?? 0
    );
    const created = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer;
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menambah pelanggan.' });
  }
});

app.put('/api/customers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
      return;
    }
    const c = req.body as Partial<Customer>;
    const rawIncomingNik = c.nik !== undefined ? c.nik : existing.nik ?? '';
    const cleanNik = String(rawIncomingNik ?? '').trim().replace(/[^0-9]/g, '');
    if (cleanNik.length !== 16) {
      res.status(400).json({
        error: 'NIK / No. KTP wajib diisi tepat 16 digit angka sebagai identitas unik pelanggan.',
      });
      return;
    }
    const dupNik = db
      .prepare('SELECT id, name, memberCode FROM customers WHERE nik = ? AND id != ? LIMIT 1')
      .get(cleanNik, id) as { id: string; name: string; memberCode: string } | undefined;
    if (dupNik) {
      res.status(409).json({
        error: `NIK ${cleanNik} sudah digunakan oleh pelanggan lain ("${dupNik.name}" - ${dupNik.memberCode}).`,
      });
      return;
    }

    db.prepare(
      `UPDATE customers SET name = ?, phone = ?, nik = ?, npwp = ?, type = ?, address = ?, preferredKadar = ?, goldColor = ?, ringSize = ?, braceletSize = ?, birthDate = ?, notes = ? WHERE id = ?`
    ).run(
      (c.name ?? existing.name).trim(),
      (c.phone ?? existing.phone).trim(),
      cleanNik,
      c.npwp !== undefined ? c.npwp : existing.npwp ?? null,
      c.type ?? existing.type,
      c.address !== undefined ? c.address : existing.address ?? null,
      c.preferredKadar !== undefined ? c.preferredKadar : existing.preferredKadar ?? null,
      c.goldColor !== undefined ? c.goldColor : existing.goldColor ?? null,
      c.ringSize !== undefined ? c.ringSize : existing.ringSize ?? null,
      c.braceletSize !== undefined ? c.braceletSize : existing.braceletSize ?? null,
      c.birthDate !== undefined ? c.birthDate : existing.birthDate ?? null,
      c.notes !== undefined ? c.notes : existing.notes ?? null,
      id
    );
    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui pelanggan.' });
  }
});

app.delete('/api/customers/:id', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const existing = db
      .prepare('SELECT id, name, totalTransactions FROM customers WHERE id = ?')
      .get(req.params.id) as { id: string; name: string; totalTransactions: number } | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
      return;
    }

    const txCnt = (
      db
        .prepare('SELECT COUNT(*) as cnt FROM transactions WHERE customerId = ? OR (customerId IS NULL AND LOWER(customerName) = LOWER(?))')
        .get(existing.id, existing.name) as {
        cnt: number;
      }
    ).cnt;
    const bbCnt = (
      db
        .prepare('SELECT COUNT(*) as cnt FROM buybacks WHERE customerId = ? OR (customerId IS NULL AND LOWER(customerName) = LOWER(?))')
        .get(existing.id, existing.name) as {
        cnt: number;
      }
    ).cnt;

    if ((existing.totalTransactions || 0) + txCnt + bbCnt > 0) {
      res.status(409).json({
        error: `Pelanggan "${existing.name}" tidak dapat dihapus karena sudah memiliki riwayat transaksi atau buyback.`,
      });
      return;
    }

    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menghapus pelanggan.' });
  }
});

// ============================================================
// PROMOS CRUD
// ============================================================

app.get('/api/promos/active', (req, res) => {
  try {
    const { activeTenantId } = getAuth(req);
    res.json(getActivePromos(activeTenantId));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat daftar promo aktif.' });
  }
});

app.post('/api/promos/validate', (req, res) => {
  try {
    const { activeTenantId } = getAuth(req);
    const body = (req.body ?? {}) as {
      code?: string;
      items?: Array<{ id: number; qty: number }>;
    };
    const result = validatePromoCouponForCart(
      activeTenantId,
      String(body.code ?? ''),
      Array.isArray(body.items) ? body.items : []
    );
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Kupon promo tidak valid.';
    const status = msg.includes('tidak ditemukan') ? 404 : 400;
    res.status(status).json({ error: msg });
  }
});

app.get('/api/promos', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const { activeTenantId } = getAuth(req);
    const page = Number(req.query.page ?? 1) || 1;
    const pageSize = Number(req.query.pageSize ?? 10) || 10;
    const search = String(req.query.search ?? '');
    const status = String(req.query.status ?? 'all');
    const rawDiscountRange = String(req.query.discountRange ?? 'all');
    const discountRange = (['all', 'under_10', '10_to_15', 'over_15'].includes(rawDiscountRange)
      ? rawDiscountRange
      : 'all') as 'all' | 'under_10' | '10_to_15' | 'over_15';
    const rawMinPurchase = String(req.query.minPurchaseFilter ?? 'all');
    const minPurchaseFilter = (['all', 'no_min', 'has_min'].includes(rawMinPurchase)
      ? rawMinPurchase
      : 'all') as 'all' | 'no_min' | 'has_min';
    const rawScopeFilter = String(req.query.scopeFilter ?? 'all');
    const scopeFilter = (['all', 'selected_sku', 'all_sku'].includes(rawScopeFilter)
      ? rawScopeFilter
      : 'all') as 'all' | 'selected_sku' | 'all_sku';
    const sortBy = String(req.query.sortBy ?? 'newest');
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
    res.json(
      queryPromos({
        page,
        pageSize,
        search,
        status,
        discountRange,
        minPurchaseFilter,
        scopeFilter,
        sortBy,
        sortDir,
        tenantId: activeTenantId,
      })
    );
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat promo.' });
  }
});

app.post('/api/promos', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const tenantId = getAuth(req).activeTenantId;
    const p = req.body as PromoCampaign;
    if (!p.name?.trim() || !p.code?.trim()) {
      res.status(400).json({ error: 'Nama dan kode promo wajib diisi.' });
      return;
    }
    const cleanCode = p.code.trim().toUpperCase();
    const startDate = String(p.startDate ?? '').trim();
    const endDate = String(p.endDate ?? '').trim();
    if (!isValidIsoDateStr(startDate) || !isValidIsoDateStr(endDate)) {
      res.status(400).json({ error: 'Tanggal mulai dan tanggal berakhir promo harus valid (YYYY-MM-DD).' });
      return;
    }
    if (endDate < startDate) {
      res.status(400).json({ error: 'Tanggal berakhir promo tidak boleh lebih awal dari tanggal mulai.' });
      return;
    }
    const discountPercent = Number(p.discountPercent);
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      res.status(400).json({ error: 'Persentase diskon harus antara 1% hingga 100%.' });
      return;
    }
    const today = getTodayWibDateStr();
    const requestedActive = p.isActive !== undefined ? Boolean(p.isActive) : true;
    if (requestedActive && endDate < today) {
      res.status(400).json({
        error: `Masa berlaku promo sudah berakhir pada ${formatPromoDate(endDate)}. Perpanjang tanggal berakhir untuk mengaktifkan promo.`,
      });
      return;
    }
    const dupCode = db
      .prepare('SELECT id FROM promos WHERE tenantId = ? AND LOWER(code) = LOWER(?)')
      .get(tenantId, cleanCode);
    if (dupCode) {
      res.status(409).json({ error: `Kode promo "${cleanCode}" sudah digunakan di outlet ini.` });
      return;
    }
    const id = p.id || `PRM-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const cleanMinPurchase =
      p.minPurchase !== undefined && p.minPurchase !== null && Number(p.minPurchase) > 0
        ? Math.round(Number(p.minPurchase))
        : null;
    db.prepare(
      `INSERT INTO promos (id, tenantId, name, code, discountPercent, label, startDate, endDate, productIdsJson, isActive, minPurchase, description, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      tenantId,
      p.name.trim(),
      cleanCode,
      discountPercent,
      (p.label || '').trim() || `Diskon ${discountPercent}%`,
      startDate,
      endDate,
      JSON.stringify(p.productIds ?? []),
      requestedActive ? 1 : 0,
      cleanMinPurchase,
      p.description?.trim() || null,
      createdAt
    );
    const createdRow = db.prepare('SELECT * FROM promos WHERE id = ?').get(id) as {
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
    const auth = getAuth(req);
    recordAuditLog({
      tenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'CREATE_PROMO',
      entityType: 'promo',
      entityId: createdRow.id,
      entityLabel: `${createdRow.code} (${createdRow.discountPercent}%)`,
      severity: 'info',
      summary: `Membuat promo "${createdRow.name}" (${createdRow.code}, diskon ${createdRow.discountPercent}%)`,
      details: { code: createdRow.code, discountPercent: createdRow.discountPercent, startDate, endDate },
      ipAddress: getClientIp(req),
    });
    res.status(201).json({
      id: createdRow.id,
      name: createdRow.name,
      code: createdRow.code,
      discountPercent: createdRow.discountPercent,
      label: createdRow.label,
      startDate: createdRow.startDate,
      endDate: createdRow.endDate,
      productIds: JSON.parse(createdRow.productIdsJson || '[]'),
      isActive: Boolean(createdRow.isActive),
      minPurchase: createdRow.minPurchase ?? undefined,
      description: createdRow.description ?? undefined,
      createdAt: createdRow.createdAt ?? undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal membuat promo.' });
  }
});

app.put('/api/promos/:id', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const tenantId = getAuth(req).activeTenantId;
    const { id } = req.params;
    const existingRow = db.prepare('SELECT * FROM promos WHERE id = ? AND tenantId = ?').get(id, tenantId) as
      | {
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
        }
      | undefined;
    if (!existingRow) {
      res.status(404).json({ error: 'Promo tidak ditemukan di outlet aktif.' });
      return;
    }
    const p = req.body as Partial<PromoCampaign>;
    const cleanCode = (p.code ?? existingRow.code).trim().toUpperCase();
    const startDate = String(p.startDate ?? existingRow.startDate).trim();
    const endDate = String(p.endDate ?? existingRow.endDate).trim();
    if (!isValidIsoDateStr(startDate) || !isValidIsoDateStr(endDate)) {
      res.status(400).json({ error: 'Tanggal mulai dan tanggal berakhir promo harus valid (YYYY-MM-DD).' });
      return;
    }
    if (endDate < startDate) {
      res.status(400).json({ error: 'Tanggal berakhir promo tidak boleh lebih awal dari tanggal mulai.' });
      return;
    }
    const discountPercent =
      p.discountPercent !== undefined ? Number(p.discountPercent) : existingRow.discountPercent;
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      res.status(400).json({ error: 'Persentase diskon harus antara 1% hingga 100%.' });
      return;
    }
    const today = getTodayWibDateStr();
    const nextIsActive = p.isActive !== undefined ? Boolean(p.isActive) : Boolean(existingRow.isActive);
    if (nextIsActive && endDate < today) {
      res.status(400).json({
        error: `Masa berlaku promo sudah berakhir pada ${formatPromoDate(endDate)}. Perpanjang tanggal berakhir atau ubah status menjadi Nonaktif.`,
      });
      return;
    }
    const dupCode = db
      .prepare('SELECT id FROM promos WHERE tenantId = ? AND LOWER(code) = LOWER(?) AND id != ?')
      .get(tenantId, cleanCode, id);
    if (dupCode) {
      res.status(409).json({ error: `Kode promo "${cleanCode}" sudah digunakan di outlet ini.` });
      return;
    }
    const existingProductIds = JSON.parse(existingRow.productIdsJson || '[]') as number[];
    const nextMinPurchase =
      p.minPurchase !== undefined
        ? p.minPurchase !== null && Number(p.minPurchase) > 0
          ? Math.round(Number(p.minPurchase))
          : null
        : existingRow.minPurchase ?? null;
    db.prepare(
      `UPDATE promos SET name = ?, code = ?, discountPercent = ?, label = ?, startDate = ?, endDate = ?, productIdsJson = ?, isActive = ?, minPurchase = ?, description = ? WHERE id = ? AND tenantId = ?`
    ).run(
      (p.name ?? existingRow.name).trim(),
      cleanCode,
      discountPercent,
      (p.label ?? existingRow.label).trim() || `Diskon ${discountPercent}%`,
      startDate,
      endDate,
      JSON.stringify(p.productIds ?? existingProductIds),
      nextIsActive ? 1 : 0,
      nextMinPurchase,
      p.description !== undefined ? (p.description?.trim() || null) : existingRow.description ?? null,
      id,
      tenantId
    );
    const updatedRow = db.prepare('SELECT * FROM promos WHERE id = ?').get(id) as typeof existingRow;
    const auth = getAuth(req);
    recordAuditLog({
      tenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'UPDATE_PROMO',
      entityType: 'promo',
      entityId: updatedRow.id,
      entityLabel: `${updatedRow.code} (${updatedRow.discountPercent}%)`,
      severity: 'info',
      summary: `Memperbarui promo "${updatedRow.name}" (${updatedRow.code}, ${updatedRow.discountPercent}%)`,
      ipAddress: getClientIp(req),
    });
    res.json({
      id: updatedRow.id,
      name: updatedRow.name,
      code: updatedRow.code,
      discountPercent: updatedRow.discountPercent,
      label: updatedRow.label,
      startDate: updatedRow.startDate,
      endDate: updatedRow.endDate,
      productIds: JSON.parse(updatedRow.productIdsJson || '[]'),
      isActive: Boolean(updatedRow.isActive),
      minPurchase: updatedRow.minPurchase ?? undefined,
      description: updatedRow.description ?? undefined,
      createdAt: updatedRow.createdAt ?? undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui promo.' });
  }
});

app.patch('/api/promos/:id/toggle', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const tenantId = getAuth(req).activeTenantId;
    const { id } = req.params;
    const today = syncExpiredPromos(tenantId);
    const existing = db
      .prepare('SELECT isActive, startDate, endDate FROM promos WHERE id = ? AND tenantId = ?')
      .get(id, tenantId) as { isActive: number; startDate: string; endDate: string } | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Promo tidak ditemukan di outlet aktif.' });
      return;
    }
    const nextState = existing.isActive ? 0 : 1;
    if (nextState === 1 && existing.endDate < today) {
      res.status(400).json({
        error: `Masa berlaku promo sudah berakhir pada ${formatPromoDate(existing.endDate)}. Edit tanggal berakhir atau tambah durasi terlebih dahulu untuk mengaktifkan kembali.`,
      });
      return;
    }
    db.prepare('UPDATE promos SET isActive = ? WHERE id = ? AND tenantId = ?').run(nextState, id, tenantId);
    const updatedRow = db.prepare('SELECT * FROM promos WHERE id = ?').get(id) as {
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
    const auth = getAuth(req);
    recordAuditLog({
      tenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'TOGGLE_PROMO',
      entityType: 'promo',
      entityId: updatedRow.id,
      entityLabel: updatedRow.code,
      severity: 'info',
      summary: `${updatedRow.isActive ? 'Mengaktifkan' : 'Menonaktifkan'} promo "${updatedRow.name}" (${updatedRow.code})`,
      ipAddress: getClientIp(req),
    });
    res.json({
      id: updatedRow.id,
      name: updatedRow.name,
      code: updatedRow.code,
      discountPercent: updatedRow.discountPercent,
      label: updatedRow.label,
      startDate: updatedRow.startDate,
      endDate: updatedRow.endDate,
      productIds: JSON.parse(updatedRow.productIdsJson || '[]'),
      isActive: Boolean(updatedRow.isActive),
      minPurchase: updatedRow.minPurchase ?? undefined,
      description: updatedRow.description ?? undefined,
      createdAt: updatedRow.createdAt ?? undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mengubah status promo.' });
  }
});

app.delete('/api/promos/:id', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const auth = getAuth(req);
    const tenantId = auth.activeTenantId;
    const existingPromo = db.prepare('SELECT name, code FROM promos WHERE id = ? AND tenantId = ?').get(req.params.id, tenantId) as
      | { name: string; code: string }
      | undefined;
    const result = db.prepare('DELETE FROM promos WHERE id = ? AND tenantId = ?').run(req.params.id, tenantId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Promo tidak ditemukan di outlet aktif.' });
      return;
    }
    recordAuditLog({
      tenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'DELETE_PROMO',
      entityType: 'promo',
      entityId: String(req.params.id),
      entityLabel: existingPromo ? `${existingPromo.code} • ${existingPromo.name}` : String(req.params.id),
      severity: 'warning',
      summary: `Menghapus promo ${existingPromo ? `"${existingPromo.name}" (${existingPromo.code})` : String(req.params.id)}`,
      ipAddress: getClientIp(req),
    });
    res.json({ deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menghapus promo.' });
  }
});

// ============================================================
// TENANTS CRUD
// ============================================================
app.get('/api/tenants', (req, res) => {
  const auth = getAuth(req);
  res.json(getAccessibleTenantsForUser(auth.user));
});

app.post('/api/tenants', requireRoles('owner'), (req, res) => {
  try {
    const auth = getAuth(req);
    const t = req.body as Tenant;
    if (!t.name?.trim() || !t.code?.trim() || !t.branchName?.trim()) {
      res.status(400).json({ error: 'Nama toko, kode outlet, dan nama cabang wajib diisi.' });
      return;
    }
    const cleanCode = t.code.trim().toUpperCase();
    const dupCode = db
      .prepare('SELECT id, name FROM tenants WHERE LOWER(code) = LOWER(?)')
      .get(cleanCode) as { id: string; name: string } | undefined;
    if (dupCode) {
      res.status(409).json({ error: `Kode outlet "${cleanCode}" sudah terdaftar pada "${dupCode.name}".` });
      return;
    }

    const createdAt = new Date().toISOString();
    const newTenant: Tenant = {
      ...t,
      name: t.name.trim(),
      code: cleanCode,
      branchName: t.branchName.trim(),
      logoUrl: (t.logoUrl ?? '').trim(),
      productCount: 0,
      createdAt,
    };
    const insertTx = db.transaction(() => {
      db.prepare(
        `INSERT INTO tenants (id, name, code, branchName, address, city, plan, cashierCount, productCount, phone, email, slug, logoInitial, logoUrl, databaseSchema, status, createdAt)
         VALUES (@id, @name, @code, @branchName, @address, @city, @plan, @cashierCount, @productCount, @phone, @email, @slug, @logoInitial, @logoUrl, @databaseSchema, @status, @createdAt)`
      ).run(newTenant);
      updateSessionTenant(auth.token, newTenant.id);
    });
    insertTx();
    recordAuditLog({
      tenantId: newTenant.id,
      tenantName: newTenant.name,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'CREATE_TENANT',
      entityType: 'tenant',
      entityId: newTenant.id,
      entityLabel: `${newTenant.code} • ${newTenant.name}`,
      severity: 'info',
      summary: `Mendaftarkan outlet baru "${newTenant.name}" (${newTenant.code})`,
      ipAddress: getClientIp(req),
    });
    res.status(201).json(newTenant);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mendaftarkan outlet.' });
  }
});

app.put('/api/tenants/:id', requireRoles('owner'), (req, res) => {
  try {
    const auth = getAuth(req);
    const id = String(req.params.id ?? '').trim();
    const existing = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id) as Tenant | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Outlet tidak ditemukan.' });
      return;
    }

    const body = req.body as Partial<Tenant>;
    const name = body.name !== undefined ? body.name.trim() : existing.name;
    const code = body.code !== undefined ? body.code.trim().toUpperCase() : existing.code;
    const branchName = body.branchName !== undefined ? body.branchName.trim() : existing.branchName;
    const city = body.city !== undefined ? body.city.trim() : existing.city;
    const address = body.address !== undefined ? body.address.trim() : existing.address;
    const phone = body.phone !== undefined ? body.phone.trim() : existing.phone;
    const email = body.email !== undefined ? body.email.trim() : existing.email;
    const logoUrl = body.logoUrl !== undefined ? body.logoUrl.trim() : (existing.logoUrl ?? '');
    const status =
      body.status && (['Aktif', 'Trial', 'Nonaktif'] as const).includes(body.status)
        ? body.status
        : existing.status;

    if (!name || name.length < 2 || !code || !branchName) {
      res.status(400).json({ error: 'Nama outlet, kode outlet, dan nama cabang wajib diisi.' });
      return;
    }

    const dupCode = db
      .prepare('SELECT id, name FROM tenants WHERE LOWER(code) = LOWER(?) AND id != ?')
      .get(code, id) as { id: string; name: string } | undefined;
    if (dupCode) {
      res.status(409).json({ error: `Kode outlet "${code}" sudah terdaftar pada "${dupCode.name}".` });
      return;
    }

    if (status === 'Nonaktif') {
      if (id === auth.activeTenantId) {
        res.status(400).json({
          error: 'Tidak dapat menonaktifkan outlet yang sedang aktif digunakan. Beralihlah ke outlet lain terlebih dahulu.',
        });
        return;
      }
      const otherActiveCount = (
        db
          .prepare("SELECT COUNT(*) as cnt FROM tenants WHERE id != ? AND status != 'Nonaktif'")
          .get(id) as { cnt: number }
      ).cnt;
      if (otherActiveCount <= 0) {
        res.status(400).json({
          error: 'Minimal harus ada 1 outlet yang berstatus aktif untuk operasional POS.',
        });
        return;
      }
    }

    const words = name
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const computedInitial =
      words.length >= 2
        ? `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase()
        : (words[0]?.slice(0, 2).toUpperCase() || existing.logoInitial || 'LP');

    db.prepare(
      `UPDATE tenants
       SET name = ?, code = ?, branchName = ?, city = ?, address = ?, phone = ?, email = ?, logoInitial = ?, logoUrl = ?, status = ?
       WHERE id = ?`
    ).run(
      name,
      code,
      branchName,
      city || 'Jakarta',
      address || '-',
      phone || '-',
      email || '-',
      computedInitial,
      logoUrl,
      status,
      id
    );

    const updated = getAllTenants().find(t => t.id === id);
    recordAuditLog({
      tenantId: id,
      tenantName: updated?.name || name,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'UPDATE_TENANT',
      entityType: 'tenant',
      entityId: id,
      entityLabel: `${code} • ${name}`,
      severity: status === 'Nonaktif' ? 'warning' : 'info',
      summary: `Memperbarui profil outlet "${name}" (${code}, status ${status})`,
      ipAddress: getClientIp(req),
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui outlet.' });
  }
});

app.patch('/api/tenants/:id/status', requireRoles('owner'), (req, res) => {
  try {
    const auth = getAuth(req);
    const id = String(req.params.id ?? '').trim();
    const existing = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id) as Tenant | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Outlet tidak ditemukan.' });
      return;
    }

    const nextStatus = (req.body as { status?: string }).status === 'Nonaktif' ? 'Nonaktif' : 'Aktif';
    if (nextStatus === 'Nonaktif') {
      if (id === auth.activeTenantId) {
        res.status(400).json({
          error: 'Outlet ini sedang aktif digunakan. Beralih ke outlet lain terlebih dahulu sebelum menonaktifkannya.',
        });
        return;
      }
      const otherActiveCount = (
        db
          .prepare("SELECT COUNT(*) as cnt FROM tenants WHERE id != ? AND status != 'Nonaktif'")
          .get(id) as { cnt: number }
      ).cnt;
      if (otherActiveCount <= 0) {
        res.status(400).json({
          error: 'Minimal harus ada 1 outlet yang tetap aktif untuk operasional kasir.',
        });
        return;
      }
    }

    db.prepare('UPDATE tenants SET status = ? WHERE id = ?').run(nextStatus, id);
    const updated = getAllTenants().find(t => t.id === id);
    recordAuditLog({
      tenantId: id,
      tenantName: updated?.name || existing.name,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'TOGGLE_TENANT_STATUS',
      entityType: 'tenant',
      entityId: id,
      entityLabel: `${existing.code} • ${existing.name}`,
      severity: nextStatus === 'Nonaktif' ? 'warning' : 'info',
      summary: `Mengubah status outlet "${existing.name}" menjadi ${nextStatus}`,
      ipAddress: getClientIp(req),
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mengubah status outlet.' });
  }
});

app.delete('/api/tenants/:id', requireRoles('owner'), (req, res) => {
  try {
    const auth = getAuth(req);
    const id = String(req.params.id ?? '').trim();
    const existing = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id) as Tenant | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Outlet tidak ditemukan.' });
      return;
    }

    const totalTenants = (db.prepare('SELECT COUNT(*) as cnt FROM tenants').get() as { cnt: number }).cnt;
    if (totalTenants <= 1) {
      res.status(400).json({ error: 'Tidak dapat menghapus satu-satunya outlet yang tersisa.' });
      return;
    }

    if (id === auth.activeTenantId) {
      res.status(400).json({
        error: 'Outlet sedang aktif digunakan. Silakan beralih ke outlet lain sebelum menghapusnya.',
      });
      return;
    }

    const otherActiveCount = (
      db
        .prepare("SELECT COUNT(*) as cnt FROM tenants WHERE id != ? AND status != 'Nonaktif'")
        .get(id) as { cnt: number }
    ).cnt;
    if (otherActiveCount <= 0) {
      res.status(400).json({
        error: 'Tidak dapat menghapus outlet karena minimal harus tersisa 1 outlet aktif.',
      });
      return;
    }

    const txCount = (db.prepare('SELECT COUNT(*) as cnt FROM transactions WHERE tenantId = ?').get(id) as { cnt: number }).cnt;
    if (txCount > 0) {
      res.status(409).json({
        error: `Outlet "${existing.name}" memiliki ${txCount} riwayat transaksi sehingga tidak dapat dihapus permanen. Gunakan fitur Nonaktifkan Outlet agar laporan keuangan tetap terjaga.`,
      });
      return;
    }

    const prodCount = (db.prepare('SELECT COUNT(*) as cnt FROM products WHERE tenantId = ?').get(id) as { cnt: number }).cnt;
    if (prodCount > 0) {
      res.status(409).json({
        error: `Outlet "${existing.name}" masih memiliki ${prodCount} produk terdaftar. Kosongkan produk terlebih dahulu atau gunakan fitur Nonaktifkan Outlet.`,
      });
      return;
    }

    const buybackCount = (db.prepare('SELECT COUNT(*) as cnt FROM buybacks WHERE tenantId = ?').get(id) as { cnt: number }).cnt;
    const promoCount = (db.prepare('SELECT COUNT(*) as cnt FROM promos WHERE tenantId = ?').get(id) as { cnt: number }).cnt;
    const shiftCount = (db.prepare('SELECT COUNT(*) as cnt FROM shift_closings WHERE tenantId = ?').get(id) as { cnt: number }).cnt;
    if (buybackCount > 0 || promoCount > 0 || shiftCount > 0) {
      res.status(409).json({
        error: `Outlet "${existing.name}" masih memiliki data promo/shift/riwayat operasional. Gunakan fitur Nonaktifkan Outlet sebagai gantinya.`,
      });
      return;
    }

    const fallbackTenantId =
      (
        db
          .prepare("SELECT id FROM tenants WHERE id != ? AND status != 'Nonaktif' ORDER BY rowid ASC LIMIT 1")
          .get(id) as { id: string } | undefined
      )?.id || auth.activeTenantId;

    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM store_settings WHERE tenantId = ?').run(id);

      const userRows = db
        .prepare('SELECT id, defaultTenantId, allowedTenantIdsJson FROM users')
        .all() as Array<{ id: string; defaultTenantId: string | null; allowedTenantIdsJson: string }>;
      const updateUserStmt = db.prepare(
        'UPDATE users SET defaultTenantId = ?, allowedTenantIdsJson = ? WHERE id = ?'
      );
      for (const u of userRows) {
        const parsedAllowed = (() => {
          try {
            const arr = JSON.parse(u.allowedTenantIdsJson || '[]');
            return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
          } catch {
            return [];
          }
        })();
        const nextAllowed = parsedAllowed.filter(tid => tid !== id);
        const nextDefault =
          u.defaultTenantId === id ? (nextAllowed[0] ?? fallbackTenantId) : u.defaultTenantId;
        if (nextAllowed.length !== parsedAllowed.length || u.defaultTenantId === id) {
          updateUserStmt.run(nextDefault, JSON.stringify(nextAllowed), u.id);
        }
      }

      db.prepare('UPDATE sessions SET activeTenantId = ? WHERE activeTenantId = ?').run(
        fallbackTenantId,
        id
      );
      db.prepare('DELETE FROM tenants WHERE id = ?').run(id);
    });
    deleteTx();

    recordAuditLog({
      tenantId: auth.activeTenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'DELETE_TENANT',
      entityType: 'tenant',
      entityId: id,
      entityLabel: `${existing.code} • ${existing.name}`,
      severity: 'critical',
      summary: `Menghapus permanen outlet "${existing.name}" (${existing.code})`,
      ipAddress: getClientIp(req),
    });

    res.json({ deletedId: id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menghapus outlet.' });
  }
});

app.patch('/api/tenants/active', (req, res) => {
  try {
    const auth = getAuth(req);
    const tenantId = String((req.body as { tenantId?: string }).tenantId ?? '').trim();
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId wajib diisi.' });
      return;
    }
    const exists = db.prepare('SELECT id, status FROM tenants WHERE id = ?').get(tenantId) as
      | { id: string; status: string }
      | undefined;
    if (!exists) {
      res.status(404).json({ error: 'Outlet tidak ditemukan.' });
      return;
    }
    if (exists.status === 'Nonaktif') {
      res.status(400).json({
        error: 'Outlet ini berstatus Nonaktif dan tidak dapat dipilih untuk operasional kasir. Aktifkan terlebih dahulu di menu Multi-Outlet.',
      });
      return;
    }
    if (!isTenantAllowedForUser(auth.user, tenantId)) {
      res.status(403).json({ error: 'Akun Anda tidak memiliki hak akses ke outlet tersebut.' });
      return;
    }
    updateSessionTenant(auth.token, tenantId);
    res.json({ activeTenantId: tenantId });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memilih outlet aktif.' });
  }
});

// ============================================================
// STORE SETTINGS & SHIFT CLOSING (TAHAP 3)
// ============================================================
app.get('/api/settings', (req, res) => {
  try {
    const auth = getAuth(req);
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(auth.activeTenantId) as Tenant | undefined;
    res.json({
      tenant: tenant ?? null,
      storeSettings: getStoreSettings(auth.activeTenantId),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat pengaturan toko.' });
  }
});

app.put('/api/settings', requireRoles('owner', 'branch_manager'), (req, res) => {
  try {
    const auth = getAuth(req);
    const result = updateStoreSettings(
      auth.activeTenantId,
      req.body as StoreSettingsUpdatePayload,
      auth.user.fullName
    );
    recordAuditLog({
      tenantId: auth.activeTenantId,
      tenantName: result.tenant?.name,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'UPDATE_SETTINGS',
      entityType: 'settings',
      entityId: auth.activeTenantId,
      entityLabel: result.tenant?.name || auth.activeTenantId,
      severity: 'warning',
      summary: `Memperbarui pengaturan toko & preferensi struk outlet "${result.tenant?.name || auth.activeTenantId}"`,
      details: {
        enablePpn: result.storeSettings.enablePpn,
        ppnPercent: result.storeSettings.ppnPercent,
        appTheme: result.storeSettings.appTheme,
      },
      ipAddress: getClientIp(req),
    });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan toko.';
    res.status(400).json({ error: msg });
  }
});

app.get('/api/shifts/summary', (req, res) => {
  try {
    const auth = getAuth(req);
    const date = String(req.query.date ?? '').trim() || new Date().toISOString().slice(0, 10);
    const requestedScope = req.query.scope === 'my' ? 'my' : 'outlet';
    const effectiveScope: 'my' | 'outlet' = auth.user.role === 'cashier' ? 'my' : requestedScope;

    res.json(
      getLiveShiftSummary({
        tenantId: auth.activeTenantId,
        date,
        scope: effectiveScope,
        cashierName: auth.user.fullName,
        cashierId: auth.user.id,
      })
    );
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat ringkasan shift kasir.' });
  }
});

app.get('/api/shifts', (req, res) => {
  try {
    const auth = getAuth(req);
    const page = Number(req.query.page ?? 1) || 1;
    const pageSize = Number(req.query.pageSize ?? 10) || 10;
    const search = String(req.query.search ?? '');
    const varianceFilter = String(req.query.varianceFilter ?? 'all');
    const sortBy = String(req.query.sortBy ?? 'newest');
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';

    res.json(
      queryShiftClosings({
        tenantId: auth.activeTenantId,
        page,
        pageSize,
        search,
        varianceFilter,
        cashierId: auth.user.role === 'cashier' ? auth.user.id : undefined,
        sortBy,
        sortDir,
      })
    );
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat riwayat tutup kasir.' });
  }
});

app.post('/api/shifts/close', (req, res) => {
  try {
    const auth = getAuth(req);
    const created = createShiftClosing({
      tenantId: auth.activeTenantId,
      user: auth.user,
      payload: req.body as ShiftClosingCreatePayload,
    });
    res.status(201).json(created);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan laporan tutup kasir.';
    res.status(400).json({ error: msg });
  }
});

// ============================================================
// AUDIT LOG & DATA BACKUP (OWNER ONLY)
// ============================================================
app.get('/api/admin/audit-logs', requireRoles('owner'), (req, res) => {
  try {
    const page = Number(req.query.page ?? 1) || 1;
    const pageSize = Number(req.query.pageSize ?? 15) || 15;
    const search = String(req.query.search ?? '');
    const severity = String(req.query.severity ?? 'all');
    const entityType = String(req.query.entityType ?? 'all');
    const tenantId = String(req.query.tenantId ?? 'all');
    const dateFrom = String(req.query.dateFrom ?? '').trim();
    const dateTo = String(req.query.dateTo ?? '').trim();
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
    res.json(
      queryAuditLogs({
        page,
        pageSize,
        search,
        severity,
        entityType,
        tenantId,
        dateFrom,
        dateTo,
        sortDir,
      })
    );
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat jejak audit.' });
  }
});

app.get('/api/admin/backup/info', requireRoles('owner'), (_req, res) => {
  try {
    res.json(getBackupDatabaseInfo());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal membaca info database.' });
  }
});

app.get('/api/admin/backup/download', requireRoles('owner'), async (req, res) => {
  const auth = getAuth(req);
  const rawFormat = String(req.query.format ?? 'sqlite').toLowerCase();
  const format = rawFormat === 'json' ? 'json' : 'sqlite';
  const now = new Date();
  const stamp = `${now.toISOString().slice(0, 10)}_${now.toTimeString().slice(0, 8).replace(/:/g, '-')}`;

  if (format === 'json') {
    try {
      const payload = exportStructuredBackupJson(auth.user.fullName);
      const filename = `LogicPOS_Backup_${stamp}.json`;
      const jsonStr = JSON.stringify(payload, null, 2);
      recordAuditLog({
        tenantId: auth.activeTenantId,
        actorId: auth.user.id,
        actorName: auth.user.fullName,
        actorRole: auth.user.role,
        action: 'DOWNLOAD_BACKUP',
        entityType: 'backup',
        entityLabel: filename,
        severity: 'info',
        summary: `Mengunduh arsip backup data terstruktur (${filename})`,
        details: { format: 'json', sizeBytes: Buffer.byteLength(jsonStr, 'utf8') },
        ipAddress: getClientIp(req),
      });
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Backup-Filename', filename);
      res.send(jsonStr);
      return;
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mengekspor backup JSON.' });
      return;
    }
  }

  const filename = `LogicPOS_Database_${stamp}.db`;
  const tmpPath = path.join(os.tmpdir(), `logicpos-backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`);
  try {
    await createDatabaseBackupSnapshot(tmpPath);
    const buffer = await fs.promises.readFile(tmpPath);
    recordAuditLog({
      tenantId: auth.activeTenantId,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      actorRole: auth.user.role,
      action: 'DOWNLOAD_BACKUP',
      entityType: 'backup',
      entityLabel: filename,
      severity: 'info',
      summary: `Mengunduh snapshot database SQLite (${filename})`,
      details: { format: 'sqlite', sizeBytes: buffer.length },
      ipAddress: getClientIp(req),
    });
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Backup-Filename', filename);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal membuat snapshot backup SQLite.' });
  } finally {
    await fs.promises.unlink(tmpPath).catch(() => {});
  }
});

// Unknown /api routes return JSON 404
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
});

async function startServer() {
  const PORT = 3000;
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    // When HMR is disabled, Vite 8's default /@vite/client still opens a WebSocket to port 24678.
    // Serve a clean no-WS client shim that preserves CSS injection & import.meta.hot stubs without WebSocket errors.
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (search ? "&" + search.slice(1) : "") + (hash || "");
}
export class ErrorOverlay {}
`);
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.use((_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
