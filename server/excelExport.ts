import ExcelJS from 'exceljs';
import type {
  Tenant,
  Transaction,
  TransactionExportPeriod,
  TransactionExportStatus,
} from '../src/types/index.ts';

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const SHORT_MONTH_NAMES_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export interface ExportFilterMeta {
  period: TransactionExportPeriod;
  month?: number;
  year?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  method?: string;
  statusFilter?: TransactionExportStatus;
  search?: string;
  exportedBy?: string;
}

function sanitizeFilenameSegment(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function formatReadableDateId(isoDate: string, shortMonth = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((isoDate || '').trim());
  if (!m) return isoDate;
  const year = m[1];
  const monthIdx = Math.max(0, Math.min(11, parseInt(m[2], 10) - 1));
  const day = m[3];
  const monthLabel = (shortMonth ? SHORT_MONTH_NAMES_ID : MONTH_NAMES_ID)[monthIdx] || m[2];
  return `${day}_${monthLabel}_${year}`;
}

export function buildExportPeriodLabel(meta: ExportFilterMeta): string {
  const now = new Date();
  const year = meta.year || now.getFullYear();
  const month = meta.month || now.getMonth() + 1;
  const monthName = MONTH_NAMES_ID[Math.max(0, Math.min(11, month - 1))] || `Bulan ${month}`;

  switch (meta.period) {
    case 'monthly':
      return `Bulan ${monthName} ${year}`;
    case 'daily': {
      const target = meta.date || now.toISOString().slice(0, 10);
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(target);
      if (m) {
        const mName = MONTH_NAMES_ID[Math.max(0, Math.min(11, parseInt(m[2], 10) - 1))];
        return `Tanggal ${Number(m[3])} ${mName} ${m[1]}`;
      }
      return `Tanggal ${target}`;
    }
    case 'custom': {
      const from = meta.dateFrom || now.toISOString().slice(0, 10);
      const to = meta.dateTo || from;
      return `Periode ${formatReadableDateId(from, true).replace(/_/g, ' ')} s/d ${formatReadableDateId(to, true).replace(/_/g, ' ')}`;
    }
    case 'yearly':
      return `Tahun ${year}`;
    case 'all':
    default:
      return 'Semua Periode';
  }
}

export function buildExportFilename(
  tenant: Tenant | null | undefined,
  meta: ExportFilterMeta,
  format: 'xlsx' | 'csv' = 'xlsx'
): string {
  const storeRaw = tenant?.name ? sanitizeFilenameSegment(tenant.name) : 'LogicPOS';
  const branchRaw = tenant?.code ? sanitizeFilenameSegment(tenant.code) : '';
  const now = new Date();
  const year = meta.year || now.getFullYear();
  const month = meta.month || now.getMonth() + 1;
  const monthName = MONTH_NAMES_ID[Math.max(0, Math.min(11, month - 1))] || `Bulan_${month}`;

  let periodPart = '';
  switch (meta.period) {
    case 'monthly':
      periodPart = `Bulan_${monthName}_${year}`;
      break;
    case 'daily': {
      const target = meta.date || now.toISOString().slice(0, 10);
      periodPart = formatReadableDateId(target, false);
      break;
    }
    case 'custom': {
      const from = meta.dateFrom || now.toISOString().slice(0, 10);
      const to = meta.dateTo || from;
      periodPart = `${formatReadableDateId(from, true)}_sd_${formatReadableDateId(to, true)}`;
      break;
    }
    case 'yearly':
      periodPart = `Tahun_${year}`;
      break;
    case 'all':
    default:
      periodPart = `Semua_Periode_${now.toISOString().slice(0, 10).replace(/-/g, '')}`;
      break;
  }

  const methodSuffix =
    meta.method && meta.method !== 'semua' ? `_${sanitizeFilenameSegment(meta.method.toUpperCase())}` : '';
  const outletPart = [storeRaw, branchRaw].filter(Boolean).join('_');
  return `Laporan_Transaksi_${outletPart}_${periodPart}${methodSuffix}.${format}`;
}

export function getPaymentMethodLabel(tx: Transaction): string {
  if (tx.status === 'void') return 'Dibatalkan (VOID)';
  if (tx.paymentMethod === 'cash') return 'Tunai';
  return tx.paymentDetails?.transferBank ? `Transfer (${tx.paymentDetails.transferBank})` : 'Transfer Bank';
}

export function getPaymentDetailText(tx: Transaction): string {
  if (tx.paymentMethod === 'cash') {
    const received = tx.paymentDetails?.cashReceived ?? tx.grandTotal;
    const change = tx.paymentDetails?.cashChange ?? 0;
    return `Bayar Rp ${received.toLocaleString('id-ID')} | Kembali Rp ${change.toLocaleString('id-ID')}`;
  }
  return [
    tx.paymentDetails?.transferBank || 'Bank',
    tx.paymentDetails?.transferRef ? `Ref: ${tx.paymentDetails.transferRef}` : '',
  ]
    .filter(Boolean)
    .join(' • ');
}

const BRAND_HEADER_FILL = 'FF6D28D9';
const SUBHEADER_FILL = 'FFF3E8FF';
const ZEBRA_FILL = 'FFFAFAFC';
const TOTAL_ROW_FILL = 'FFEDE9FE';
const BORDER_COLOR = 'FFD4D4D8';

function applyThinBorder(cell: ExcelJS.Cell, color = BORDER_COLOR): void {
  cell.border = {
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } },
  };
}

