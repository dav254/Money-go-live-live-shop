/**
 * Operational history on PocketBase — the trails an admin reads when
 * something went wrong, mirrored from Firestore to the VPS.
 *
 * Why this section: every other mirror protects business data; these three
 * protect the ability to INVESTIGATE after the fact —
 *
 *   • `activity_logs`   — who did what and why (admin moderation actions,
 *                         including the buyer-request engine's audit trail);
 *   • `error_logs`      — app-wide error captures (GlobalErrorListener →
 *                         POST /api/error-log);
 *   • `support_tickets` — customer/reseller tickets and their status
 *                         transitions.
 *
 * All three were Firestore-only: an outage, a bad rule or a stray delete
 * would erase the very evidence needed to understand it — including the
 * record of who touched what. Firestore stays the primary write target for
 * all three; these helpers mirror every write here so the history survives
 * whatever Firestore does.
 *
 * Same rules as the other section mirrors:
 *  - `fsId` = the Firestore doc id, so the mirror is re-runnable.
 *  - indexed scalar columns for the filters the admin pages actually run
 *    (`category`, `status`, `userId`) + the FULL document in `data`,
 *    Timestamps converted to ISO strings.
 *  - every helper returns false when PocketBase is not configured and NEVER
 *    throws — a mirror failure must never fail an admin action, an error
 *    capture or a customer's support ticket.
 */

import {
  ensureCollection,
  pbCreateRecord,
  pbListRecords,
  pocketBaseEnabled,
  pbRequest,
  scrubForPocketBase,
  type PbField,
  type PbRecord,
} from './server';

export const ACTIVITY_LOGS_COLLECTION = 'activity_logs';
export const ERROR_LOGS_COLLECTION = 'error_logs';
export const SUPPORT_TICKETS_COLLECTION = 'support_tickets';

const ACTIVITY_LOG_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true }, // Firestore doc id — re-runnable mirror
  { name: 'category', type: 'text' },
  { name: 'action', type: 'text' },
  { name: 'targetType', type: 'text' },
  { name: 'targetId', type: 'text' },
  { name: 'actorUid', type: 'text' },
  { name: 'at', type: 'date' },
  { name: 'createdAt', type: 'date' },
  { name: 'data', type: 'json' },
];

const ERROR_LOG_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true },
  { name: 'status', type: 'text' },
  { name: 'errorMessage', type: 'text' },
  { name: 'userId', type: 'text' },
  { name: 'environment', type: 'text' },
  { name: 'timestamp', type: 'date' },
  { name: 'createdAt', type: 'date' },
  { name: 'data', type: 'json' },
];

const SUPPORT_TICKET_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true },
  { name: 'userId', type: 'text' },
  { name: 'issueType', type: 'text' },
  { name: 'status', type: 'text' },
  { name: 'createdAt', type: 'date' },
  { name: 'data', type: 'json' },
];

const esc = (value: string) => value.replace(/'/g, "\\'");

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function iso(v: unknown): string | undefined {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v;
  return undefined;
}

async function findByFsId(collection: string, fsId: string): Promise<PbRecord | null> {
  const rows = await pbListRecords(collection, {
    filter: `fsId = '${esc(fsId)}'`,
    perPage: 1,
  });
  return rows[0] ?? null;
}

/** The indexed columns each history collection keeps (absent values omitted). */
function columnsFor(collection: string, d: Record<string, unknown>): Record<string, unknown> {
  switch (collection) {
    case ACTIVITY_LOGS_COLLECTION:
      return {
        category: str(d.category) ?? '',
        action: str(d.action) ?? '',
        targetType: str(d.targetType) ?? '',
        targetId: str(d.targetId) ?? '',
        actorUid: str(d.actorUid) ?? '',
        at: iso(d.at),
        createdAt: iso(d.createdAt),
      };
    case ERROR_LOGS_COLLECTION:
      return {
        status: str(d.status) ?? '',
        // Column keeps one scan-line; the FULL message lives in `data`.
        errorMessage: (str(d.errorMessage) ?? '').slice(0, 200),
        userId: str(d.userId) ?? '',
        environment: str(d.environment) ?? '',
        timestamp: iso(d.timestamp),
        createdAt: iso(d.createdAt),
      };
    case SUPPORT_TICKETS_COLLECTION:
      return {
        userId: str(d.userId) ?? '',
        issueType: str(d.issueType) ?? '',
        status: str(d.status) ?? '',
        createdAt: iso(d.createdAt),
      };
    default:
      return {};
  }
}

/**
 * Generic full-document mirror (create or merge). Column extraction is done
 * by `columnsFor`; `scrubForPocketBase` converts Firestore Timestamps to ISO
 * strings and drops FieldValue sentinels (`serverTimestamp()` has no JSON
 * form — it must never reach the wire). Never throws; false = PB off/failed.
 */
async function mirrorRecord(
  collection: string,
  fields: PbField[],
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(collection, fields);
    const clean = scrubForPocketBase(data) as Record<string, unknown>;
    const body = JSON.stringify({ fsId, ...columnsFor(collection, clean), data: clean });
    const existing = await findByFsId(collection, fsId);
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${collection}/records/${existing.id}`,
        { method: 'PATCH', body },
      );
      return res.ok;
    }
    await pbCreateRecord(collection, JSON.parse(body));
    return true;
  } catch (error) {
    console.error(`[pocketbase] ${collection} mirror failed:`, error);
    return false;
  }
}

/** Mirror one audit entry (admin action) to the VPS store. Never throws. */
export async function pbMirrorActivityLog(
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  return mirrorRecord(ACTIVITY_LOGS_COLLECTION, ACTIVITY_LOG_FIELDS, fsId, data);
}

/** Mirror one captured error to the VPS store. Never throws. */
export async function pbMirrorErrorLog(
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  return mirrorRecord(ERROR_LOGS_COLLECTION, ERROR_LOG_FIELDS, fsId, data);
}

/** Mirror one support ticket (create or status transition). Never throws. */
export async function pbMirrorSupportTicket(
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  return mirrorRecord(SUPPORT_TICKETS_COLLECTION, SUPPORT_TICKET_FIELDS, fsId, data);
}
