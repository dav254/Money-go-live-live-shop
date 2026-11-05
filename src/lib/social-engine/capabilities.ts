/**
 * SOCIAL ENGINE — feature capability identifiers (manual-first).
 *
 * Every feature the engine exposes is named here as a stable id, so a future
 * pricing layer can attach to it without rewriting integrations. NO prices,
 * NO point costs, NO deduction logic exist in this file or anywhere in the
 * Social Engine — only identifiers and grouping.
 *
 * ## Why there are no AI capabilities any more
 * The marketing workflow is manual first: captions and hashtags are written by
 * an administrator, drafts are approved by a person, and nothing is generated
 * in the background. The AI identifiers that used to live here (`caption.ai`,
 * `campaign.ideas.ai`, …) were never implemented, so they were removed rather
 * than shown as available controls. Vidnov's unrelated AI tools keep their own
 * point balance and capability surface — this file never described them.
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

export type FreeCapability = (typeof FREE_CAPABILITIES)[number];
export type CapabilityId = FreeCapability;

export function isFreeCapability(id: string): id is FreeCapability {
  return (FREE_CAPABILITIES as readonly string[]).includes(id);
}

/** Every known capability id. */
export function allCapabilities(): CapabilityId[] {
  return [...FREE_CAPABILITIES];
}

/**
 * Whether a capability id is known. A pricing layer must refuse unknown ids
 * rather than defaulting them to free or to a charge.
 */
export function isKnownCapability(id: string): boolean {
  return isFreeCapability(id);
}

/**
 * The capability ids each module actually exposes.
 *
 * Pure data used by the readiness dashboard so a card can list what the
 * integration makes possible. Identifiers only — never a price or a charge.
 */
export function moduleCapabilities(moduleId: string): {
  free: FreeCapability[];
} {
  const publishFree: FreeCapability[] = [
    'account.connect',
    'content.upload',
    'caption.write.manual',
    'publish.ordinary.approved',
    'history.view.basic',
    'analytics.view.basic',
  ];

  switch (moduleId) {
    case 'telegram':
    case 'tiktok':
    case 'bluesky':
    case 'tumblr':
    case 'mastodon':
    case 'discord':
    case 'facebook':
    case 'instagram':
      return { free: publishFree };
    case 'media':
      return { free: ['content.upload', 'history.view.basic'] };
    case 'urls':
      return { free: ['campaign.create.ordinary', 'history.view.basic', 'analytics.view.basic'] };
    case 'publishing':
      return {
        free: [
          'campaign.create.ordinary',
          'campaign.schedule.manual.approved',
          'publish.ordinary.approved',
          'history.view.basic',
          'analytics.view.basic',
        ],
      };
    default:
      // google / livekit / pocketbase — infrastructure with no publish surface.
      return { free: ['account.connect', 'history.view.basic'] };
  }
}
