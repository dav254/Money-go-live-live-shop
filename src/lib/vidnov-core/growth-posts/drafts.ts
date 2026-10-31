/**
 * GROWTH POSTS — selection, prompt, parsing, publish gates (pure module).
 *
 * Everything in this file is deterministic and side-effect free so the whole
 * engine can be tested without a network, a database or credentials:
 *
 *   • `selectDraftTargets` — ranks REAL product metrics (views, likes,
 *     sales, recency) and honours a per-product cooldown, so the same
 *     listing is not drafted again and again.
 *   • `buildDraftPrompt`    — hands the model only facts that exist on the
 *     document, and instructs it not to invent prices, discounts, stock or
 *     delivery promises. The share link carries the existing `ref=` code so
 *     arrivals are attributed like every other Vidnov share.
 *   • `parseDraftResponse`  — accepts strict JSON, degrades to plain text +
 *     #hashtags, and refuses to save an empty caption (a failure is reported
 *     as a failure, never as a draft).
 *   • `growthProviderStatuses` / `publishGate` — derive capability from env
 *     presence ONLY. Values are never read, returned or logged.
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
  GROWTH_POST_LIMITS,
  GROWTH_TRACKING_ID,
  SOCIAL_CHANNELS,
  isSocialChannel,
  type GrowthPublishChannel,
  type GrowthProviderStatus,
  type SocialChannel,
} from './types';

/* ── Candidate shape ────────────────────────────────────────────────────── */

/**
 * The minimum a product must offer the drafter. Mapped from the real
 * Firestore document by the service; absent fields stay absent.
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

export interface DraftTargetResult {
  selected: DraftCandidate[];
  /** Why nothing else was picked — surfaced in the run report. */
  skipped: Array<{ id: string; reason: 'cooldown' | 'incomplete' }>;
}

function finite(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/** True when a candidate carries everything a post needs to be honest. */
export function isDraftable(candidate: DraftCandidate): boolean {
  if (!candidate.id || !candidate.name?.trim()) return false;
  if (!Number.isFinite(candidate.price) || candidate.price < 0) return false;
  return typeof candidate.imageUrl === 'string' && /^https?:\/\//.test(candidate.imageUrl);
}

/**
 * Performance score on real metrics only — never a fabricated popularity
 * number. Views carry least weight, sales most; a fresh listing gets a
 * recency bump so new sellers also get a turn.
 */
export function scoreCandidate(candidate: DraftCandidate, now: number): number {
  const views = finite(candidate.viewCount);
  const likes = finite(candidate.likes);
  const sales = finite(candidate.salesCount);
  let score = views * 1 + likes * 3 + sales * 10;
  if (candidate.createdMs && Number.isFinite(candidate.createdMs)) {
    const ageDays = Math.max(0, (now - candidate.createdMs) / 86_400_000);
    if (ageDays <= 14) score += 20;
    else if (ageDays <= 30) score += 10;
  }
  return score;
}

/**
 * Picks the products to draft for: best score wins, products drafted inside
 * the cooldown window are skipped, incomplete documents are skipped, and the
 * result is clamped to the caller's limit (which the service has already
 * clamped to `GROWTH_POST_LIMITS`).
 */
export function selectDraftTargets(
  candidates: DraftCandidate[],
  options: {
    limit: number;
    cooldownProductIds: ReadonlySet<string>;
    now: number;
  },
): DraftTargetResult {
  const skipped: DraftTargetResult['skipped'] = [];
  const eligible: DraftCandidate[] = [];

  for (const candidate of candidates) {
    if (!isDraftable(candidate)) {
      skipped.push({ id: candidate.id, reason: 'incomplete' });
      continue;
    }
    if (options.cooldownProductIds.has(candidate.id)) {
      skipped.push({ id: candidate.id, reason: 'cooldown' });
      continue;
    }
    eligible.push(candidate);
  }

  const selected = eligible
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, options.now) }))
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, Math.max(0, options.limit))
    .map((entry) => entry.candidate);

  return { selected, skipped };
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

/* ── Prompt ─────────────────────────────────────────────────────────────── */

