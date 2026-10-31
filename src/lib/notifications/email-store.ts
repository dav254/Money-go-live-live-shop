/**
 * VIDNOV email store — Firestore-backed operations for the reliability layer.
 *
 * Owns four additive collections (all covered by the default-deny catch-all
 * in the security rules; admin-SDK only, never client-readable):
 *
 *   emailSuppressions  one doc per suppressed recipient (doc id = address,
 *                      so writes are naturally idempotent)
 *   emailJobs          durable retry queue: pending → done | dead, with
 *                      bounded exponential backoff decided by the pure
 *                      policy in `email-reliability.ts`
 *   emailWebhookEvents provider webhook deliveries (doc id = sanitized
 *                      svix id) — the idempotency record
 *   (emailLogs)        status patches by provider message id
 *
 * Every helper is best-effort and NEVER THROWS: a store hiccup can never
 * fail a send, a webhook handler or a cron pass — callers decide whether a
 * `false`/`0` result matters (the webhook route turns it into a 500 so the
 * provider retries the delivery instead of losing the event).
 *
 * The database parameter is a structural subset of the Firebase Admin
 * `Firestore` instance, so routes pass `db` from `@/firebase/server`
 * unchanged and tests can pass a fake.
 */

import { normalizeAddress } from './email-reliability';

/* ── Loose Firestore contract (structural subset of firebase-admin) ──────── */

