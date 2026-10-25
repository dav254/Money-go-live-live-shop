/**
 * NOTIFICATION STORE — the VPS-controlled data layer.
 *
 * ## Storage method
 *
 * Primary store is **PocketBase on our VPS** (`notifications`,
 * `push_subscriptions`, `push_prefs` collections), reached over HTTP as the
 * superuser — the same migration path orders, products, email logs and live
 * sessions already use. Every read and write in the notification feature goes
 * through this module, so nothing in the section touches Firestore unless
 * PocketBase is not configured (`POCKETBASE_URL` / admin credentials missing),
 * in which case the legacy Firestore path keeps the feature alive — the
 * graceful-degradation convention `pocketbase/server.ts` documents.
 *
 * ## Ownership is enforced HERE, not by the client
 *
 * Every list is filtered by `userId`, and every mutation re-reads the record
 * and checks `record.userId === uid` before touching it. PocketBase
 * collections are created with empty API rules (superuser-only), and the
 * Firestore fallback runs with the Admin SDK — so an unchecked mutation would
 * bypass whatever rules exist. The API routes pass the uid from the verified
 * ID token and never a userId from the body.
 *
 * ## Duplicate suppression
 *
 * `createNotification` refuses to write the same event twice within a short
 * window (recipient + type + entity). Webhook retries and trigger fan-outs
 * can fire twice; an inbox that shows the same order alert twice reads as a
 * bug. Identity lives in `normalize.ts` so it can be unit-tested.
 */

import {
  ensureCollection,
  pbListRecords,
  pbRequest,
  pocketBaseEnabled,
  pbCreateRecord,
  type PbField,
} from '@/lib/pocketbase/server';
import { db as firestoreDb } from '@/firebase/server';
import {
  dedupeIdentity,
  isUnreadRecord,
  normalizeNotification,
  sameEventIdentity,
  sortNotificationsDesc,
  type NormalizedNotification,
  type RawNotification,
} from './normalize';

/* --------------------------------------------------------------------------- */
/* Collection schemas                                                          */
/* --------------------------------------------------------------------------- */

const NOTIFICATION_FIELDS: PbField[] = [
  { name: 'userId', type: 'text', required: true },
  { name: 'type', type: 'text' },
  { name: 'title', type: 'text' },
  { name: 'message', type: 'text' },
  { name: 'category', type: 'text' },
  { name: 'entityType', type: 'text' },
  { name: 'entityId', type: 'text' },
  { name: 'link', type: 'text' },
  { name: 'isRead', type: 'bool' },
  { name: 'readAt', type: 'date' },
  { name: 'createdAt', type: 'date' },
];

const PUSH_SUBSCRIPTION_FIELDS: PbField[] = [
  { name: 'userId', type: 'text', required: true },
  { name: 'endpoint', type: 'text', required: true },
  { name: 'subscription', type: 'json' },
  { name: 'userAgent', type: 'text' },
  { name: 'lastSeenAt', type: 'date' },
];

const PUSH_PREF_FIELDS: PbField[] = [
  { name: 'userId', type: 'text', required: true },
  { name: 'categories', type: 'json' },
];

let ensurePromise: Promise<void> | null = null;

/** Creates the three collections once per process; idempotent and diff-aware. */
export function ensureNotificationCollections(): Promise<void> {
  if (!pocketBaseEnabled()) return Promise.resolve();
  if (!ensurePromise) {
    ensurePromise = Promise.all([
      ensureCollection('notifications', NOTIFICATION_FIELDS),
      ensureCollection('push_subscriptions', PUSH_SUBSCRIPTION_FIELDS),
      ensureCollection('push_prefs', PUSH_PREF_FIELDS),
    ])
      .then(() => undefined)
      .catch((err) => {
        ensurePromise = null; // a failed ensure must not poison every later call
        throw err;
      });
  }
  return ensurePromise;
}

