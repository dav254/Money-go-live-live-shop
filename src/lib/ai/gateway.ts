import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import {
  AI_JOB_COLLECTION,
  getAiSettings,
  type AiGenerationType,
  type AiProviderId,
} from './config';
import { getModel, type AiCapability } from './providers';
import { notifyAiEvent } from './notify';

/**
 * VIDNOV AI GATEWAY (spec §8–12).
 *
 * Every AI request from the UI passes through here. The gateway:
 *   1. validates + prices the request from admin settings,
 *   2. creates an aiJobs document (QUEUED) and charges points,
 *   3. dispatches to the active PROVIDER ADAPTER,
 *   4. stores output through the Vidnov media system,
 *   5. completes or fails the job (auto-refunding on failure).
 *
 * Providers are swappable adapters — the UI never knows which engine ran.
 */

/* ------------------------------------------------------------------ */
/* Provider adapter interface                                          */
/* ------------------------------------------------------------------ */

export interface GeneratedImageOutput {
  imageBuffer: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
  model: string;
}

export interface GeneratedVideoOutput {
  videoBuffer: Buffer;
  mimeType: string;
  durationSeconds?: number;
  model: string;
}

export interface ImageJobInput {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16';
  quality?: 'standard' | 'high';
  count?: number;
}

export interface ImageEditJobInput extends ImageJobInput {
  /** Source image for image→image (restyle / variation). */
  imageBuffer: Buffer;
  mimeType?: string;
}

export interface VideoJobInput {
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: '1:1' | '16:9' | '9:16';
  quality?: 'standard' | 'high';
}

export interface ImageToVideoJobInput {
  imageBuffer: Buffer;
  mimeType: string;
  prompt?: string;
  durationSeconds?: number;
  aspectRatio?: '1:1' | '16:9' | '9:16';
}

export type AnimationPreset =
  | 'camera-movement'
  | 'zoom'
  | 'pan'
  | 'motion'
  | 'product-showcase'
  | 'cinematic';

export interface AnimationJobInput extends ImageToVideoJobInput {
  preset: AnimationPreset;
}

export interface AiProvider {
  readonly id: AiProviderId;
  readonly label: string;
  generateImage?(input: ImageJobInput): Promise<GeneratedImageOutput>;
  editImage?(input: ImageEditJobInput): Promise<GeneratedImageOutput>;
  generateVideo?(input: VideoJobInput): Promise<GeneratedVideoOutput>;
  generateImageToVideo?(input: ImageToVideoJobInput): Promise<GeneratedVideoOutput>;
  animateImage?(input: AnimationJobInput): Promise<GeneratedVideoOutput>;
}

/* ------------------------------------------------------------------ */
/* Provider: Gemini (Veo for video, Imagen-class for images)           */
/* ------------------------------------------------------------------ */

const PRESET_PROMPTS: Record<AnimationPreset, string> = {
  'camera-movement': 'smooth cinematic camera movement around the subject',
  zoom: 'a slow, steady zoom into the subject',
  pan: 'a gentle horizontal pan across the scene',
  motion: 'subtle natural motion bringing the subject alive',
  'product-showcase': 'an elegant product showcase orbit with studio lighting',
  cinematic: 'dramatic cinematic movement with depth-of-field shifts',
};

const geminiProvider: AiProvider = {
  id: 'GEMINI_VEO',
  label: 'Gemini (Veo) — managed',

  async generateImage(input: ImageJobInput): Promise<GeneratedImageOutput> {
    const { imagenBuffer } = await import('./gemini-adapter');
    return imagenBuffer(input);
  },

  async editImage(input: ImageEditJobInput): Promise<GeneratedImageOutput> {
    const { editImageBuffer } = await import('./gemini-adapter');
    return editImageBuffer(input);
  },

  async generateVideo(input: VideoJobInput): Promise<GeneratedVideoOutput> {
    const { runVeoJob } = await import('./gemini-adapter');
    return runVeoJob(input.prompt, input);
  },

  async generateImageToVideo(input: ImageToVideoJobInput): Promise<GeneratedVideoOutput> {
    const { runVeoImageJob } = await import('./gemini-adapter');
    return runVeoImageJob(input.prompt ?? 'animate this image naturally', input.imageBuffer, input.mimeType);
  },

  async animateImage(input: AnimationJobInput): Promise<GeneratedVideoOutput> {
    const { runVeoImageJob } = await import('./gemini-adapter');
    const instruction = `${PRESET_PROMPTS[input.preset]}.${input.prompt ? ` ${input.prompt}` : ''}`;
    return runVeoImageJob(instruction, input.imageBuffer, input.mimeType);
  },
};

