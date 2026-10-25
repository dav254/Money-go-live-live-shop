import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import {
  resolveOwnedVideo,
  resolveMusicSource,
  startStudioRender,
  newStudioMediaId,
} from '@/lib/media/soundtrack';
import {
  sanitizeSoundtrack,
  sanitizeTrim,
  sanitizeAspect,
  sanitizeOverlay,
} from '@/lib/studio/video-studio';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/video-studio/mix — produce the FINAL video (poster + soundtrack)
 * for a studio draft.
 *
 * 1. authenticate the seller (Bearer token → verifyUserContext);
 * 2. resolve the source clip by id AND owner — a seller can only ever render
 *    their own media;
 * 3. resolve the music the same way (own upload under music/<uid>/ or a
 *    licensed catalogue track) — an unresolvable source is refused, never
 *    silently dropped;
 * 4. sanitize every setting (trim, volumes, fades, overlay, aspect) with the
 *    SAME clamps the UI showed;
 * 5. hand a fresh mediaId to the background renderer and return it — the
 *    browser polls the existing GET /api/media/status?id= contract.
 *
 * Returns display-safe fields only: mediaId, whether a real render was
 * needed, and the resolved duration. No paths, no tokens, no plan internals.
 */
export async function POST(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'seller' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Only sellers can prepare videos.' }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const videoMediaId = typeof body.videoMediaId === 'string' ? body.videoMediaId : '';
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(videoMediaId)) {
      return NextResponse.json({ error: 'Missing video.' }, { status: 400 });
    }

    const source = await resolveOwnedVideo(videoMediaId, user.uid);
    if (!source) {
      return NextResponse.json(
        { error: 'That video is not ready yet or does not belong to your account.' },
        { status: 403 },
      );
    }
    if (source.durationSeconds > 0 && source.durationSeconds > 130) {
      return NextResponse.json(
        { error: 'This video is too long for the studio (2 minutes max).' },
        { status: 413 },
      );
    }

    const soundtrack = sanitizeSoundtrack(body.soundtrack);
    let music = null;
    let soundtrackTitle: string | null = null;
    if (soundtrack) {
      music = await resolveMusicSource(soundtrack, user.uid);
      if (!music) {
        return NextResponse.json(
          { error: 'The selected music is no longer available. Pick another track.' },
          { status: 409 },
        );
      }
      soundtrackTitle = music.title;
    }

    const trim = sanitizeTrim(body.trim, source.durationSeconds);
    const aspect = sanitizeAspect(body.aspect);
    const overlay = sanitizeOverlay(body.overlay);
    const coverAtSeconds =
      typeof body.coverAtSeconds === 'number' && Number.isFinite(body.coverAtSeconds)
        ? Math.min(Math.max(0, body.coverAtSeconds), source.durationSeconds)
        : 0;

    const finalMediaId = newStudioMediaId();
    await startStudioRender({
      finalMediaId,
      userId: user.uid,
      source,
      music,
      plan: {
        durationSeconds: source.durationSeconds,
        width: source.width,
        height: source.height,
        videoHasAudio: source.hasAudio,
        trim,
        aspect,
        overlay,
        coverAtSeconds,
        soundtrack,
      },
    });

    return NextResponse.json({
      mediaId: finalMediaId,
      soundtrackTitle,
      sourceDurationSeconds: Math.round(source.durationSeconds * 10) / 10,
    });
  } catch (error) {
    console.error('[video-studio/mix] unexpected error');
    return NextResponse.json(
      { error: 'Could not prepare the video. Please try again.' },
      { status: 500 },
    );
  }
}