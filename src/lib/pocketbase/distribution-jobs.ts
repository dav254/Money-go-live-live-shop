/**
 * Distribution jobs on PocketBase — the "growth engine queues" section of the
 * Firestore → self-hosting migration.
 *
 * Why this exists: the Distribution Control Center (admin/system/distribution)
 * read ONLY Firestore, so a blocked Firestore project made every queue,
 * publication and error counter on that page unavailable. The VPS keeps its
 * own copy of each job so the admin consoles answer from this machine.
 *
 * Shape (same rules as the orders/products mirrors):
 *  - `fsId` = the Firestore doc id (the deterministic job id), so the mirror
 *    is re-runnable and transitions match the right row.
 *  - indexed scalar columns for the equality filters the admin routes actually
 *    run (status, channel, confirmation.state, lastError.class, attempts) +
 *    the FULL job document in `data` (payloads are already sanitized server-
 *    side; response bodies and credentials never reach a job doc).
 *  - every helper returns null/false when PocketBase is not configured and
 *    NEVER throws — a mirror failure must never fail a distribution run.
 *  - reads: Firestore first (source of truth), this store as the fallback
 *    when Firestore cannot answer.
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

export const DISTRIBUTION_JOBS_PB_COLLECTION = 'distribution_jobs';

export const DISTRIBUTION_JOB_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true }, // the job id — re-runnable mirror
  { name: 'status', type: 'text' },
  { name: 'channel', type: 'text' },
  { name: 'productId', type: 'text' },
  { name: 'sellerId', type: 'text' },
  { name: 'confirmationState', type: 'text' },
  { name: 'lastErrorClass', type: 'text' },
  { name: 'attempts', type: 'number' },
  { name: 'updatedAt', type: 'date' },
  // The WHOLE job document (payload preview, submissions, audit fields) so the
  // admin queues can render from this store alone.
  { name: 'data', type: 'json' },
];

/** One mirrored job: the Firestore job id + the full document. */
export interface PbDistributionJob {
  id: string;
  status?: string;
  channel?: string;
  productId?: string;
  sellerId?: string;
  data: Record<string, unknown>;
}

