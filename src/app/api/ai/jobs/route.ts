import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { db } from '@/firebase/server';
import { AI_JOB_COLLECTION } from '@/lib/ai/config';
import type { AiJobDoc } from '@/lib/ai/gateway';

export const runtime = 'nodejs';

/**
 * GET /api/ai/jobs?id=...        → one job (poll endpoint, owner or admin)
 * GET /api/ai/jobs?type=...&status=... → My Generations list (spec §13)
 */
export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  try {
    if (id) {
      const snap = await db.collection(AI_JOB_COLLECTION).doc(id).get();
      if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const job = snap.data() as AiJobDoc;
      if (job.userId !== user.uid && !user.isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.json({ job });
    }

    // List mine (single-field indexes only — filter status client-side too).
    const typeFilter = url.searchParams.get('type');
    let query = db.collection(AI_JOB_COLLECTION).where('userId', '==', user.uid).limit(100) as ReturnType<typeof db.collection>;
    if (typeFilter) query = query.where('type', '==', typeFilter) as typeof query;
    const snap = await query.get().catch(() => null);
    const jobs: AiJobDoc[] = [];
    if (snap) {
      snap.forEach((doc) => jobs.push({ ...(doc.data() as AiJobDoc), id: doc.id }));
    }
    jobs.sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));

    const statusFilter = url.searchParams.get('status');
    const filtered = statusFilter ? jobs.filter((j) => j.status === statusFilter) : jobs;
    return NextResponse.json({ jobs: filtered });
  } catch (error) {
    console.error('[ai/jobs]', error);
    return NextResponse.json({ error: 'Failed to load jobs.' }, { status: 500 });
  }
}

function tsMs(value: unknown): number {
  if (!value) return 0;
  const ts = value as { toDate?: () => Date; seconds?: number };
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

/** DELETE /api/ai/jobs?id=... — soft-delete my generation from history. */
export async function DELETE(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  const snap = await db.collection(AI_JOB_COLLECTION).doc(id).get();
  if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const job = snap.data() as AiJobDoc;
  if (job.userId !== user.uid && !user.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await db.collection(AI_JOB_COLLECTION).doc(id).update({ hidden: true }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
