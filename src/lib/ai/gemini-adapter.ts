/**
 * Gemini provider adapter (the first ACTIVE provider).
 *
 * Talks to the Gemini API REST endpoints directly instead of going through
 * Genkit, because image and video generation live behind two different
 * endpoints:
 *   • images → `models/{model}:generateContent` (Gemini native image models,
 *     e.g. gemini-3.1-flash-image / gemini-2.5-flash-image),
 *   • video  → `models/{model}:predictLongRunning` (Veo 3.1).
 *
 * The Imagen `:predict` models this adapter used before (imagen-2.0 /
 * imagen-3.0-generate-*) are not available on the Gemini API and returned
 * 404 — they are gone from the model list entirely. Model ids below are the
 * ones the API actually advertises; the first that responds wins.
 *
 * Raw Buffers are returned so the gateway can hand off to the Vidnov media
 * pipeline.
 */
import type {
  GeneratedImageOutput,
  GeneratedVideoOutput,
  ImageEditJobInput,
  ImageJobInput,
  VideoJobInput,
} from './gateway';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';

/** Image models, cheapest first. All return inline base64 image data. */
const IMAGE_MODELS = [
  'gemini-3.1-flash-image',
  'gemini-2.5-flash-image',
  'gemini-3-pro-image',
];

/** Veo video models, fastest first. All use predictLongRunning. */
const VEO_MODELS = ['veo-3.1-fast-generate-preview', 'veo-3.1-generate-preview'];

/** Durations Veo accepts. */
const ALLOWED_DURATIONS = [4, 6, 8];

const ASPECT_HINT: Record<string, string> = {
  '1:1': 'square 1:1 composition',
  '16:9': 'wide 16:9 cinematic composition',
  '9:16': 'vertical 9:16 mobile-first composition',
};

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('AI is not configured yet. Please try again later.');
  return key;
}

/** Error carrying the HTTP status so callers can react to quota/limit codes. */
class AiApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'AiApiError';
  }
}

async function callApi<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_ROOT}/${path}`, { ...init, cache: 'no-store' });
  if (res.ok) return (await res.json()) as T;
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  throw new AiApiError(body?.error?.message || `The AI engine returned ${res.status}.`, res.status);
}

const QUOTA_MESSAGE =
  'Image generation is temporarily unavailable — the connected AI account has no image quota left. ' +
  'Enable billing in Google AI Studio (or switch to a paid API key) and image generation resumes automatically.';

const jsonPost = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function normalizeDuration(seconds: number | undefined): number {
  const requested = seconds ?? 8;
  return ALLOWED_DURATIONS.reduce((best, d) =>
    Math.abs(d - requested) < Math.abs(best - requested) ? d : best,
  ALLOWED_DURATIONS[0]);
}

/* ------------------------------------------------------------------ */
/* Images                                                             */
/* ------------------------------------------------------------------ */

interface GenerateContentResponse {
  candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
  promptFeedback?: { blockReason?: string };
}

export async function imagenBuffer(input: ImageJobInput): Promise<GeneratedImageOutput> {
  const key = apiKey();
  const prompt = `${input.prompt}. ${ASPECT_HINT[input.aspectRatio ?? '1:1']}. High quality, professional.`;

  let lastError: Error | null = null;
  let allQuotaBlocked = true;
  for (const model of IMAGE_MODELS) {
    try {
      const data = await callApi<GenerateContentResponse>(`models/${model}:generateContent?key=${key}`, {
        ...jsonPost({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: { aspectRatio: input.aspectRatio ?? '1:1' },
          },
        }),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      });

      const blockReason = data.promptFeedback?.blockReason;
      const inline = data.candidates?.[0]?.content?.parts?.find((p) => !!p.inlineData?.data)?.inlineData;
      if (!inline?.data) {
        throw new Error(
          blockReason
            ? `The prompt was blocked by the AI engine (${blockReason}).`
            : 'Image engine returned an empty result.',
        );
      }
      return {
        imageBuffer: Buffer.from(inline.data, 'base64'),
        mimeType: inline.mimeType ?? 'image/png',
        model,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!(err instanceof AiApiError) || err.status !== 429) allQuotaBlocked = false;
    }
  }
  if (allQuotaBlocked) throw new Error(QUOTA_MESSAGE);
  throw lastError ?? new Error('Image generation failed.');
}

/**
 * IMAGE → IMAGE (spec §5): restyle / re-compose an existing image.
 * The source image is sent inline alongside the instruction, so the result
 * keeps the subject while the background/style changes.
 */
export async function editImageBuffer(input: ImageEditJobInput): Promise<GeneratedImageOutput> {
  const key = apiKey();
  const aspectRatio = input.aspectRatio ?? '1:1';
  const instruction = `${input.prompt}. ${ASPECT_HINT[aspectRatio]}. Keep the subject recognisable, professional result.`;

  let lastError: Error | null = null;
  let allQuotaBlocked = true;
  for (const model of IMAGE_MODELS) {
    try {
      const data = await callApi<GenerateContentResponse>(`models/${model}:generateContent?key=${key}`, {
        ...jsonPost({
          contents: [
            {
              role: 'user',
              parts: [
                { text: instruction },
                {
                  inlineData: {
                    mimeType: input.mimeType ?? 'image/png',
                    data: input.imageBuffer.toString('base64'),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: { aspectRatio },
          },
        }),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      });

      const inline = data.candidates?.[0]?.content?.parts?.find((p) => !!p.inlineData?.data)?.inlineData;
      if (!inline?.data) {
        throw new Error(
          data.promptFeedback?.blockReason
            ? `The request was blocked by the AI engine (${data.promptFeedback.blockReason}).`
            : 'Image engine returned an empty result.',
        );
      }
      return {
        imageBuffer: Buffer.from(inline.data, 'base64'),
        mimeType: inline.mimeType ?? 'image/png',
        model,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!(err instanceof AiApiError) || err.status !== 429) allQuotaBlocked = false;
    }
  }
  if (allQuotaBlocked) throw new Error(QUOTA_MESSAGE);
  throw lastError ?? new Error('Image generation failed.');
}

/* ------------------------------------------------------------------ */
/* Video                                                              */
/* ------------------------------------------------------------------ */

interface PredictResponse {
  name?: string;
  error?: { message?: string };
}

interface OperationResponse {
  done?: boolean;
  error?: { message?: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: { video?: VeoSample }[];
    };
    raiMediaFiltered?: unknown;
  };
}

async function downloadVideo(uri: string, key: string): Promise<Buffer> {
  const url = uri.includes('key=') ? uri : `${uri}${uri.includes('?') ? '&' : '?'}key=${key}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Generated video could not be retrieved from the AI engine.');
  return Buffer.from(await res.arrayBuffer());
}

