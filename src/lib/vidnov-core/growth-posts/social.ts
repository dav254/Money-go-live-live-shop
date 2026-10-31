/**
 * GROWTH POSTS — Phase 2A social adapters (routes/cron only, NOT test-imported).
 *
 * The four channels that are genuinely FREE and need NO platform approval,
 * so a new marketplace can start distributing on day one:
 *
 *   • Bluesky   — AT Protocol: app-password session → `createRecord`.
 *                 Up to 4 images via `uploadBlob`; falls back to a link card
 *                 when the image cannot be fetched. (~1,666 posts/hour.)
 *   • Mastodon  — one instance URL + access token → `/api/v1/statuses`,
 *                 with optional media upload (`/api/v2/media`).
 *   • Telegram  — BotFather bot + channel id → `sendPhoto`/`sendMessage`.
 *                 The photo is passed BY URL, so nothing is downloaded.
 *   • Discord   — one webhook URL, no auth at all; embed with the product
 *                 image URL and a `wait=true` response carrying the message.
 *   • Pinterest — `POST /v5/pins` with `media_source.source_type=image_url`
 *                 (Pinterest fetches the image itself). Pins are IMAGE-ONLY:
 *                 no product image ⇒ honest refusal. Needs a business
 *                 account, an OAuth access token and a board id — and pins
 *                 created under Pinterest's TRIAL access are visible only to
 *                 their creator until the app passes Standard review.
 *   • Reddit    — script-app OAuth (password grant) at `/api/v1/access_token`
 *                 → `POST /api/submit` on oauth.reddit.com, always as a LINK
 *                 post to `REDDIT_SUBREDDIT` (the brand's own community).
 *                 A unique `User-Agent` is mandatory or Reddit answers 429.
 *                 Posting to other people's subreddits is a HUMAN decision
 *                 (self-promotion rules) and is never automated here.
 *
 * ## Honesty contract
 * `ok: true` is returned ONLY when the platform's own response carried a
 * message/record id (`remoteId`). Anything else — a timeout, a 4xx/5xx, a
 * 200 without an id — is `ok: false` with a STATIC, sanitized note: upstream
 * bodies and credentials never reach a record, a log or the admin UI. The
 * service writes `status: 'published'` in the same patch as the remoteId.
 *
 * ## Deliberately absent
 * X (charged per post), WhatsApp Channels (no official publish API),
 * Instagram/Facebook/Threads (Phase 2B — reviewed Meta app).
 */

import { sanitizeErrorMessage } from '../distribution/job-utils';
import type { SocialChannel } from './types';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface SocialPublishInput {
  channel: SocialChannel;
  /** Final text, already composed within the channel's character budget. */
  text: string;
  /** Absolute tracked URL — never trimmed, never dropped. */
  shareUrl: string;
  productName: string;
  imageUrl?: string;
  env: Record<string, string | undefined>;
  fetchLike?: FetchLike;
}

export interface SocialPublishOutcome {
  ok: boolean;
  /** The platform's OWN id — present iff ok. Stored on the post record. */
  remoteId?: string;
  /** Static, human-readable note. Never an upstream error body. */
  note: string;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const fail = (note: string): SocialPublishOutcome => ({ ok: false, note });
const succeed = (remoteId: string, note: string): SocialPublishOutcome => ({
  ok: true,
  remoteId,
  note,
});

/** Fetches a product image with hard bounds; null = publish without image. */
async function fetchImage(
  url: string | undefined,
  fetchLike: FetchLike,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string } | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetchLike(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > MAX_IMAGE_BYTES) return null;
    const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
    return { bytes, contentType };
  } catch {
    return null;
  }
}

/* ── Bluesky ────────────────────────────────────────────────────────────── */

