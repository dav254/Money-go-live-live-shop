import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { db } from '@/firebase/server';
import { AI_JOB_COLLECTION, getAiSettings } from '@/lib/ai/config';
import type { AiJobDoc } from '@/lib/ai/gateway';

export const runtime = 'nodejs';

/**
 * GET /api/admin/ai-stats — Admin AI Center dashboard data (spec §16).
 * Aggregate counters only; no worker URLs or credentials are ever returned.
 */
export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const settings = await getAiSettings();
    const snap = await db.collection(AI_JOB_COLLECTION).limit(500).get();

    const stats = {
      total: 0,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      byEngine: {} as Record<string, number>,
      pointsSpent: 0,
      avgProcessingMs: 0,
      failed: 0,
      activeWorkers: 0,
    };
    let processingSamples = 0;
    let processingTotal = 0;

    snap.forEach((doc) => {
      const job = doc.data() as AiJobDoc;
      stats.total += 1;
      stats.byStatus[job.status] = (stats.byStatus[job.status] ?? 0) + 1;
      stats.byType[job.type] = (stats.byType[job.type] ?? 0) + 1;
      const engine = job.engine ?? job.model ?? job.provider;
      stats.byEngine[engine] = (stats.byEngine[engine] ?? 0) + 1;
      if (job.status !== 'FAILED') stats.pointsSpent += job.creditsUsed ?? 0;
      if (job.status === 'FAILED') stats.failed += 1;
      if (job.status === 'PROCESSING') stats.activeWorkers += 1;
      if (job.processingMs) {
        processingTotal += job.processingMs;
        processingSamples += 1;
      }
    });

    stats.avgProcessingMs = processingSamples ? Math.round(processingTotal / processingSamples) : 0;

    return NextResponse.json({
      stats,
      settings,
      models: Object.values(settings.activeProviders).filter(
        (provider, index, all) => all.indexOf(provider) === index,
      ),
    });
  } catch (error) {
    console.error('[admin/ai-stats]', error);
    return NextResponse.json({ error: 'Failed to load AI statistics.' }, { status: 500 });
  }
}