interface VeoSample {
  uri?: string;
  bytesBase64Encoded?: string;
  mimeType?: string;
}

/** Submits a Veo job and polls the operation until it finishes. */
async function waitForVeo(
  prompt: string,
  input: Partial<VideoJobInput> & { imageBuffer?: Buffer; imageMime?: string },
): Promise<{ sample: VeoSample; model: string }> {
  const key = apiKey();
  const durationSeconds = normalizeDuration(input.durationSeconds);

  let lastError: Error | null = null;
  for (const model of VEO_MODELS) {
    try {
      const instance: Record<string, unknown> = { prompt };
      if (input.imageBuffer) {
        instance.image = {
          bytesBase64Encoded: input.imageBuffer.toString('base64'),
          mimeType: input.imageMime ?? 'image/png',
        };
      }

      const submitted = await callApi<PredictResponse>(
        `models/${model}:predictLongRunning?key=${key}`,
        jsonPost({
          instances: [instance],
          parameters: { aspectRatio: input.aspectRatio ?? '16:9', durationSeconds },
        }),
      );
      if (!submitted.name) throw new Error(submitted.error?.message ?? 'The video engine returned no operation.');

      let operation: OperationResponse = { done: false };
      // Veo typically takes 1–3 minutes; poll for up to ~10 minutes.
      for (let attempt = 0; attempt < 120 && !operation.done; attempt += 1) {
        await new Promise((r) => setTimeout(r, 5000));
        operation = await callApi<OperationResponse>(`${submitted.name}?key=${key}`, { method: 'GET' });
      }
      if (!operation.done) throw new Error('The video engine timed out. Please try again.');
      if (operation.error) throw new Error(operation.error.message || 'The video engine reported an error.');

      const sample = operation.response?.generateVideoResponse?.generatedSamples?.[0]?.video;
      if (!sample) throw new Error('The AI engine returned an empty result.');
      return { sample, model };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('Video generation failed.');
}

async function veoToOutput(
  result: Awaited<ReturnType<typeof waitForVeo>>,
  duration: number,
): Promise<GeneratedVideoOutput> {
  const { sample, model } = result;
  const key = apiKey();
  const videoBuffer = sample.bytesBase64Encoded
    ? Buffer.from(sample.bytesBase64Encoded, 'base64')
    : sample.uri
      ? await downloadVideo(sample.uri, key)
      : null;
  if (!videoBuffer) throw new Error('The AI engine returned an empty result.');
  return { videoBuffer, mimeType: sample.mimeType ?? 'video/mp4', durationSeconds: duration, model };
}

export async function runVeoJob(prompt: string, input: VideoJobInput): Promise<GeneratedVideoOutput> {
  const styled = `[ADVERTISING MASTER SCENE]: ${prompt}. Cinematic camera motion, premium color grading.`;
  const result = await waitForVeo(styled, input);
  return veoToOutput(result, input.durationSeconds ?? 8);
}

export async function runVeoImageJob(
  prompt: string,
  imageBuffer: Buffer,
  imageMime?: string,
): Promise<GeneratedVideoOutput> {
  const result = await waitForVeo(prompt, { imageBuffer, imageMime, durationSeconds: 6 });
  return veoToOutput(result, 6);
}