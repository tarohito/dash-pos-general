import type { PromoCampaign } from '../types/index.ts';

export type PromoEffectiveStatus = 'active' | 'scheduled' | 'expired' | 'inactive';

const PROMO_DATE_FMT = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const WIB_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getTodayWibDateStr(now: Date = new Date()): string {
  return WIB_DATE_FMT.format(now);
}

export function isValidIsoDateStr(value: string): boolean {
  const clean = (value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function parsePromoUtcMs(dateStr: string): number | null {
  const clean = (dateStr || '').trim();
  if (!isValidIsoDateStr(clean)) return null;
  const [y, m, d] = clean.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDaysIso(dateStr: string, deltaDays: number): string {
  const ms = parsePromoUtcMs(dateStr);
  if (ms === null) return dateStr;
  const next = new Date(ms + Math.trunc(deltaDays) * 86_400_000);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  const d = String(next.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getPromoDurationDays(startDate: string, endDate: string): number | null {
  const startMs = parsePromoUtcMs(startDate);
  const endMs = parsePromoUtcMs(endDate);
  if (startMs === null || endMs === null) return null;
  const diffDays = Math.round((endMs - startMs) / 86_400_000) + 1;
  return diffDays > 0 ? diffDays : 0;
}

export function getEndDateFromDuration(startDate: string, durationDays: number): string {
  const safeDays = Math.max(1, Math.min(3650, Math.round(durationDays) || 1));
  return addDaysIso(startDate, safeDays - 1);
}

export function getPromoRemainingDays(endDate: string, todayStr: string = getTodayWibDateStr()): number {
  const endMs = parsePromoUtcMs(endDate);
  const todayMs = parsePromoUtcMs(todayStr);
  if (endMs === null || todayMs === null) return 0;
  return Math.round((endMs - todayMs) / 86_400_000);
}

export function getDaysUntilStart(startDate: string, todayStr: string = getTodayWibDateStr()): number {
  const startMs = parsePromoUtcMs(startDate);
  const todayMs = parsePromoUtcMs(todayStr);
  if (startMs === null || todayMs === null) return 0;
  return Math.round((startMs - todayMs) / 86_400_000);
}

export function formatPromoDate(dateStr: string): string {
  const ms = parsePromoUtcMs(dateStr);
  if (ms === null) return dateStr || '-';
  return PROMO_DATE_FMT.format(new Date(ms));
}

export function getPromoEffectiveStatus(
  promo: Pick<PromoCampaign, 'isActive' | 'startDate' | 'endDate'>,
  todayStr: string = getTodayWibDateStr()
): PromoEffectiveStatus {
  if (promo.endDate && promo.endDate < todayStr) {
    return 'expired';
  }
  if (!promo.isActive) {
    return 'inactive';
  }
  if (promo.startDate && promo.startDate > todayStr) {
    return 'scheduled';
  }
  return 'active';
}

export function getPromoStatusSummary(
  promo: Pick<PromoCampaign, 'isActive' | 'startDate' | 'endDate'>,
  todayStr: string = getTodayWibDateStr()
): {
  status: PromoEffectiveStatus;
  label: string;
  detailText: string;
  durationDays: number | null;
  remainingDays: number;
  untilStartDays: number;
} {
  const status = getPromoEffectiveStatus(promo, todayStr);
  const durationDays = getPromoDurationDays(promo.startDate, promo.endDate);
  const remainingDays = getPromoRemainingDays(promo.endDate, todayStr);
  const untilStartDays = getDaysUntilStart(promo.startDate, todayStr);

  if (status === 'expired') {
    const ago = Math.abs(remainingDays);
    return {
      status,
      label: 'Berakhir',
      detailText: ago === 1 ? 'Berakhir kemarin' : `Berakhir ${ago} hari lalu`,
      durationDays,
      remainingDays,
      untilStartDays,
    };
  }
  if (status === 'scheduled') {
    return {
      status,
      label: 'Terjadwal',
      detailText: untilStartDays === 1 ? 'Mulai besok' : `Mulai ${untilStartDays} hari lagi`,
      durationDays,
      remainingDays,
      untilStartDays,
    };
  }
  if (status === 'inactive') {
    return {
      status,
      label: 'Nonaktif',
      detailText: 'Dijeda manual',
      durationDays,
      remainingDays,
      untilStartDays,
    };
  }
  return {
    status: 'active',
    label: 'Aktif',
    detailText: remainingDays === 0 ? 'Berakhir hari ini' : `Sisa ${remainingDays} hari`,
    durationDays,
    remainingDays,
    untilStartDays,
  };
}
