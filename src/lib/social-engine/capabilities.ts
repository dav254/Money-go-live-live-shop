/**
 * SOCIAL ENGINE — feature capability identifiers (free vs AI Points).
 *
 * Pricing is configured LATER without rewriting integrations (task §9):
 * every feature the engine exposes is named here as a stable id. NO prices,
 * NO point costs, NO deduction logic exist in this file or anywhere in the
 * Social Engine — only identifiers and grouping.
 *
 * FREE capabilities are always available to a seller whose accounts are
 * connected and whose content is approved. AI POINT capabilities are the
 * candidates for future per-use pricing; their presence here is not a
 * charge, only a seam a pricing layer can attach to later.
 */

export const FREE_CAPABILITIES = [
  'account.connect',
  'content.upload',
  'caption.write.manual',
  'campaign.create.ordinary',
  'campaign.schedule.manual.approved',
  'publish.ordinary.approved',
  'history.view.basic',
  'analytics.view.basic',
] as const;

export const AI_POINT_CAPABILITIES = [
  'caption.ai',
  'campaign.ideas.ai',
  'poster.ai',
  'image.enhance.ai',
  'video.generate.ai',
  'voiceover.ai',
  'marketing.recommendations.ai',
  'performance.analysis.ai',
] as const;

export type FreeCapability = (typeof FREE_CAPABILITIES)[number];
export type AiPointCapability = (typeof AI_POINT_CAPABILITIES)[number];
export type CapabilityId = FreeCapability | AiPointCapability;

export function isFreeCapability(id: string): id is FreeCapability {
  return (FREE_CAPABILITIES as readonly string[]).includes(id);
}

export function isAiPointCapability(id: string): id is AiPointCapability {
  return (AI_POINT_CAPABILITIES as readonly string[]).includes(id);
}

/** Every known capability id (both groups). */
export function allCapabilities(): CapabilityId[] {
  return [...FREE_CAPABILITIES, ...AI_POINT_CAPABILITIES];
}

/**
 * Whether a capability id is known. A pricing layer must refuse unknown ids
 * rather than defaulting them to free or to a charge.
 */
export function isKnownCapability(id: string): boolean {
  return isFreeCapability(id) || isAiPointCapability(id);
}

/**
 * The capability ids each module actually exposes.
 *
 * Pure data used by the readiness dashboard so a card can list what the
 * integration makes possible. Identifiers only — never a price or a charge.
 */
export function moduleCapabilities(moduleId: string): {
  free: FreeCapability[];
  aiPoint: AiPointCapability[];
} {
  const publishFree: FreeCapability[] = [
    'account.connect',
    'content.upload',
    'caption.write.manual',
    'publish.ordinary.approved',
    'history.view.basic',
    'analytics.view.basic',
  ];
  const publishAi: AiPointCapability[] = ['caption.ai', 'campaign.ideas.ai'];

  switch (moduleId) {
    case 'telegram':
    case 'tiktok':
    case 'bluesky':
    case 'tumblr':
    case 'mastodon':
    case 'discord':
    case 'facebook':
    case 'instagram':
      return { free: publishFree, aiPoint: publishAi };
    case 'media':
      return {
        free: ['content.upload', 'history.view.basic'],
        aiPoint: ['poster.ai', 'image.enhance.ai', 'video.generate.ai'],
      };
    case 'urls':
      return {
        free: ['campaign.create.ordinary', 'history.view.basic', 'analytics.view.basic'],
        aiPoint: ['marketing.recommendations.ai', 'performance.analysis.ai'],
      };
    case 'publishing':
      return {
        free: [
          'campaign.create.ordinary',
          'campaign.schedule.manual.approved',
          'publish.ordinary.approved',
          'history.view.basic',
          'analytics.view.basic',
        ],
        aiPoint: ['marketing.recommendations.ai', 'performance.analysis.ai', 'voiceover.ai'],
      };
    default:
      // google / livekit / pocketbase — infrastructure with no publish surface.
      return { free: ['account.connect', 'history.view.basic'], aiPoint: [] };
  }
}
