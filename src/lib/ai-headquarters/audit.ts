/**
 * ORBIT — append-only audit trail (`ai_hq_audit`).
 *
 * Every identity change and every approval decision is recorded, because the
 * founder has to be able to answer "who asked for this, and who approved it"
 * long after the fact. Audit writes are best-effort: a failure here is logged
 * without payloads and never turns a successful action into an error.
 */
import type { Firestore } from 'firebase-admin/firestore';
import type { HqAuditEntry } from './types';

export const AUDIT_COLLECTION = 'ai_hq_audit';

export async function writeAudit(
  db: Firestore,
  entry: Omit<HqAuditEntry, 'at'> & { at?: string },
): Promise<void> {
  try {
    await db.collection(AUDIT_COLLECTION).add({
      ...entry,
      at: entry.at ?? new Date().toISOString(),
    });
  } catch {
    // Static line only — no actor, no note, no credentials.
    console.error('[orbit] audit write failed');
  }
}

export async function listAudit(db: Firestore, limit = 40): Promise<HqAuditEntry[]> {
  const snap = await db
    .collection(AUDIT_COLLECTION)
    .orderBy('at', 'desc')
    .limit(Math.min(100, Math.max(1, limit)))
    .get();
  return snap.docs.map((doc) => doc.data() as HqAuditEntry);
}
