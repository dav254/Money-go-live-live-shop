/**
 * POCKETBASE USER AUTHENTICATION — the identity layer.
 *
 * Vidnov's accounts used to live only in Firebase Auth: passwords, email
 * uniqueness and session tokens were all Google's. This module moves the
 * credential authority onto our own VPS:
 *
 *   • `vidnov_users` is a PocketBase **auth** collection. PocketBase owns the
 *     password hash, the unique email index and password verification
 *     (`auth-with-password`), so no password ever reaches Firebase.
 *   • every record carries `appUid` — the identifier the rest of the app,
 *     Firestore documents and API tokens already use. For an account created
 *     here it equals the PocketBase record id; for a migrated account it is the
 *     account's existing Firebase uid, so NOTHING about an existing user's id
 *     changes and no duplicate identity is created.
 *
 * Access rules are superuser-only (`null`), because the browser and the phone
 * must never read the credential collection directly: they talk to
 * `/api/auth/v2/*`, which is the only thing holding the superuser token.
 * PocketBase's auth endpoints still work with locked record rules — that is
 * deliberate, `auth-with-password` is not a record read.
 *
 * Everything returns null / a typed result instead of throwing when PocketBase
 * is not configured, so callers can fall back honestly rather than pretend.
 */

import {
  SUPERUSER_ONLY_RULES,
  getPocketBaseConfig,
  pbListRecords,
  pbRequest,
  type PbField,
  type PbRecord,
} from './server';

export const AUTH_COLLECTION = 'vidnov_users';

/**
 * Custom fields only. `email`, `password`, `verified` and the system columns
 * are created by PocketBase itself for every auth collection; sending them
 * would be rejected as duplicate fields.
 */
export const AUTH_USER_FIELDS: PbField[] = [
  { name: 'appUid', type: 'text', required: true },
  { name: 'fullName', type: 'text' },
  { name: 'username', type: 'text' },
  { name: 'userRole', type: 'text' },
  { name: 'phoneNumber', type: 'text' },
];

export interface PbAuthUser {
  /** PocketBase record id (also a session target for password updates). */
  id: string;
  /** Canonical app identity — Firestore profile id and API token subject. */
  appUid: string;
  email: string;
  fullName?: string;
  username?: string;
  userRole?: string;
  phoneNumber?: string;
}

export type PbAuthFailure =
  | { kind: 'not_configured' }
  | { kind: 'invalid_credentials' }
  | { kind: 'duplicate_email' }
  | { kind: 'rate_limited' }
  | { kind: 'error'; message: string };

export type PbAuthResult<T> = { ok: true; value: T } | { ok: false; failure: PbAuthFailure };

