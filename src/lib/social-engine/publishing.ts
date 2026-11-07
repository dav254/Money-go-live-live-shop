/**
 * SOCIAL ENGINE — neutral publish tests.
 *
 * Each platform publishes the SAME neutral test copy to its own destination:
 *   "Vidnov integration test — safe to ignore."
 * and reports the platform's OWN id when — and only when — the platform
 * confirmed the send. No marketing copy is ever sent, no audience is targeted,
 * nothing is promoted.
 *
 * ## Reuse policy (no duplicate publishing systems)
 *   • telegram / bluesky / mastodon / discord — the existing `publishSocial()`
 *     from `vidnov-core/growth-posts`. It already owns auth, media handling
 *     (Telegram sendPhoto), webhook validation (Discord), media budgets and
 *     the honesty contract. The engine only supplies the neutral copy and the
 *     tracked share URL it requires.
 *   • tumblr — OAuth 1.0a, which `publishSocial()` does not implement, so a
 *     thin adapter posts to the connected blog using the shared
 *     `oauth1AuthorizationHeader()`.
 *   • facebook / instagram — the same Meta Graph version (`META_GRAPH_API`)
 *     the rest of the repository speaks.
 *   • tiktok — a confirmed publish only when the account holds `video.publish`
 *     and a real video URL is supplied; otherwise a handoff, which is never
 *     recorded as a published post.
 *
 * ## Honesty contract
 * `ok: true` requires a real platform id. Anything else is `ok: false` with a
 * sanitized note. A handoff carries `handoffUrl` and is audited as
 * `share_handoff_initiated`, never as `post_confirmed_published`.
 */
import { sanitizeErrorMessage } from '@/lib/vidnov-core/distribution/job-utils';
import type { SocialChannel } from '@/lib/vidnov-core/growth-posts/types';
import { publishSocial, type SocialPublishInput } from '@/lib/vidnov-core/growth-posts/social';
import { MEDIA_CONFIG, ALLOWED_IMAGE_MIME, ALLOWED_VIDEO_MIME } from '@/lib/media/config';
import { oauth1AuthorizationHeader } from './oauth';
import { canonicalOrigin } from './url-track';
import { META_GRAPH_API } from './flows';
import { openConnectionTokens, type StoredTokens } from './connections';
import { PLATFORM_MEDIA_CAPS, validateForPlatform, capsForPlatform } from './media';
import type { ModuleId } from './types';

/**
 * A publish test runs only with explicit confirmation. The flag is asserted
 * both here and in the route (and checked by a source-level test), so no route
 * can forget it.
 */
export interface PublishTestContext {
  module: ModuleId;
  /** Owner of the connection being tested (the admin themselves, in the console). */
  ownerId: string;
  /** Caller of the test — tenant wall + audit actor. */
  caller: { uid: string; isAdmin: boolean };
  /** The shared env view (names only are ever inspected). */
  env: Record<string, string | undefined>;
  /** Fetch-like — tests inject a fake response, nothing else changes. */
  fetchLike?: (input: string, init?: RequestInit) => Promise<Response>;
  /** Explicit confirmation — without `true` the test refuses. */
  confirm?: boolean;
  /** Facebook: pin a specific managed Page (defaults to the first one). */
  pageId?: string;
  /** TikTok: a real, publicly reachable video URL for a direct publish test. */
  videoUrl?: string;
}

/**
 * The neutral test copy — a plain statement, never a promotion: no emoji, no
 * claims, no branding of the destination audience's content.
 */
export const NEUTRAL_TEST_COPY = 'Vidnov integration test — safe to ignore.';

/** The site's own icon — real bytes from the existing storage, no synthetic fixture. */
const TEST_IMAGE_PATH = '/icons/icon-512.png';

export interface PublishTestOutcome {
  /** True only when the platform returned a real id. */
  ok: boolean;
  /** Platform's own id (post id, media id, publish id). Present iff ok. */
  remoteId?: string;
  /** Sanitized, safe to display. */
  note: string;
  /** A Share-to-TikTok-style handoff — deliberately NOT a publish. */
  handoffUrl?: string;
  /** Which attribution event the outcome corresponds to (audit). */
  event?: 'post_confirmed_published' | 'share_handoff_initiated';
}

const TIMEOUT = 20_000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function fetcher(ctx: PublishTestContext): FetchLike {
  return ctx.fetchLike ?? ((url, init) => fetch(url, init));
}