async function publishBluesky(input: SocialPublishInput, fetchLike: FetchLike): Promise<SocialPublishOutcome> {
  const handle = (input.env.BLUESKY_HANDLE ?? '').trim();
  const appPassword = (input.env.BLUESKY_APP_PASSWORD ?? '').trim();
  const service = (input.env.BLUESKY_SERVICE_URL ?? 'https://bsky.social').trim().replace(/\/+$/, '');
  if (!handle || !appPassword) return fail('Bluesky credentials are missing.');

  const sessionRes = await fetchLike(`${service}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!sessionRes.ok) return fail(`Bluesky sign-in failed (${sessionRes.status}).`);
  const session = (await sessionRes.json().catch(() => null)) as
    | { accessJwt?: string; did?: string }
    | null;
  if (!session?.accessJwt || !session?.did) return fail('Bluesky sign-in returned no session.');

  const auth = { Authorization: `Bearer ${session.accessJwt}` };

  // Image first (better reach); a failed upload degrades to a link card —
  // never a failed post.
  let embed: unknown;
  const image = await fetchImage(input.imageUrl, fetchLike);
  if (image) {
    try {
      const upload = await fetchLike(`${service}/xrpc/com.atproto.repo.uploadBlob`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': image.contentType },
        body: image.bytes as unknown as BodyInit,
        signal: AbortSignal.timeout(20_000),
      });
      if (upload.ok) {
        const uploaded = (await upload.json().catch(() => null)) as { blob?: unknown } | null;
        if (uploaded?.blob) {
          embed = {
            $type: 'app.bsky.embed.images',
            images: [{ alt: input.productName.slice(0, 1000), image: uploaded.blob }],
          };
        }
      }
    } catch {
      /* image upload is best-effort */
    }
  }
  if (!embed) {
    embed = {
      $type: 'app.bsky.embed.external',
      external: {
        uri: input.shareUrl,
        title: input.productName.slice(0, 300),
        description: input.text.slice(0, 300),
      },
    };
  }

  const res = await fetchLike(`${service}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: input.text,
        createdAt: new Date().toISOString(),
        langs: ['en'],
        embed,
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return fail(`Bluesky rejected the post (${res.status}).`);
  const data = (await res.json().catch(() => null)) as { uri?: string } | null;
  if (!data?.uri) return fail('Bluesky returned no record id.');
  return succeed(data.uri, 'Published to Bluesky.');
}

/* ── Mastodon ───────────────────────────────────────────────────────────── */

async function publishMastodon(input: SocialPublishInput, fetchLike: FetchLike): Promise<SocialPublishOutcome> {
  const base = (input.env.MASTODON_API_URL ?? '').trim().replace(/\/+$/, '');
  const token = (input.env.MASTODON_ACCESS_TOKEN ?? '').trim();
  if (!base || !token) return fail('Mastodon credentials are missing.');
  const auth = { Authorization: `Bearer ${token}` };

  let mediaId: string | undefined;
  const image = await fetchImage(input.imageUrl, fetchLike);
  if (image) {
    try {
      const form = new FormData();
      form.append('file', new Blob([image.bytes], { type: image.contentType }), 'product.jpg');
      form.append('description', input.productName.slice(0, 1500));
      const upload = await fetchLike(`${base}/api/v2/media`, {
        method: 'POST',
        headers: auth,
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      if (upload.ok) {
        const media = (await upload.json().catch(() => null)) as { id?: string } | null;
        if (media?.id) mediaId = media.id;
      }
    } catch {
      /* media upload is best-effort — the text post still goes out */
    }
  }

  const res = await fetchLike(`${base}/api/v1/statuses`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: input.text,
      visibility: 'public',
      ...(mediaId ? { media_ids: [mediaId] } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return fail(`Mastodon rejected the post (${res.status}).`);
  const data = (await res.json().catch(() => null)) as { id?: string; url?: string } | null;
  if (!data?.id) return fail('Mastodon returned no status id.');
  return succeed(data.url || data.id, 'Published to Mastodon.');
}

/* ── Telegram ───────────────────────────────────────────────────────────── */

async function publishTelegram(input: SocialPublishInput, fetchLike: FetchLike): Promise<SocialPublishOutcome> {
  const token = (input.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  const chatId = (input.env.TELEGRAM_CHANNEL_ID ?? '').trim();
  if (!token || !chatId) return fail('Telegram credentials are missing.');
  // Basic-token in the path; never logged, never stored.
  const api = `https://api.telegram.org/bot${token}`;

  const extract = (data: { ok?: boolean; result?: { message_id?: number } }) =>
    data?.ok && typeof data?.result?.message_id === 'number'
      ? succeed(String(data.result.message_id), 'Published to Telegram.')
      : null;

  if (input.imageUrl && /^https?:\/\//i.test(input.imageUrl)) {
    try {
      const res = await fetchLike(`${api}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, photo: input.imageUrl, caption: input.text }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          result?: { message_id?: number };
        } | null;
        const outcome = data ? extract(data) : null;
        if (outcome) return outcome;
      }
    } catch {
      /* fall through to a text-only message */
    }
  }

  try {
    const res = await fetchLike(`${api}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: input.text }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return fail(`Telegram rejected the post (${res.status}).`);
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      result?: { message_id?: number };
    } | null;
    const outcome = data ? extract(data) : null;
    return outcome ?? fail('Telegram returned no message id.');
  } catch (error) {
    return fail(`Telegram send failed: ${sanitizeErrorMessage(error)}`);
  }
}

/* ── Discord ────────────────────────────────────────────────────────────── */

const DISCORD_WEBHOOK_PATTERN =
  /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+(?:\?.*)?$/;

async function publishDiscord(input: SocialPublishInput, fetchLike: FetchLike): Promise<SocialPublishOutcome> {
  const url = (input.env.DISCORD_WEBHOOK_URL ?? '').trim();
  if (!url) return fail('Discord webhook is missing.');
  if (!DISCORD_WEBHOOK_PATTERN.test(url)) return fail('Discord webhook URL is not a valid webhook address.');

  const sep = url.includes('?') ? '&' : '?';
  const res = await fetchLike(`${url}${sep}wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: input.text,
      embeds: [
        {
          title: input.productName.slice(0, 256) || 'Vidnov',
          url: input.shareUrl,
          ...(input.imageUrl ? { image: { url: input.imageUrl } } : {}),
          color: 0xff0033, // Vidnov coral-red
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return fail(`Discord rejected the post (${res.status}).`);
  const data = (await res.json().catch(() => null)) as { id?: string } | null;
  if (!data?.id) return fail('Discord returned no message id.');
  return succeed(data.id, 'Published to Discord.');
}

/* ── Pinterest ──────────────────────────────────────────────────────────── */

async function publishPinterest(input: SocialPublishInput, fetchLike: FetchLike): Promise<SocialPublishOutcome> {
  const token = (input.env.PINTEREST_ACCESS_TOKEN ?? '').trim();
  const boardId = (input.env.PINTEREST_BOARD_ID ?? '').trim();
  if (!token || !boardId) return fail('Pinterest credentials are missing.');
  if (!/^\d+$/.test(boardId)) return fail('Pinterest board id must be numeric.');
  // A pin cannot be text-only: without a public product image there is
  // nothing to pin, so we refuse instead of publishing a broken pin.
  if (!input.imageUrl || !/^https?:\/\//i.test(input.imageUrl)) {
    return fail('Pinterest needs a product image URL — this listing has none.');
  }

  const res = await fetchLike('https://api.pinterest.com/v5/pins', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'vidnov:growth-posts:v1.0',
    },
    body: JSON.stringify({
      board_id: boardId,
      title: input.productName.slice(0, 100),
      description: input.text.slice(0, 500),
      link: input.shareUrl.slice(0, 2048),
      alt_text: input.productName.slice(0, 500),
      media_source: { source_type: 'image_url', url: input.imageUrl },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return fail(`Pinterest rejected the pin (${res.status}).`);
  const data = (await res.json().catch(() => null)) as { id?: string } | null;
  if (!data?.id) return fail('Pinterest returned no pin id.');
  // The API response carries no permalink — it is derived from the id.
  return succeed(`https://www.pinterest.com/pin/${data.id}`, 'Published to Pinterest.');
}

/* ── Reddit ─────────────────────────────────────────────────────────────── */

async function publishReddit(input: SocialPublishInput, fetchLike: FetchLike): Promise<SocialPublishOutcome> {
  const clientId = (input.env.REDDIT_CLIENT_ID ?? '').trim();
  const clientSecret = (input.env.REDDIT_CLIENT_SECRET ?? '').trim();
  const username = (input.env.REDDIT_USERNAME ?? '').trim();
  const password = (input.env.REDDIT_PASSWORD ?? '').trim();
  const subreddit = (input.env.REDDIT_SUBREDDIT ?? '').trim().replace(/^r\//i, '');
  if (!clientId || !clientSecret || !username || !password || !subreddit) {
    return fail('Reddit credentials are missing.');
  }
  // Reddit refuses anonymous/undescriptive agents — a unique UA is required.
  const userAgent = `vidnov:growth-posts:v1.0 (by /u/${username})`;

  const tokenRes = await fetchLike('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
    body: new URLSearchParams({ grant_type: 'password', username, password }).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!tokenRes.ok) return fail(`Reddit sign-in failed (${tokenRes.status}).`);
  const session = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
  if (!session?.access_token) return fail('Reddit sign-in returned no session.');

  // The share URL travels in the link field, so the title keeps the copy:
  // drop a trailing standalone URL line, collapse whitespace, cap at 300.
  const withoutUrl = input.text
    .split('\n')
    .filter((line) => line.trim() !== input.shareUrl)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const title = (withoutUrl || input.productName).slice(0, 300);

  const res = await fetchLike('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
    body: new URLSearchParams({
      api_type: 'json',
      kind: 'link',
      sr: subreddit,
      title,
      url: input.shareUrl,
    }).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => null)) as
    | { json?: { errors?: unknown[][]; data?: { id?: string; name?: string; url?: string } } }
    | null;
  const errors = data?.json?.errors;
  // Reddit answers 200 with a populated errors[] — treat both as refusal,
  // and keep only the status: reasons (e.g. subreddit rules) stay upstream.
  if (!res.ok || (Array.isArray(errors) && errors.length > 0)) {
    return fail(`Reddit rejected the post (${res.status}).`);
  }
  const posted = data?.json?.data;
  const remoteId = posted?.name || posted?.id;
  if (!remoteId) return fail('Reddit returned no post id.');
  return succeed(remoteId, 'Published to Reddit.');
}

/* ── Dispatcher ─────────────────────────────────────────────────────────── */

export async function publishSocial(input: SocialPublishInput): Promise<SocialPublishOutcome> {
  const fetchLike: FetchLike = input.fetchLike ?? ((url, init) => fetch(url, init));
  try {
    switch (input.channel) {
      case 'bluesky':
        return await publishBluesky(input, fetchLike);
      case 'mastodon':
        return await publishMastodon(input, fetchLike);
      case 'telegram':
        return await publishTelegram(input, fetchLike);
      case 'discord':
        return await publishDiscord(input, fetchLike);
      case 'pinterest':
        return await publishPinterest(input, fetchLike);
      case 'reddit':
        return await publishReddit(input, fetchLike);
      default:
        return fail('Unknown social channel.');
    }
  } catch (error) {
    // Sanitized — an upstream body can never reach a record or a log.
    return fail(`Publish failed: ${sanitizeErrorMessage(error)}`);
  }
}
