/**
 * Admin role store on PocketBase — the "roles" section of the Firestore →
 * self-hosted migration.
 *
 * Why this exists: the admin gates (Communication Center, Email Status,
 * WhatsApp Alerts) used to look the role up in Firestore on every request.
 * On the VPS that meant slow/failed reads and admins locked out of their own
 * dashboards ("This account is not an admin"). The role now lives on the
 * same machine as the app: a tiny `admins` collection in the local
 * PocketBase instance, checked first on every request.
 *
 * Firestore stays as a fallback while the migration window is open, so
 * nothing breaks when PocketBase is not configured yet — every helper here
 * returns `null` in that case and callers keep their existing behaviour.
 *
 * Grant/demote from the VPS with:
 *   npx tsx scripts/promote-admin.ts promote you@example.com
 */

import { ensureCollection, pbListRecords, pocketBaseEnabled, type PbField } from './server';

export const ADMINS_COLLECTION = 'admins';

const ADMIN_FIELDS: PbField[] = [
  { name: 'uid', type: 'text', required: true },
  { name: 'email', type: 'text' },
  { name: 'name', type: 'text' },
  { name: 'grantedAt', type: 'date' },
];

/**
 * True / false when the local store has an opinion about this uid,
 * `null` when PocketBase is off or the lookup failed (→ caller falls back
 * to Firestore).
 */
export async function pbIsAdmin(uid: string): Promise<boolean | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(ADMINS_COLLECTION, ADMIN_FIELDS);
    const rows = await pbListRecords(ADMINS_COLLECTION, {
      filter: `uid = '${uid.replace(/'/g, "\\'")}'`,
      perPage: 1,
    });
    // No record yet → no opinion; Firestore still decides.
    return rows.length > 0 ? true : null;
  } catch (error) {
    console.error('[pocketbase] admin lookup failed:', error);
    return null;
  }
}

/** Grants (or revokes) admin in the local store. No-op when PB is off. */
export async function pbSetAdmin(
  uid: string,
  grant: boolean,
  profile: { email?: string; name?: string } = {},
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(ADMINS_COLLECTION, ADMIN_FIELDS);
    const existing = await pbListRecords(ADMINS_COLLECTION, {
      filter: `uid = '${uid.replace(/'/g, "\\'")}'`,
      perPage: 1,
    });
    const { pbRequest } = await import('./server');
    if (grant) {
      const body = JSON.stringify({
        uid,
        email: profile.email ?? null,
        name: profile.name ?? null,
        grantedAt: new Date().toISOString(),
      });
      if (existing.length > 0) {
        await pbRequest(`/api/collections/${ADMINS_COLLECTION}/records/${existing[0].id}`, {
          method: 'PATCH',
          body,
        });
      } else {
        await pbRequest(`/api/collections/${ADMINS_COLLECTION}/records`, {
          method: 'POST',
          body,
        });
      }
      return true;
    }
    for (const row of existing) {
      await pbRequest(`/api/collections/${ADMINS_COLLECTION}/records/${row.id}`, {
        method: 'DELETE',
      });
    }
    return true;
  } catch (error) {
    console.error('[pocketbase] admin write failed:', error);
    return false;
  }
}
