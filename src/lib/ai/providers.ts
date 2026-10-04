/**
 * VIDNOV AI PROVIDER LAYER (spec §17).
 *
 * The studio never talks to an engine directly. Every capability
 * (text→video, image→video, text→image, image→image) resolves to a model
 * descriptor here, so swapping Wan 2.1 for another GPU model — or Gemini
 * images for a self-hosted image model later — never touches the UI.
 *
 * The browser never sees worker URLs, tokens or model credentials; only the
 * backend imports this module.
 */
import type { AiProviderId } from './config';

/** The five creation capabilities offered by AI Studio. */
export type AiCapability =
  | 'text-to-image'
  | 'image-to-image'
  | 'text-to-video'
  | 'image-to-video'
  | 'image-animation';

export interface CapabilityDescriptor {
  /** Public route/label key, e.g. TEXT_TO_VIDEO_PROVIDER. */
  constant: string;
  id: AiCapability;
  label: string;
  blurb: string;
  inputType: 'TEXT' | 'IMAGE';
  outputType: 'IMAGE' | 'VIDEO';
  /** Capability key used in aiSettings.activeProviders. */
  settingsKey: AiCapability;
}

export const AI_CAPABILITIES: Record<AiCapability, CapabilityDescriptor> = {
  'text-to-video': {
    constant: 'TEXT_TO_VIDEO_PROVIDER',
    id: 'text-to-video',
    label: 'Text → Video',
    blurb: 'Describe a scene and Wan2.1 renders a cinematic clip for your listing or ad.',
    inputType: 'TEXT',
    outputType: 'VIDEO',
    settingsKey: 'text-to-video',
  },
  'image-to-video': {
    constant: 'IMAGE_TO_VIDEO_PROVIDER',
    id: 'image-to-video',
    label: 'Image → Video',
    blurb: 'Animate a still — product photos become slow commercial camera moves.',
    inputType: 'IMAGE',
    outputType: 'VIDEO',
    settingsKey: 'image-to-video',
  },
  'text-to-image': {
    constant: 'TEXT_TO_IMAGE_PROVIDER',
    id: 'text-to-image',
    label: 'Text → Image',
    blurb: 'Turn a description into a studio-grade image for ads, listings or social posts.',
    inputType: 'TEXT',
    outputType: 'IMAGE',
    settingsKey: 'text-to-image',
  },
  'image-to-image': {
    constant: 'IMAGE_TO_IMAGE_PROVIDER',
    id: 'image-to-image',
    label: 'Image → Image',
    blurb: 'Restyle an existing image — new backgrounds, variations and ad layouts.',
    inputType: 'IMAGE',
    outputType: 'IMAGE',
    settingsKey: 'image-to-image',
  },
  'image-animation': {
    constant: 'IMAGE_ANIMATION_PROVIDER',
    id: 'image-animation',
    label: 'Animate Image',
    blurb: 'Apply a motion preset to any image — the quickest route to a social clip.',
    inputType: 'IMAGE',
    outputType: 'VIDEO',
    settingsKey: 'image-animation',
  },
};

export const AI_CAPABILITY_LIST: CapabilityDescriptor[] = Object.values(AI_CAPABILITIES);

export interface AiModelDescriptor {
  /** Value stored in aiSettings.activeProviders. */
  providerId: AiProviderId;
  /** Human name shown in My Creations / History / Admin. */
  engine: string;
  label: string;
  kind: 'image' | 'video';
  location: 'self-hosted' | 'managed';
  /** Server-side availability check (env based) — never leaks the secret. */
  isAvailable: () => boolean;
  /** Config keys the operator must provide to switch this model on. */
  requiredEnv: string[];
}

/**
 * Model registry. A self-hosted image model (Flux / SDXL on the GPU worker)
 * can be registered here later without any UI change.
 */
export const AI_MODELS: Record<AiProviderId, AiModelDescriptor> = {
  FAL_AI: {
    providerId: 'FAL_AI',
    engine: 'WAN2.2 · FLUX',
    label: 'Wan 2.2 + FLUX (fal.ai) — serverless GPU',
    kind: 'video',
    location: 'managed',
    isAvailable: () => Boolean(process.env.FAL_KEY),
    requiredEnv: ['FAL_KEY'],
  },
  GEMINI_VEO: {
    providerId: 'GEMINI_VEO',
    engine: 'GEMINI',
    label: 'Gemini (Veo 3.1 / Gemini Image) — managed',
    kind: 'video',
    location: 'managed',
    isAvailable: () => Boolean(process.env.GEMINI_API_KEY),
    requiredEnv: ['GEMINI_API_KEY'],
  },
  SELF_HOSTED_WAN: {
    providerId: 'SELF_HOSTED_WAN',
    engine: 'WAN2.1',
    label: 'Wan 2.1 — self-hosted GPU worker',
    kind: 'video',
    location: 'self-hosted',
    isAvailable: () => Boolean(process.env.VIDNOV_WAN_WORKER_URL),
    requiredEnv: ['VIDNOV_WAN_WORKER_URL', 'VIDNOV_WAN_WORKER_TOKEN'],
  },
  EXTERNAL_VIDEO_API: {
    providerId: 'EXTERNAL_VIDEO_API',
    engine: 'EXTERNAL',
    label: 'External video API — reserved',
    kind: 'video',
    location: 'managed',
    isAvailable: () => false,
    requiredEnv: [],
  },
  EXTERNAL_IMAGE_API: {
    providerId: 'EXTERNAL_IMAGE_API',
    engine: 'EXTERNAL',
    label: 'External image API — reserved',
    kind: 'image',
    location: 'managed',
    isAvailable: () => false,
    requiredEnv: [],
  },
};

/** Resolves the model descriptor behind a settings provider id. */
export function getModel(providerId: AiProviderId): AiModelDescriptor {
  return AI_MODELS[providerId] ?? AI_MODELS.FAL_AI;
}

/** Model descriptor for a capability, given the provider chosen in settings. */
export function modelForCapability(
  capability: AiCapability,
  activeProviders: Partial<Record<AiCapability, AiProviderId>>,
): AiModelDescriptor {
  return getModel(activeProviders[capability] ?? 'FAL_AI');
}