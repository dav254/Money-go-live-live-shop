/**
 * User profiles on PocketBase — the "accounts" section of the Firestore →
 * self-hosted migration.
 *
 * Why this exists: signup used to write the profile from the BROWSER with the
 * client SDK. When that write failed (Firestore rules, network, blocked
 * project), the Firebase Auth account existed but no profile did — the user
 * was signed in and stuck forever on "We couldn't load your account", and the
 * admin Buyers/Sellers lists never showed them. Profiles are now created
 * server-side (see /api/auth/welcome and /api/auth/profile) and mirrored
 * here, on the same machine as the app, so registration survives whatever
 * happens to Firestore.
 *
 * Firestore stays the primary store while the migration window is open: every
 * helper returns `null` when PocketBase is not configured and callers keep
 * their existing Firestore behaviour.
 */

import {
  ensureCollection,
  pbCreateRecord,
  pbListRecords,
  pocketBaseEnabled,
  pbRequest,
  type PbField,
  type PbRecord,
} from './server';

export const USER_PROFILES_COLLECTION = 'user_profiles';

export const PROFILE_FIELDS: PbField[] = [
  { name: 'uid', type: 'text', required: true },
  { name: 'email', type: 'text' },
  { name: 'fullName', type: 'text' },
  { name: 'username', type: 'text' },
  { name: 'userRole', type: 'text' },
  { name: 'status', type: 'text' },
  { name: 'phoneNumber', type: 'text' },
  { name: 'profilePictureUrl', type: 'text' },
  { name: 'joinDate', type: 'text' },
  // Live-session charge (added with the live-sessions migration): the balance
  // and shop name go-live reads server-side must survive a Firestore outage.
  { name: 'shopName', type: 'text' },
  { name: 'aiPoints', type: 'number' },
];

/** The profile fields this store keeps — same names as Firestore. */
export interface PbProfile {
  uid: string;
  email?: string;
  fullName?: string;
  username?: string;
  userRole?: string;
  status?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  joinDate?: string;
  shopName?: string;
  /** Points balance. `undefined` = never written here — NOT a zero balance. */
  aiPoints?: number;
}

function toProfile(record: PbRecord): PbProfile {
  return {
    uid: String(record.uid ?? record.id),
    email: record.email != null ? String(record.email) : undefined,
    fullName: record.fullName != null ? String(record.fullName) : undefined,
    username: record.username != null ? String(record.username) : undefined,
    userRole: record.userRole != null ? String(record.userRole) : undefined,
    status: record.status != null ? String(record.status) : undefined,
    phoneNumber: record.phoneNumber != null ? String(record.phoneNumber) : undefined,
    profilePictureUrl: record.profilePictureUrl != null ? String(record.profilePictureUrl) : undefined,
    joinDate: record.joinDate != null ? String(record.joinDate) : undefined,
    shopName: record.shopName != null ? String(record.shopName) : undefined,
    aiPoints:
      typeof record.aiPoints === 'number' && Number.isFinite(record.aiPoints)
        ? record.aiPoints
        : undefined,
  };
}

const esc = (value: string) => value.replace(/'/g, "\\'");

/** The VPS-side profile for a uid, or null (PB off / not found / error). */
export async function pbGetProfile(uid: string): Promise<PbProfile | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(USER_PROFILES_COLLECTION, PROFILE_FIELDS);
    const rows = await pbListRecords(USER_PROFILES_COLLECTION, {
      filter: `uid = '${esc(uid)}'`,
      perPage: 1,
    });
    return rows[0] ? toProfile(rows[0]) : null;
  } catch (error) {
    console.error('[pocketbase] profile read failed:', error);
    return null;
  }
}

/**
 * Creates or updates the VPS-side profile. Existing fields are kept unless
 * the caller passes a new value (undefined = leave alone, null = clear).
 * Returns false when PB is off or the write failed — callers fall back to
 * Firestore-only behaviour either way.
 */
export async function pbUpsertProfile(
  uid: string,
  patch: Partial<Record<keyof PbProfile, string | number | null>>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(USER_PROFILES_COLLECTION, PROFILE_FIELDS);
    const existing = await pbListRecords(USER_PROFILES_COLLECTION, {
      filter: `uid = '${esc(uid)}'`,
      perPage: 1,
    });
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      clean[key] = value === null ? '' : value;
    }
    if (existing[0]) {
      const res = await pbRequest(
        `/api/collections/${USER_PROFILES_COLLECTION}/records/${existing[0].id}`,
        { method: 'PATCH', body: JSON.stringify(clean) },
      );
      return res.ok;
    }
    await pbCreateRecord(USER_PROFILES_COLLECTION, { uid, ...clean });
    return true;
  } catch (error) {
    console.error('[pocketbase] profile write failed:', error);
    return false;
  }
}

/** Recent profiles for one role, newest first (admin lists). Null when PB is off/failed. */
export async function pbListProfilesByRole(
  role: string,
  limit = 200,
): Promise<PbProfile[] | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(USER_PROFILES_COLLECTION, PROFILE_FIELDS);
    const items = await pbListRecords(USER_PROFILES_COLLECTION, {
      filter: `userRole = '${esc(role)}'`,
      sort: '-joinDate',
      perPage: limit,
    });
    return items.map(toProfile);
  } catch (error) {
    console.error('[pocketbase] profile list failed:', error);
    return null;
  }
}

/**
 * Add `delta` points to a balance on the VPS store (negative = charge).
 *
 * Read-modify-write: PocketBase has no cross-document transactions, and this
 * is a single record, so the race window is one small PATCH — the live-session
 * double-submit guard (the studio disables the button while `starting`)
 * covers the practical double-charge case.
 *
 * Returns the NEW balance, or null when PocketBase is off or the write
 * failed — callers must treat null as "no charge happened" and fall back.
 * Never throws.
 */
export async function pbAdjustAiPoints(uid: string, delta: number): Promise<number | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(USER_PROFILES_COLLECTION, PROFILE_FIELDS);
    const rows = await pbListRecords(USER_PROFILES_COLLECTION, {
      filter: `uid = '${esc(uid)}'`,
      perPage: 1,
    });
    const row = rows[0];
    if (!row) return null; // No VPS profile — caller decides how to proceed.
    const current =
      typeof row.aiPoints === 'number' && Number.isFinite(row.aiPoints) ? row.aiPoints : null;
    if (current === null) return null; // Balance unknown here — never invent one.
    const next = current + delta;
    if (next < 0) return null; // Never drive a balance negative.
    const res = await pbRequest(
      `/api/collections/${USER_PROFILES_COLLECTION}/records/${row.id}`,
      { method: 'PATCH', body: JSON.stringify({ aiPoints: next }) },
    );
    return res.ok ? next : null;
  } catch (error) {
    console.error('[pocketbase] points adjust failed:', error);
    return null;
  }
}