/** PocketBase filter string — doubles as the server-side ownership clause. */
function ownedBy(userId: string): string {
  // PocketBase filters are expression-language strings; escape quotes/backslashes.
  const safe = userId.replace(/([\\"])/g, '\\$1');
  return `userId = "${safe}"`;
}

const pbEcho = (id: string): string => id.replace(/([\\"])/g, '\\$1');

/* --------------------------------------------------------------------------- */
/* Create (+ duplicate suppression)                                            */
/* --------------------------------------------------------------------------- */

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  category?: string;
  entityType?: string;
  entityId?: string;
  link?: string;
  /** How long two writes of the same event count as a duplicate. */
  dedupeWindowMs?: number;
}

export interface CreateNotificationResult {
  id: string | null;
  duplicate: boolean;
}

/**
 * Writes one notification for exactly one recipient.
 * Returns `{ id: null, duplicate: true }` when the same event was already
 * recorded within the window — the caller treats that as success (the
 * notification exists; it just was not written twice).
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<CreateNotificationResult> {
  const windowMs = input.dedupeWindowMs ?? 2 * 60 * 1000;
  const identity = dedupeIdentity(input);
  const nowIso = new Date().toISOString();

  const doc = {
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    category: input.category || 'system',
    entityType: input.entityType || '',
    entityId: input.entityId || '',
    link: input.link || '',
    isRead: false,
    readAt: null,
    createdAt: nowIso,
  };

  if (pocketBaseEnabled()) {
    try {
      await ensureNotificationCollections();
      // A non-positive window deliberately skips the check: the admin
      // broadcast path passes 0 so a 500-recipient fan-out does not cost one
      // dedupe query per recipient.
      if (windowMs > 0) {
        const recent = await pbListRecords('notifications', {
          filter: `${ownedBy(input.userId)} && type = "${input.type.replace(/([\\"])/g, '\\$1')}" && created >= "${new Date(Date.now() - windowMs).toISOString()}"`,
          perPage: 50,
        });
        if (recent.some((r) => sameEventIdentity(r as RawNotification, identity))) {
          return { id: null, duplicate: true };
        }
      }
      const rec = await pbCreateRecord('notifications', doc);
      return { id: rec.id, duplicate: false };
    } catch (err) {
      console.error('[notifications] PocketBase create failed, falling back:', err);
      // fall through to the legacy store rather than losing the event
    }
  }

  try {
    let isDuplicate = false;
    if (windowMs > 0) {
      const recent = await firestoreDb
        .collection('notifications')
        .where('userId', '==', input.userId)
        .limit(50)
        .get();
      const cutoff = Date.now() - windowMs;
      isDuplicate = recent.docs.some((snap) => {
        const raw = { id: snap.id, ...snap.data() } as RawNotification;
        const ms =
          (raw.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ??
          (raw.timestamp as { toMillis?: () => number } | undefined)?.toMillis?.() ??
          0;
        return ms >= cutoff && sameEventIdentity(raw, identity);
      });
    }
    if (isDuplicate) return { id: null, duplicate: true };
    const ref = await firestoreDb.collection('notifications').add(doc);
    return { id: ref.id, duplicate: false };
  } catch (err) {
    console.error('[notifications] create failed:', err);
    return { id: null, duplicate: false };
  }
}

/* --------------------------------------------------------------------------- */
/* Read                                                                        */
/* --------------------------------------------------------------------------- */

export interface ListResult {
  items: NormalizedNotification[];
  unread: number;
}

/** The caller's own notifications, newest first, plus their total unread. */
export async function listNotifications(
  userId: string,
  limit = 50,
): Promise<ListResult> {
  if (pocketBaseEnabled()) {
    try {
      await ensureNotificationCollections();
      const [items, unread] = await Promise.all([
        pbListRecords('notifications', {
          filter: ownedBy(userId),
          sort: '-created',
          perPage: Math.min(Math.max(limit, 1), 200),
        }),
        countUnreadPb(userId),
      ]);
      return {
        items: items.map((r) => normalizeNotification({ ...r, id: r.id })),
        unread,
      };
    } catch (err) {
      console.error('[notifications] PocketBase list failed, falling back:', err);
    }
  }

  const snap = await firestoreDb
    .collection('notifications')
    .where('userId', '==', userId)
    .limit(Math.min(Math.max(limit, 1), 200))
    .get();
  const raw: RawNotification[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const sorted = sortNotificationsDesc(raw);
  return {
    items: sorted.map((r) => normalizeNotification(r)),
    unread: sorted.filter(isUnreadRecord).length,
  };
}

async function countUnreadPb(userId: string): Promise<number> {
  const res = await pbRequest(
    `/api/collections/notifications/records?${new URLSearchParams({
      filter: `${ownedBy(userId)} && isRead = false`,
      perPage: '1',
    })}`,
  );
  if (!res.ok) {
    // Counting must never break the inbox — an unknown count reads as 0.
    return 0;
  }
  const data = (await res.json().catch(() => null)) as { totalItems?: number } | null;
  return typeof data?.totalItems === 'number' ? data.totalItems : 0;
}

/** Unread badge only — cheap enough for the header to poll. */
export async function unreadCount(userId: string): Promise<number> {
  if (pocketBaseEnabled()) {
    try {
      await ensureNotificationCollections();
      return await countUnreadPb(userId);
    } catch (err) {
      console.error('[notifications] PocketBase count failed, falling back:', err);
    }
  }
  const snap = await firestoreDb
    .collection('notifications')
    .where('userId', '==', userId)
    .limit(100)
    .get();
  return snap.docs.filter((d) => isUnreadRecord(d.data())).length;
}

/* --------------------------------------------------------------------------- */
/* Mutate (ownership checked inside)                                           */
/* --------------------------------------------------------------------------- */

async function getOwnedPb(
  id: string,
  userId: string,
): Promise<RawNotification | null> {
  const res = await pbRequest(
    `/api/collections/notifications/records/${encodeURIComponent(id)}`,
  );
  if (!res.ok) return null;
  const rec = (await res.json().catch(() => null)) as RawNotification | null;
  if (!rec) return null;
  return rec.userId === userId ? rec : null;
}

/**
 * Sets one notification's read state (`isRead` defaults to true).
 * Returns false when absent or not owned — both reported as 404 by the route.
 */
export async function markRead(
  userId: string,
  id: string,
  isRead = true,
): Promise<boolean> {
  if (pocketBaseEnabled()) {
    try {
      await ensureNotificationCollections();
      const owned = await getOwnedPb(id, userId);
      if (!owned) return false;
      const res = await pbRequest(
        `/api/collections/notifications/records/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            isRead,
            readAt: isRead ? new Date().toISOString() : null,
          }),
        },
      );
      return res.ok;
    } catch (err) {
      console.error('[notifications] PocketBase markRead failed, falling back:', err);
    }
  }

  const ref = firestoreDb.collection('notifications').doc(id);
  const snap = await ref.get().catch(() => null);
  if (!snap?.exists) return false;
  if (snap.data()?.userId !== userId) return false;
  await ref
    .update({
      isRead,
      readAt: isRead ? new Date() : null,
      status: isRead ? 'read' : 'unread',
    })
    .catch(() => undefined);
  return true;
}

/**
 * Marks every one of the caller's unread notifications read — both field
 * shapes, because the legacy writers store `status` while the engine stores
 * `isRead`, and a badge that only understood one would never reach zero.
 */
export async function markAllRead(userId: string): Promise<number> {
  if (pocketBaseEnabled()) {
    try {
      await ensureNotificationCollections();
      const res = await pbRequest(
        `/api/collections/notifications/records?${new URLSearchParams({
          filter: `${ownedBy(userId)} && isRead = false`,
        })}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            isRead: true,
            readAt: new Date().toISOString(),
          }),
        },
      );
      if (!res.ok) return 0;
      const data = (await res.json().catch(() => null)) as
        | { numAffected?: number }
        | null;
      return typeof data?.numAffected === 'number' ? data.numAffected : 0;
    } catch (err) {
      console.error('[notifications] PocketBase markAll failed, falling back:', err);
    }
  }

  const snap = await firestoreDb
    .collection('notifications')
    .where('userId', '==', userId)
    .limit(500)
    .get();
  const targets = snap.docs.filter((d) => isUnreadRecord(d.data()));
  if (targets.length === 0) return 0;
  const batch = firestoreDb.batch();
  targets.forEach((d) =>
    batch.update(d.ref, { isRead: true, readAt: new Date(), status: 'read' }),
  );
  await batch.commit().catch(() => undefined);
  return targets.length;
}

/** Deletes one notification. Returns false when absent or not owned. */
export async function deleteNotification(userId: string, id: string): Promise<boolean> {
  if (pocketBaseEnabled()) {
    try {
      await ensureNotificationCollections();
      const owned = await getOwnedPb(id, userId);
      if (!owned) return false;
      const res = await pbRequest(
        `/api/collections/notifications/records/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      return res.ok || res.status === 404;
    } catch (err) {
      console.error('[notifications] PocketBase delete failed, falling back:', err);
    }
  }

  const ref = firestoreDb.collection('notifications').doc(id);
  const snap = await ref.get().catch(() => null);
  if (!snap?.exists) return false;
  if (snap.data()?.userId !== userId) return false;
  await ref.delete().catch(() => undefined);
  return true;
}

/* --------------------------------------------------------------------------- */
/* Push subscriptions                                                          */
/* --------------------------------------------------------------------------- */

/** Web Push subscription as the browser's PushManager produces it. */
export interface PushSubscriptionJson {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
  expirationTime?: number | null;
}

/** Upserts this device's subscription (keyed by endpoint under the uid). */
export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionJson,
  userAgent = '',
): Promise<void> {
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    throw new Error('Invalid push subscription');
  }
  const doc = {
    userId,
    endpoint: subscription.endpoint.slice(0, 2000),
    subscription,
    userAgent: userAgent.slice(0, 200),
    lastSeenAt: new Date().toISOString(),
  };

  if (pocketBaseEnabled()) {
    await ensureNotificationCollections();
    const existing = await pbListRecords('push_subscriptions', {
      filter: `${ownedBy(userId)} && endpoint = "${pbEcho(subscription.endpoint.slice(0, 2000))}"`,
      perPage: 1,
    });
    if (existing.length > 0) {
      const res = await pbRequest(
        `/api/collections/push_subscriptions/records/${existing[0].id}`,
        { method: 'PATCH', body: JSON.stringify(doc) },
      );
      if (!res.ok) throw new Error(`Could not update push subscription (${res.status})`);
      return;
    }
    await pbCreateRecord('push_subscriptions', doc);
    return;
  }

  // Legacy fallback — same keying the old FCM path used (hash of the token).
  await firestoreDb
    .collection('pushSubscriptions')
    .doc(userId)
    .collection('devices')
    .doc(hashKey(subscription.endpoint))
    .set({ ...doc, platform: 'web', createdAt: new Date() }, { merge: true });
}

/** Every subscription a user owns. */
export async function listPushSubscriptions(
  userId: string,
): Promise<PushSubscriptionJson[]> {
  if (pocketBaseEnabled()) {
    try {
      await ensureNotificationCollections();
      const rows = await pbListRecords('push_subscriptions', {
        filter: ownedBy(userId),
        perPage: 100,
      });
      return rows
        .map((r) => r.subscription as PushSubscriptionJson | undefined)
        .filter((s): s is PushSubscriptionJson => !!s?.endpoint);
    } catch (err) {
      console.error('[notifications] PocketBase push list failed, falling back:', err);
    }
  }

  /*
   * Legacy fallback: those records hold FCM *tokens*, not Web Push
   * subscriptions, and raw Web Push cannot address an FCM token. They are
   * deliberately treated as empty — devices re-register through the new
   * subscribe route (standard `pushManager.subscribe`) as they come back.
   */
  void firestoreDb; // the legacy path needs no read here
  return [];
}

/** Removes every subscription for a user ("stop sending to me"). */
export async function deletePushSubscriptions(userId: string): Promise<number> {
  if (pocketBaseEnabled()) {
    try {
      await ensureNotificationCollections();
      const rows = await pbListRecords('push_subscriptions', {
        filter: ownedBy(userId),
        perPage: 100,
      });
      let removed = 0;
      for (const row of rows) {
        const res = await pbRequest(
          `/api/collections/push_subscriptions/records/${row.id}`,
          { method: 'DELETE' },
        );
        if (res.ok || res.status === 404) removed += 1;
      }
      return removed;
    } catch (err) {
      console.error('[notifications] PocketBase push revoke failed, falling back:', err);
    }
  }

  const list = await firestoreDb
    .collection('pushSubscriptions')
    .doc(userId)
    .collection('devices')
    .listDocuments();
  if (list.length === 0) return 0;
  const batch = firestoreDb.batch();
  list.forEach((ref) => batch.delete(ref));
  await batch.commit().catch(() => undefined);
  return list.length;
}

/** Drops one subscription after the push service reports it gone (404/410). */
export async function prunePushSubscription(
  userId: string,
  endpoint: string,
): Promise<void> {
  if (pocketBaseEnabled()) {
    try {
      const rows = await pbListRecords('push_subscriptions', {
        filter: `${ownedBy(userId)} && endpoint = "${pbEcho(endpoint.slice(0, 2000))}"`,
        perPage: 1,
      });
      if (rows.length > 0) {
        await pbRequest(`/api/collections/push_subscriptions/records/${rows[0].id}`, {
          method: 'DELETE',
        });
      }
      return;
    } catch (err) {
      console.error('[notifications] push prune failed:', err);
      return;
    }
  }
  await firestoreDb
    .collection('pushSubscriptions')
    .doc(userId)
    .collection('devices')
    .doc(hashKey(endpoint))
    .delete()
    .catch(() => undefined);
}

/* --------------------------------------------------------------------------- */
/* Push preferences                                                            */
/* --------------------------------------------------------------------------- */

export async function getPushPrefs(userId: string): Promise<Record<string, boolean>> {
  if (pocketBaseEnabled()) {
    try {
      await ensureNotificationCollections();
      const rows = await pbListRecords('push_prefs', {
        filter: ownedBy(userId),
        perPage: 1,
      });
      const cats = rows[0]?.categories;
      return cats && typeof cats === 'object' ? (cats as Record<string, boolean>) : {};
    } catch (err) {
      console.error('[notifications] push prefs read failed:', err);
      return {};
    }
  }
  try {
    const snap = await firestoreDb.doc(`users/${userId}/settings/push`).get();
    const prefs = snap.data() as { categories?: Record<string, boolean> } | undefined;
    return prefs?.categories ?? {};
  } catch {
    return {};
  }
}

export async function setPushPrefs(
  userId: string,
  categories: Record<string, boolean>,
): Promise<void> {
  if (pocketBaseEnabled()) {
    await ensureNotificationCollections();
    const rows = await pbListRecords('push_prefs', {
      filter: ownedBy(userId),
      perPage: 1,
    });
    if (rows.length > 0) {
      const res = await pbRequest(`/api/collections/push_prefs/records/${rows[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({ categories }),
      });
      if (!res.ok) throw new Error(`Could not save preferences (${res.status})`);
      return;
    }
    await pbCreateRecord('push_prefs', { userId, categories });
    return;
  }
  await firestoreDb
    .doc(`users/${userId}/settings/push`)
    .set({ categories, updatedAt: new Date() }, { merge: true });
}

/** Stable short key for legacy device docs — mirrors the old client hash. */
function hashKey(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}