/**
 * Opportunity applications on PocketBase — the "growth engine review queue"
 * section of the Firestore → self-hosting migration.
 *
 * Why this exists: the admin review queue (admin/system/opportunities) read
 * ONLY Firestore, so a blocked Firestore project made every application
 * review impossible ("Review queue unavailable"). The VPS keeps its own copy
 * of each application so the queue answers from this machine.
 *
 * Shape (same rules as the other mirrors):
 *  - `fsId` = the Firestore doc id, so the mirror is re-runnable.
 *  - indexed columns for the equality filters the admin route runs (`state`)
 *    plus the FULL document in `data`.
 *  - every helper returns null/false when PocketBase is not configured and
 *    NEVER throws — a mirror failure must never fail a review.
 *  - reads: Firestore first (the transactional state machine lives there),
 *    this store as the fallback when Firestore cannot answer.
 *
 * Note on writes: APPROVE/REJECT transitions still require Firestore (they
 * run inside a transaction, which is the concurrency guarantee of the state
 * machine). This mirror makes the queue VISIBLE when Firestore is down; a
 * review decision is never invented against a store that cannot confirm it.
 */

import {
  ensureCollection,
  pbListRecords,
  pocketBaseEnabled,
  pbRequest,
  scrubForPocketBase,
  type PbField,
  type PbRecord,
} from './server';

export const OPPORTUNITY_APPLICATIONS_PB_COLLECTION = 'opportunity_applications';

export const OPPORTUNITY_APPLICATION_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true }, // Firestore doc id — re-runnable mirror
  { name: 'state', type: 'text' },
  { name: 'opportunityId', type: 'text' },
  { name: 'applicantUid', type: 'text' },
  { name: 'updatedAt', type: 'date' },
  // The WHOLE application document so the review queue renders from this
  // store alone.
  { name: 'data', type: 'json' },
];

const esc = (value: string) => value.replace(/'/g, "\\'");

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function toApplication(record: PbRecord): Record<string, unknown> {
  const data = (record.data ?? null) as Record<string, unknown> | null;
  return { id: String(record.fsId ?? record.id), ...(data ?? {}) };
}

async function findByFsId(fsId: string): Promise<PbRecord | null> {
  const rows = await pbListRecords(OPPORTUNITY_APPLICATIONS_PB_COLLECTION, {
    filter: `fsId = '${esc(fsId)}'`,
    perPage: 1,
  });
  return rows[0] ?? null;
}

/**
 * Mirror one opportunity application to the VPS store (create-or-merge with
 * the full document). Never throws; false = PB off or write failed.
 */
export async function pbMirrorOpportunityApplication(
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(OPPORTUNITY_APPLICATIONS_PB_COLLECTION, OPPORTUNITY_APPLICATION_FIELDS);
    const clean = (scrubForPocketBase(data) ?? {}) as Record<string, unknown>;
    const columns = {
      state: str(clean.state) ?? '',
      opportunityId: str(clean.opportunityId) ?? '',
      applicantUid: str(clean.applicantUid) ?? '',
      updatedAt: new Date().toISOString(),
    };
    const body = JSON.stringify({ fsId, ...columns, data: clean });
    const existing = await findByFsId(fsId);
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${OPPORTUNITY_APPLICATIONS_PB_COLLECTION}/records/${existing.id}`,
        { method: 'PATCH', body },
      );
      return res.ok;
    }
    const res = await pbRequest(
      `/api/collections/${OPPORTUNITY_APPLICATIONS_PB_COLLECTION}/records`,
      { method: 'POST', body },
    );
    return res.ok;
  } catch (error) {
    console.error('[pocketbase] opportunity application mirror failed:', error);
    return false;
  }
}

/**
 * Mirrored applications in the given states, newest first — the admin review
 * queue's fallback when Firestore cannot answer. Null when PB is off or the
 * read failed (the route reports honestly either way).
 */
export async function pbListOpportunityApplications(
  states: readonly string[],
  limit = 50,
): Promise<Array<Record<string, unknown>> | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(OPPORTUNITY_APPLICATIONS_PB_COLLECTION, OPPORTUNITY_APPLICATION_FIELDS);
    const filter = states.map((s) => `state = '${esc(s)}'`).join(' || ');
    const rows = await pbListRecords(OPPORTUNITY_APPLICATIONS_PB_COLLECTION, {
      ...(filter ? { filter } : {}),
      sort: '-updatedAt',
      perPage: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map(toApplication);
  } catch (error) {
    console.error('[pocketbase] opportunity application list failed:', error);
    return null;
  }
}
