/**
 * DISTRIBUTION CRON — the authorization decision, pure.
 *
 * Kept out of the route so it can be tested directly (a gate you can only
 * assert by reading source is a gate nobody has actually verified) and so the
 * three fail-closed rules live in exactly one place:
 *
 *   1. **Off unless explicitly on.** `enabled` must be true — a brand-new
 *      scheduler entry point must not start life reachable. (Deliberately the
 *      opposite default from the legacy `/api/media/cleanup-cron`, which was
 *      already running in production and therefore had to stay opt-OUT.)
 *   2. **A secret must exist.** Enabled-with-no-secret would be an
 *      unauthenticated trigger for outbound API spend, so it refuses rather
 *      than runs: misconfigured is a 403, never a pass-through.
 *   3. **The presented secret must match**, compared timing-safe over
 *      fixed-length SHA-256 digests (a plain `===` on a secret is a
 *      string-comparison timing oracle).
 *
 * Nothing here reads the environment, the request, or the filesystem: callers
 * pass the values. The decision carries only a status code — no reason string
 * ever reaches a caller, so a probe cannot distinguish "disabled" from
 * "misconfigured" from "wrong secret" by the body.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

export interface CronSecrets {
  /** `VIDNOV_CRON_ENABLED === 'true'`, resolved by the caller. */
  enabled: boolean;
  /** `CRON_SECRET`, trimmed. Empty means "no secret configured". */
  secret: string;
}

export type CronAuthDecision =
  | { allowed: true }
  | { allowed: false; status: 204 | 403 };

/** Timing-safe comparison over fixed-length digests (never the raw strings). */
export function secretsMatch(expected: string, presented: string): boolean {
  if (!expected || !presented) return false;
  const a = createHash('sha256').update(expected, 'utf8').digest();
  const b = createHash('sha256').update(presented, 'utf8').digest();
  return timingSafeEqual(a, b);
}

/**
 * The whole gate. `presented` is whatever the request offered (Bearer header
 * first, then the legacy `?secret=` the existing scheduler uses — already
 * resolved by the caller).
 */
export function authorizeCronSchedule(
  secrets: CronSecrets,
  presented: string,
): CronAuthDecision {
  if (!secrets.enabled) return { allowed: false, status: 204 }; // silent no-op
  const secret = (secrets.secret ?? '').trim();
  if (!secret) return { allowed: false, status: 403 }; // enabled but unguarded → refuse
  if (!presented || !secretsMatch(secret, presented)) {
    return { allowed: false, status: 403 };
  }
  return { allowed: true };
}
