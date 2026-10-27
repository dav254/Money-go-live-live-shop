/**
 * CORE EVENTS — recorder (Firestore injected).
 *
 * One write path for every engine outcome event. Idempotency: when a
 * `dedupeKey` is given, the document id is deterministic and created with
 * `.create()` — a retried job/task records its outcome exactly once
 * (ALREADY_EXISTS is reported as `recorded: false`, not an error).
 *
 * Retention follows the growth spine: every doc carries `expiresAt`
 * (EVENT_RETENTION_DAYS) for a Firestore TTL policy. Counts over this
 * collection are therefore RECENT-WINDOW counts — lifetime metrics must be
 * rolled into their own counters, never read off raw events after expiry.
 *
 * Failures here never break the caller's main operation: recording is
 * best-effort with the error surfaced to the caller to handle.
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { CORE_EVENTS_COLLECTION, buildCoreEventDoc, coreEventDocId, type CoreEventInput } from './event-doc';

export interface RecordResult {
  recorded: boolean;
  id: string;
}

/**
 * Records one core event. Returns `{recorded:false}` when an identical
 * idempotent event already existed (the caller may treat that as success —
 * the outcome is already durably recorded).
 */
export async function recordCoreEvent(db: Firestore, input: CoreEventInput): Promise<RecordResult> {
  const now = new Date();
  const doc = { ...buildCoreEventDoc(input, now), createdAt: FieldValue.serverTimestamp() };
  const collection = db.collection(CORE_EVENTS_COLLECTION);

  const id = coreEventDocId(input, now);
  if (id) {
    try {
      await collection.doc(id).create(doc);
      return { recorded: true, id };
    } catch (err) {
      const code = (err as { code?: number | string })?.code;
      if (code === 6 || code === 'already-exists') return { recorded: false, id };
      throw err;
    }
  }
  const ref = await collection.add(doc);
  return { recorded: true, id: ref.id };
}