/* ------------------------------------------------------------------ */
/* Provider: fal.ai (FLUX images + Wan 2.2 video, serverless GPU)      */
/* ------------------------------------------------------------------ */

/**
 * fal.ai is the studio's default engine: Wan 2.2 for video and FLUX for
 * images, metered per generation, so no GPU server has to be bought or
 * patched. If FAL_KEY is missing the gateway falls back to Gemini.
 */
const falProvider: AiProvider = {
  id: 'FAL_AI',
  label: 'Wan 2.2 + FLUX (fal.ai)',

  async generateImage(input: ImageJobInput): Promise<GeneratedImageOutput> {
    const { falTextToImage } = await import('./fal-adapter');
    return falTextToImage(input);
  },

  async editImage(input: ImageEditJobInput): Promise<GeneratedImageOutput> {
    const { falImageToImage } = await import('./fal-adapter');
    return falImageToImage(input);
  },

  async generateVideo(input: VideoJobInput): Promise<GeneratedVideoOutput> {
    const { falTextToVideo } = await import('./fal-adapter');
    return falTextToVideo(input);
  },

  async generateImageToVideo(input: ImageToVideoJobInput): Promise<GeneratedVideoOutput> {
    const { falImageToVideo } = await import('./fal-adapter');
    return falImageToVideo({ ...input, mimeType: input.mimeType });
  },

  async animateImage(input: AnimationJobInput): Promise<GeneratedVideoOutput> {
    const { falImageToVideo } = await import('./fal-adapter');
    const instruction = `${PRESET_PROMPTS[input.preset]}. ${input.prompt ?? ''}`.trim();
    return falImageToVideo({
      prompt: instruction,
      imageBuffer: input.imageBuffer,
      mimeType: input.mimeType,
      durationSeconds: input.durationSeconds,
      aspectRatio: input.aspectRatio,
    });
  },
};

/* ------------------------------------------------------------------ */
/* Provider: self-hosted Wan 2.2 GPU worker (future-ready adapter)     */
/* ------------------------------------------------------------------ */

/**
 * SELF_HOSTED_WAN talks to a GPU worker over HTTP. Until
 * VIDNOV_WAN_WORKER_URL is configured the adapter reports unavailable and
 * the gateway falls back / fails gracefully — nothing else changes when the
 * worker comes online (spec §9, §39).
 */
const wanProvider: AiProvider = {
  id: 'SELF_HOSTED_WAN',
  label: 'Wan 2.2 — self-hosted GPU worker',

  async generateVideo(input: VideoJobInput): Promise<GeneratedVideoOutput> {
    const { wanVideo } = await import('./wan-adapter');
    return wanVideo(input);
  },
  async generateImageToVideo(input: ImageToVideoJobInput): Promise<GeneratedVideoOutput> {
    const { wanImageToVideo } = await import('./wan-adapter');
    return wanImageToVideo(input);
  },
  async animateImage(input: AnimationJobInput): Promise<GeneratedVideoOutput> {
    const { wanImageToVideo } = await import('./wan-adapter');
    return wanImageToVideo({ ...input, prompt: `${PRESET_PROMPTS[input.preset]}. ${input.prompt ?? ''}`.trim() });
  },
};

const REGISTRY: Record<AiProviderId, AiProvider> = {
  FAL_AI: falProvider,
  GEMINI_VEO: geminiProvider,
  SELF_HOSTED_WAN: wanProvider,
  EXTERNAL_VIDEO_API: wanProvider, // placeholder until an external adapter lands
  EXTERNAL_IMAGE_API: geminiProvider,
};

export function getProvider(id: AiProviderId): AiProvider {
  return REGISTRY[id] ?? (process.env.FAL_KEY ? falProvider : geminiProvider);
}

/* ------------------------------------------------------------------ */
/* Job lifecycle                                                       */
/* ------------------------------------------------------------------ */

export type AiJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface AiAttachment {
  target: 'product' | 'service' | 'request' | 'business' | 'message' | 'live';
  targetId: string;
  label: string;
  attachedAt: unknown;
}