const esc = (value: string) => value.replace(/'/g, "\\'");

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function iso(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function toJob(record: PbRecord): PbDistributionJob {
  const data = (record.data ?? null) as Record<string, unknown> | null;
  return {
    id: String(record.fsId ?? record.id),
    status: str(record.status) ?? str(data?.status),
    channel: str(record.channel) ?? str(data?.channel),
    productId: str(record.productId) ?? str(data?.productId),
    sellerId: str(record.sellerId) ?? str(data?.sellerId),
    data: data ?? {},
  };
}

async function findByFsId(fsId: string): Promise<PbRecord | null> {
  const rows = await pbListRecords(DISTRIBUTION_JOBS_PB_COLLECTION, {
    filter: `fsId = '${esc(fsId)}'`,
    perPage: 1,
  });
  return rows[0] ?? null;
}

/**
 * Mirror one distribution job to the VPS store (create-or-merge with the
 * full document). Never throws; false = PB off or write failed.
 */
export async function pbMirrorDistributionJob(
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(DISTRIBUTION_JOBS_PB_COLLECTION, DISTRIBUTION_JOB_FIELDS);
    const clean = (scrubForPocketBase(data) ?? {}) as Record<string, unknown>;
    const confirmation = (clean.confirmation ?? null) as { state?: unknown } | null;
    const lastError = (clean.lastError ?? null) as { class?: unknown } | null;
    const columns = {
      status: str(clean.status) ?? '',
      channel: str(clean.channel) ?? '',
      productId: str(clean.productId) ?? '',
      sellerId: str(clean.sellerId) ?? '',
      confirmationState: str(confirmation?.state) ?? '',
      lastErrorClass: str(lastError?.class) ?? '',
      attempts: num(clean.attempts) ?? 0,
      updatedAt: iso(clean.updatedAt) ?? new Date().toISOString(),
    };
    const body = JSON.stringify({ fsId, ...columns, data: clean });
    const existing = await findByFsId(fsId);
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${DISTRIBUTION_JOBS_PB_COLLECTION}/records/${existing.id}`,
        { method: 'PATCH', body },
      );
      return res.ok;
    }
    const res = await pbRequest(
      `/api/collections/${DISTRIBUTION_JOBS_PB_COLLECTION}/records`,
      { method: 'POST', body },
    );
    return res.ok;
  } catch (error) {
    console.error('[pocketbase] distribution job mirror failed:', error);
    return false;
  }
}

/**
 * Re-read one job from Firestore and mirror it — the "keep the VPS copy in
 * step" call every write site fires after its transaction commits. Best-effort
 * by design: void it, never await a throw.
 */
export async function syncDistributionJob(
  db: { collection(name: string): { doc(id: string): { get(): Promise<{ exists: boolean; data(): unknown }> } } },
  jobId: string,
): Promise<void> {
  if (!pocketBaseEnabled()) return;
  try {
    const snap = await db.collection('distributionJobs').doc(jobId).get();
    if (snap.exists) {
      await pbMirrorDistributionJob(jobId, (snap.data() ?? {}) as Record<string, unknown>);
    }
  } catch {
    // Firestore read failed right after its own write, or PB off — nothing to do.
  }
}

/** Job equality filters the admin routes run. All optional. */
export interface DistributionJobFilter {
  status?: string;
  channel?: string;
  confirmationState?: string;
  lastErrorClass?: string;
  attempts?: number;
}

function buildFilter(f: DistributionJobFilter): string | undefined {
  const parts: string[] = [];
  if (f.status) parts.push(`status = '${esc(f.status)}'`);
  if (f.channel) parts.push(`channel = '${esc(f.channel)}'`);
  if (f.confirmationState) parts.push(`confirmationState = '${esc(f.confirmationState)}'`);
  if (f.lastErrorClass) parts.push(`lastErrorClass = '${esc(f.lastErrorClass)}'`);
  if (typeof f.attempts === 'number') parts.push(`attempts = ${f.attempts}`);
  return parts.length ? parts.join(' && ') : undefined;
}

/**
 * One page of mirrored jobs for the admin queues, newest first.
 * Null when PocketBase is off or the read failed (caller falls back to
 * whatever it can, or reports honestly).
 */
export async function pbListDistributionJobs(
  filter: DistributionJobFilter,
  limit = 50,
): Promise<PbDistributionJob[] | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(DISTRIBUTION_JOBS_PB_COLLECTION, DISTRIBUTION_JOB_FIELDS);
    const rows = await pbListRecords(DISTRIBUTION_JOBS_PB_COLLECTION, {
      ...(buildFilter(filter) ? { filter: buildFilter(filter) } : {}),
      sort: '-updatedAt',
      perPage: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map(toJob);
  } catch (error) {
    console.error('[pocketbase] distribution job list failed:', error);
    return null;
  }
}

/**
 * Equality-only count for the overview's counters. Null means "unknown" —
 * never a fabricated 0. Uses `totalItems` from a 1-row page (a count query
 * without pulling documents).
 */
export async function pbCountDistributionJobs(
  filter: DistributionJobFilter,
): Promise<number | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(DISTRIBUTION_JOBS_PB_COLLECTION, DISTRIBUTION_JOB_FIELDS);
    const qs = new URLSearchParams();
    const f = buildFilter(filter);
    if (f) qs.set('filter', f);
    qs.set('perPage', '1');
    qs.set('page', '1');
    const res = await pbRequest(
      `/api/collections/${DISTRIBUTION_JOBS_PB_COLLECTION}/records?${qs}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { totalItems?: number };
    return typeof data.totalItems === 'number' ? data.totalItems : null;
  } catch (error) {
    console.error('[pocketbase] distribution job count failed:', error);
    return null;
  }
}

/** Recent failed jobs from the VPS store — the overview's error list fallback. */
export async function pbRecentFailedJobs(
  limit = 10,
): Promise<Array<Record<string, unknown>> | null> {
  const jobs = await pbListDistributionJobs({ status: 'failed' }, limit);
  if (!jobs) return null;
  return jobs.map((j) => {
    const d = j.data as {
      productId?: unknown;
      channel?: unknown;
      attempts?: unknown;
      lastError?: { class?: string; message?: string; at?: string } | null;
    };
    return {
      jobId: j.id,
      productId: typeof d.productId === 'string' ? d.productId : null,
      channel: typeof d.channel === 'string' ? d.channel : null,
      attempts: typeof d.attempts === 'number' ? d.attempts : 0,
      error: d.lastError
        ? {
            class: d.lastError.class ?? 'unknown',
            message: d.lastError.message ?? '',
            at: d.lastError.at ?? null,
          }
        : null,
      // Conservative: retryability is re-derived from the sanitized record the
      // same way canRetry does — never claims "retryable" without the data.
      retryable: null as boolean | null,
    };
  });
}
