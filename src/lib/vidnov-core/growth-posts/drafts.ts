/**
 * GROWTH POSTS — composition, publish gates (pure module).
 *
 * Everything in this file is deterministic and side-effect free so the whole
 * engine can be tested without a network, a database or credentials:
 *
 *   • `buildPostText` / `CHANNEL_TEXT_LIMITS` — shape admin-written copy to
 *     each channel's budget without ever dropping the tracked share link.
 *   • `growthProviderStatuses` / `publishGate` — derive capability from env
 *     presence ONLY. Values are never read, returned or logged.
 *
 * ## Manual first
 * There is NO model in this workflow: captions and hashtags are written by an
 * administrator, a draft is reviewed and approved by a person, and nothing is
 * generated or published in the background. The AI drafting pipeline (Gemini
 * prompt, response parsing, product scoring) was removed on purpose; see
 * `docs/social-engine-adapter.md`.
 *
 * ## Channels (Phase 2A)
 * Four FREE, approval-free networks are wired end to end — Bluesky,
 * Mastodon, Telegram and Discord (see `social.ts`). The large networks stay
 * `not_configured` until Phase 2B: X charges per post, WhatsApp Channels has
 * no official publish API, and Instagram/Facebook/Threads need a reviewed
 * Meta app. Claiming a post was published because text was copied would be
 * a lie the rest of the engine is built to prevent — `publishGate` and the
 * service only ever record `published` alongside the platform's own
 * message/record id.
 */

import { buildTrackedUrl } from '../attribution/tracking';
import {
  GROWTH_TRACKING_ID,
  SOCIAL_CHANNELS,
  isSocialChannel,
  type GrowthPublishChannel,
  type GrowthProviderStatus,
  type SocialChannel,
} from './types';

/* ── Candidate shape ────────────────────────────────────────────────────── */

/**
 * The product facts a composed post needs. Mapped from the real Firestore
 * document by the service; absent fields stay absent.
 */
export interface DraftCandidate {
  id: string;
  name: string;
  price: number;
  currency?: string;
  category?: string;
  condition?: 'new' | 'used';
  description?: string;
  deliveryOptions?: string;
  location?: string;
  imageUrl?: string;
  viewCount?: number;
  likes?: number;
  salesCount?: number;
  /** Epoch ms of the listing's newest known date, when it has one. */
  createdMs?: number | null;
}

/* ── Share link ─────────────────────────────────────────────────────────── */

/**
 * The tracked path for one listing — the SAME `ref=` format the share
 * buttons, referral codes and arrival capture already parse, so post clicks
 * land in the existing attribution pipeline with no new plumbing.
 */
export function sharePathFor(productId: string): string {
  return buildTrackedUrl(`/products/${encodeURIComponent(productId)}`, { ref: GROWTH_TRACKING_ID });
}

/* ── Post composition (pure) ─────────────────────────────────────────────── */

/**
 * Per-channel character budgets. Bluesky's real limit is 300 GRAPHEMES;
 * 297 characters is a safe approximation for latin hashtags. Telegram's
 * 1024 is the photo-caption cap (we always post with the product image when
 * one exists), Mastodon's 500 is the documented default, Discord's 2000 is
 * the message-content cap. Pinterest's pin description caps at 800 (500 is
 * a safe budget that also fits its title/link split) and Reddit's link-post
 * TITLE caps at 300 — the publisher sends the URL as the link field, so the
 * budget is spent on the headline, not the URL.
 */
export const CHANNEL_TEXT_LIMITS: Record<GrowthPublishChannel, number> = {
  copy: 4_000,
  email: 4_000,
  bluesky: 297,
  mastodon: 500,
  telegram: 1_024,
  discord: 2_000,
  pinterest: 500,
  reddit: 300,
};

/**
 * Composes the final text for one channel within its budget, in priority
 * order: the share URL is NEVER dropped (it is the attribution), hashtags
 * go first when trimming is needed, and only then is the caption cut — with
 * an ellipsis, never mid-URL. Deterministic and unit-tested.
 */
export function buildPostText(
  input: { caption: string; hashtags: string[]; shareUrl: string },
  maxChars: number,
): string {
  const caption = input.caption.trim();
  const url = input.shareUrl.trim();
  const tags = input.hashtags
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
    .join(' ');

  const full = [caption, tags, url].filter(Boolean).join('\n\n');
  if (full.length <= maxChars) return full;

  const withoutTags = [caption, url].filter(Boolean).join('\n\n');
  if (withoutTags.length <= maxChars) return withoutTags;

  // Keep the URL whole: reserve it, then fit as much caption as remains.
  const reserve = url.length + 2; // separator + newline
  const room = maxChars - reserve;
  if (room <= 1) return url.slice(0, maxChars); // degenerate budget — caller clamps
  const trimmed = caption.slice(0, room - 1).trimEnd();
  return `${trimmed}…\n\n${url}`;
}

/* ── Provider status & publish gates (env presence only) ────────────────── */

/**
 * Env var NAMES each social channel needs. All six are free to call; what
 * differs is the setup an admin must do once:
 *   • Bluesky/Mastodon/Telegram/Discord — create the credential, done.
 *   • Pinterest — a Pinterest BUSINESS account, an app (Trial → Standard
 *     access review), an OAuth access token and a board id. Pins created
 *     under Trial access are visible only to their creator.
 *   • Reddit — a "script" app + the brand's own subreddit; posts are only
 *     ever sent to `REDDIT_SUBREDDIT` (your own community), never scraped
 *     into other people's.
 */
