import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getLiveStream } from '@/lib/live/service';
import { LIVESTREAMS_COLLECTION, LIVE_REPORT_REASONS, type LiveReportReason } from '@/lib/live/types';

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

  await db.collection('contentModerationQueue').add({
    contentType: 'liveStream',
    contentId: id,
    reporterId: user.uid,
    reason,
    details: (body.details ?? '').slice(0, 500),
    streamTitle: stream.title,
    sellerId: stream.sellerId,
    status: 'pending',
    createdAt: new Date(),
  });

  await db
    .collection(LIVESTREAMS_COLLECTION)
    .doc(id)
    .update({ reportsCount: FieldValue.increment(1) })
    .catch(() => undefined);

  return NextResponse.json({ ok: true });
}