function form(values: Record<string, string | undefined>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value != null) body.set(key, value);
  return body;
}

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** The token record for a module, or a static refusal note. */
async function tokensFor(
  module: ModuleId,
  ctx: PublishTestContext,
): Promise<{ tokens: StoredTokens } | { note: string }> {
  const opened = await openConnectionTokens(module, ctx.ownerId, ctx.caller);
  if ('tokens' in opened) return { tokens: opened.tokens };
  switch (opened.missing) {
    case 'no_key':
      return { note: 'SOCIAL_ENGINE_TOKEN_KEY is not set — stored tokens cannot be decrypted. Set the key on the server.' };
    case 'decrypt_failed':
      return { note: 'The stored connection could not be decrypted — reconnect the account.' };
    default:
      return { note: 'No account is connected yet — use Connect first.' };
  }
}

/**
 * Publish-level test for one module.
 *
 * Policy, enforced here rather than in the UI:
 *   • explicit confirmation is mandatory,
 *   • env-level modules need their server variables,
 *   • OAuth modules need a connected, still-connected account,
 *   • infrastructure modules have no publish test at all (their intended
 *     service is proven by a diagnostic).
 */
export async function publishTest(
  module: ModuleId,
  ctx: PublishTestContext,
): Promise<PublishTestOutcome> {
  if (ctx.confirm !== true) {
    return {
      ok: false,
      note: 'Not confirmed — an administrator must confirm before any publish test.',
    };
  }

  switch (module) {
    case 'telegram':
      return publishViaSharedEngine('telegram', ctx, 'Telegram');
    case 'bluesky':
      return publishViaSharedEngine('bluesky', ctx, 'Bluesky');
    case 'mastodon':
      return publishMastodonModule(ctx);
    case 'discord':
      return publishViaSharedEngine('discord', ctx, 'Discord');
    case 'tumblr':
      return publishTumblr(ctx);
    case 'facebook':
      return publishFacebook(ctx);
    case 'instagram':
      return publishInstagram(ctx);
    case 'tiktok':
      return publishTikTok(ctx);
    case 'media':
      return publishMedia(ctx);
    case 'google':
    case 'livekit':
    case 'pocketbase':
    case 'urls':
    case 'publishing':
      return {
        ok: false,
        note: 'No publish test for this module — its intended service is verified by a diagnostic (config, health or queue reachability).',
      };
    default:
      return { ok: false, note: `No publish test is implemented for "${module}".` };
  }
}

/* ── Env-channel adapters: the shared engine does the publishing ─────────── */

async function publishViaSharedEngine(
  channel: Extract<SocialChannel, 'telegram' | 'bluesky' | 'mastodon' | 'discord'>,
  ctx: PublishTestContext,
  label: string,
): Promise<PublishTestOutcome> {
  const input: SocialPublishInput = {
    channel,
    text: NEUTRAL_TEST_COPY,
    shareUrl: `${canonicalOrigin()}/`,
    productName: 'Vidnov',
    env: ctx.env,
    fetchLike: ctx.fetchLike,
  };
  const outcome = await publishSocial(input);
  if (outcome.ok && outcome.remoteId) {
    return {
      ok: true,
      remoteId: outcome.remoteId,
      note: `${label}: neutral test message published (${outcome.note}).`,
      event: 'post_confirmed_published',
    };
  }
  return {
    ok: false,
    note: `${label} test failed: ${sanitizeErrorMessage(outcome.note || 'no provider id returned')}`,
  };
}

/**
 * Mastodon publishes through the shared engine either way, but the credential
 * source differs:
 *   • the legacy server pair (`MASTODON_API_URL` + `MASTODON_ACCESS_TOKEN`)
 *     wins when both are set — that is the path growth-posts has always used;
 *   • otherwise the CONNECTED account's token is used, against the instance
 *     the app is configured for. Without this the module told an admin to
 *     connect an account and then refused to publish with it.
 */
