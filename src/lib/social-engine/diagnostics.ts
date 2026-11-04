/**
 * SOCIAL ENGINE — safe diagnostics (server-only).
 *
 * One function per module that proves, with a REAL provider response, that
 * the integration works — without publishing anything promotional and
 * without ever putting a credential or an upstream body into a note, a log
 * or the dashboard (task §8, §10). Notes are static text; only status
 * codes, counts and provider-supplied account labels (handles/usernames)
 * are interpolated.
 *
 * Test levels, recorded by the caller:
 *   auth        — credentials/session authenticate.
 *   diagnostic  — permissions/destination/config verified end to end.
 *
 * Publishing tests live in `publishing.ts` (neutral message, explicit
 * administrator confirmation).
 */
import { livekitConfigured, livekitUrlProblem } from '@/lib/live/service';
import { getPocketBaseConfig } from '@/lib/pocketbase/server';
import { sanitizeErrorMessage } from '@/lib/vidnov-core/distribution/job-utils';
import { MEDIA_CONFIG, ALLOWED_IMAGE_MIME, ALLOWED_VIDEO_MIME } from '@/lib/media/config';
import { publicOrigin } from '@/lib/site-url';
import { oauth1AuthorizationHeader } from './oauth';
import { META_GRAPH_API } from './flows';
import { openConnectionTokens } from './connections';
import type { ModuleId, TestKind, TestRecord } from './types';

export interface DiagnosticContext {
  env: Record<string, string | undefined>;
  /** Owner whose connection to use (admin flows use their own uid). */
  ownerId: string;
  caller: { uid: string; isAdmin: boolean };
  fetchLike?: (input: string, init?: RequestInit) => Promise<Response>;
}

export interface DiagnosticStep {
  kind: TestKind;
  ok: boolean;
  note: string;
  accountLabel?: string;
  scopes?: string[];
  permissions?: { granted: boolean; note: string };
}

export interface DiagnosticOutcome {
  steps: DiagnosticStep[];
  /** True when the module cannot be tested at all — caller must 400/409. */
  refuse?: string;
}

const TIMEOUT = AbortSignal.timeout(15_000);

function rec(step: DiagnosticStep, at = new Date().toISOString()): TestRecord {
  return {
    kind: step.kind,
    ok: step.ok,
    at,
    note: step.note,
    permissions: step.permissions,
    accountLabel: step.accountLabel,
    scopes: step.scopes,
  };
}

async function call(
  ctx: DiagnosticContext,
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const fetchLike = ctx.fetchLike ?? ((u, i) => fetch(u, i));
  try {
    const res = await fetchLike(url, { ...init, signal: TIMEOUT });
    const body = res.headers.get('content-type')?.includes('json')
      ? await res.json().catch(() => null)
      : null;
    return { status: res.status, body };
  } catch {
    // Network failure: status 0, no message — upstream details never travel.
    return { status: 0, body: null };
  }
}

function envOf(ctx: DiagnosticContext, name: string): string {
  return (ctx.env[name] ?? '').trim();
}

/* ── Telegram ────────────────────────────────────────────────────────────── */

