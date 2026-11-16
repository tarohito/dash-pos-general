import { useEffect, useState } from 'react';

export const NEW_BADGE_DURATION_MS = 5 * 60 * 1000;

export function isRecentlyCreated(
  createdAt?: string | null,
  nowMs: number = Date.now()
): boolean {
  if (!createdAt) return false;
  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) return false;
  const diff = nowMs - parsed;
  return diff >= -60_000 && diff < NEW_BADGE_DURATION_MS;
}

export function useNewBadgeClock(
  timestamps: Array<string | null | undefined>
): number {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const current = Date.now();
    let nextExpirationDelay = Infinity;

    for (const ts of timestamps) {
      if (!ts) continue;
      const parsed = Date.parse(ts);
      if (Number.isNaN(parsed)) continue;
      const remaining = parsed + NEW_BADGE_DURATION_MS - current;
      if (remaining > 0 && remaining < nextExpirationDelay) {
        nextExpirationDelay = remaining;
      }
    }

    if (!Number.isFinite(nextExpirationDelay)) return;

    const timer = window.setTimeout(() => {
      setNowMs(Date.now());
    }, Math.max(250, Math.min(nextExpirationDelay + 250, NEW_BADGE_DURATION_MS + 1000)));

    return () => window.clearTimeout(timer);
  }, [timestamps, nowMs]);

  return nowMs;
}