/**
 * Mastodon publishing — ONE credential resolver, with the linked account first.
 *
 * ## The defect this replaces
 *
 * This adapter used to check the legacy server pair
 * (`MASTODON_API_URL` + `MASTODON_ACCESS_TOKEN`) BEFORE looking at the
 * connection, so a server with both configured tested (and published through)
 * the legacy token even when an administrator had connected a real account.
 * The result was a green publish test that proved nothing about the account the
 * dashboard showed as connected — and a broken connection could stay hidden
 * indefinitely.
 *
 * Order is now: a linked account always decides. The legacy pair is only a
 * fallback for a server with NO account linked (the state the growth-posts
 * adapter still documents). If an account IS linked but cannot be decrypted,
 * the test REFUSES instead of quietly posting with the other credential.
 */
async function publishMastodonModule(ctx: PublishTestContext): Promise<PublishTestOutcome> {
  // A store that cannot be READ is not the same as "no account linked". It is
  // tracked separately so the legacy fallback can say so in its note instead
  // of presenting itself as the connected account.
  let storeUnreadable = false;
  let opened: Awaited<ReturnType<typeof openConnectionTokens>> | { missing: 'store_unreadable' };
  try {
    opened = await openConnectionTokens('mastodon', ctx.ownerId, ctx.caller);
  } catch {
    opened = { missing: 'store_unreadable' };
    storeUnreadable = true;
  }

  if ('missing' in opened && opened.missing !== 'no_connection' && opened.missing !== 'store_unreadable') {
    return {
      ok: false,
      note:
        opened.missing === 'no_key'
          ? 'SOCIAL_ENGINE_TOKEN_KEY is not set — the connected Mastodon account cannot be read. Set the key on the server.'
          : 'The connected Mastodon account could not be decrypted — reconnect it.',
    };
  }

  if ('tokens' in opened) {
    const instance = ((ctx.env.MASTODON_INSTANCE_URL ?? '').trim() ||
      (typeof opened.tokens.meta?.instanceUrl === 'string' ? opened.tokens.meta.instanceUrl.trim() : ''))
      .replace(/\/+$/, '');
    if (!instance) {
      return { ok: false, note: 'The Mastodon instance was not recorded for this connection — set MASTODON_INSTANCE_URL and reconnect.' };
    }
    if (!opened.tokens.access_token) {
      return { ok: false, note: 'The connected Mastodon account has no access token — reconnect it.' };
    }
    return publishViaSharedEngine(
      'mastodon',
      {
        ...ctx,
        env: { ...ctx.env, MASTODON_API_URL: instance, MASTODON_ACCESS_TOKEN: opened.tokens.access_token },
      },
      'Mastodon',
    );
  }

  // No account linked (or the store could not be read): the legacy
  // server-level credential pair is the only remaining path, and the note says
  // so plainly if it is absent.
  const base = (ctx.env.MASTODON_API_URL ?? '').trim().replace(/\/+$/, '');
  const token = (ctx.env.MASTODON_ACCESS_TOKEN ?? '').trim();
  if (base && token) {
    const outcome = await publishViaSharedEngine('mastodon', ctx, 'Mastodon');
    if (storeUnreadable && outcome.ok) {
      return {
        ...outcome,
        note: `${outcome.note} (Published with the legacy server token — the connection store could not be read.)`,
      };
    }
    return outcome;
  }

  return {
    ok: false,
    note: 'No Mastodon account is connected, and the legacy MASTODON_API_URL / MASTODON_ACCESS_TOKEN pair is not set.',
  };
}

/* ── Tumblr: OAuth 1.0a text post to the connected blog ──────────────────── */