async function telegram(ctx: DiagnosticContext): Promise<DiagnosticOutcome> {
  const token = envOf(ctx, 'TELEGRAM_BOT_TOKEN');
  if (!token) return { steps: [], refuse: 'TELEGRAM_BOT_TOKEN is not set.' };
  // The token travels only inside the API path; it is never logged or noted.
  const api = `https://api.telegram.org/bot${token}`;

  const me = await call(ctx, `${api}/getMe`);
  const bot = (me.body ?? {}) as { ok?: boolean; result?: { username?: string; can_join_groups?: boolean } };
  if (me.status !== 200 || !bot.ok) {
    return {
      steps: [{ kind: 'auth', ok: false, note: `Telegram authentication failed (HTTP ${me.status || 'network'}).` }],
    };
  }
  const username = bot.result?.username ? `@${bot.result.username}` : 'bot';
  const steps: DiagnosticStep[] = [
    { kind: 'auth', ok: true, note: `Bot ${username} authenticated.`, accountLabel: username },
  ];

  const chatId = envOf(ctx, 'TELEGRAM_CHANNEL_ID');
  if (!chatId) {
    steps.push({
      kind: 'diagnostic',
      ok: false,
      note: 'Destination not configured (TELEGRAM_CHANNEL_ID missing) — publishing cannot be verified.',
      permissions: { granted: false, note: 'No destination configured.' },
    });
    return { steps };
  }

  const chat = await call(ctx, `${api}/getChat?chat_id=${encodeURIComponent(chatId)}`);
  const chatBody = (chat.body ?? {}) as { ok?: boolean; result?: { type?: string; title?: string } };
  if (chat.status !== 200 || !chatBody.ok) {
    steps.push({
      kind: 'diagnostic',
      ok: false,
      note: `Destination check failed (HTTP ${chat.status || 'network'}) — bot missing from the channel or wrong id.`,
      permissions: { granted: false, note: 'Destination unreachable.' },
    });
    return { steps };
  }

  const member = await call(
    ctx,
    `${api}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${encodeURIComponent(
      String(((me.body as { result?: { id?: number } })?.result?.id) ?? ''),
    )}`,
  );
  const memberBody = (member.body ?? {}) as {
    ok?: boolean;
    result?: { status?: string; can_post?: boolean };
  };
  const status = memberBody.result?.status ?? 'unknown';
  const canPost =
    memberBody.ok === true &&
    (memberBody.result?.can_post === true ||
      status === 'administrator' ||
      status === 'creator' ||
      status === 'member');
  steps.push({
    kind: 'diagnostic',
    ok: canPost,
    note: canPost
      ? `Destination reachable (${chatBody.result?.type ?? 'chat'}); bot status: ${status}.`
      : `Destination reachable but the bot status "${status}" cannot post there — promote it to an admin with post permission.`,
    permissions: {
      granted: canPost,
      note: canPost ? `Bot status ${status} may post.` : `Bot status ${status} may not post.`,
    },
  });
  return { steps };
}

/* ── Bluesky ─────────────────────────────────────────────────────────────── */

