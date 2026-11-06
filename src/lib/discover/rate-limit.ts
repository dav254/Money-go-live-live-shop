/**
 * DISCOVERY RATE LIMIT — a small fixed-window limiter.
 *
 * ## Scope, stated honestly
 *
 * This is per Node process, like the Growth Posts scheduler's in-flight guard.
 * Behind several instances it divides the effective limit by the instance
 * count; it is a brake on abuse, not a billing control. Anything stricter would
 * need shared state, and adding Redis for a search page would be a much larger
 * dependency than the problem justifies.
 *
 * The limit is deliberately generous: a real customer types, filters and pages,
 * and a limiter that punishes paging is a limiter that punishes browsing.
 */

export interface RateDecision {
  allowed: boolean;
  /** Seconds until the window resets — sent as `Retry-After`. */
  retryAfter: number;
  remaining: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
/** Bound the map so a spray of distinct keys cannot exhaust memory. */
const MAX_KEYS = 5_000;

const buckets = new Map<string, Bucket>();

/** The client address, or `unknown` when no proxy header is present. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function rateLimit(key: string, now: number = Date.now()): RateDecision {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0, remaining: MAX_REQUESTS - 1 };
  }

  existing.count += 1;
  const remaining = Math.max(MAX_REQUESTS - existing.count, 0);
  return {
    allowed: existing.count <= MAX_REQUESTS,
    retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    remaining,
  };
}

/** Test seam: clears all counters. */
export function resetRateLimits(): void {
  buckets.clear();
}

export { MAX_REQUESTS, WINDOW_MS };
