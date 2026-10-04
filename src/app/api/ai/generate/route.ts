import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { dispatchAiJob, AiGatewayError, type AnimationPreset } from '@/lib/ai/gateway';
import { getAiSettings } from '@/lib/ai/config';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/ai/generate — the single AI entrypoint (spec §8, §35).
 *
 * Body: { type, prompt?, imageBase64?, imageMime?, animationPreset?,
 *         aspectRatio?, quality?, durationSeconds? }
 *
 * Creates the job, charges points, and returns { jobId } immediately.
 * The UI polls /api/ai/jobs?id=... for progress — long video generations
 * never block a page request (spec §11).
 */
export async function POST(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as {
      type?: string;
      prompt?: string;
      imageBase64?: string;
      imageMime?: string;
      animationPreset?: string;
      aspectRatio?: '1:1' | '16:9' | '9:16';
      quality?: 'standard' | 'high';
      durationSeconds?: number;
    };

    const type = body.type as 'text-to-image' | 'image-to-image' | 'text-to-video' | 'image-to-video' | 'image-animation' | undefined;
    if (!type || !['text-to-image', 'image-to-image', 'text-to-video', 'image-to-video', 'image-animation'].includes(type)) {
      return NextResponse.json({ error: 'Unknown generation type.' }, { status: 400 });
    }

    // Upload size guard for source images.
    if (body.imageBase64) {
      const bytes = Math.ceil((body.imageBase64.length * 3) / 4);
      const settings = await getAiSettings();
      if (bytes > settings.maxUploadMb * 1024 * 1024) {
        return NextResponse.json({ error: `Image is too large. Maximum ${settings.maxUploadMb}MB.` }, { status: 413 });
      }
    }

    const { jobId, promise } = await dispatchAiJob({
      userId: user.uid,
      businessId: null,
      type,
      prompt: body.prompt,
      imageBuffer: body.imageBase64 ? Buffer.from(body.imageBase64, 'base64') : undefined,
      imageMime: body.imageMime,
      animationPreset: body.animationPreset as AnimationPreset | undefined,
      aspectRatio: body.aspectRatio,
      quality: body.quality,
      durationSeconds: body.durationSeconds,
    });

    // Keep the process engaged on the promise; the client polls job status.
    void promise.catch(() => undefined);

    return NextResponse.json({ jobId });
  } catch (error) {
    if (error instanceof AiGatewayError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === 'INSUFFICIENT_POINTS' ? 402 : 400 });
    }
    console.error('[ai/generate]', error);
    return NextResponse.json({ error: 'Could not start the generation.' }, { status: 500 });
  }
}

/** GET /api/ai/generate — pricing for the UI (admin-configured, spec §12). */
export async function GET() {
  const settings = await getAiSettings();
  const { AI_CAPABILITY_LIST, modelForCapability } = await import('@/lib/ai/providers');
  return NextResponse.json({
    pricing: settings.pricing,
    freeTrialGenerations: settings.freeTrialGenerations,
    maxUploadMb: settings.maxUploadMb,
    capabilities: AI_CAPABILITY_LIST.map((cap) => ({
      ...cap,
      engine: modelForCapability(cap.id, settings.activeProviders).engine,
    })),
  });
}