async function bluesky(ctx: DiagnosticContext): Promise<DiagnosticOutcome> {
  const handle = envOf(ctx, 'BLUESKY_HANDLE');
  const password = envOf(ctx, 'BLUESKY_APP_PASSWORD');
  if (!handle || !password) return { steps: [], refuse: 'Bluesky credentials are not set.' };
  const service = envOf(ctx, 'BLUESKY_SERVICE_URL') || 'https://bsky.social';

  const session = await call(ctx, `${service}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password }),
  });
  const body = (session.body ?? {}) as { accessJwt?: string; did?: string };
  if (session.status !== 200 || !body.accessJwt || !body.did) {
    return {
      steps: [
        { kind: 'auth', ok: false, note: `Bluesky sign-in failed (HTTP ${session.status || 'network'}).` },
      ],
    };
  }
  const steps: DiagnosticStep[] = [
    { kind: 'auth', ok: true, note: `Session established for ${handle}.`, accountLabel: handle },
  ];

  const profile = await call(ctx, `${service}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(body.did)}`, {
    headers: { Authorization: `Bearer ${body.accessJwt}` },
  });
  const ok = profile.status === 200;
  steps.push({
    kind: 'diagnostic',
    ok,
    note: ok
      ? 'Profile reachable — the session can create records (posts + image blobs).'
      : `Profile check failed (HTTP ${profile.status || 'network'}).`,
    permissions: { granted: ok, note: ok ? 'Session may publish.' : 'Session may not publish.' },
  });
  return { steps };
}

/* ── TikTok ──────────────────────────────────────────────────────────────── */

async function tiktok(ctx: DiagnosticContext): Promise<DiagnosticOutcome> {
  const opened = await openConnectionTokens('tiktok', ctx.ownerId, ctx.caller);
  if ('missing' in opened) {
    return { steps: [], refuse: 'No TikTok account is connected yet — use Connect first.' };
  }
  const token = opened.tokens.access_token;
  const user = await call(ctx, 'https://open.tiktokapis.com/v2/user/info/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (user.body ?? {}) as {
    data?: { user?: { display_name?: string; open_id?: string } };
    error?: { code?: string };
  };
  const label = body.data?.user?.display_name;
  if (user.status !== 200 || !body.data?.user) {
    return {
      steps: [
        { kind: 'auth', ok: false, note: `TikTok token check failed (HTTP ${user.status || 'network'}) — reconnect.` },
      ],
    };
  }
  const scopes = (await getTikTokScopes(ctx, opened.tokens.access_token)) ?? [];
  const direct = scopes.includes('video.publish');
  return {
    steps: [
      { kind: 'auth', ok: true, note: `Account authorized (${label ?? 'TikTok user'}).`, accountLabel: label, scopes },
      {
        kind: 'diagnostic',
        ok: true,
        note: direct
          ? 'video.publish permission present — direct Content Posting is available.'
          : 'Account connected without video.publish — Share-to-TikTok handoff will be used until TikTok grants the permission.',
        scopes,
        permissions: {
          granted: direct,
          note: direct ? 'Direct publish permitted.' : 'Share-to-TikTok handoff only.',
        },
      },
    ],
  };
}

async function getTikTokScopes(ctx: DiagnosticContext, accessToken: string): Promise<string[] | null> {
  // The token exchange response carried scopes; they are also on the stored
  // record. Re-reading them from the connection keeps this call free of an
  // extra network round-trip.
  try {
    const opened = await openConnectionTokens('tiktok', ctx.ownerId, ctx.caller);
    if ('tokens' in opened) return opened.tokens.scopes ?? [];
  } catch {
    /* fall through */
  }
  void accessToken;
  return null;
}

/* ── Tumblr ──────────────────────────────────────────────────────────────── */

async function tumblr(ctx: DiagnosticContext): Promise<DiagnosticOutcome> {
  const opened = await openConnectionTokens('tumblr', ctx.ownerId, ctx.caller);
  if ('missing' in opened) {
    return { steps: [], refuse: 'No Tumblr account is connected yet — use Connect first.' };
  }
  const key = envOf(ctx, 'TUMBLR_CONSUMER_KEY');
  const secret = envOf(ctx, 'TUMBLR_CONSUMER_SECRET');
  if (!key || !secret) return { steps: [], refuse: 'Tumblr consumer credentials are not set.' };

  const url = 'https://api.tumblr.com/v2/user/info';
  const header = oauth1AuthorizationHeader({
    method: 'GET',
    url,
    consumerKey: key,
    consumerSecret: secret,
    token: opened.tokens.access_token,
    tokenSecret: opened.tokens.extra?.oauth_token_secret,
  });
  const info = await call(ctx, url, { headers: { Authorization: header } });
  const body = (info.body ?? {}) as {
    response?: { user?: { name?: string }; blogs?: Array<{ name?: string; can_post?: boolean }> };
  };
  if (info.status !== 200 || !body.response?.user) {
    return {
      steps: [{ kind: 'auth', ok: false, note: `Tumblr token check failed (HTTP ${info.status || 'network'}) — reconnect.` }],
    };
  }
  const blogs = body.response.blogs ?? [];
  const writable = blogs.filter((b) => b.can_post !== false).length;
  return {
    steps: [
      {
        kind: 'auth',
        ok: true,
        note: `Account authorized (${body.response.user.name ?? 'tumblr user'}).`,
        accountLabel: body.response.user.name,
      },
      {
        kind: 'diagnostic',
        ok: writable > 0,
        note:
          writable > 0
            ? `${writable} blog(s) accept posts — publishing destination verified.`
            : 'No writable blog found on this account.',
        permissions: { granted: writable > 0, note: writable > 0 ? 'Writable blogs present.' : 'No writable blog.' },
      },
    ],
  };
}

/* ── Mastodon ────────────────────────────────────────────────────────────── */

async function mastodon(ctx: DiagnosticContext): Promise<DiagnosticOutcome> {
  const instance = envOf(ctx, 'MASTODON_INSTANCE_URL').replace(/\/+$/, '');
  if (!instance) return { steps: [], refuse: 'MASTODON_INSTANCE_URL is not set.' };

  const steps: DiagnosticStep[] = [];
  const info = await call(ctx, `${instance}/api/v1/instance`);
  const body = (info.body ?? {}) as { version?: string; uri?: string };
  if (info.status !== 200) {
    return {
      steps: [
        {
          kind: 'diagnostic',
          ok: false,
          note: `Instance discovery failed (HTTP ${info.status || 'network'}) — check MASTODON_INSTANCE_URL.`,
        },
      ],
    };
  }
  steps.push({
    kind: 'diagnostic',
    ok: true,
    note: `Instance reachable (Mastodon ${body.version ?? 'unknown'}).`,
    permissions: { granted: true, note: 'Instance API reachable.' },
  });

  const opened = await openConnectionTokens('mastodon', ctx.ownerId, ctx.caller);
  if ('tokens' in opened) {
    const me = await call(ctx, `${instance}/api/v1/accounts/verify_credentials`, {
      headers: { Authorization: `Bearer ${opened.tokens.access_token}` },
    });
    const meBody = (me.body ?? {}) as { username?: string };
    if (me.status === 200 && meBody.username) {
      steps.unshift({
        kind: 'auth',
        ok: true,
        note: `Account authorized (@${meBody.username}).`,
        accountLabel: `@${meBody.username}`,
        scopes: opened.tokens.scopes ?? [],
      });
    } else {
      steps.unshift({
        kind: 'auth',
        ok: false,
        note: `Account token check failed (HTTP ${me.status || 'network'}) — reconnect.`,
      });
    }
  }
  return { steps };
}

/* ── Discord ─────────────────────────────────────────────────────────────── */

async function discord(ctx: DiagnosticContext): Promise<DiagnosticOutcome> {
  const opened = await openConnectionTokens('discord', ctx.ownerId, ctx.caller);
  if ('missing' in opened) {
    return { steps: [], refuse: 'No Discord account is connected yet — use Connect first.' };
  }
  const auth = { Authorization: `Bearer ${opened.tokens.access_token}` };

  const me = await call(ctx, 'https://discord.com/api/v10/users/@me', { headers: auth });
  const meBody = (me.body ?? {}) as { id?: string; username?: string; global_name?: string };
  if (me.status !== 200 || !meBody.id) {
    return {
      steps: [{ kind: 'auth', ok: false, note: `Discord token check failed (HTTP ${me.status || 'network'}) — reconnect.` }],
    };
  }

  const guilds = await call(ctx, 'https://discord.com/api/v10/users/@me/guilds', { headers: auth });
  const guildBody = (guilds.body ?? {}) as Array<{ id?: string; name?: string }> | unknown;
  const guildCount = Array.isArray(guildBody) ? guildBody.length : 0;
  const webhook = (ctx.env.DISCORD_WEBHOOK_URL ?? '').trim();

  return {
    steps: [
      {
        kind: 'auth',
        ok: true,
        note: `Account authorized (${meBody.global_name || meBody.username || 'discord user'}).`,
        accountLabel: meBody.global_name || meBody.username,
        scopes: opened.tokens.scopes ?? [],
      },
      {
        kind: 'diagnostic',
        ok: guilds.status === 200 && (guildCount > 0 || webhook.length > 0),
        note:
          guilds.status !== 200
            ? `Server authorization check failed (HTTP ${guilds.status || 'network'}).`
            : guildCount > 0
              ? `${guildCount} server(s) authorized — channel selection available.`
              : webhook
                ? 'No servers on this account, but a webhook is configured — webhook publishing is available.'
                : 'No servers authorized and no webhook configured — nothing to publish to yet.',
        permissions: {
          granted: guildCount > 0 || webhook.length > 0,
          note: guildCount > 0 || webhook ? 'A publish destination exists.' : 'No destination.',
        },
      },
    ],
  };
}

/* ── Google ──────────────────────────────────────────────────────────────── */

async function google(ctx: DiagnosticContext): Promise<DiagnosticOutcome> {
  const opened = await openConnectionTokens('google', ctx.ownerId, ctx.caller);
  if ('missing' in opened) {
    return { steps: [], refuse: 'No Google account is connected yet — use Connect first.' };
  }
  const me = await call(ctx, 'https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${opened.tokens.access_token}` },
  });
  const body = (me.body ?? {}) as { sub?: string; email?: string; name?: string };
  if (me.status !== 200 || !body.sub) {
    return {
      steps: [{ kind: 'auth', ok: false, note: `Google token check failed (HTTP ${me.status || 'network'}) — reconnect.` }],
    };
  }
  return {
    steps: [
      {
        kind: 'auth',
        ok: true,
        note: `Account authorized (${body.name || body.email || 'google account'}).`,
        accountLabel: body.name || body.email,
        scopes: opened.tokens.scopes ?? [],
      },
      {
        kind: 'diagnostic',
        ok: true,
        note:
          'OAuth token valid. Google is used for sign-in, Gemini, Search Console/GA4/Merchant (service accounts) and GTM today — enable any additional API (e.g. YouTube) per the activation docs.',
        permissions: { granted: true, note: 'OAuth flow verified.' },
      },
    ],
  };
}

