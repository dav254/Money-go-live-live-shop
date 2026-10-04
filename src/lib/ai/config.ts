import { db } from '@/firebase/server';

/**
 * AI Studio configuration (spec §10, §12).
 *
 * Pricing, provider selection and limits live in Firestore (aiSettings/main)
 * so Admin can change them without a deploy. These constants are only the
 * safe defaults used before an admin saves anything. The frontend never
 * hard-codes prices — it reads them from /api/ai/pricing.
 */

export type AiGenerationType =
  | 'text-to-image'
  | 'image-to-image'
  | 'text-to-video'
  | 'image-to-video'
  | 'image-animation';

export const AI_JOB_COLLECTION = 'aiJobs';
export const AI_SETTINGS_DOC = 'aiSettings/main';

export type AiProviderId = 'FAL_AI' | 'SELF_HOSTED_WAN' | 'GEMINI_VEO' | 'EXTERNAL_VIDEO_API' | 'EXTERNAL_IMAGE_API';

export interface AiPricingEntry {
  /** Points charged per generation. */
  points: number;
  /** Optional daily cap per user (null = unlimited). */
  dailyLimit?: number | null;
  /** Max output duration for video types (seconds). */
  maxDurationSeconds?: number;
}

export interface AiSettings {
  activeProviders: Record<AiGenerationType, AiProviderId>;
  pricing: Record<AiGenerationType, AiPricingEntry>;
  /** Free trial allocation for brand-new creators. */
  freeTrialGenerations: number;
  /** Billing policy: refund points automatically when a job fails. */
  refundOnFailure: boolean;
  maxUploadMb: number;
  updatedAt?: unknown;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  activeProviders: {
    'text-to-image': 'FAL_AI',
    'image-to-image': 'FAL_AI',
    'text-to-video': 'FAL_AI',
    'image-to-video': 'FAL_AI',
    'image-animation': 'FAL_AI',
  },
  pricing: {
    'text-to-image': { points: 100, dailyLimit: 20 },
    'image-to-image': { points: 120, dailyLimit: 20 },
    'text-to-video': { points: 250, dailyLimit: 5, maxDurationSeconds: 8 },
    'image-to-video': { points: 250, dailyLimit: 5, maxDurationSeconds: 8 },
    'image-animation': { points: 150, dailyLimit: 10, maxDurationSeconds: 6 },
  },
  freeTrialGenerations: 3,
  refundOnFailure: true,
  maxUploadMb: 10,
};

/** Loads admin settings, merging over defaults so new keys never break reads. */
export async function getAiSettings(): Promise<AiSettings> {
  try {
    const snap = await db.doc(AI_SETTINGS_DOC).get();
    if (!snap.exists) return DEFAULT_AI_SETTINGS;
    const data = snap.data() as Partial<AiSettings>;
    return {
      ...DEFAULT_AI_SETTINGS,
      ...data,
      activeProviders: { ...DEFAULT_AI_SETTINGS.activeProviders, ...(data.activeProviders ?? {}) },
      pricing: { ...DEFAULT_AI_SETTINGS.pricing, ...(data.pricing ?? {}) },
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

/** Admin save helper (used by the admin API route). */
export async function saveAiSettings(update: Partial<AiSettings>): Promise<AiSettings> {
  const merged: AiSettings = {
    ...(await getAiSettings()),
    ...update,
    updatedAt: new Date(),
  };
  await db.doc(AI_SETTINGS_DOC).set(merged, { merge: true });
  return merged;
}