async function publishTumblr(ctx: PublishTestContext): Promise<PublishTestOutcome> {
  const opened = await tokensFor('tumblr', ctx);
  if ('note' in opened) return { ok: false, note: opened.note };
  const { tokens } = opened;

  const consumerKey = (ctx.env.TUMBLR_CONSUMER_KEY ?? '').trim();
  const consumerSecret = (ctx.env.TUMBLR_CONSUMER_SECRET ?? '').trim();
  const tokenSecret = tokens.extra?.oauth_token_secret;
  const blog = typeof tokens.meta?.blogHostname === 'string' ? tokens.meta.blogHostname : '';
  if (!consumerKey || !consumerSecret) {
    return { ok: false, note: 'TUMBLR_CONSUMER_KEY / TUMBLR_CONSUMER_SECRET are not set.' };
  }
  if (!tokenSecret) {
    return { ok: false, note: 'The Tumblr connection is incomplete (no token secret) — reconnect the account.' };
  }
  if (!blog) {
    return { ok: false, note: 'No Tumblr blog was recorded for this connection — reconnect to select the destination blog.' };
  }

  const endpoint = `https://api.tumblr.com/v2/blog/${encodeURIComponent(blog)}/post`;
  const bodyParams = {
    type: 'text',
    title: 'Vidnov integration test',
    body: NEUTRAL_TEST_COPY,
    state: 'published',
  };
  const header = oauth1AuthorizationHeader({
    method: 'POST',
    url: endpoint,
    consumerKey,
    consumerSecret,
    token: tokens.access_token,
    tokenSecret,
    params: bodyParams,
  });

  const res = await fetcher(ctx)(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: header },
    body: form(bodyParams),
    signal: AbortSignal.timeout(TIMEOUT),
  }).catch(() => null);
  if (!res) return { ok: false, note: 'Tumblr test failed: the request could not be completed.' };
  if (!res.ok) return { ok: false, note: `Tumblr test failed (HTTP ${res.status}).` };

  const data = await readJson(res);
  const response = (data?.response ?? {}) as { id?: unknown };
  const id = typeof response.id === 'string' ? response.id : typeof response.id === 'number' ? String(response.id) : '';
  if (!id) return { ok: false, note: 'Tumblr accepted the post but returned no id — not recorded as published.' };
  return {
    ok: true,
    remoteId: id,
    note: `Tumblr: neutral text post published to ${blog}.`,
    event: 'post_confirmed_published',
  };
}

/* ── Facebook Pages: publish a neutral post to a managed Page ────────────── */

interface ManagedPage {
  id?: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id?: string };
}

function storedPages(tokens: StoredTokens): ManagedPage[] {
  const pages = tokens.meta?.pages;
  return Array.isArray(pages) ? (pages as ManagedPage[]) : [];
}

