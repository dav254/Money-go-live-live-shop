/**
 * GET /api/admin/search-engines/history
 *
 * Activity & Logs for the Search Engine Center, read from the EXISTING
 * stores — this console deliberately has no log table of its own:
 *
 *   • `distributionAudit`   — engine runs, sitemap submissions, the manual
 *     URL submissions made from this page (`url_submitted`);
 *   • `distributionConfig`   — `lastRunAt` / `sitemapSubmittedAt`;
 *   • `distributionJobs`     — the per-job `submissions` array (bounded,
 *     sanitized: HTTP status + outcome + ≤200-char note, never a body).
 *
 * Every Firestore read is wrapped: in an environment where the admin SDK
 * cannot reach the database the route answers `store: 'unavailable'` with a
 * truthful note instead of 500-ing or showing an empty log as if it were
 * complete.
 *
 * Authorization: `verifyAdminUid`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db, verifyAdminUid } from '@/lib/notifications/server-utils';
import { listAudit, type AuditEntry } from '@/lib/vidnov-core/distribution/audit';
import {
  readDistributionConfig,
  type DistributionConfig,
} from '@/lib/vidnov-core/distribution/config';
import { distributionStatusCounts } from '@/lib/vidnov-core/distribution/service';

export const dynamic = 'force-dynamic';

interface SubmissionRow {
  at: string | null;
  outcome: string;
  responseStatus?: number;
  message?: string | null;
  remoteId?: string | null;
}

interface JobSubmissionRow {
  id: string;
  channel: string;
  url: string | null;
  status: string;
  updatedAt: string | null;
  submissions: SubmissionRow[];
}

function iso(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toMillis' in value) {
    try {
      return new Date((value as { toMillis: () => number }).toMillis()).toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

/** Newest-first, hard-bounded projection of the per-job submission log. */
async function recentSubmissions(): Promise<JobSubmissionRow[]> {
  const snap = await db
    .collection('distributionJobs')
    .orderBy('updatedAt', 'desc')
    .limit(12)
    .get();
  return snap.docs.map((doc) => {
    const raw = (doc.data() ?? {}) as Record<string, unknown>;
    const payload = (raw.payload ?? {}) as { destinationUrl?: unknown };
    const subs = Array.isArray(raw.submissions) ? raw.submissions.slice(0, 3) : [];
    return {
      id: doc.id,
      channel: typeof raw.channel === 'string' ? raw.channel : 'unknown',
      url: typeof payload.destinationUrl === 'string' ? payload.destinationUrl : null,
      status: typeof raw.status === 'string' ? raw.status : 'unknown',
      updatedAt: iso(raw.updatedAt),
      submissions: subs.map((s) => {
        const r = (s ?? {}) as Record<string, unknown>;
        return {
          at: iso(r.at),
          outcome: typeof r.outcome === 'string' ? r.outcome : 'unknown',
          ...(typeof r.responseStatus === 'number' ? { responseStatus: r.responseStatus } : {}),
          ...(typeof r.message === 'string' ? { message: r.message } : {}),
          ...(typeof r.remoteId === 'string' ? { remoteId: r.remoteId } : {}),
        } satisfies SubmissionRow;
      }),
    } satisfies JobSubmissionRow;
  });
}

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  let audit: AuditEntry[] = [];
  let config: DistributionConfig | null = null;
  let statusCounts: Record<string, number | null> | null = null;
  let jobs: JobSubmissionRow[] = [];
  let store: 'ok' | 'unavailable' = 'ok';
  let storeNote: string | null = null;

  try {
    audit = await listAudit(db, 50);
    config = await readDistributionConfig(db);
    jobs = await recentSubmissions();
    statusCounts = await distributionStatusCounts(db);
  } catch {
    store = 'unavailable';
    storeNote =
      'The submission store could not be read in this environment, so history may be incomplete.';
  }

  // Flatten every submission attempt for "last success / last error" views.
  const flat = jobs.flatMap((j) =>
    j.submissions.map((s) => ({ channel: j.channel, url: j.url, ...s })),
  );
  const lastSuccess = flat
    .filter((s) => s.outcome === 'accepted')
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))[0] ?? null;
  const lastError = flat
    .filter((s) => s.outcome === 'error' || s.outcome === 'rejected')
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))[0] ?? null;

  return NextResponse.json({
    store,
    storeNote,
    checkedAt: new Date().toISOString(),
    engine: config
      ? {
          paused: config.paused,
          lastRunAt: config.lastRunAt,
          sitemapSubmittedAt: config.sitemapSubmittedAt,
          maxPerRun: config.maxPerRun,
          maxPerDay: config.maxPerDay,
        }
      : null,
    statusCounts,
    audit,
    jobs,
    summary: {
      urlsTracked: jobs.length,
      attempts: flat.length,
      lastSuccess,
      lastError,
    },
  });
}