const esc = (value: string) => value.replace(/'/g, "\\'");

function toAuthUser(record: PbRecord): PbAuthUser {
  return {
    id: record.id,
    appUid: String(record.appUid ?? record.id),
    email: String(record.email ?? ''),
    fullName: record.fullName != null ? String(record.fullName) : undefined,
    username: record.username != null ? String(record.username) : undefined,
    userRole: record.userRole != null ? String(record.userRole) : undefined,
    phoneNumber: record.phoneNumber != null ? String(record.phoneNumber) : undefined,
  };
}

/**
 * A PocketBase record id: exactly 15 characters from `[a-z0-9]`. We generate it
 * ourselves so the app uid is known BEFORE the create and is therefore the same
 * value the Firebase bridge token and every profile write use.
 */
export function generateAppUid(random: (size: number) => Uint8Array = defaultRandom): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = random(15);
  let out = '';
  for (let i = 0; i < 15; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function defaultRandom(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  // `crypto` exists on Node 18+ (the only runtime these routes use).
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Creates the auth collection once, with superuser-only rules and a unique
 * index on `appUid`.
 *
 * `ensureCollection` only knows how to build `type: 'base'` collections, so
 * this mirrors its create/repair shape for the auth type. Password auth is
 * enabled explicitly: a collection created without it silently rejects every
 * login.
 */
async function ensureAuthCollection(): Promise<boolean> {
  const existing = await pbRequest(`/api/collections/${AUTH_COLLECTION}`);
  if (existing.ok) {
    const detail = (await existing.json().catch(() => null)) as
      | { passwordAuth?: { enabled?: boolean }; fields?: { name: string }[]; schema?: { name: string }[] }
      | null;
    if (!detail) return true;

    // Repair: password auth must be on, or every login fails with 400.
    if (detail.passwordAuth?.enabled !== true) {
      const res = await pbRequest(`/api/collections/${AUTH_COLLECTION}`, {
        method: 'PATCH',
        body: JSON.stringify({ passwordAuth: { enabled: true, identityFields: ['email'] } }),
      });
      if (!res.ok) {
        console.error(`[pocketbase] could not enable password auth on "${AUTH_COLLECTION}" (${res.status})`);
        return false;
      }
    }
    return true;
  }

  const body = {
    name: AUTH_COLLECTION,
    type: 'auth',
    // Locked to superusers: clients authenticate through our API, never here.
    ...SUPERUSER_ONLY_RULES,
    passwordAuth: { enabled: true, identityFields: ['email'] },
    emailAuth: { enabled: true },
    fields: AUTH_USER_FIELDS,
  };

  for (const schemaKey of ['fields', 'schema'] as const) {
    const res = await pbRequest('/api/collections', {
      method: 'POST',
      body: JSON.stringify({ ...body, [schemaKey]: AUTH_USER_FIELDS }),
    });
    if (res.ok) return true;
  }
  // A concurrent request may have won the race; anything else is a real error.
  const retry = await pbRequest(`/api/collections/${AUTH_COLLECTION}`);
  return retry.ok;
}

/** Looks an account up by email (case-insensitive). Null when absent. */
export async function pbFindAuthUserByEmail(email: string): Promise<PbAuthUser | null> {
  if (!getPocketBaseConfig()) return null;
  try {
    await ensureAuthCollection();
    const rows = await pbListRecords(AUTH_COLLECTION, {
      filter: `email = '${esc(email.trim().toLowerCase())}'`,
      perPage: 1,
    });
    return rows[0] ? toAuthUser(rows[0]) : null;
  } catch (error) {
    console.error('[pocketbase] auth lookup failed:', error);
    return null;
  }
}

/** Looks an account up by canonical app uid. Null when absent. */
export async function pbFindAuthUserByAppUid(appUid: string): Promise<PbAuthUser | null> {
  if (!getPocketBaseConfig()) return null;
  try {
    await ensureAuthCollection();
    const rows = await pbListRecords(AUTH_COLLECTION, {
      filter: `appUid = '${esc(appUid)}'`,
      perPage: 1,
    });
    return rows[0] ? toAuthUser(rows[0]) : null;
  } catch (error) {
    console.error('[pocketbase] auth lookup by uid failed:', error);
    return null;
  }
}

/**
 * Creates an account. `appUid` is supplied by the caller so a migrated legacy
 * account keeps its existing id; a new account passes a freshly generated id
 * that is also used as the PocketBase record id.
 */
export async function pbCreateAuthUser(input: {
  email: string;
  password: string;
  appUid: string;
  fullName?: string;
  username?: string;
  userRole?: string;
  phoneNumber?: string;
}): Promise<PbAuthResult<PbAuthUser>> {
  if (!getPocketBaseConfig()) return { ok: false, failure: { kind: 'not_configured' } };
  try {
    if (!(await ensureAuthCollection())) {
      return { ok: false, failure: { kind: 'error', message: 'Could not prepare the account store.' } };
    }

    const email = input.email.trim().toLowerCase();
    const payload: Record<string, unknown> = {
      id: input.appUid,
      appUid: input.appUid,
      email,
      password: input.password,
      passwordConfirm: input.password,
      emailVisibility: false,
      verified: false,
    };
    if (input.fullName) payload.fullName = input.fullName;
    if (input.username) payload.username = input.username;
    if (input.userRole) payload.userRole = input.userRole;
    if (input.phoneNumber) payload.phoneNumber = input.phoneNumber;

    const res = await pbRequest(`/api/collections/${AUTH_COLLECTION}/records`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return { ok: true, value: toAuthUser((await res.json()) as PbRecord) };
    }

    const detail = await res.text().catch(() => '');
    if (res.status === 400 && /email/i.test(detail) && /(unique|already)/i.test(detail)) {
      return { ok: false, failure: { kind: 'duplicate_email' } };
    }
    if (res.status === 429) return { ok: false, failure: { kind: 'rate_limited' } };
    return { ok: false, failure: { kind: 'error', message: detail.slice(0, 300) || `create failed (${res.status})` } };
  } catch (error) {
    console.error('[pocketbase] auth create failed:', error);
    return { ok: false, failure: { kind: 'error', message: 'Account store unavailable.' } };
  }
}

/**
 * Verifies email + password against PocketBase.
 *
 * The auth endpoint is called **as a guest**: attaching the superuser token
 * would authenticate the superuser instead of the account being checked, which
 * is exactly the "always succeeds" bug this function must never have.
 */
export async function pbVerifyPassword(
  email: string,
  password: string,
): Promise<PbAuthResult<PbAuthUser>> {
  const cfg = getPocketBaseConfig();
  if (!cfg) return { ok: false, failure: { kind: 'not_configured' } };
  try {
    await ensureAuthCollection();
    const res = await fetch(`${cfg.url}/api/collections/${AUTH_COLLECTION}/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email.trim().toLowerCase(), password }),
    });

    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { record?: PbRecord } | null;
      if (data?.record) return { ok: true, value: toAuthUser(data.record) };
      return { ok: false, failure: { kind: 'error', message: 'Auth response had no account.' } };
    }
    if (res.status === 429) return { ok: false, failure: { kind: 'rate_limited' } };
    if (res.status === 400) return { ok: false, failure: { kind: 'invalid_credentials' } };
    return { ok: false, failure: { kind: 'error', message: `auth failed (${res.status})` } };
  } catch (error) {
    console.error('[pocketbase] password verification failed:', error);
    return { ok: false, failure: { kind: 'error', message: 'Account store unreachable.' } };
  }
}

/**
 * Sets a password for an existing account (superuser PATCH).
 *
 * Used by the password-reset flow so a reset changes BOTH the PocketBase
 * credential and the Firebase bridge credential — otherwise the reset would
 * appear to work and the next login would fail.
 */
export async function pbSetPasswordByAppUid(appUid: string, password: string): Promise<boolean> {
  if (!getPocketBaseConfig()) return false;
  try {
    const user = await pbFindAuthUserByAppUid(appUid);
    if (!user) return false;
    const res = await pbRequest(`/api/collections/${AUTH_COLLECTION}/records/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ password, passwordConfirm: password }),
    });
    return res.ok;
  } catch (error) {
    console.error('[pocketbase] password update failed:', error);
    return false;
  }
}

/** Keeps the searchable profile fields on the credential record in step. */
export async function pbUpdateAuthUserProfile(
  appUid: string,
  patch: Partial<Pick<PbAuthUser, 'fullName' | 'username' | 'userRole' | 'phoneNumber'>>,
): Promise<boolean> {
  if (!getPocketBaseConfig()) return false;
  try {
    const user = await pbFindAuthUserByAppUid(appUid);
    if (!user) return false;
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (typeof value === 'string' && value.trim()) body[key] = value.trim();
    }
    if (Object.keys(body).length === 0) return true;
    const res = await pbRequest(`/api/collections/${AUTH_COLLECTION}/records/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (error) {
    console.error('[pocketbase] auth profile update failed:', error);
    return false;
  }
}
