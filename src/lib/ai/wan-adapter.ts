/**
 * Wan 2.2 self-hosted GPU worker adapter (spec §9).
 *
 * Talks to a remote GPU worker over plain HTTP. Configure
 * VIDNOV_WAN_WORKER_URL (and optionally a shared secret) and the gateway
 * routes video jobs to your own hardware — no frontend changes needed.
 */
import type { GeneratedVideoOutput, ImageToVideoJobInput, VideoJobInput } from './gateway';

function workerUrl(): string | null {
  return process.env.VIDNOV_WAN_WORKER_URL ?? null;
}

async function postJob(payload: Record<string, unknown>): Promise<{ buffer: Buffer; model: string }> {
  const base = workerUrl();
  if (!base) throw new Error('Self-hosted video worker is not configured yet.');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.VIDNOV_WAN_WORKER_TOKEN) {
    headers.Authorization = `Bearer ${process.env.VIDNOV_WAN_WORKER_TOKEN}`;
  }

  const res = await fetch(`${base.replace(/\/$/, '')}/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    // Long-running GPU jobs; the worker streams the finished MP4 back.
    signal: AbortSignal.timeout(15 * 60_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GPU worker error (${res.status}). ${text.slice(0, 140)}`);
  }
  const model = res.headers.get('x-model') ?? 'wan-2.2';
  return { buffer: Buffer.from(await res.arrayBuffer()), model };
}

export async function wanVideo(input: VideoJobInput): Promise<GeneratedVideoOutput> {
  const { buffer, model } = await postJob({
    task: 'text-to-video',
    model: 'wan-2.2',
    prompt: input.prompt,
    durationSeconds: input.durationSeconds ?? 5,
    aspectRatio: input.aspectRatio ?? '16:9',
    quality: input.quality ?? 'standard',
  });
  return { videoBuffer: buffer, mimeType: 'video/mp4', durationSeconds: input.durationSeconds ?? 5, model };
}

export async function wanImageToVideo(input: ImageToVideoJobInput): Promise<GeneratedVideoOutput> {
  const { buffer, model } = await postJob({
    task: 'image-to-video',
    model: 'wan-2.2',
    prompt: input.prompt ?? 'animate this image naturally',
    imageBase64: input.imageBuffer.toString('base64'),
    imageMime: input.mimeType,
    durationSeconds: input.durationSeconds ?? 5,
    aspectRatio: input.aspectRatio ?? '16:9',
  });
  return { videoBuffer: buffer, mimeType: 'video/mp4', durationSeconds: input.durationSeconds ?? 5, model };
}