function autoFitColumns(sheet: ExcelJS.Worksheet, minWidth = 10, maxWidth = 44): void {
  sheet.columns.forEach(column => {
    let maxLen = minWidth;
    column.eachCell?.({ includeEmpty: false }, cell => {
      // Skip wide merged banner titles in row 1-2
      if (Number(cell.row) <= 2 && Number(column.number) === 1) return;
      const val = cell.value;
      let text = '';
      if (val === null || val === undefined) text = '';
      else if (typeof val === 'object' && 'richText' in val) {
        text = val.richText.map(r => r.text).join('');
      } else if (typeof val === 'object' && 'result' in val) {
        text = String(val.result ?? '');
      } else {
        text = String(val);
      }
      const lines = text.split('\n');
      for (const line of lines) {
        maxLen = Math.max(maxLen, line.length + 3);
      }
    });
    column.width = Math.min(maxWidth, Math.max(minWidth, maxLen));
  });
}

export async function generateTransactionsExcelBuffer(
  transactions: Transaction[],
  tenant: Tenant | null | undefined,
  meta: ExportFilterMeta
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LogicPOS';
  workbook.created = new Date();
  workbook.modified = new Date();

  const periodLabel = buildExportPeriodLabel(meta);
  const storeTitle = tenant ? `${tenant.name} — ${tenant.branchName} (${tenant.code})` : 'LogicPOS';
  const exportedAt = new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const activeTxs = transactions.filter(t => t.status !== 'void');
  const voidTxs = transactions.filter(t => t.status === 'void');

  const totalQtyAll = activeTxs.reduce((s, t) => s + (t.totalQty || 0), 0);
  const totalSubtotalAll = activeTxs.reduce((s, t) => s + (t.subtotal || 0), 0);
  const totalTaxAll = activeTxs.reduce((s, t) => s + (t.tax || 0), 0);
  const totalGrandAll = activeTxs.reduce((s, t) => s + (t.grandTotal || 0), 0);

  let totalHppAll = 0;
  for (const tx of activeTxs) {
    for (const it of tx.items) {
      totalHppAll += (it.hpp || 0) * (it.qty || 0);
    }
  }
  const totalGrossProfit = totalSubtotalAll - totalHppAll;

  // ==========================================================
  // SHEET 1: RINGKASAN LAPORAN
  // ==========================================================
  const summarySheet = workbook.addWorksheet('Ringkasan Laporan', {
    views: [{ showGridLines: true }],
    properties: { tabColor: { argb: 'FF6D28D9' } },
  });

  summarySheet.mergeCells('A1:D1');
  const sTitle = summarySheet.getCell('A1');
  sTitle.value = `LAPORAN TRANSAKSI PENJUALAN — ${storeTitle}`;
  sTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  sTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_HEADER_FILL } };
  sTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  summarySheet.getRow(1).height = 30;

  summarySheet.mergeCells('A2:D2');
  const sSub = summarySheet.getCell('A2');
  sSub.value = `Periode: ${periodLabel}  •  Diekspor: ${exportedAt}${meta.exportedBy ? ` oleh ${meta.exportedBy}` : ''}`;
  sSub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF4C1D95' } };
  sSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEADER_FILL } };
  sSub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  summarySheet.getRow(2).height = 22;

  const methodFilterLabel =
    !meta.method || meta.method === 'semua'
      ? 'Semua Metode Pembayaran'
      : meta.method === 'cash'
      ? 'Tunai'
      : 'Transfer Bank';
  const statusFilterLabel =
    meta.statusFilter === 'void'
      ? 'Hanya Transaksi VOID'
      : meta.statusFilter === 'all'
      ? 'Semua Status (Lunas & VOID)'
      : 'Hanya Transaksi Lunas (Aktif)';

  const kpiRows: Array<[string, string | number, string?]> = [
    ['Outlet / Cabang', storeTitle],
    ['Periode Laporan', periodLabel],
    ['Filter Metode Pembayaran', methodFilterLabel],
    ['Filter Status Transaksi', statusFilterLabel],
    ['Total Transaksi Lunas', activeTxs.length, '#,##0'],
    ['Total Transaksi VOID', voidTxs.length, '#,##0'],
    ['Total Produk Terjual (pcs)', totalQtyAll, '#,##0'],
    ['Total Penjualan Sebelum PPN (Rp)', totalSubtotalAll, '"Rp "#,##0'],
    ['Total Pajak PPN (Rp)', totalTaxAll, '"Rp "#,##0'],
    ['Grand Total Omzet Penjualan (Rp)', totalGrandAll, '"Rp "#,##0'],
    ['Total Estimasi HPP / Modal (Rp)', totalHppAll, '"Rp "#,##0'],
    ['Estimasi Laba Kotor (Rp)', totalGrossProfit, '"Rp "#,##0'],
  ];

  let curRow = 4;
  const kpiHdr = summarySheet.getRow(curRow);
  kpiHdr.values = ['Ringkasan Kinerja Penjualan', 'Nilai'];
  summarySheet.mergeCells(`B${curRow}:D${curRow}`);
  kpiHdr.height = 24;
  for (let c = 1; c <= 4; c++) {
    const cell = kpiHdr.getCell(c);
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18181B' } };
    cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
    applyThinBorder(cell, 'FF18181B');
  }

  for (let idx = 0; idx < kpiRows.length; idx++) {
    curRow += 1;
    const [label, val, numFmt] = kpiRows[idx];
    const row = summarySheet.getRow(curRow);
    row.getCell(1).value = label;
    row.getCell(2).value = val;
    summarySheet.mergeCells(`B${curRow}:D${curRow}`);
    row.height = 21;
    const isHighlight = label.startsWith('Grand Total') || label.startsWith('Estimasi Laba');
    for (let c = 1; c <= 4; c++) {
      const cell = row.getCell(c);
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: isHighlight || c > 1,
        color: { argb: isHighlight ? 'FF4C1D95' : 'FF18181B' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isHighlight ? TOTAL_ROW_FILL : idx % 2 === 1 ? ZEBRA_FILL : 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
      applyThinBorder(cell);
    }
    if (numFmt) {
      row.getCell(2).numFmt = numFmt;
    }
  }

  // Rekap per Metode Pembayaran
  curRow += 2;
  const payHeaderRow = summarySheet.getRow(curRow);
  payHeaderRow.values = ['Rekap Metode Pembayaran (Lunas)', 'Jumlah Nota', 'Qty (pcs)', 'Total Bayar (Rp)'];
  payHeaderRow.height = 24;
  payHeaderRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'right' };
    applyThinBorder(cell, BRAND_HEADER_FILL);
  });

  const payMethodGroups: Array<{ key: 'cash' | 'transfer'; label: string }> = [
    { key: 'cash', label: 'Tunai (Cash)' },
    { key: 'transfer', label: 'Transfer Bank' },
  ];

  for (let idx = 0; idx < payMethodGroups.length; idx++) {
    const grp = payMethodGroups[idx];
    const matching = activeTxs.filter(t =>
      grp.key === 'cash' ? t.paymentMethod === 'cash' : t.paymentMethod !== 'cash'
    );
    curRow += 1;
    const row = summarySheet.getRow(curRow);
    row.values = [
      grp.label,
      matching.length,
      matching.reduce((s, t) => s + t.totalQty, 0),
      matching.reduce((s, t) => s + t.grandTotal, 0),
    ];
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF18181B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 1 ? ZEBRA_FILL : 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'right' };
      applyThinBorder(cell);
    });
    row.getCell(2).numFmt = '#,##0';
    row.getCell(3).numFmt = '#,##0';
    row.getCell(4).numFmt = '"Rp "#,##0';
  }

  // Total baris metode pembayaran
  curRow += 1;
  const payTotalRow = summarySheet.getRow(curRow);
  payTotalRow.values = ['Total Pembayaran Lunas', activeTxs.length, totalQtyAll, totalGrandAll];
  payTotalRow.height = 22;
  payTotalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4C1D95' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_ROW_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'right' };
    applyThinBorder(cell, BRAND_HEADER_FILL);
  });
  payTotalRow.getCell(2).numFmt = '#,##0';
  payTotalRow.getCell(3).numFmt = '#,##0';
  payTotalRow.getCell(4).numFmt = '"Rp "#,##0';

  // Rekap per Kategori Produk
  curRow += 2;
  const catHeaderRow = summarySheet.getRow(curRow);
  catHeaderRow.values = ['Rekap Per Kategori Produk (Lunas)', 'Qty Terjual (pcs)', 'HPP (Rp)', 'Total Penjualan (Rp)'];
  catHeaderRow.height = 24;
  catHeaderRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'right' };
    applyThinBorder(cell, BRAND_HEADER_FILL);
  });

  const categoryAgg = new Map<string, { qty: number; hpp: number; subtotal: number }>();
  for (const tx of activeTxs) {
    for (const it of tx.items) {
      const catName = it.category || 'Lainnya';
      const prev = categoryAgg.get(catName) ?? { qty: 0, hpp: 0, subtotal: 0 };
      prev.qty += it.qty;
      prev.hpp += (it.hpp || 0) * it.qty;
      prev.subtotal += it.subtotal;
      categoryAgg.set(catName, prev);
    }
  }
  const sortedCategories = Array.from(categoryAgg.entries()).sort((a, b) => b[1].subtotal - a[1].subtotal);
  if (sortedCategories.length === 0) {
    curRow += 1;
    const row = summarySheet.getRow(curRow);
    row.values = ['Belum ada data penjualan kategori pada periode ini', 0, 0, 0];
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, italic: colNumber === 1, color: { argb: 'FF71717A' } };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'right' };
      applyThinBorder(cell);
    });
    row.getCell(2).numFmt = '#,##0';
    row.getCell(3).numFmt = '"Rp "#,##0';
    row.getCell(4).numFmt = '"Rp "#,##0';
  } else {
    sortedCategories.forEach(([catName, agg], idx) => {
      curRow += 1;
      const row = summarySheet.getRow(curRow);
      row.values = [catName, agg.qty, agg.hpp, agg.subtotal];
      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF18181B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 1 ? ZEBRA_FILL : 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'right' };
        applyThinBorder(cell);
      });
      row.getCell(2).numFmt = '#,##0';
      row.getCell(3).numFmt = '"Rp "#,##0';
      row.getCell(4).numFmt = '"Rp "#,##0';
    });

    curRow += 1;
    const catTotalRow = summarySheet.getRow(curRow);
    catTotalRow.values = ['Total Penjualan Kategori (Sebelum PPN)', totalQtyAll, totalHppAll, totalSubtotalAll];
    catTotalRow.height = 22;
    catTotalRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4C1D95' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_ROW_FILL } };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'right' };
      applyThinBorder(cell, BRAND_HEADER_FILL);
    });
    catTotalRow.getCell(2).numFmt = '#,##0';
    catTotalRow.getCell(3).numFmt = '"Rp "#,##0';
    catTotalRow.getCell(4).numFmt = '"Rp "#,##0';
  }

  autoFitColumns(summarySheet, 20, 42);
  summarySheet.getColumn(1).width = 36;
  summarySheet.getColumn(2).width = 20;
  summarySheet.getColumn(3).width = 20;
  summarySheet.getColumn(4).width = 24;

  // ==========================================================
  // SHEET 2: REKAP TRANSAKSI
  // ==========================================================
  const txSheet = workbook.addWorksheet('Rekap Transaksi', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
    properties: { tabColor: { argb: 'FF059669' } },
  });

  txSheet.mergeCells('A1:O1');
  const txTitle = txSheet.getCell('A1');
  txTitle.value = `REKAP TRANSAKSI PENJUALAN — ${storeTitle}`;
  txTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  txTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_HEADER_FILL } };
  txTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  txSheet.getRow(1).height = 28;

  txSheet.mergeCells('A2:O2');
  const txSub = txSheet.getCell('A2');
  txSub.value = `Periode: ${periodLabel}  •  Jumlah Nota: ${transactions.length}  •  Diekspor: ${exportedAt}`;
  txSub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF4C1D95' } };
  txSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEADER_FILL } };
  txSub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  txSheet.getRow(2).height = 20;

  const txHeaders = [
    'No',
    'No. Transaksi',
    'Tanggal',
    'Waktu',
    'Kasir',
    'Pelanggan',
    'Kode Member',
    'Nama Produk',
    'Qty (pcs)',
    'Subtotal (Rp)',
    'PPN (Rp)',
    'Total Bayar (Rp)',
    'Pembayaran',
    'Rincian Pembayaran',
    'Status',
  ];

  const txHeaderRow = txSheet.getRow(4);
  txHeaderRow.values = txHeaders;
  txHeaderRow.height = 25;
  txHeaderRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_HEADER_FILL } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: [1, 9, 10, 11, 12].includes(colNumber) ? 'right' : 'left',
      wrapText: true,
    };
    applyThinBorder(cell, BRAND_HEADER_FILL);
  });

  transactions.forEach((tx, idx) => {
    const productLines = tx.items.map(it => {
      const criteria = [
        it.category,
        it.brand && it.brand !== 'No Brand' ? it.brand : '',
      ]
        .filter(Boolean)
        .join(' · ');
      return `• ${it.name} (${it.qty} pcs${criteria ? ` — ${criteria}` : ''})`;
    });
    const productSummary = productLines.join('\n');

    const statusText =
      tx.status === 'void'
        ? `VOID${tx.voidReason ? ` (${tx.voidReason})` : ''}`
        : 'SELESAI (LUNAS)';

    const row = txSheet.getRow(5 + idx);
    row.values = [
      idx + 1,
      tx.invoiceNo,
      tx.dateStr,
      tx.timeStr,
      tx.cashier,
      tx.customerName,
      tx.customerMemberCode || '-',
      productSummary || '-',
      tx.totalQty,
      tx.subtotal,
      tx.tax,
      tx.grandTotal,
      getPaymentMethodLabel(tx),
      getPaymentDetailText(tx),
      statusText,
    ];
    row.height = Math.max(22, Math.min(96, Math.max(1, productLines.length) * 15 + 6));
    const isVoid = tx.status === 'void';
    row.eachCell((cell, colNumber) => {
      cell.font = {
        name: 'Calibri',
        size: 10,
        color: { argb: isVoid ? 'FFB91C1C' : 'FF18181B' },
        strike: isVoid && colNumber === 12,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isVoid ? 'FFFEF2F2' : idx % 2 === 1 ? ZEBRA_FILL : 'FFFFFFFF' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: [1, 9, 10, 11, 12].includes(colNumber) ? 'right' : 'left',
        wrapText: colNumber === 8 || colNumber === 15,
      };
      applyThinBorder(cell);
    });
    row.getCell(1).numFmt = '#,##0';
    row.getCell(9).numFmt = '#,##0';
    row.getCell(10).numFmt = '"Rp "#,##0';
    row.getCell(11).numFmt = '"Rp "#,##0';
    row.getCell(12).numFmt = '"Rp "#,##0';
  });

  // Totals Row for Sheet 2
  const txTotalRowIdx = 5 + transactions.length;
  const txTotalRow = txSheet.getRow(txTotalRowIdx);
  txTotalRow.values = [
    '',
    `TOTAL AKTIF (${activeTxs.length} Nota)`,
    '',
    '',
    '',
    '',
    '',
    '',
    totalQtyAll,
    totalSubtotalAll,
    totalTaxAll,
    totalGrandAll,
    '',
    '',
    voidTxs.length > 0 ? `${voidTxs.length} Nota VOID tidak dihitung` : 'Semua Nota Terverifikasi',
  ];
  txTotalRow.height = 24;
  txTotalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4C1D95' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_ROW_FILL } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: [9, 10, 11, 12].includes(colNumber) ? 'right' : 'left',
    };
    applyThinBorder(cell, BRAND_HEADER_FILL);
  });
  txTotalRow.getCell(9).numFmt = '#,##0';
  txTotalRow.getCell(10).numFmt = '"Rp "#,##0';
  txTotalRow.getCell(11).numFmt = '"Rp "#,##0';
  txTotalRow.getCell(12).numFmt = '"Rp "#,##0';

  txSheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: Math.max(4, txTotalRowIdx - 1), column: txHeaders.length },
  };
  autoFitColumns(txSheet, 11, 44);
  txSheet.getColumn(1).width = 6;
  txSheet.getColumn(8).width = 44;
  txSheet.getColumn(14).width = 28;
  txSheet.getColumn(15).width = 24;

  // ==========================================================
  // SHEET 3: DETAIL ITEM PRODUK
  // ==========================================================
  const itemSheet = workbook.addWorksheet('Detail Item Produk', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
    properties: { tabColor: { argb: 'FF2563EB' } },
  });

  itemSheet.mergeCells('A1:P1');
  const itemTitle = itemSheet.getCell('A1');
  itemTitle.value = `DETAIL ITEM PRODUK TERJUAL — ${storeTitle}`;
  itemTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  itemTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_HEADER_FILL } };
  itemTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  itemSheet.getRow(1).height = 28;

  itemSheet.mergeCells('A2:P2');
  const itemSub = itemSheet.getCell('A2');
  itemSub.value = `Periode: ${periodLabel}  •  Rincian Nama Produk, Kategori, Merek / Brand, Harga Jual, HPP & Laba`;
  itemSub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF4C1D95' } };
  itemSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEADER_FILL } };
  itemSub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  itemSheet.getRow(2).height = 20;

  const itemHeaders = [
    'No',
    'No. Transaksi',
    'Tanggal',
    'Waktu',
    'Kasir',
    'Pelanggan',
    'Nama Produk',
    'Kategori',
    'Merek / Brand',
    'Qty (pcs)',
    'HPP (Rp)',
    'Harga Jual (Rp)',
    'Subtotal (Rp)',
    'Estimasi Laba (Rp)',
    'Pembayaran',
    'Status',
  ];

  const itemHeaderRow = itemSheet.getRow(4);
  itemHeaderRow.values = itemHeaders;
  itemHeaderRow.height = 25;
  itemHeaderRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_HEADER_FILL } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: [1, 10, 11, 12, 13, 14].includes(colNumber) ? 'right' : 'left',
      wrapText: true,
    };
    applyThinBorder(cell, BRAND_HEADER_FILL);
  });

  let itemRowIdx = 4;
  let itemLineNo = 0;
  let activeItemLineCount = 0;
  let sumDetailQty = 0;
  let sumDetailSubtotal = 0;
  let sumDetailProfit = 0;

  for (const tx of transactions) {
    const isVoid = tx.status === 'void';
    const methodLabel = getPaymentMethodLabel(tx);
    const statusLabel = isVoid ? 'VOID' : 'SELESAI';

    for (const it of tx.items) {
      itemRowIdx += 1;
      itemLineNo += 1;
      const hppVal = it.hpp || 0;
      const profitVal = hppVal > 0 ? it.subtotal - hppVal * it.qty : 0;

      if (!isVoid) {
        activeItemLineCount += 1;
        sumDetailQty += it.qty || 0;
        sumDetailSubtotal += it.subtotal || 0;
        sumDetailProfit += profitVal;
      }

      const row = itemSheet.getRow(itemRowIdx);
      row.values = [
        itemLineNo,
        tx.invoiceNo,
        tx.dateStr,
        tx.timeStr,
        tx.cashier,
        tx.customerName,
        it.name,
        it.category || '-',
        it.brand || 'No Brand',
        it.qty,
        hppVal,
        it.harga,
        it.subtotal,
        profitVal,
        methodLabel,
        statusLabel,
      ];
      row.height = 21;
      row.eachCell((cell, colNumber) => {
        cell.font = {
          name: 'Calibri',
          size: 10,
          color: { argb: isVoid ? 'FFB91C1C' : 'FF18181B' },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isVoid ? 'FFFEF2F2' : itemLineNo % 2 === 0 ? ZEBRA_FILL : 'FFFFFFFF' },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: [1, 10, 11, 12, 13, 14].includes(colNumber) ? 'right' : 'left',
        };
        applyThinBorder(cell);
      });
      row.getCell(1).numFmt = '#,##0';
      row.getCell(10).numFmt = '#,##0';
      row.getCell(11).numFmt = '"Rp "#,##0';
      row.getCell(12).numFmt = '"Rp "#,##0';
      row.getCell(13).numFmt = '"Rp "#,##0';
      row.getCell(14).numFmt = '"Rp "#,##0';
    }
  }

  const itemTotalRow = itemSheet.getRow(itemRowIdx + 1);
  itemTotalRow.values = [
    '',
    `TOTAL ITEM AKTIF (${activeItemLineCount} Baris)`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    sumDetailQty,
    '',
    '',
    sumDetailSubtotal,
    sumDetailProfit,
    '',
    '',
  ];
  itemTotalRow.height = 24;
  itemTotalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4C1D95' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_ROW_FILL } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: [10, 13, 14].includes(colNumber) ? 'right' : 'left',
    };
    applyThinBorder(cell, BRAND_HEADER_FILL);
  });
  itemTotalRow.getCell(10).numFmt = '#,##0';
  itemTotalRow.getCell(13).numFmt = '"Rp "#,##0';
  itemTotalRow.getCell(14).numFmt = '"Rp "#,##0';

  itemSheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: Math.max(4, itemRowIdx), column: itemHeaders.length },
  };
  autoFitColumns(itemSheet, 11, 38);
  itemSheet.getColumn(1).width = 6;
  itemSheet.getColumn(7).width = 34;

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateTransactionsCsvString(transactions: Transaction[]): string {
  const headers = [
    'No. Transaksi',
    'Tanggal',
    'Waktu',
    'Kasir',
    'Pelanggan',
    'Kode Member',
    'Nama Produk',
    'Kategori',
    'Merek / Brand',
    'Qty (pcs)',
    'Harga Jual (Rp)',
    'Subtotal (Rp)',
    'PPN (Rp)',
    'Total Bayar (Rp)',
    'Pembayaran',
    'Status',
  ];

  const lines: string[] = [headers.map(escapeCsvCell).join(',')];
  for (const tx of transactions) {
    const methodLabel = getPaymentMethodLabel(tx);
    const statusLabel = tx.status === 'void' ? 'VOID' : 'SELESAI';
    for (const it of tx.items) {
      lines.push(
        [
          tx.invoiceNo,
          tx.dateStr,
          tx.timeStr,
          tx.cashier,
          tx.customerName,
          tx.customerMemberCode || '-',
          it.name,
          it.category || '-',
          it.brand || 'No Brand',
          it.qty,
          it.harga,
          it.subtotal,
          tx.tax,
          tx.grandTotal,
          methodLabel,
          statusLabel,
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    }
  }

  return `\uFEFF${lines.join('\r\n')}`;
}