/** Facts are handed over verbatim; empty facts are stated as empty. */
export function buildDraftPrompt(candidate: DraftCandidate, sharePath: string): string {
  const facts = [
    `Product: ${candidate.name}`,
    `Price: ${candidate.currency || 'USD'} ${candidate.price}`,
    candidate.category ? `Category: ${candidate.category}` : null,
    candidate.condition ? `Condition: ${candidate.condition}` : null,
    candidate.deliveryOptions ? `Delivery: ${candidate.deliveryOptions}` : null,
    candidate.location ? `Location: ${candidate.location}` : null,
    candidate.description ? `Description: ${candidate.description.slice(0, 400)}` : 'Description: (none supplied)',
  ]
    .filter(Boolean)
    .join('\n');

  return [
    'You are Vidnov\'s social copywriter for a video-first marketplace.',
    'Write ONE ready-to-post caption for the product below, suitable for Instagram, TikTok or X.',
    'Return STRICT JSON only: {"caption": "...", "hashtags": ["...", ...]}',
    'Rules:',
    '- Use ONLY the facts given. Never invent discounts, stock levels, ratings, delivery times or guarantees.',
    '- If a fact is missing, simply leave it out.',
    '- Caption: max 480 characters, max 3 emoji, natural marketplace voice, no quotation marks around it.',
    '- Hashtags: 3 to 6, lowercase, no spaces, no "#" in the JSON values, relevant to the category and location.',
    '- Do not repeat the whole caption inside the hashtags.',
    `Product link to include on platforms that support links (the admin may strip it): ${sharePath}`,
    '',
    'Facts:',
    facts,
  ].join('\n');
}

/* ── Response parsing ───────────────────────────────────────────────────── */

export interface ParsedDraft {
  caption: string;
  hashtags: string[];
}

const MAX_CAPTION = 600;

function cleanHashtags(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const tag = String(item ?? '')
      .trim()
      .replace(/^#+/, '')
      .replace(/\s+/g, '')
      .toLowerCase();
    if (!tag || tag.length > 30 || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= 8) break;
  }
  return out;
}

/** Pulls #tags out of free text — the fallback path's hashtag source. */
function hashtagsFromText(text: string): string[] {
  return cleanHashtags(text.match(/#[\p{L}\p{N}_]+/gu) ?? []);
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

/**
 * Parses a model response into a draft. Accepts strict JSON first, then
 * degrades to "the whole reply is the caption" with hashtags lifted from the
 * text. Throws on an empty caption — a failed generation must surface as a
 * failure, not as an empty post sitting in the queue.
 */
export function parseDraftResponse(raw: string): ParsedDraft {
  const text = stripFences(String(raw ?? ''));
  if (!text) throw new Error('empty_response');

  // Strict JSON (the happy path).
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    let parsed: { caption?: unknown; hashtags?: unknown } | null = null;
    try {
      parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { caption?: unknown; hashtags?: unknown };
    } catch {
      parsed = null; // not JSON after all — fall through to plain text
    }
    if (parsed) {
      const caption = typeof parsed.caption === 'string' ? parsed.caption.trim() : '';
      // Valid JSON with no usable caption is a FAILED generation — it must
      // never degrade into "the JSON is the caption".
      if (!caption) throw new Error('empty_response');
      const hashtags = Array.isArray(parsed.hashtags)
        ? cleanHashtags(parsed.hashtags.map((h) => String(h)))
        : hashtagsFromText(caption);
      return { caption: caption.slice(0, MAX_CAPTION), hashtags };
    }
  }

  // Plain text: use it as-is, lift hashtags out of it and take them OUT of
  // the caption (they are returned separately, so the admin never posts the
  // same tags twice).
  const hashtags = hashtagsFromText(text);
  const withoutTags = text
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const caption = withoutTags || text.replace(/\s+/g, ' ').trim();
  if (!caption) throw new Error('empty_response');
  return { caption: caption.slice(0, MAX_CAPTION), hashtags };
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
): Record<'ai' | 'email' | 'social' | SocialChannel, GrowthProviderStatus> {
  const aiReady = Boolean(env.GEMINI_API_KEY);
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
    ai: {
      id: 'ai',
      label: 'AI drafting (Gemini)',
      status: aiReady ? 'configured' : 'not_configured',
      requiredEnvVars: ['GEMINI_API_KEY'],
      note: aiReady
        ? 'Key present. Each run drafts at most the per-run cap; a failed call is reported as failed, never saved as a draft.'
        : 'GEMINI_API_KEY missing — the draft run refuses to start and spends nothing.',
    },
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

/** The daily draft budget shared by the cron run and manual "Run now". */
export function draftsRemainingToday(createdToday: number): number {
  return Math.max(0, GROWTH_POST_LIMITS.perDay - createdToday);
}