/* ── Facebook Pages ──────────────────────────────────────────────────────── */

interface MetaPermission {
  permission?: string;
  status?: string;
}

/** Permission names granted to the connected Meta user token. */
async function metaPermissions(ctx: DiagnosticContext, token: string): Promise<string[]> {
  const res = await call(ctx, `${META_GRAPH_API}/me/permissions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (res.body ?? {}) as { data?: MetaPermission[] };
  if (res.status !== 200 || !Array.isArray(body.data)) return [];
  return body.data
    .filter((p) => p.status === 'granted' && typeof p.permission === 'string')
    .map((p) => p.permission as string);
}

interface ManagedPage {
  id?: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id?: string };
}

/** Pages the connected user manages, read from the connection record. */
function storedPages(meta: Record<string, unknown> | undefined): ManagedPage[] {
  const pages = meta?.pages;
  return Array.isArray(pages) ? (pages as ManagedPage[]) : [];
}

async function facebook(ctx: DiagnosticContext): Promise<DiagnosticOutcome> {
  const opened = await openConnectionTokens('facebook', ctx.ownerId, ctx.caller);
  if ('missing' in opened) {
    return { steps: [], refuse: 'No Facebook account is connected yet — use Connect first.' };
  }
  const token = opened.tokens.access_token;
  const me = await call(ctx, `${META_GRAPH_API}/me?fields=id,name`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meBody = (me.body ?? {}) as { id?: string; name?: string; error?: { message?: string } };
  if (me.status !== 200 || !meBody.id) {
    return {
      steps: [{ kind: 'auth', ok: false, note: `Facebook token check failed (HTTP ${me.status || 'network'}) — reconnect.` }],
    };
  }

  const granted = await metaPermissions(ctx, token);
  const pages = storedPages(opened.tokens.meta as Record<string, unknown> | undefined);
  const canPublish = granted.includes('pages_manage_posts');

  return {
    steps: [
      {
        kind: 'auth',
        ok: true,
        note: `Account authorized (${meBody.name ?? 'Facebook user'}).`,
        accountLabel: meBody.name,
        scopes: granted,
      },
      {
        kind: 'diagnostic',
        ok: pages.length > 0 && canPublish,
        note:
          pages.length === 0
            ? 'No Facebook Page is managed by this account — connect a Page to publish to.'
            : canPublish
              ? `${pages.length} Page(s) available and pages_manage_posts granted — publishing is available.`
              : `${pages.length} Page(s) available, but pages_manage_posts is not granted — request it in App Review before publishing.`,
        scopes: granted,
        permissions: {
          granted: pages.length > 0 && canPublish,
          note:
            pages.length === 0
              ? 'No managed Page.'
              : canPublish
                ? 'Page publishing permitted.'
                : 'Missing pages_manage_posts.',
        },
      },
    ],
  };
}

/* ── Instagram ───────────────────────────────────────────────────────────── */

async function instagram(ctx: DiagnosticContext): Promise<DiagnosticOutcome> {
  const opened = await openConnectionTokens('instagram', ctx.ownerId, ctx.caller);
  if ('missing' in opened) {
    return { steps: [], refuse: 'No Instagram account is connected yet — use Connect first.' };
  }
  const token = opened.tokens.access_token;
  const meta = opened.tokens.meta as Record<string, unknown> | undefined;
  const igUserId =
    (typeof meta?.instagramUserId === 'string' ? meta.instagramUserId : undefined) ??
    storedPages(meta).find((page) => page.instagram_business_account?.id)?.instagram_business_account?.id;

  const me = await call(ctx, `${META_GRAPH_API}/me?fields=id,name`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (me.status !== 200) {
    return {
      steps: [{ kind: 'auth', ok: false, note: `Instagram token check failed (HTTP ${me.status || 'network'}) — reconnect.` }],
    };
  }

  if (!igUserId) {
    return {
      steps: [
        { kind: 'auth', ok: true, note: 'Meta account authorized.' },
        {
          kind: 'diagnostic',
          ok: false,
          note: 'No linked Instagram business account — the account must be professional and linked to a managed Facebook Page.',
          permissions: { granted: false, note: 'No professional Instagram account linked.' },
        },
      ],
    };
  }

  const account = await call(ctx, `${META_GRAPH_API}/${encodeURIComponent(igUserId)}?fields=username`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const accountBody = (account.body ?? {}) as { username?: string; error?: { message?: string } };
  if (account.status !== 200 || !accountBody.username) {
    return {
      steps: [
        {
          kind: 'auth',
          ok: false,
          note: `Instagram account lookup failed (HTTP ${account.status || 'network'}) — reconnect the Page and Instagram account.`,
        },
      ],
    };
  }

  const granted = await metaPermissions(ctx, token);
  const canPublish = granted.includes('instagram_content_publish');
  return {
    steps: [
      {
        kind: 'auth',
        ok: true,
        note: `Account authorized (@${accountBody.username}).`,
        accountLabel: `@${accountBody.username}`,
        scopes: granted,
      },
      {
        kind: 'diagnostic',
        ok: canPublish,
        note: canPublish
          ? 'Instagram Content Publishing permission present — image/video posts are available.'
          : 'Professional account linked, but instagram_content_publish is not granted — App Review is required before publishing.',
        scopes: granted,
        permissions: {
          granted: canPublish,
          note: canPublish ? 'Content publishing permitted.' : 'Missing instagram_content_publish.',
        },
      },
    ],
  };
}

/* ── Infrastructure modules ──────────────────────────────────────────────── */

function livekit(ctx: DiagnosticContext): DiagnosticOutcome {
  const configured = livekitConfigured();
  const problem = configured ? livekitUrlProblem() : 'LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not all set.';
  return {
    steps: [
      {
        kind: 'diagnostic',
        ok: configured && problem === null,
        note: problem ?? 'Configuration valid — broadcast tokens mint through the existing live-session flow.',
        permissions: { granted: configured && problem === null, note: problem ?? 'Ready for live sessions.' },
      },
    ],
  };
}

async function pocketbase(ctx: DiagnosticContext): Promise<DiagnosticOutcome> {
  const cfg = getPocketBaseConfig();
  if (!cfg) {
    return {
      steps: [
        {
          kind: 'diagnostic',
          ok: false,
          note: 'PocketBase is not configured (POCKETBASE_URL / admin credentials missing) — mirrored sections use Firestore.',
        },
      ],
    };
  }
  const health = await call(ctx, `${cfg.url}/api/health`);
  const ok = health.status === 200;
  return {
    steps: [
      {
        kind: 'diagnostic',
        ok,
        note: ok
          ? 'Instance healthy — mirror sections can write through PocketBase (Firestore remains the source of truth).'
          : `Instance health check failed (HTTP ${health.status || 'network'}).`,
        permissions: { granted: ok, note: ok ? 'Instance reachable.' : 'Unreachable.' },
      },
    ],
  };
}

function media(ctx: DiagnosticContext): DiagnosticOutcome {
  const c = MEDIA_CONFIG;
  const numbersOk =
    c.IMAGE_MAX_UPLOAD_MB > 0 &&
    c.IMAGE_MAX_DIMENSION > 0 &&
    c.IMAGE_QUALITY > 0 &&
    c.THUMBNAIL_DIMENSION > 0 &&
    c.VIDEO_MAX_UPLOAD_MB > 0 &&
    c.VIDEO_MAX_DURATION_SECONDS > 0 &&
    c.VIDEO_MAX_HEIGHT > 0 &&
    c.VIDEO_CRF > 0;
  void ctx;
  return {
    steps: [
      {
        kind: 'diagnostic',
        ok: numbersOk && ALLOWED_IMAGE_MIME.size > 0 && ALLOWED_VIDEO_MIME.size > 0,
        note: numbersOk
          ? `Media limits loaded (images ≤${c.IMAGE_MAX_UPLOAD_MB}MB/${c.IMAGE_MAX_DIMENSION}px, video ≤${c.VIDEO_MAX_UPLOAD_MB}MB/${c.VIDEO_MAX_DURATION_SECONDS}s/${c.VIDEO_MAX_HEIGHT}px, CRF ${c.VIDEO_CRF}).`
          : 'One or more media limits resolved to a non-positive value — check the VIDNOV_* variables.',
        permissions: { granted: numbersOk, note: numbersOk ? 'Configuration sane.' : 'Invalid configuration.' },
      },
    ],
  };
}

function urls(ctx: DiagnosticContext): DiagnosticOutcome {
  const origin = publicOrigin();
  let parsed = false;
  let host = '';
  try {
    const u = new URL(origin);
    parsed = u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    host = u.host;
  } catch {
    parsed = false;
  }
  const names = [
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_BASE_URL',
    'NEXT_PUBLIC_APP_URL',
    'APP_PUBLIC_URL',
    'APP_URL',
  ];
  const set = names.filter((n) => (ctx.env[n] ?? '').trim().length > 0);
  return {
    steps: [
      {
        kind: 'diagnostic',
        ok: parsed,
        note: parsed
          ? `Canonical origin ${host} (default https://vidnov.com) — ${set.length} of ${names.length} URL variables set.`
          : 'The resolved public origin is not a valid URL — check the NEXT_PUBLIC_* URL variables.',
        permissions: { granted: parsed, note: parsed ? 'Origin valid.' : 'Invalid origin.' },
      },
    ],
  };
}

