import * as path from 'path';
import * as fsp from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { falQueue } from '@/lib/ai/fal-adapter';
import { MEDIA_ROOT } from '@/lib/media/config';
import { engineMediaUrl, readStatus } from '@/lib/media/engine';
import { storeGeneratedImage, storeGeneratedVideo } from '@/lib/media/service';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * AI UHD / Enhance — the editor's enhancement workspace, backed by fal.ai's
 * REAL upscalers when a provider key is connected:
 *
 *   GET  → { available, image, video, engines } — what THIS server can do,
 *          derived only from whether FAL_KEY exists. The UI renders the
 *          workspace disabled with that exact reason instead of faking work.
 *   POST → { kind, mediaId, scale } resolves the media by id AND owner (an id
 *          alone never grants access), sends it to
 *            · fal-ai/esrgan         (images, sync through the queue)
 *            · fal-ai/video-upscaler (video, queue + poll)
 *          then stores the result in the caller's Vidnov library and returns
 *          the new media record — so an enhanced file can be reused in the
 *          editor, Discovery, listings and the shop like any upload.
 *
 * Images travel as a data URI (works even for private files); videos need a
 * public URL, so a private source is refused with a plain explanation rather
 * than a mystery failure from the provider.
 */

const IMAGE_MODEL = 'fal-ai/esrgan';
const VIDEO_MODEL = 'fal-ai/video-upscaler';
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export async function GET() {
  const available = Boolean(process.env.FAL_KEY);
  return NextResponse.json({
    available,
    image: available,
    video: available,
    engines: available ? `${IMAGE_MODEL} · ${VIDEO_MODEL}` : null,
  });
}

function extractImageUrl(result: Record<string, unknown>): string | null {
  const single = result.image as { url?: string } | undefined;
  if (single?.url) return single.url;
  const many = result.images as { url?: string }[] | undefined;
  if (many?.[0]?.url) return many[0].url;
  return null;
}

export async function POST(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'seller' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Only sellers can enhance media.' }, { status: 403 });
  }

  if (!process.env.FAL_KEY) {
    return NextResponse.json(
      {
        code: 'no-provider',
        error: 'No enhancement provider is connected on this server yet (FAL_KEY is not set).',
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    kind?: unknown;
    mediaId?: unknown;
    scale?: unknown;
  };
  const kind = body.kind === 'image' ? 'image' : 'video';
  const mediaId = typeof body.mediaId === 'string' ? body.mediaId : '';
  const scale = body.scale === 4 ? 4 : 2;
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(mediaId)) {
    return NextResponse.json({ error: 'Pick a file from your media library first.' }, { status: 400 });
  }

  const rec = await readStatus(mediaId).catch(() => null);
  if (!rec || rec.userId !== user.uid || rec.status !== 'READY' || !rec.storagePath || rec.storagePath.includes('..')) {
    return NextResponse.json(
      { error: 'That file is not ready or does not belong to your account.' },
      { status: 403 },
    );
  }
  if (rec.type !== kind) {
    return NextResponse.json(
      { error: kind === 'image' ? 'That mediaId is not an image.' : 'That mediaId is not a video.' },
      { status: 400 },
    );
  }

  try {
    if (kind === 'image') {
      const absolute = path.join(MEDIA_ROOT, rec.storagePath);
      const stat = await fsp.stat(absolute).catch(() => null);
      if (!stat) return NextResponse.json({ error: 'The original file is missing from storage.' }, { status: 410 });
      if (stat.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: 'Image is over 25MB — try a smaller one.' }, { status: 413 });
      }
      const buffer = await fsp.readFile(absolute);
      const dataUri = `data:${rec.mimeType || 'image/png'};base64,${buffer.toString('base64')}`;

      const requestId = await falQueue.submit(IMAGE_MODEL, {
        image_url: dataUri,
        scale,
        model: 'RealESRGAN_x4plus',
        output_format: 'png',
      });
      const result = await falQueue.result(IMAGE_MODEL, requestId);
      const url = extractImageUrl(result);
      if (!url) throw new Error('The enhancement engine returned no image.');
      const out = await falQueue.download(url);
      const stored = await storeGeneratedImage(out, user.uid, 'png');
      return NextResponse.json({ ...stored, kind: 'image', scale });
    }

    // video — the provider fetches it by URL, so it must be publicly served.
    if (rec.isPrivate) {
      return NextResponse.json(
        {
          error:
            'This video is private, so the enhancement provider cannot fetch it. Make it public or upload an unlisted copy.',
        },
        { status: 409 },
      );
    }
    const stat = await fsp.stat(path.join(MEDIA_ROOT, rec.storagePath)).catch(() => null);
    if (!stat) return NextResponse.json({ error: 'The original file is missing from storage.' }, { status: 410 });
    if (stat.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: 'Video is over 200MB — trim it first.' }, { status: 413 });
    }

    const origin = request.nextUrl.origin;
    const videoUrl = new URL(engineMediaUrl(rec.storagePath), origin).toString();

    const requestId = await falQueue.submit(VIDEO_MODEL, { video_url: videoUrl, scale });
    const result = await falQueue.result(VIDEO_MODEL, requestId);
    const outUrl = (result.video as { url?: string } | undefined)?.url ?? null;
    if (!outUrl) throw new Error('The enhancement engine returned no video.');
    const out = await falQueue.download(outUrl);
    const stored = await storeGeneratedVideo(out, user.uid);
    return NextResponse.json({ ...stored, kind: 'video', scale });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enhancement failed.';
    const status = /balance|credit|top up/i.test(message) ? 402 : 502;
    return NextResponse.json(
      { code: status === 402 ? 'no-credit' : 'failed', error: message },
      { status },
    );
  }
}
