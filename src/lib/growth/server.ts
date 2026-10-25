/**
 * GROWTH EVENT SPINE — server-only helpers (node:crypto).
 *
 * Turns the viewer's raw session evidence into a privacy-preserving hash:
 * the raw `sid` (or uid) NEVER reaches Firestore — only a truncated
 * SHA-256 over (salt + day + value), so the stored form:
 *   • is stable within one day (dedupe works),
 *   • cannot be correlated across days (the day bucket is in the pre-hash),
 *   • cannot be reversed to the nonce without the salt.
 *
 * The salt prefers `EVENTS_SESSION_SECRET` when configured (recommended on
 * the VPS); otherwise it falls back to a built-in pepper. The fallback is
 * still safe for this purpose: the input is already a random client nonce,
 * not a credential — the pepper only prevents cross-deployment correlation
 * if a database were exported.
 *
 * Server-only: imports node:crypto. Must never be imported by a client
 * component (enforced by src/tests/growth-events.test.ts).
 */

import { createHash } from 'crypto';

function salt(): string {
  return (
    (process.env.EVENTS_SESSION_SECRET || '').trim() ||
    'vidnov-growth-events-salt-v1'
  );
}

/**
 * One-way viewer identity for event dedupe. Output is a 32-char hex prefix —
 * short, opaque, and unlinkable between days.
 */
export function hashViewerId(raw: string, day: string): string {
  return createHash('sha256')
    .update(`${salt()}|${day}|${raw}`)
    .digest('hex')
    .slice(0, 32);
}