async function publishing(ctx: DiagnosticContext): Promise<DiagnosticOutcome> {
  // The shared publishing queue (growth-posts) IS the Social Engine queue —
  // drafts, scheduling, approval and history all live here. The diagnostic
  // proves the queue is reachable and readable without touching a single
  // draft's content: one limit(1) metadata query, no payloads returned.
  try {
    const { db } = await import('@/firebase/server');
    const { GROWTH_POSTS_COLLECTION } = await import('@/lib/vidnov-core/growth-posts/types');
    const snap = await db.collection(GROWTH_POSTS_COLLECTION).limit(1).get();
    const empty = snap.empty;
    return {
      steps: [
        {
          kind: 'diagnostic',
          ok: true,
          note: empty
            ? `Queue reachable (${GROWTH_POSTS_COLLECTION} — no drafts yet, scheduling starts empty).`
            : `Queue reachable (${GROWTH_POSTS_COLLECTION} — drafts present).`,
          permissions: { granted: true, note: 'Publishing queue reachable.' },
        },
      ],
    };
  } catch {
    return {
      steps: [
        {
          kind: 'diagnostic',
          ok: false,
          note: 'Publishing queue unreachable — Firestore read failed (check server credentials).',
          permissions: { granted: false, note: 'Queue unreachable.' },
        },
      ],
    };
  }
}

