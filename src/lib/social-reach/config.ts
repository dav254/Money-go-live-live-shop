/**
 * SOCIAL REACH — server-side configuration: pricing and the approval gate.
 *
 * Costs live HERE, on the server. Client components may display these values
 * but never decide them: an edited browser bundle must not be able to set the
 * price of a post.
 *
 * ## Pricing (proposed, TikTok-first)
 *   • One successful TikTok post: 50 points (env `SOCIAL_REACH_POST_COST`).
 *   • The proposed 120-point "three-platform bundle" is deliberately NOT
 *     implemented — charging for three platforms while only TikTok works
 *     would sell something that does not exist.
 *   • No free-trial flag. A trial, if ever added, needs a server-side atomic
 *     claim per account — a client-only toggle is just an infinite free-post
 *     button.
 *
 * ## Approval gate (why publishing is OFF by default)
 * The TikTok app does not have verified Content Posting API approval as far
 * as this codebase can prove. Two independent server env flags must both be
 * 'true' before any request reaches TikTok:
 *   • `SOCIAL_REACH_PUBLISHING_ENABLED` — our feature switch.
 *   • `TIKTOK_DIRECT_POST_APPROVED`     — records that TikTok granted the
 *     app public direct-post approval with the `video.publish` scope.
 * Both default unset → publishing returns 503 with an explicit reason.
 */

export const SOCIAL_REACH_JOBS_COLLECTION = 'social_reach_jobs';

/** Proposed introductory price for one successful TikTok post. */
export const DEFAULT_POST_COST_POINTS = 50;

/** TikTok's caption limit. */
export const MAX_CAPTION_LENGTH = 2200;

/** Scopes the publish flow requires. */
export const REQUIRED_TIKTOK_SCOPES = ['video.publish'];

export function socialReachPostCost(): number {
  const raw = Number(process.env.SOCIAL_REACH_POST_COST);
  if (Number.isFinite(raw) && raw >= 0 && raw <= 100_000) return Math.floor(raw);
  return DEFAULT_POST_COST_POINTS;
}

function flag(name: string): boolean {
  return (process.env[name] ?? '').trim().toLowerCase() === 'true';
}

export interface PublishingGate {
  enabled: boolean;
  /** Safe, user-facing reason when disabled. Never contains secrets. */
  reason: string;
  /** Whether TikTok granted public direct-post approval (per our env). */
  approvalGranted: boolean;
}

/**
 * The single answer to "may this server submit a direct post to TikTok?".
 * Both flags required, plus the server-side client key to build the flow.
 */
export function publishingGate(): PublishingGate {
  const approvalGranted = flag('TIKTOK_DIRECT_POST_APPROVED');
  if (!flag('SOCIAL_REACH_PUBLISHING_ENABLED')) {
    return {
      enabled: false,
      approvalGranted,
      reason: 'Direct publishing is not enabled yet on Vidnov. You can connect your account now — posting opens after approval.',
    };
  }
  if (!approvalGranted) {
    return {
      enabled: false,
      approvalGranted,
      reason: 'TikTok has not granted public posting approval for the Vidnov app yet. Publishing stays disabled until it does.',
    };
  }
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
    return { enabled: false, approvalGranted, reason: 'TikTok API credentials are not configured on the server.' };
  }
  return { enabled: true, approvalGranted, reason: 'Publishing is enabled.' };
}