async function publishFacebook(ctx: PublishTestContext): Promise<PublishTestOutcome> {
  const opened = await tokensFor('facebook', ctx);
  if ('note' in opened) return { ok: false, note: opened.note };
  const { tokens } = opened;

  const pages = storedPages(tokens);
  if (pages.length === 0) {
    return { ok: false, note: 'No Facebook Page is managed by this account — reconnect and select a Page.' };
  }
  const page = ctx.pageId ? pages.find((p) => p.id === ctx.pageId) : pages[0];
  if (!page?.id) {
    return { ok: false, note: 'The selected Facebook Page is not managed by this account.' };
  }

  // The Page access token is the only token that may post to a Page; the user
  // token is accepted by the Graph API as a fallback only when a Page token
  // was not returned at connect time.
  const accessToken = page.access_token || tokens.access_token;
  const res = await fetcher(ctx)(`${META_GRAPH_API}/${encodeURIComponent(page.id)}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({
      message: NEUTRAL_TEST_COPY,
      link: `${canonicalOrigin()}/`,
      access_token: accessToken,
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  }).catch(() => null);
  if (!res) return { ok: false, note: 'Facebook test failed: the request could not be completed.' };
  if (!res.ok) {
    return {
      ok: false,
      note: `Facebook test failed (HTTP ${res.status}) — check pages_manage_posts and the Page selection.`,
    };
  }

  const data = await readJson(res);
  if (data?.error) {
    const message = (data.error as { message?: unknown }).message;
    return {
      ok: false,
      note: `Facebook rejected the post: ${sanitizeErrorMessage(typeof message === 'string' ? message : 'unknown error')}`,
    };
  }
  const id = typeof data?.id === 'string' ? data.id : '';
  if (!id) return { ok: false, note: 'Facebook accepted the post but returned no id — not recorded as published.' };
  return {
    ok: true,
    remoteId: id,
    note: `Facebook: neutral post published to Page "${page.name ?? page.id}".`,
    event: 'post_confirmed_published',
  };
}

/* ── Instagram: Content Publishing through the Graph API ─────────────────── */

async function publishInstagram(ctx: PublishTestContext): Promise<PublishTestOutcome> {
  const opened = await tokensFor('instagram', ctx);
  if ('note' in opened) return { ok: false, note: opened.note };
  const { tokens } = opened;

  const igUserId =
    (typeof tokens.meta?.instagramUserId === 'string' ? tokens.meta.instagramUserId : undefined) ??
    storedPages(tokens).find((page) => page.instagram_business_account?.id)?.instagram_business_account?.id;
  if (!igUserId) {
    return { ok: false, note: 'No professional Instagram account is linked — connect one to a managed Facebook Page first.' };
  }

  // Instagram fetches the media itself, so the URL must be public. A localhost
  // origin can never work and is refused rather than reported as a failure of
  // the Instagram integration.
  const origin = canonicalOrigin();
  if (!origin.startsWith('https://')) {
    return {
      ok: false,
      note: 'Instagram requires a publicly reachable HTTPS image URL — the configured public origin is not HTTPS.',
    };
  }

  const imageUrl = `${origin}${TEST_IMAGE_PATH}`;
  const createRes = await fetcher(ctx)(`${META_GRAPH_API}/${encodeURIComponent(igUserId)}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ image_url: imageUrl, caption: NEUTRAL_TEST_COPY, access_token: tokens.access_token }),
    signal: AbortSignal.timeout(TIMEOUT),
  }).catch(() => null);
  if (!createRes) {
    return { ok: false, note: 'Instagram test failed: the media container request could not be completed.' };
  }
  if (!createRes.ok) {
    return {
      ok: false,
      note: `Instagram media creation failed (HTTP ${createRes.status}) — Instagram Content Publishing needs a JPEG/MP4 asset on a public URL plus instagram_content_publish.`,
    };
  }
  const created = await readJson(createRes);
  const creationId = typeof created?.id === 'string' ? created.id : '';
  if (!creationId) {
    return { ok: false, note: 'Instagram returned no media container id — not recorded as published.' };
  }

  const publishRes = await fetcher(ctx)(`${META_GRAPH_API}/${encodeURIComponent(igUserId)}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ creation_id: creationId, access_token: tokens.access_token }),
    signal: AbortSignal.timeout(TIMEOUT),
  }).catch(() => null);
  if (!publishRes) {
    return { ok: false, note: 'Instagram test failed: the publish request could not be completed.' };
  }
  if (!publishRes.ok) {
    return { ok: false, note: `Instagram media publish failed (HTTP ${publishRes.status}).` };
  }
  const published = await readJson(publishRes);
  const mediaId = typeof published?.id === 'string' ? published.id : '';
  if (!mediaId) return { ok: false, note: 'Instagram returned no media id — not recorded as published.' };
  return {
    ok: true,
    remoteId: mediaId,
    note: 'Instagram: neutral image published to the linked professional account.',
    event: 'post_confirmed_published',
  };
}

/* ── TikTok: confirmed publish, or an honest handoff ─────────────────────── */

/**
 * TikTok's Content Posting API confirms a video asynchronously: the init call
 * returns a publish id, and only the status endpoint says whether the video is
 * live. This test therefore polls briefly and reports `ok: true` ONLY on
 * `PUBLISH_COMPLETE`. An upload still processing is reported as pending — the
 * administrator re-runs the test (the engine's cooldown makes that cheap).
 *
 * Without `video.publish`, or without a real video URL, the outcome is a
 * Share-to-TikTok handoff: a link to TikTok's upload page, recorded as a
 * handoff and never as a published post.
 */
async function publishTikTok(ctx: PublishTestContext): Promise<PublishTestOutcome> {
  const handoff = (note: string): PublishTestOutcome => ({
    ok: false,
    note,
    handoffUrl: 'https://www.tiktok.com/upload',
    event: 'share_handoff_initiated',
  });

  const opened = await tokensFor('tiktok', ctx);
  if ('note' in opened) return handoff(opened.note);
  const { tokens } = opened;

  if (!tokens.scopes?.includes('video.publish')) {
    return handoff(
      'The connected TikTok account does not hold video.publish, so the API cannot publish. Use Share-to-TikTok: this handoff is not a published post.',
    );
  }

  const videoUrl = (ctx.videoUrl ?? '').trim();
  if (!videoUrl) {
    return handoff(
      'video.publish is granted, but a direct publish test needs a real video URL. No video was supplied, so nothing was uploaded.',
    );
  }
  if (!/^https:\/\//i.test(videoUrl)) {
    return { ok: false, note: 'The test video URL must be a public HTTPS URL.' };
  }

  const initRes = await fetcher(ctx)('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        title: NEUTRAL_TEST_COPY,
        // SELF_ONLY keeps the test visible to the account owner only.
        privacy_level: 'SELF_ONLY',
      },
      source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  }).catch(() => null);
  if (!initRes) return { ok: false, note: 'TikTok test failed: the upload request could not be completed.' };

  const initBody = await readJson(initRes);
  const initData = (initBody?.data ?? {}) as { publish_id?: unknown };
  const publishId = typeof initData.publish_id === 'string' ? initData.publish_id : '';
  if (!initRes.ok || !publishId) {
    const errorCode = (initBody?.error as { code?: unknown } | undefined)?.code;
    return {
      ok: false,
      note: `TikTok rejected the upload (HTTP ${initRes.status}${typeof errorCode === 'string' ? `, ${errorCode}` : ''}).`,
    };
  }

  // Poll for the real status (bounded: 4 attempts, 2s apart).
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 2_000));
    const statusRes = await fetcher(ctx)('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publish_id: publishId }),
      signal: AbortSignal.timeout(TIMEOUT),
    }).catch(() => null);
    if (!statusRes) continue;
    const statusBody = await readJson(statusRes);
    const status = (statusBody?.data as { status?: unknown } | undefined)?.status;
    if (status === 'PUBLISH_COMPLETE') {
      return {
        ok: true,
        remoteId: publishId,
        note: 'TikTok: neutral video uploaded privately (SELF_ONLY) and confirmed complete.',
        event: 'post_confirmed_published',
      };
    }
    if (status === 'FAILED') {
      return {
        ok: false,
        note: `TikTok reported FAILED for upload ${publishId} — nothing was published.`,
      };
    }
  }

  return {
    ok: false,
    note: `TikTok accepted the upload (publish id ${publishId}) but has not confirmed completion yet. Re-run the test in a minute — it is not recorded as published until TikTok reports PUBLISH_COMPLETE.`,
  };
}

/* ── Media preparation: validate a real asset against every platform cap ─── */

async function publishMedia(ctx: PublishTestContext): Promise<PublishTestOutcome> {
  const imageUrl = `${canonicalOrigin()}${TEST_IMAGE_PATH}`;
  const res = await fetcher(ctx)(imageUrl, { signal: AbortSignal.timeout(TIMEOUT) }).catch(() => null);
  if (!res || !res.ok) {
    return { ok: false, note: 'Could not fetch the site icon to validate media preparation.' };
  }
  const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim();
  const bytes = Number(res.headers.get('content-length') ?? 0) || (await res.arrayBuffer()).byteLength;
  if (!ALLOWED_IMAGE_MIME.has(mime)) {
    return { ok: false, note: `Vidnov's media pipeline does not accept ${mime || 'that content type'} for images.` };
  }
  if (bytes <= 0) return { ok: false, note: 'The test asset was empty.' };
  if (bytes > MEDIA_CONFIG.IMAGE_MAX_UPLOAD_MB * 1024 * 1024) {
    return { ok: false, note: 'The test asset exceeds Vidnov\'s own image upload cap.' };
  }

  // The intended service of this module is an HONEST report: which platforms
  // accept the asset as-is, and which need a pipeline conversion. A platform
  // that requires a different format is not a failure of media preparation.
  const needsConversion: string[] = [];
  const rejected: string[] = [];
  for (const caps of PLATFORM_MEDIA_CAPS) {
    if (caps.maxImages === 0 || caps.imageMime.length === 0) continue;
    const verdict = validateForPlatform(caps.id, { kind: 'image', mime, bytes });
    if (verdict.ok) continue;
    if (bytes > caps.maxImageBytes) rejected.push(`${caps.label} (size limit)`);
    else needsConversion.push(caps.label);
  }

  if (rejected.length > 0) {
    return {
      ok: false,
      note: `Media validation failed for ${rejected.join(', ')} — the asset cannot be prepared within those limits.`,
    };
  }

  return {
    ok: true,
    note:
      needsConversion.length === 0
        ? `Media preparation validated: ${PLATFORM_MEDIA_CAPS.length} platform profiles accept the test asset as-is (${bytes} bytes, ${mime}).`
        : `Media preparation validated (${bytes} bytes, ${mime}). The pipeline converts the asset for: ${needsConversion.join(', ')}.`,
  };
}

/* ── Shared media helpers (single definition lives in ./media) ───────────── */

export { validateForPlatform, capsForPlatform, PLATFORM_MEDIA_CAPS, MEDIA_CONFIG, ALLOWED_IMAGE_MIME, ALLOWED_VIDEO_MIME };
export type { PlatformMediaCaps } from './media';