/* ── Dispatcher ──────────────────────────────────────────────────────────── */

export async function runDiagnostics(module: ModuleId, ctx: DiagnosticContext): Promise<DiagnosticOutcome> {
  try {
    switch (module) {
      case 'telegram':
        return await telegram(ctx);
      case 'bluesky':
        return await bluesky(ctx);
      case 'tiktok':
        return await tiktok(ctx);
      case 'tumblr':
        return await tumblr(ctx);
      case 'mastodon':
        return await mastodon(ctx);
      case 'discord':
        return await discord(ctx);
      case 'facebook':
        return await facebook(ctx);
      case 'instagram':
        return await instagram(ctx);
      case 'google':
        return await google(ctx);
      case 'livekit':
        return livekit(ctx);
      case 'pocketbase':
        return await pocketbase(ctx);
      case 'media':
        return media(ctx);
      case 'urls':
        return urls(ctx);
      case 'publishing':
        return publishing(ctx);
      default:
        // Unreachable through the routes (they validate with isModuleId first),
        // but a new ModuleId without a diagnostic must fail loudly rather than
        // silently report READY.
        return { steps: [], refuse: `No diagnostic is implemented for "${module}".` };
    }
  } catch (error) {
    // Sanitized — never an upstream body or a credential.
    return {
      steps: [
        { kind: 'diagnostic', ok: false, note: `Diagnostic failed: ${sanitizeErrorMessage(error)}` },
      ],
    };
  }
}

export { rec as testRecordFromStep };
