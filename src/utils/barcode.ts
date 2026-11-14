import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export type BarcodeLabelFormat = 'hybrid' | 'code128' | 'qr' | 'butterfly';

const CATEGORY_CODE_MAP: Record<string, string> = {
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

/**
 * Menghasilkan SKU standar retail: [KATEGORI]-[3 DIGIT ACAK]
 * Contoh: PF-418, SK-705, BC-109
 * Kompatibel penuh dengan Code 128 dan QR Code.
 */
export function generateRetailSku(category: string, _productName = ''): string {
  const normalizedCat = category.trim().toLowerCase();
  let catCode = CATEGORY_CODE_MAP[normalizedCat];
  if (!catCode) {
    const cleanAlpha = normalizedCat.replace(/[^a-z]/g, '');
    catCode = (cleanAlpha.slice(0, 2) || 'PR').toUpperCase();
  }

  const randomSeq = Math.floor(100 + Math.random() * 900);
  return `${catCode}-${randomSeq}`;
}

export const generateJewelrySku = generateRetailSku;

/**
 * Validasi karakter ASCII printable untuk standar Code 128.
 */
export function isValidCode128(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code < 32 || code > 126) return false;
  }
  return true;
}

/**
 * Mengekstrak kode SKU bersih dari hasil scan Code 128, EAN-13, maupun QR Code
 * (mendukung teks polos `PF-418`, prefix `SKU:PF-418`, atau JSON `{"sku":"PF-418"}`).
 */
export function extractBarcodeValue(rawScan: string): string {
  const trimmed = rawScan.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as { sku?: string; code?: string; id?: string | number };
      if (parsed.sku) return String(parsed.sku).trim();
      if (parsed.code) return String(parsed.code).trim();
      if (parsed.id !== undefined) return String(parsed.id).trim();
    } catch {
      // Abaikan jika bukan JSON valid
    }
  }

  const skuPrefixMatch = trimmed.match(/^(?:SKU|BARCODE|CODE)\s*[:=]\s*(.+)$/i);
  if (skuPrefixMatch) {
    return skuPrefixMatch[1].trim();
  }

  if (trimmed.includes('|')) {
    const firstPart = trimmed.split('|')[0]?.trim();
    if (firstPart) return firstPart;
  }

  return trimmed;
}

/**
 * Render Code 128 barcode ke elemen SVG menggunakan standar CODE128.
 */
export function renderCode128ToSvg(
  svgEl: SVGSVGElement | null,
  value: string,
  options?: { height?: number; barWidth?: number; fontSize?: number; displayValue?: boolean }
): boolean {
  if (!svgEl) return false;
  const clean = value.trim();
  if (!isValidCode128(clean)) return false;

  try {
    JsBarcode(svgEl, clean, {
      format: 'CODE128',
      width: options?.barWidth ?? 1.5,
      height: options?.height ?? 34,
      displayValue: options?.displayValue ?? true,
      font: 'Roboto Mono, monospace',
      fontSize: options?.fontSize ?? 10,
      fontOptions: 'bold',
      textMargin: 2,
      margin: 2,
      background: 'transparent',
      lineColor: '#111827',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Membuat QR Code crisp berbasis Data URL (Error Correction Level M).
 */
export async function createQrCodeDataUrl(value: string, width = 96): Promise<string> {
  const clean = value.trim();
  if (!clean) return '';
  return QRCode.toDataURL(clean, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
  });
}
