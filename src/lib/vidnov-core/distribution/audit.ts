/**
 * DISTRIBUTION HUB — append-only audit history.
 *
 * Every management action the Control Center performs (pause, config change,
 * reconciliation sweep, engine run, dead-letter re-queue, job stop) leaves one
 * entry here, written server-side only. The collection is new and has no
 * Firestore rules ⇒ default-deny for clients (no rules change ships with it).
 *
 * Entries are immutable by construction: there is no update or delete path
 * anywhere in the engine. Details go through the shared sanitizer, are
 * single-line and bounded — an audit trail must never become a place where a
 * credential or an upstream response body leaks.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { sanitizeErrorMessage } from './job-utils';

export const DISTRIBUTION_AUDIT_COLLECTION = 'distributionAudit';

/** The closed set of auditable actions. */
export const AUDIT_ACTIONS = [
  'config_updated',
  'pause_toggled',
  'reconcile_run',
  'engine_run',
  'sitemap_submitted',
  'job_stopped',
  'admin_requeue',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntryInput {
  actorUid: string;
  action: AuditAction;
  /** What was acted on: `job` | `config` | `destination` | `reconcile`. */
  targetType: 'job' | 'config' | 'destination' | 'reconcile' | 'run';
  targetId?: string;
  destination?: string;
  /** Short, sanitized, credential-free summary (≤200 chars). */
  detail?: string;
}

/** Safe projection of a stored audit entry (timestamp normalised to ISO). */
export interface AuditEntry {
  id: string;
  actorUid: string;
  /** Stored value cast to the closed set, or `unknown` for foreign values. */
  action: AuditAction | 'unknown';
  targetType: AuditEntryInput['targetType'] | 'unknown';
  targetId?: string;
  destination?: string;
  at: string | null;
  detail: string | null;
}

function isoOf(value: unknown): string | null {
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return new Date((value as { toMillis: () => number }).toMillis()).toISOString();
  }
  return typeof value === 'string' ? value : null;
}

/**
 * Appends one audit entry. Best-effort by contract: an audit write failure
 * is surfaced as `false` but never rolls back the action it describes — the
 * caller reports the gap instead of hiding it.
 */
export async function recordAudit(db: Firestore, input: AuditEntryInput): Promise<boolean> {
  try {
    await db.collection(DISTRIBUTION_AUDIT_COLLECTION).add({
      actorUid: input.actorUid,
      action: input.action,
      targetType: input.targetType,
      ...(input.targetId ? { targetId: input.targetId } : {}),
      ...(input.destination ? { destination: input.destination } : {}),
      ...(input.detail ? { detail: sanitizeErrorMessage(input.detail) } : {}),
      at: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

/** Latest audit entries, newest first, hard-bounded. */
export async function listAudit(db: Firestore, limit = 25): Promise<AuditEntry[]> {
  const capped = Math.min(Math.max(limit, 1), 50);
  try {
    const snap = await db.collection(DISTRIBUTION_AUDIT_COLLECTION).limit(capped).get();
    // Firestore's default order is by document id (append order for `add`),
    // so reverse to show newest first without needing an orderBy index.
    return snap.docs
      .map((d) => {
        const raw = (d.data() ?? {}) as Record<string, unknown>;
        return {
          id: d.id,
          actorUid: typeof raw.actorUid === 'string' ? raw.actorUid : 'unknown',
          action: (typeof raw.action === 'string' ? raw.action : 'unknown') as AuditEntry['action'],
          targetType: (typeof raw.targetType === 'string'
            ? raw.targetType
            : 'unknown') as AuditEntry['targetType'],
          ...(typeof raw.targetId === 'string' ? { targetId: raw.targetId } : {}),
          ...(typeof raw.destination === 'string' ? { destination: raw.destination } : {}),
          at: isoOf(raw.at),
          detail: typeof raw.detail === 'string' ? raw.detail : null,
        };
      })
      .reverse();
  } catch {
    return [];
  }
}
