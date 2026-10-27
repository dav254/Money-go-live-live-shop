/**
 * Per-user subcollections on PocketBase — the "my account" section of the
 * Firestore → self-hosting migration.
 *
 * Three subcollections live UNDER a user profile and are read/written by the
 * account that owns them:
 *
 *   • `userProfiles/{uid}/cart/{productId}`      — the buyer's cart, read
 *     directly by both cart screens at checkout.
 *   • `userProfiles/{uid}/paymentMethods/{id}`  — saved buyer instruments.
 *   • `userProfiles/{uid}/payoutMethods/{id}`   — where a seller is paid.
 *
 * The `payments` / `payouts` LEDGERS were already mirrored (wallet section),
 * but these per-user documents were not — so the money trail survived a
 * Firestore outage while the destination a payout is sent to, and the cart a
 * buyer checked out with, did not.
 *
 * Each collection is keyed by `userId` + `fsId`, because a cart document id is
 * a PRODUCT id and therefore repeats across buyers; every filter must pin both
 * or one buyer's cart line could be served to another.
 *
 * Same contract as the other sections: every helper returns null/false when
 * PocketBase is not configured and NEVER throws — a mirror failure must never
 * break an add-to-cart or a saved method.
 */

import {
  ensureCollection,
  pbCreateRecord,
  pbDelete,
  pbListRecords,
  pocketBaseEnabled,
  pbRequest,
  type PbField,
  type PbRecord,
} from './server';

export type UserDataKind = 'cart' | 'paymentMethod' | 'payoutMethod';

/** Firestore subcollection → the PocketBase collection that mirrors it. */
export const USER_DATA_COLLECTION: Record<UserDataKind, string> = {
  cart: 'user_carts',
  paymentMethod: 'user_payment_methods',
  payoutMethod: 'user_payout_methods',
};

/** The Firestore subcollection path segment for a kind. */
export const USER_DATA_SUBCOLLECTION: Record<UserDataKind, string> = {
  cart: 'cart',
  paymentMethod: 'paymentMethods',
  payoutMethod: 'payoutMethods',
};

export const USER_DATA_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true }, // Firestore doc id
  { name: 'userId', type: 'text' }, // profile that owns it — the tenancy key
  { name: 'kind', type: 'text' },
  // The whole document (cart line, saved method) so a screen can render from
  // this store alone.
  { name: 'data', type: 'json' },
];

/** One mirrored per-user document. */
export interface PbUserDoc {
  id: string; // Firestore doc id
  userId: string;
  kind: UserDataKind;
  data: Record<string, unknown>;
}

const esc = (value: string) => value.replace(/'/g, "\\'");

function toUserDoc(record: PbRecord, kind: UserDataKind): PbUserDoc {
  const data = (record.data ?? null) as Record<string, unknown> | null;
  return {
    id: String(record.fsId ?? record.id),
    userId: String(record.userId ?? ''),
    kind,
    data: data ?? {},
  };
}

/**
 * Mirror one document of a per-user subcollection. `userId` is the profile it
 * lives under — supplied by the SERVER from the verified caller, never from a
 * request body. Never throws; false when PocketBase is off / the write failed.
 */
export async function pbMirrorUserDoc(
  kind: UserDataKind,
  userId: string,
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    const collection = USER_DATA_COLLECTION[kind];
    await ensureCollection(collection, USER_DATA_FIELDS);
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || ['string', 'number', 'boolean', 'object'].includes(typeof value)) {
        clean[key] = value;
      }
    }
    const body = JSON.stringify({ fsId, userId, kind, data: clean });
    const rows = await pbListRecords(collection, {
      filter: `userId = '${esc(userId)}' && fsId = '${esc(fsId)}'`,
      perPage: 1,
    });
    if (rows[0]) {
      const res = await pbRequest(
        `/api/collections/${collection}/records/${rows[0].id}`,
        { method: 'PATCH', body },
      );
      return res.ok;
    }
    await pbCreateRecord(collection, { fsId, userId, kind, data: clean });
    return true;
  } catch (error) {
    console.error(`[pocketbase] ${USER_DATA_COLLECTION[kind]} mirror failed:`, error);
    return false;
  }
}

/**
 * Drop the mirrored copy of a per-user document (the buyer removed a cart
 * line / a saved method). Unlike products there is no tombstone: nothing
 * renders these rows as public content, so leaving a stale row behind would be
 * worse than removing it. Never throws.
 */
export async function pbDeleteUserDoc(
  kind: UserDataKind,
  userId: string,
  fsId: string,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    const collection = USER_DATA_COLLECTION[kind];
    const rows = await pbListRecords(collection, {
      filter: `userId = '${esc(userId)}' && fsId = '${esc(fsId)}'`,
      perPage: 1,
    });
    if (!rows[0]) return true; // Nothing mirrored — nothing to remove.
    return await pbDelete(collection, rows[0].id);
  } catch (error) {
    console.error(`[pocketbase] ${USER_DATA_COLLECTION[kind]} delete failed:`, error);
    return false;
  }
}

/**
 * Everything one user has in a subcollection, or null when PocketBase is off
 * / the read failed — callers fall back to Firestore either way. Always scoped
 * to a single `userId`: there is no cross-user listing here by design.
 */
export async function pbListUserDocs(
  kind: UserDataKind,
  userId: string,
  limit = 500,
): Promise<PbUserDoc[] | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    const collection = USER_DATA_COLLECTION[kind];
    await ensureCollection(collection, USER_DATA_FIELDS);
    const rows = await pbListRecords(collection, {
      filter: `userId = '${esc(userId)}'`,
      perPage: Math.min(limit, 500),
    });
    return rows.map((row) => toUserDoc(row, kind)).filter((row) => row.data);
  } catch (error) {
    console.error(`[pocketbase] ${USER_DATA_COLLECTION[kind]} list failed:`, error);
    return null;
  }
}
