/**
 * ADMIN_EMAILS — an env-var allowlist of admin accounts, checked by every
 * admin gate BEFORE any database lookup.
 *
 * Why this exists: the VPS-first chain (local admin grant → local profile →
 * Firestore profile) still needs ONE of those stores to hold the grant. When
 * the Firestore project is blocked AND the local PocketBase grant has not
 * been seeded yet, every admin API 403's — locking the operator out of their
 * own console. This allowlist is the store that always exists: it lives in
 * the process environment, like the session secret, and answers instantly.
 *
 * Format (comma-separated), set in the VPS `.env`:
 *
 *   ADMIN_EMAILS=owner@vidnov.com,ops@vidnov.com
 *
 * Entries may be emails or Firebase Auth uids; matching is case-insensitive
 * for emails. Absent/empty = the feature is off and nothing changes.
 *
 * SECURITY:
 *   • It only ever GRANTS to accounts whose verified Firebase identity (ID
 *     token / server-side uid lookup) matches — never trusts a client claim.
 *   • Removing the variable or the entry revokes access just as fast.
 *   • Demotion still applies everywhere else: the local `admins` record and
 *     Firestore remain authoritative for non-listed admins.
 */

/** Lowercased entries; empty set when unset (feature off). */
let cached: { raw: string; set: Set<string> } | null = null;

function allowlist(): Set<string> {
  const raw = (process.env.ADMIN_EMAILS ?? '').trim();
  if (cached && cached.raw === raw) return cached.set;
  const set = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  cached = { raw, set };
  return set;
}

/** True when the allowlist exists and contains uid or the (lowercased) email. */
export function isAdminByEnv(uid: string | null | undefined, email?: string | null): boolean {
  const set = allowlist();
  if (set.size === 0 || !uid) return false;
  if (set.has(uid.toLowerCase())) return true;
  if (email && set.has(email.trim().toLowerCase())) return true;
  return false;
}
