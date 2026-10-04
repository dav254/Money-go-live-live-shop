/**
 * fal.ai provider adapter — the primary engine for VIDNOV AI Studio.
 *
 * Why fal.ai instead of a self-hosted GPU box: it runs Wan 2.2 (the model the
 * studio is designed around) and FLUX as a serverless API, so there is no GPU
 * server to buy, patch or keep alive — you pay per generation and scale to
 * zero. When volume eventually justifies your own GPU (or a Wan worker VPS),
 * swap the provider in `providers.ts`; the UI never changes.
 *
 * Uses fal's REST queue API directly (submit → poll status → fetch result),
 * so there is no extra client dependency. The API key stays server-side.
 */
import type {
  GeneratedImageOutput,
  GeneratedVideoOutput,
  ImageEditJobInput,
  ImageJobInput,
  VideoJobInput,
} from './gateway';

const QUEUE_ROOT = 'https://queue.fal.run';

/** FLUX for images, Wan 2.2 for video — the exact engines the studio names. */
const IMAGE_MODELS = ['fal-ai/flux-pro/kontext', 'fal-ai/flux/schnell'];
const TEXT_TO_VIDEO_MODELS = ['fal-ai/wan/v2.2-a14b/text-to-video'];
const IMAGE_TO_VIDEO_MODELS = ['fal-ai/wan/v2.2-a14b/image-to-video'];

/** fal accepts named sizes for images and ratios for video. */
const IMAGE_SIZE: Record<string, string> = {
  '1:1': 'square_hd',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
};

const VIDEO_ASPECT: Record<string, string> = {
  '1:1': '1:1',
  '16:9': '16:9',
  '9:16': '9:16',
};

const ALLOWED_DURATIONS = ['5s', '8s']; // Wan 2.2 accepts 5s / 8s.

function falKey(): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('AI is not configured yet. Please try again later.');
  return key;
}

/** fal rejects calls when the account balance runs out — say so plainly. */
class FalError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'FalError';
  }
}

const BALANCE_MESSAGE =
  'The AI engine account has no credit left. Top up the AI provider balance and generation resumes automatically.';

async function falFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    cache: 'no-store',
    headers: { Authorization: `Key ${falKey()}`, ...(init.headers ?? {}) },
  });
}

