import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getLiveStream } from '@/lib/live/service';
import { LIVESTREAMS_COLLECTION, LIVE_REPORT_REASONS, type LiveReportReason } from '@/lib/live/types';
import { pbBumpLiveStreamCounter, pbMirrorLiveReport } from '@/lib/pocketbase/live-streams';

export const runtime = 'nodejs';

/**
 * POST /api/live/[id]/report (spec §33)
 * Feeds the existing moderation queue — admins review from the dashboard.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const stream = await getLiveStream(id);
  if (!stream) return NextResponse.json({ error: 'Stream not found.' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { reason?: string; details?: string };
  const reason = LIVE_REPORT_REASONS.includes(body.reason as LiveReportReason)
    ? (body.reason as LiveReportReason)
    : 'Other';

  const details = (body.details ?? '').slice(0, 500);
  const reportRef = await db.collection('contentModerationQueue').add({
    contentType: 'liveStream',
    contentId: id,
    reporterId: user.uid,
    reason,
    details,
    streamTitle: stream.title,
    sellerId: stream.sellerId,
    status: 'pending',
    createdAt: new Date(),
  });

  // VPS copy of the report (best-effort — the moderation queue in Firestore
  // stays the queue admins review; this keeps a copy that survives an outage).
  void pbMirrorLiveReport(reportRef.id, {
    streamId: id,
    streamTitle: stream.title,
    sellerId: stream.sellerId,
    reporterId: user.uid,
    reason,
    details,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  await db
    .collection(LIVESTREAMS_COLLECTION)
    .doc(id)
    .update({ reportsCount: FieldValue.increment(1) })
    .catch(() => undefined);
  void pbBumpLiveStreamCounter(id, 'reportsCount', 1);

  return NextResponse.json({ ok: true });
}
