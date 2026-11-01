export const MAX_ATTEMPTS = 8;
export const LEASE_MS = 2 * 60_000;
const CAP_MS = 6 * 3600_000;

/** Delay before the next try after `attempts` failures so far (1-based): 30s * 4^(n-1), capped at 6h. */
export const backoffMs = (attempts: number) => Math.min(30_000 * 4 ** Math.max(0, attempts - 1), CAP_MS);

/** What to write after a failed attempt. `attempts` is the count BEFORE this failure. */
export function afterFailure(attempts: number, permanent: boolean, now: number) {
  const n = attempts + 1;
  const dead = permanent || n >= MAX_ATTEMPTS;
  return { attempts: n, dead, nextAt: new Date(now + backoffMs(n)) };
}

export const shortError = (reason: string) => reason.replace(/\s+/g, " ").slice(0, 200);