export interface StoreDocRef {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(data: Record<string, unknown>, opts?: { merge?: boolean }): Promise<void>;
  update(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}

export interface StoreQuery {
  limit(n: number): StoreQuery;
  get(): Promise<{ docs: Array<{ id: string; data(): Record<string, unknown>; ref: StoreDocRef }> }>;
}

export interface StoreCollection {
  add(data: Record<string, unknown>): Promise<{ id: string }>;
  doc(id?: string): StoreDocRef;
  where(field: string, op: string, value: unknown): StoreQuery;
  limit(n: number): StoreQuery;
}

export interface StoreDb {
  collection(path: string): StoreCollection;
}

export const SUPPRESSIONS_COLLECTION = 'emailSuppressions';
export const JOBS_COLLECTION = 'emailJobs';
export const WEBHOOK_EVENTS_COLLECTION = 'emailWebhookEvents';
export const EMAIL_LOGS_COLLECTION = 'emailLogs';

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function isoOrNull(v: unknown): string | null {
  if (typeof v === 'string' && v) return v;
  if (v instanceof Date) return v.toISOString();
  const t = v as { toDate?: () => Date };
  if (t && typeof t.toDate === 'function') {
    try {
      return t.toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

/* ── Suppression ─────────────────────────────────────────────────────────── */

export interface SuppressionRow {
  address: string;
  reason: string;
  source: string;
  createdAt: string | null;
}

/** Read side: returns `suppressed: false` when the store cannot answer. */
export async function isSuppressed(
  db: StoreDb,
  address: string,
): Promise<{ suppressed: boolean; reason?: string }> {
  const key = normalizeAddress(address);
  if (!key) return { suppressed: false };
  try {
    const snap = await db.collection(SUPPRESSIONS_COLLECTION).doc(key).get();
    if (!snap.exists) return { suppressed: false };
    const data = snap.data() ?? {};
    return { suppressed: true, reason: str(data.reason) || 'suppressed' };
  } catch {
    return { suppressed: false };
  }
}

/** Write side: idempotent (doc id = address). Returns false on failure. */
export async function suppressAddress(
  db: StoreDb,
  input: { address: string; reason: string; source: string },
): Promise<boolean> {
  const key = normalizeAddress(input.address);
  if (!key) return false;
  try {
    await db.collection(SUPPRESSIONS_COLLECTION).doc(key).set({
      address: key,
      reason: input.reason.slice(0, 200),
      source: input.source.slice(0, 60),
      createdAt: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

/** Administrative removal (manual re-engagement after fixing the address). */
export async function unsuppressAddress(db: StoreDb, address: string): Promise<boolean> {
  const key = normalizeAddress(address);
  if (!key) return false;
  try {
    await db.collection(SUPPRESSIONS_COLLECTION).doc(key).delete();
    return true;
  } catch {
    return false;
  }
}

export async function listSuppressions(db: StoreDb, limit: number): Promise<SuppressionRow[]> {
  try {
    const snap = await db.collection(SUPPRESSIONS_COLLECTION).limit(Math.max(1, Math.min(200, limit))).get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        address: str(data.address) || d.id,
        reason: str(data.reason),
        source: str(data.source),
        createdAt: isoOrNull(data.createdAt),
      };
    });
  } catch {
    return [];
  }
}

/* ── Durable retry queue ─────────────────────────────────────────────────── */

export interface RetryJobInput {
  to: string;
  from: string;
  templateKey: string;
  category: string;
  vars: Record<string, string | undefined>;
  userId?: string | undefined;
  errorClass: string;
  /** Sanitized first-failure note (≤300 chars, never an upstream body). */
  lastError: string;
  nextAttemptAt: string;
}

export async function enqueueRetryJob(db: StoreDb, job: RetryJobInput): Promise<string | null> {
  try {
    const now = new Date().toISOString();
    const ref = await db.collection(JOBS_COLLECTION).add({
      ...job,
      attempts: 1,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      lastAttemptAt: now,
    });
    return ref.id;
  } catch {
    return null;
  }
}

export interface RetryJobRow {
  id: string;
  to: string;
  from: string;
  templateKey: string;
  category: string;
  vars: Record<string, string | undefined>;
  userId?: string;
  attempts: number;
  status: string;
  nextAttemptAt: string;
  lastErrorClass?: string;
  lastError?: string;
}

function toJob(id: string, data: Record<string, unknown>): RetryJobRow {
  return {
    id,
    to: str(data.to),
    from: str(data.from),
    templateKey: str(data.templateKey),
    category: str(data.category),
    vars:
      data.vars && typeof data.vars === 'object' && !Array.isArray(data.vars)
        ? (data.vars as Record<string, string | undefined>)
        : {},
    ...(str(data.userId) ? { userId: str(data.userId) } : {}),
    attempts: typeof data.attempts === 'number' ? data.attempts : 0,
    status: str(data.status) || 'pending',
    nextAttemptAt: str(data.nextAttemptAt),
    ...(str(data.lastErrorClass) ? { lastErrorClass: str(data.lastErrorClass) } : {}),
    ...(str(data.lastError) ? { lastError: str(data.lastError) } : {}),
  };
}

/**
 * Due pending jobs, newest first. The status filter runs in Firestore and
 * the time filter in memory (bounded window, no composite index required —
 * the same pattern the distribution and growth engines use).
 */
export async function listDueRetryJobs(db: StoreDb, nowIso: string, limit: number): Promise<RetryJobRow[]> {
  try {
    const snap = await db
      .collection(JOBS_COLLECTION)
      .where('status', '==', 'pending')
      .limit(Math.max(1, Math.min(50, limit)))
      .get();
    return snap.docs
      .map((d) => toJob(d.id, d.data()))
      .filter((j) => j.nextAttemptAt && j.nextAttemptAt <= nowIso)
      .sort((a, b) => (a.nextAttemptAt < b.nextAttemptAt ? -1 : a.nextAttemptAt > b.nextAttemptAt ? 1 : 0));
  } catch {
    return [];
  }
}

export async function updateRetryJob(
  db: StoreDb,
  id: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  try {
    await db.collection(JOBS_COLLECTION).doc(id).update({
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

/** Pending-job count for the admin dashboard (null when the store is down). */
export async function countPendingRetryJobs(db: StoreDb): Promise<number | null> {
  try {
    const snap = await db.collection(JOBS_COLLECTION).where('status', '==', 'pending').limit(50).get();
    return snap.docs.length;
  } catch {
    return null;
  }
}

/* ── Webhook events (idempotency + admin visibility) ─────────────────────── */

export interface WebhookEventInput {
  /** Sanitized svix id — also the document id, so redeliveries are no-ops. */
  eventId: string;
  type: string;
  messageId?: string | undefined;
  address?: string | undefined;
  status?: string | undefined;
}

export async function recordWebhookEvent(db: StoreDb, event: WebhookEventInput): Promise<boolean> {
  try {
    await db.collection(WEBHOOK_EVENTS_COLLECTION).doc(event.eventId).set({
      eventId: event.eventId,
      type: event.type.slice(0, 60),
      messageId: event.messageId ?? null,
      address: event.address ? normalizeAddress(event.address) : null,
      status: event.status ?? null,
      receivedAt: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

export interface WebhookEventRow {
  id: string;
  type: string;
  messageId: string | null;
  address: string | null;
  status: string | null;
  receivedAt: string | null;
}

export async function listWebhookEvents(db: StoreDb, limit: number): Promise<WebhookEventRow[]> {
  try {
    const snap = await db.collection(WEBHOOK_EVENTS_COLLECTION).limit(Math.max(1, Math.min(100, limit))).get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        type: str(data.type),
        messageId: typeof data.messageId === 'string' ? data.messageId : null,
        address: typeof data.address === 'string' ? data.address : null,
        status: typeof data.status === 'string' ? data.status : null,
        receivedAt: isoOrNull(data.receivedAt),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Patches every delivery-log row carrying this provider message id.
 * Returns the number of rows updated; 0 with `ok: false` on store failure
 * (the webhook route then answers 500 so the provider redelivers).
 */
export async function updateLogStatusByProviderId(
  db: StoreDb,
  providerId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: boolean; updated: number }> {
  if (!providerId) return { ok: false, updated: 0 };
  try {
    const snap = await db.collection(EMAIL_LOGS_COLLECTION).where('providerId', '==', providerId).limit(5).get();
    if (snap.docs.length === 0) return { ok: true, updated: 0 };
    for (const doc of snap.docs) {
      await doc.ref.update(patch);
    }
    return { ok: true, updated: snap.docs.length };
  } catch {
    return { ok: false, updated: 0 };
  }
}
