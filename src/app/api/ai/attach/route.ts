import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { attachAiCreation, setAiJobSaved, type AiAttachment } from '@/lib/ai/gateway';

export const runtime = 'nodejs';

/**
 * POST /api/ai/attach — connects a finished creation to the marketplace
 * (spec §11 "Use in Product / Service / Request", §21 sharing).
 *
 * Body: { jobId, target, targetId, label?, saved? }
 * The attachment is written server-side on the aiJobs document so the link is
 * traceable from both the creation and the marketplace side.
 */
export async function POST(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as {
      jobId?: string;
      target?: AiAttachment['target'];
      targetId?: string;
      label?: string;
      saved?: boolean;
    };

    if (!body.jobId) return NextResponse.json({ error: 'Missing jobId.' }, { status: 400 });

    if (typeof body.saved === 'boolean' && !body.target) {
      await setAiJobSaved(body.jobId, user.uid, body.saved);
      return NextResponse.json({ ok: true, saved: body.saved });
    }

    const targets: AiAttachment['target'][] = ['product', 'service', 'request', 'business', 'message', 'live'];
    if (!body.target || !targets.includes(body.target) || !body.targetId) {
      return NextResponse.json({ error: 'Invalid attachment target.' }, { status: 400 });
    }

    const job = await attachAiCreation(body.jobId, user.uid, {
      target: body.target,
      targetId: body.targetId,
      label: body.label?.slice(0, 120) || body.targetId,
    });
    return NextResponse.json({ ok: true, attachments: job.attachments ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not attach the creation.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}