/**
 * Small in-memory fixed-window limiter for the admin → Postiz publish path.
 *
 * Per-process (PM2 single-instance app) and best-effort: its job is to stop
 * runaway admin UI retries from burning the instance's global Postiz API
 * budget (90 create-requests/hour per instance, API_LIMIT) — not multi-node
 * quota enforcement.
 */

export interface RateLimitSpec {
  max: number;
  windowMs: number;
}

/** Generous for a human admin, tiny for a loop: 10 submits / 10 minutes. */
export const PUBLISH_LIMIT: RateLimitSpec = { max: 10, windowMs: 10 * 60_000 };

/** Pure: how many timestamps in `times` still fall inside the window. */
export function countWithin(times: readonly number[], nowMs: number, windowMs: number): number {
  const cutoff = nowMs - windowMs;
  let n = 0;
  for (const t of times) if (t > cutoff) n += 1;
  return n;
}

/**
 * Records a hit for `key` and reports whether it is allowed.
 * Prunes its own stale entries; the map only ever grows to the number of
 * distinct admin uids in a window.
 */
export function allowRequest(
  key: string,
  store: Map<string, number[]>,
  spec: RateLimitSpec = PUBLISH_LIMIT,
  nowMs: number = Date.now(),
): boolean {
  const cutoff = nowMs - spec.windowMs;
  const hits = (store.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= spec.max) {
    store.set(key, hits);
    return false;
  }
  hits.push(nowMs);
  store.set(key, hits);
  return true;
}
