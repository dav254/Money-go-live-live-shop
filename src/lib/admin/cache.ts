/**
 * Tiny in-process TTL cache for admin analytics.
 *
 * Why this exists: the admin dashboard fires several admin-only Firestore
 * queries on every mount. On the Spark (no-cost) plan the project gets a hard
 * daily read cap, and when it is reached Firestore starts rejecting *every*
 * read with RESOURCE_EXHAUSTED — including the one-line admin-profile check
 * that guards the endpoint. That turned a quota problem into a 500 on the
 * dashboard and a full-screen dev error overlay.
 *
 * Caching the aggregate results means a dashboard refresh does not re-read the
 * orders/payouts collections, which both reduces read volume and keeps the
 * dashboard populated between quota windows.
 *
 * Scope and limits, deliberately:
 *  - In-process only. A serverless/cold deploy starts empty, which is fine —
 *    it just refills the cache.
 *  - Short TTL. Analytics are a dashboard, not an audit log.
 *  - It does NOT fix an already-exhausted quota. That needs the Spark → Blaze
 *    upgrade. It only stops the dashboard from being the thing that burns it.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Reads a cached value if it has not expired. */
export function readCache<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

/** Stores a value for `ttlMs`. */
export function writeCache<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Drops everything — used by tests and diagnostics. */
export function clearCache(): void {
  store.clear();
}

/**
 * Reads through the cache, calling `producer` only on a miss.
 *
 * If `producer` throws, a previously cached value is returned rather than
 * letting the failure propagate — a stale number beats a broken dashboard when
 * the quota is the thing that broke. `null` means "no value, ever cached".
 */
export async function cached<T>(key: string, ttlMs: number, producer: () => Promise<T>): Promise<T | null> {
  const hit = readCache<T>(key);
  if (hit !== null) return hit;

  try {
    const value = await producer();
    writeCache(key, value, ttlMs);
    return value;
  } catch {
    return readCache<T>(key);
  }
}

/** Default lifetime for dashboard aggregates. */
export const ADMIN_CACHE_TTL_MS = 60_000;