async function submit(model: string, input: Record<string, unknown>): Promise<string> {
  const res = await falFetch(`${QUEUE_ROOT}/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => null)) as { request_id?: string; detail?: string } | null;
  if (!res.ok || !body?.request_id) {
    const detail = body?.detail ?? `fal.ai returned ${res.status}.`;
    const message = res.status === 402 || res.status === 403 || /balance|credit|locked/i.test(detail)
      ? BALANCE_MESSAGE
      : detail;
    throw new FalError(message, res.status);
  }
  return body.request_id;
}

async function waitForResult(model: string, requestId: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const statusRes = await falFetch(`${QUEUE_ROOT}/${model}/requests/${requestId}/status`);
    if (!statusRes.ok) {
      const body = (await statusRes.json().catch(() => null)) as { detail?: string } | null;
      throw new FalError(body?.detail ?? `fal.ai status check failed (${statusRes.status}).`, statusRes.status);
    }
    const status = (await statusRes.json()) as { status?: string; error?: unknown };
    if (status.status === 'COMPLETED') {
      const res = await falFetch(`${QUEUE_ROOT}/${model}/requests/${requestId}`);
      if (!res.ok) throw new FalError('Could not read the generated result.', res.status);
      return (await res.json()) as Record<string, unknown>;
    }
    if (status.status === 'FAILED' || status.error) {
      throw new FalError('The AI engine could not complete this generation.', 500);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new FalError('The AI engine timed out. Please try again.', 504);
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new FalError('The generated file could not be downloaded.', res.status);
  return Buffer.from(await res.arrayBuffer());
}

/** FLUX results look like { images: [{ url, content_type }] }. */
function firstImageUrl(result: Record<string, unknown>): { url: string; mimeType: string } | null {
  const images = result.images as { url?: string; content_type?: string }[] | undefined;
  const first = images?.[0];
  if (first?.url) return { url: first.url, mimeType: first.content_type ?? 'image/png' };
  const single = result.image as { url?: string; content_type?: string } | undefined;
  if (single?.url) return { url: single.url, mimeType: single.content_type ?? 'image/png' };
  return null;
}

/** Wan results look like { video: { url } }. */
function videoUrl(result: Record<string, unknown>): string | null {
  const video = result.video as { url?: string } | undefined;
  return video?.url ?? null;
}

/* ------------------------------------------------------------------ */
/* Images                                                             */
/* ------------------------------------------------------------------ */

export async function falTextToImage(input: ImageJobInput): Promise<GeneratedImageOutput> {
  const imageSize = IMAGE_SIZE[input.aspectRatio ?? '1:1'] ?? 'square_hd';
  const prompt = `${input.prompt}. High quality, professional, commercially usable.`;

  let lastError: Error | null = null;
  for (const model of IMAGE_MODELS) {
    try {
      const requestId = await submit(model, { prompt, image_size: imageSize, num_images: 1 });
      const result = await waitForResult(model, requestId);
      const image = firstImageUrl(result);
      if (!image) throw new FalError('The AI engine returned an empty result.', 500);
      return {
        imageBuffer: await download(image.url),
        mimeType: image.mimeType,
        model: model.split('/').pop() ?? model,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Balance/auth problems will not fix themselves by trying another model.
      if (err instanceof FalError && err.status < 500 && !/model|schema|input/i.test(err.message)) break;
    }
  }
  throw lastError ?? new Error('Image generation failed.');
}

/** IMAGE → IMAGE: FLUX Kontext restyles the source image on instruction. */
export async function falImageToImage(input: ImageEditJobInput): Promise<GeneratedImageOutput> {
  const imageSize = IMAGE_SIZE[input.aspectRatio ?? '1:1'] ?? 'square_hd';
  const model = 'fal-ai/flux-pro/kontext';

  // fal needs a fetchable URL; a data URI is accepted by the Kontext endpoint.
  const imageUrl = `data:${input.mimeType ?? 'image/png'};base64,${input.imageBuffer.toString('base64')}`;
  const requestId = await submit(model, {
    prompt: `${input.prompt}. Keep the subject recognisable, professional result.`,
    image_url: imageUrl,
    image_size: imageSize,
    num_images: 1,
  });
  const result = await waitForResult(model, requestId);
  const image = firstImageUrl(result);
  if (!image) throw new FalError('The AI engine returned an empty result.', 500);
  return {
    imageBuffer: await download(image.url),
    mimeType: image.mimeType,
    model: 'flux-pro/kontext',
  };
}

/* ------------------------------------------------------------------ */
/* Video (Wan 2.2)                                                     */
/* ------------------------------------------------------------------ */

function duration(seconds: number | undefined): string {
  const requested = seconds ?? 8;
  return ALLOWED_DURATIONS.reduce((best, d) =>
    Math.abs(Number(d.replace('s', '')) - requested) < Math.abs(Number(best.replace('s', '')) - requested) ? d : best,
  ALLOWED_DURATIONS[0]);
}

async function runWan(
  model: string,
  input: Record<string, unknown>,
  durationSeconds: number,
): Promise<GeneratedVideoOutput> {
  const requestId = await submit(model, input);
  const result = await waitForResult(model, requestId);
  const url = videoUrl(result);
  if (!url) throw new FalError('The AI engine returned an empty result.', 500);
  return {
    videoBuffer: await download(url),
    mimeType: 'video/mp4',
    durationSeconds,
    model: 'wan-2.2',
  };
}

export async function falTextToVideo(input: VideoJobInput): Promise<GeneratedVideoOutput> {
  const seconds = duration(input.durationSeconds);
  const aspectRatio = VIDEO_ASPECT[input.aspectRatio ?? '16:9'] ?? '16:9';
  const model = TEXT_TO_VIDEO_MODELS[0];
  return runWan(
    model,
    {
      prompt: `${input.prompt}. Cinematic camera motion, premium colour grading, commercial look.`,
      duration: seconds,
      aspect_ratio: aspectRatio,
      resolution: '720p',
      negative_prompt: 'blurry, distorted, watermark, text artifacts',
    },
    Number(seconds.replace('s', '')),
  );
}

export async function falImageToVideo(
  input: Omit<VideoJobInput, 'prompt'> & { prompt?: string; imageBuffer: Buffer; mimeType?: string },
): Promise<GeneratedVideoOutput> {
  const seconds = duration(input.durationSeconds);
  const aspectRatio = VIDEO_ASPECT[input.aspectRatio ?? '16:9'] ?? '16:9';
  const model = IMAGE_TO_VIDEO_MODELS[0];
  return runWan(
    model,
    {
      prompt: input.prompt || 'Animate this image with smooth natural motion.',
      image_url: `data:${input.mimeType ?? 'image/png'};base64,${input.imageBuffer.toString('base64')}`,
      duration: seconds,
      aspect_ratio: aspectRatio,
      resolution: '720p',
      negative_prompt: 'blurry, distorted, watermark, text artifacts',
    },
    Number(seconds.replace('s', '')),
  );
}