export interface AiJobDoc {
  id: string;
  userId: string;
  businessId?: string | null;
  type: AiGenerationType;
  provider: AiProviderId;
  model?: string;
  engine?: string;
  prompt?: string;
  inputMediaId?: string | null;
  outputMediaId?: string | null;
  outputUrl?: string | null;
  thumbnailUrl?: string | null;
  status: AiJobStatus;
  progress: number;
  /** Milliseconds spent generating (set on completion / failure). */
  processingMs?: number | null;
  queuePosition?: number | null;
  saved?: boolean;
  attachments?: AiAttachment[];
  errorMessage?: string | null;
  creditsUsed: number;
  createdAt?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
}

export class AiGatewayError extends Error {
  constructor(
    message: string,
    public readonly code: 'INSUFFICIENT_POINTS' | 'DAILY_LIMIT' | 'PROVIDER_UNAVAILABLE' | 'VALIDATION' = 'VALIDATION',
  ) {
    super(message);
  }
}

export interface DispatchResult {
  jobId: string;
  /** Runs the generation to completion; resolves with the final job doc. */
  promise: Promise<AiJobDoc>;
}

/**
 * Creates a job, charges points, and starts generation in the background.
 * Points are refunded automatically when the configured policy says so.
 */
export async function dispatchAiJob(params: {
  userId: string;
  businessId?: string | null;
  type: AiGenerationType;
  prompt?: string;
  inputMediaId?: string | null;
  imageBuffer?: Buffer;
  imageMime?: string;
  animationPreset?: AnimationPreset;
  aspectRatio?: '1:1' | '16:9' | '9:16';
  quality?: 'standard' | 'high';
  durationSeconds?: number;
}): Promise<DispatchResult> {
  const settings = await getAiSettings();
  const entry = settings.pricing[params.type];
  const providerId = settings.activeProviders[params.type];
  const provider = getProvider(providerId);

  const capability = {
    'text-to-image': provider.generateImage,
    'image-to-image': provider.editImage,
    'text-to-video': provider.generateVideo,
    'image-to-video': provider.generateImageToVideo,
    'image-animation': provider.animateImage,
  }[params.type];
  if (!capability) {
    throw new AiGatewayError(
      `The active provider (${provider.label}) does not support ${params.type}.`,
      'PROVIDER_UNAVAILABLE',
    );
  }

  // Validation.
  if (['text-to-image', 'text-to-video'].includes(params.type) && !params.prompt?.trim()) {
    throw new AiGatewayError('A prompt is required.', 'VALIDATION');
  }
  if (['image-to-video', 'image-animation', 'image-to-image'].includes(params.type) && !params.imageBuffer) {
    throw new AiGatewayError('A source image is required.', 'VALIDATION');
  }
  if (params.type === 'image-to-image' && !params.prompt?.trim()) {
    throw new AiGatewayError('Describe the change you want.', 'VALIDATION');
  }
  const maxDuration = entry.maxDurationSeconds;
  if (maxDuration && (params.durationSeconds ?? 0) > maxDuration) {
    throw new AiGatewayError(`Duration is capped at ${maxDuration}s.`, 'VALIDATION');
  }

  // Daily limit check (best-effort; a failed count never blocks).
  if (entry.dailyLimit) {
    const since = new Date(Date.now() - 86_400_000);
    const recent = await db
      .collection(AI_JOB_COLLECTION)
      .where('userId', '==', params.userId)
      .where('type', '==', params.type)
      .get()
      .catch(() => null);
    if (recent) {
      let count = 0;
      recent.forEach((d) => {
        const data = d.data() as AiJobDoc;
        const at = (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? null;
        if (at && at >= since) count += 1;
      });
      if (count >= entry.dailyLimit) {
        throw new AiGatewayError(
          `Daily limit reached (${entry.dailyLimit} ${params.type} generations per day).`,
          'DAILY_LIMIT',
        );
      }
    }
  }

  // Charge points atomically; refuse when the balance is too low.
  const profileRef = db.collection('userProfiles').doc(params.userId);
  const charged = await db.runTransaction(async (tx) => {
    const snap = await tx.get(profileRef);
    const balance = Number((snap.data() as { aiPoints?: number } | undefined)?.aiPoints ?? 0);
    if (balance < entry.points) return false;
    tx.update(profileRef, { aiPoints: FieldValue.increment(-entry.points) });
    return true;
  }).catch(() => false);
  if (!charged) {
    throw new AiGatewayError(
      `Not enough points — this generation costs ${entry.points}. Top up in Wallet.`,
      'INSUFFICIENT_POINTS',
    );
  }

  // Create the job document.
  const jobRef = db.collection(AI_JOB_COLLECTION).doc();
  const now = FieldValue.serverTimestamp();
  await jobRef.set({
    id: jobRef.id,
    userId: params.userId,
    businessId: params.businessId ?? null,
    type: params.type,
    provider: providerId,
    engine: getModel(providerId).engine,
    prompt: params.prompt ?? null,
    inputMediaId: params.inputMediaId ?? null,
    outputMediaId: null,
    outputUrl: null,
    thumbnailUrl: null,
    status: 'QUEUED' as AiJobStatus,
    progress: 0,
    processingMs: null,
    saved: false,
    attachments: [],
    errorMessage: null,
    creditsUsed: entry.points,
    createdAt: now,
  });

  // "Your creation is being processed" through the existing notification system.
  void notifyAiEvent({ userId: params.userId, kind: 'started', type: params.type });

  const promise = runJob(jobRef.id, {
    provider,
    type: params.type,
    userId: params.userId,
    prompt: params.prompt,
    imageBuffer: params.imageBuffer,
    imageMime: params.imageMime,
    animationPreset: params.animationPreset,
    aspectRatio: params.aspectRatio,
    quality: params.quality,
    durationSeconds: params.durationSeconds,
    creditsUsed: entry.points,
    refundOnFailure: settings.refundOnFailure,
  });

  return { jobId: jobRef.id, promise };
}

/** Executes a job with status/progress tracking + failure refunds. */
async function runJob(
  jobId: string,
  ctx: {
    provider: AiProvider;
    type: AiGenerationType;
    userId: string;
    prompt?: string;
    imageBuffer?: Buffer;
    imageMime?: string;
    animationPreset?: AnimationPreset;
    aspectRatio?: '1:1' | '16:9' | '9:16';
    quality?: 'standard' | 'high';
    durationSeconds?: number;
    creditsUsed: number;
    refundOnFailure: boolean;
  },
): Promise<AiJobDoc> {
  const ref = db.collection(AI_JOB_COLLECTION).doc(jobId);
  const startedAt = FieldValue.serverTimestamp();
  const startedMs = Date.now();

  const setProgress = (progress: number) =>
    ref.update({ status: 'PROCESSING' as AiJobStatus, progress, startedAt }).catch(() => undefined);

  try {
    await setProgress(10);
    let output: GeneratedImageOutput | GeneratedVideoOutput;

    if (ctx.type === 'text-to-image') {
      output = await ctx.provider.generateImage!({
        prompt: ctx.prompt!,
        aspectRatio: ctx.aspectRatio,
        quality: ctx.quality,
      });
    } else if (ctx.type === 'image-to-image') {
      await setProgress(25);
      output = await ctx.provider.editImage!({
        prompt: ctx.prompt!,
        imageBuffer: ctx.imageBuffer!,
        mimeType: ctx.imageMime ?? 'image/png',
        aspectRatio: ctx.aspectRatio,
        quality: ctx.quality,
      });
    } else if (ctx.type === 'text-to-video') {
      await setProgress(30);
      output = await ctx.provider.generateVideo!({
        prompt: ctx.prompt!,
        durationSeconds: ctx.durationSeconds,
        aspectRatio: ctx.aspectRatio,
        quality: ctx.quality,
      });
    } else {
      await setProgress(30);
      const input = {
        imageBuffer: ctx.imageBuffer!,
        mimeType: ctx.imageMime ?? 'image/png',
        prompt: ctx.prompt,
        durationSeconds: ctx.durationSeconds,
        aspectRatio: ctx.aspectRatio,
      };
      output =
        ctx.type === 'image-animation'
          ? await ctx.provider.animateImage!({ ...input, preset: ctx.animationPreset ?? 'camera-movement' })
          : await ctx.provider.generateImageToVideo!(input);
    }
    await setProgress(70);

    // Persist through the Vidnov media system (thumbnails included).
    const { storeGeneratedVideo, storeGeneratedImage } = await import('@/lib/media/service');
    const stored =
      'videoBuffer' in output
        ? await storeGeneratedVideo(output.videoBuffer, ctx.userId)
        : await storeGeneratedImage(output.imageBuffer, ctx.userId);
    await setProgress(90);

    const completedAt = FieldValue.serverTimestamp();
    const processingMs = Date.now() - startedMs;
    await ref.update({
      status: 'COMPLETED' as AiJobStatus,
      progress: 100,
      outputMediaId: stored.mediaId,
      outputUrl: stored.url,
      thumbnailUrl: stored.thumbnailUrl ?? null,
      model: output.model,
      processingMs,
      completedAt,
    });

    // "Your AI creation is ready" — same notification system as everything else.
    void notifyAiEvent({ userId: ctx.userId, kind: 'completed', type: ctx.type });

    return {
      id: jobId,
      userId: ctx.userId,
      type: ctx.type,
      provider: ctx.provider.id,
      status: 'COMPLETED',
      progress: 100,
      creditsUsed: ctx.creditsUsed,
      outputMediaId: stored.mediaId,
      outputUrl: stored.url,
      thumbnailUrl: stored.thumbnailUrl ?? null,
      startedAt,
      completedAt,
    } as AiJobDoc;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed.';
    await ref
      .update({
        status: 'FAILED' as AiJobStatus,
        errorMessage: message,
        processingMs: Date.now() - startedMs,
        completedAt: FieldValue.serverTimestamp(),
      })
      .catch(() => undefined);

    void notifyAiEvent({ userId: ctx.userId, kind: 'failed', type: ctx.type });

    // Billing policy: refund on failure unless admin opted out (spec §36).
    if (ctx.refundOnFailure && ctx.creditsUsed > 0) {
      await db
        .collection('userProfiles')
        .doc(ctx.userId)
        .update({ aiPoints: FieldValue.increment(ctx.creditsUsed) })
        .catch(() => undefined);
    }

    throw error instanceof Error ? error : new Error(message);
  }
}

/** Cancels a queued job owned by the caller (running jobs run to completion). */
export async function cancelAiJob(jobId: string, userId: string): Promise<void> {
  const ref = db.collection(AI_JOB_COLLECTION).doc(jobId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Job not found.');
  const job = snap.data() as AiJobDoc;
  if (job.userId !== userId) throw new Error('Not your job.');
  if (job.status !== 'QUEUED') throw new Error('Only queued jobs can be cancelled.');
  await ref.update({ status: 'CANCELLED' as AiJobStatus, completedAt: FieldValue.serverTimestamp() });
  if (job.creditsUsed > 0) {
    await db.collection('userProfiles').doc(userId).update({ aiPoints: FieldValue.increment(job.creditsUsed) }).catch(() => undefined);
  }
}

/**
 * Marks a completed creation as saved (My Creations → Saved) or unsaved.
 */
export async function setAiJobSaved(jobId: string, userId: string, saved: boolean): Promise<void> {
  const ref = db.collection(AI_JOB_COLLECTION).doc(jobId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Job not found.');
  const job = snap.data() as AiJobDoc;
  if (job.userId !== userId) throw new Error('Not your job.');
  await ref.update({ saved });
}

/**
 * Attaches a completed creation to a marketplace destination
 * (product / service / request / business) — spec §11, §21.
 * Stored on the job so every destination can be traced back to the creation.
 */
export async function attachAiCreation(
  jobId: string,
  userId: string,
  attachment: Omit<AiAttachment, 'attachedAt'>,
): Promise<AiJobDoc> {
  const ref = db.collection(AI_JOB_COLLECTION).doc(jobId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Creation not found.');
  const job = snap.data() as AiJobDoc;
  if (job.userId !== userId) throw new Error('Not your job.');
  if (job.status !== 'COMPLETED' || !job.outputMediaId) {
    throw new Error('Only finished creations can be attached.');
  }

  const attachments = [...(job.attachments ?? [])];
  const index = attachments.findIndex((a) => a.target === attachment.target && a.targetId === attachment.targetId);
  const entry: AiAttachment = { ...attachment, attachedAt: new Date() };
  if (index >= 0) attachments[index] = entry;
  else attachments.push(entry);

  await ref.update({ attachments, saved: true });
  return { ...job, attachments, saved: true };
}