export const SOCIAL_ENV_REQUIREMENTS: Record<SocialChannel, readonly string[]> = {
  bluesky: ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'],
  mastodon: ['MASTODON_API_URL', 'MASTODON_ACCESS_TOKEN'],
  telegram: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHANNEL_ID'],
  discord: ['DISCORD_WEBHOOK_URL'],
  pinterest: ['PINTEREST_ACCESS_TOKEN', 'PINTEREST_BOARD_ID'],
  reddit: [
    'REDDIT_CLIENT_ID',
    'REDDIT_CLIENT_SECRET',
    'REDDIT_USERNAME',
    'REDDIT_PASSWORD',
    'REDDIT_SUBREDDIT',
  ],
};

const SOCIAL_LABELS: Record<SocialChannel, string> = {
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  telegram: 'Telegram channel',
  discord: 'Discord channel',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
};

export function growthProviderStatuses(
  env: Record<string, string | undefined> = process.env,
): Record<'email' | 'social' | SocialChannel, GrowthProviderStatus> {
  const emailReady = Boolean(env.EMAIL_PROVIDER && env.EMAIL_API_KEY);
  const emailProd = env.EMAIL_MODE?.toLowerCase() === 'production';

  const socials = Object.fromEntries(
    SOCIAL_CHANNELS.map((id) => {
      const required = SOCIAL_ENV_REQUIREMENTS[id];
      const ready = required.every((name) => Boolean((env[name] ?? '').trim()));
      return [
        id,
        {
          id,
          label: SOCIAL_LABELS[id],
          status: ready ? 'configured' : 'not_configured',
          requiredEnvVars: [...required],
          note: ready
            ? `Credentials present (${required.join(', ')}). A post is only recorded as published when ${SOCIAL_LABELS[id]}'s API returns its own message id.`
            : `Missing: ${required.join(', ')} (names only) — this channel cannot send.`,
        } satisfies GrowthProviderStatus,
      ] as const;
    }),
  ) as Record<SocialChannel, GrowthProviderStatus>;

  return {
    email: {
      id: 'email',
      label: 'Email to seller (transactional provider)',
      status: emailReady ? 'configured' : 'not_configured',
      requiredEnvVars: ['EMAIL_PROVIDER', 'EMAIL_API_KEY', 'EMAIL_MODE'],
      note: !emailReady
        ? 'No email credentials — approved posts can only be copied manually.'
        : emailProd
          ? 'Credentials present and EMAIL_MODE=production. Delivery is recorded per message from the provider response.'
          : 'Credentials present but EMAIL_MODE is development: messages are captured to the dev mailbox and recorded as dev_captured — NOT delivered.',
    },
    // Kept for the legacy key the queue already renders: it aggregates the
    // four channels above so the page has one summary entry as well.
    social: {
      id: 'social',
      label: 'Social networks (auto-publish)',
      status: Object.values(socials).some((s) => s.status === 'configured') ? 'configured' : 'not_configured',
      requiredEnvVars: [],
      note: Object.values(socials).some((s) => s.status === 'configured')
        ? 'At least one free, approval-free channel is configured. Each publish is confirmed by the platform\'s own message id.'
        : 'No social API configured yet — posts can be approved and copied by hand. X, WhatsApp Channels, Facebook/Instagram and Threads are intentionally not wired here.',
    },
    ...socials,
  };
}

export interface PublishGate {
  allowed: boolean;
  reason: string;
}

/**
 * May this approved post be published on this channel right now?
 * `copy` always works (it is the admin's own clipboard); `email` needs
 * provider credentials AND a real recipient address.
 */
export function publishGate(
  channel: GrowthPublishChannel,
  options: {
    env: Record<string, string | undefined>;
    recipient?: string | null;
  },
): PublishGate {
  if (channel === 'copy') {
    return { allowed: true, reason: 'Copy is a manual action by the admin — nothing is claimed as published.' };
  }
  const env = options.env;

  if (isSocialChannel(channel)) {
    const required = SOCIAL_ENV_REQUIREMENTS[channel];
    const missing = required.filter((name) => !(env[name] ?? '').trim());
    if (missing.length > 0) {
      return { allowed: false, reason: `Missing: ${missing.join(', ')} (environment names only).` };
    }
    return {
      allowed: true,
      reason: 'Credentials present. Success is recorded only with the platform\'s own message id in the response.',
    };
  }

  if (!env.EMAIL_PROVIDER || !env.EMAIL_API_KEY) {
    return { allowed: false, reason: 'Email provider is not configured (EMAIL_PROVIDER / EMAIL_API_KEY).' };
  }
  const recipient = (options.recipient ?? '').trim();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { allowed: false, reason: 'No seller email address is available on this listing.' };
  }
  if (env.EMAIL_MODE?.toLowerCase() !== 'production') {
    return { allowed: true, reason: 'Development mode: the message is captured, not delivered (recorded as dev_captured).' };
  }
  return { allowed: true, reason: 'Provider configured and EMAIL_MODE=production.' };
}

