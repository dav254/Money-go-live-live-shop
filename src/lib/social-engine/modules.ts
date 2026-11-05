/**
 * SOCIAL ENGINE — module registry.
 *
 * The single source of truth for what each integration is, which env var
 * NAMES it needs, what each variable is for, and how an administrator
 * activates it. Values are never read into any structure that reaches the
 * client: only presence booleans (computed in `readiness.ts`) travel.
 *
 * Naming rule (task §11): existing environment variable names are reused
 * wherever the codebase already defines one — Mastodon's legacy publish
 * pair (`MASTODON_API_URL` / `MASTODON_ACCESS_TOKEN`), Telegram's channel
 * destination (`TELEGRAM_CHANNEL_ID`), Discord's webhook publish path
 * (`DISCORD_WEBHOOK_URL`), TikTok's state secret (`TIKTOK_OAUTH_SECRET`).
 * The task-listed names are added where no existing name covers the need.
 *
 * One new name is introduced: `SOCIAL_ENGINE_TOKEN_KEY` — the encryption
 * key for stored OAuth tokens (task §10). No existing variable can serve as
 * an encryption key without coupling unrelated secrets, so it is documented
 * here as required-for-OAuth-storage and reported as missing config until
 * an administrator sets it.
 */
import type { ModuleId } from './types';

export interface EnvVarSpec {
  name: string;
  role: string;
  required: boolean;
}

export interface ModuleSpec {
  id: ModuleId;
  label: string;
  purpose: string;
  /**
   * How accounts connect: 'oauth' needs a connection record (and usually
   * SOCIAL_ENGINE_TOKEN_KEY to encrypt tokens); 'env' is a server-level
   * credential an admin supplies directly; 'builtin' is infrastructure the
   * engine only observes.
   */
  connectionKind: 'oauth' | 'env' | 'builtin';
  env: EnvVarSpec[];
  /** Existing alternate variables that also satisfy part of the module. */
  alternates?: EnvVarSpec[];
  /** Extra setup that is NOT an env var (documented, never guessed). */
  additionalSetup?: string[];
  approval?: { required: boolean; note: string };
  /** Which test kind proves the module's intended service (for READY). */
  readyBy: 'publish' | 'diagnostic' | 'none';
  /** Route that starts the connection flow (existing routes reused). */
  connectPath?: string;
  activation: string;
}

export const MODULE_SPECS: Record<ModuleId, ModuleSpec> = {
  telegram: {
    id: 'telegram',
    label: 'Telegram',
    purpose:
      'Publish text and photo posts to the Vidnov Telegram channel/channel group via the BotFather bot.',
    connectionKind: 'env',
    env: [
      { name: 'TELEGRAM_BOT_TOKEN', role: 'BotFather bot token (server-only)', required: true },
      { name: 'TELEGRAM_BOT_USERNAME', role: 'Bot username, shown in diagnostics', required: true },
      {
        name: 'TELEGRAM_CHANNEL_ID',
        role: 'Destination: @channelusername or numeric -100… id — required before publishing',
        required: true,
      },
    ],
    readyBy: 'publish',
    activation:
      'Create a bot with @BotFather → set TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME → add the bot to the target channel as an administrator with post permission → set TELEGRAM_CHANNEL_ID. Run Test, then a publish test (neutral message).',
  },

  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    purpose:
      'Authorize a seller TikTok account (OAuth) and publish videos through the Content Posting API where permission allows; otherwise hand off to Share-to-TikTok.',
    connectionKind: 'oauth',
    env: [
      { name: 'TIKTOK_CLIENT_KEY', role: 'TikTok developer app key', required: true },
      { name: 'TIKTOK_CLIENT_SECRET', role: 'TikTok developer app secret', required: true },
      {
        name: 'TIKTOK_OAUTH_SECRET',
        role: 'HMAC secret for OAuth state (falls back to TIKTOK_CLIENT_SECRET)',
        required: false,
      },
      {
        name: 'SOCIAL_ENGINE_TOKEN_KEY',
        role: 'Key that encrypts stored OAuth tokens (32+ random chars, server-only)',
        required: true,
      },
    ],
    approval: {
      required: true,
      note:
        'Direct publishing via the Content Posting API requires TikTok to grant the video.publish permission on the app (developer review). Until then the engine uses Share-to-TikTok — a handoff, never recorded as a published post.',
    },
    readyBy: 'publish',
    additionalSetup: [
      'A publish test needs a real video asset: supply a test-video URL when running it. Without video.publish the test refuses — a Share-to-TikTok handoff is recorded separately and never counts as published.',
    ],
    // The existing hardened flow: HMAC state, HttpOnly binding cookie,
    // server-only token store. Reused, never duplicated.
    connectPath: '/api/tiktok/connect',
    activation:
      'Register the app in the TikTok developer portal with redirect URI /api/tiktok/callback → set TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET → Connect (existing Social Reach flow) → confirm video.publish permission for direct posting, or use Share-to-TikTok handoff.',
  },

  bluesky: {
    id: 'bluesky',
    label: 'Bluesky',
    purpose:
      'Publish text/link posts with up to four images over the AT Protocol using an app-password session.',
    connectionKind: 'env',
    env: [
      { name: 'BLUESKY_HANDLE', role: 'Bluesky handle (identifier)', required: true },
      { name: 'BLUESKY_APP_PASSWORD', role: 'App password (not the account password)', required: true },
      { name: 'BLUESKY_SERVICE_URL', role: 'PDS URL, defaults to https://bsky.social', required: false },
    ],
    readyBy: 'publish',
    activation:
      'Bluesky settings → App passwords → create one → set BLUESKY_HANDLE and BLUESKY_APP_PASSWORD. Run Test (session), then a publish test.',
  },

  tumblr: {
    id: 'tumblr',
    label: 'Tumblr',
    purpose:
      'Connect a Tumblr account (OAuth 1.0a) and publish text/photo posts to the account’s blog.',
    connectionKind: 'oauth',
    env: [
      { name: 'TUMBLR_CONSUMER_KEY', role: 'Tumblr app OAuth consumer key', required: true },
      { name: 'TUMBLR_CONSUMER_SECRET', role: 'Tumblr app OAuth consumer secret', required: true },
      {
        name: 'TUMBLR_CALLBACK_URL',
        role: 'Registered callback — must equal {origin}/api/social-engine/callback/tumblr',
        required: true,
      },
      {
        name: 'SOCIAL_ENGINE_TOKEN_KEY',
        role: 'Key that encrypts stored OAuth tokens (32+ random chars, server-only)',
        required: true,
      },
    ],
    approval: { required: false, note: '' },
    readyBy: 'publish',
    activation:
      'Register an app at tumblr.com/oauth/apps → callback exactly {origin}/api/social-engine/callback/tumblr → set the three variables → Connect → Run test → publish test.',
  },

  mastodon: {
    id: 'mastodon',
    label: 'Mastodon',
    purpose:
      'Instance discovery, OAuth account connection, media upload and post publishing to any Mastodon instance.',
    connectionKind: 'oauth',
    env: [
      { name: 'MASTODON_INSTANCE_URL', role: 'Instance origin, e.g. https://mastodon.social', required: true },
      { name: 'MASTODON_CLIENT_ID', role: 'OAuth client id from the instance', required: true },
      { name: 'MASTODON_CLIENT_SECRET', role: 'OAuth client secret', required: true },
      { name: 'MASTODON_REDIRECT_URI', role: 'Registered redirect — must equal {origin}/api/social-engine/callback/mastodon', required: true },
      {
        name: 'SOCIAL_ENGINE_TOKEN_KEY',
        role: 'Key that encrypts stored OAuth tokens (32+ random chars, server-only)',
        required: true,
      },
    ],
    alternates: [
      { name: 'MASTODON_API_URL', role: 'Legacy publish path — instance API base used by growth-posts', required: false },
      { name: 'MASTODON_ACCESS_TOKEN', role: 'Legacy server-level token used when no account is connected', required: false },
    ],
    approval: { required: false, note: '' },
    readyBy: 'publish',
    activation:
      'On your instance: Development → New application (scopes read write) → set the four variables (redirect must match) → Connect → Test (instance + account) → publish test. The legacy MASTODON_API_URL/MASTODON_ACCESS_TOKEN pair still satisfies the publish adapter when no account is connected.',
  },

  discord: {
    id: 'discord',
    label: 'Discord',
    purpose:
      'Connect a Discord account, authorize servers, pick channels with permission checks, and publish messages/embeds.',
    connectionKind: 'oauth',
    env: [
      { name: 'DISCORD_APPLICATION_ID', role: 'Discord application id', required: true },
      { name: 'DISCORD_PUBLIC_KEY', role: 'Application public key', required: true },
      { name: 'DISCORD_CLIENT_SECRET', role: 'OAuth2 client secret', required: true },
      { name: 'DISCORD_REDIRECT_URI', role: 'Registered redirect — must equal {origin}/api/social-engine/callback/discord', required: true },
      {
        name: 'DISCORD_WEBHOOK_URL',
        role: 'Channel webhook that actually posts the message (no OAuth scope can publish for you)',
        required: true,
      },
      {
        name: 'SOCIAL_ENGINE_TOKEN_KEY',
        role: 'Key that encrypts stored OAuth tokens (32+ random chars, server-only)',
        required: true,
      },
    ],
    additionalSetup: [
      'A BOT is additional setup: the OAuth client secret is NOT a bot token. Create a bot under the application (Bot → Reset Token → DISCORD_BOT_TOKEN on the server), invite it to the target server, and grant it View Channel + Send Messages + Embed Links in the destination channel. Channel publishing uses the bot; the webhook path publishes without one.',
    ],
    approval: { required: false, note: '' },
    readyBy: 'publish',
    activation:
      'Create the application at discord.com/developers → add OAuth2 redirect {origin}/api/social-engine/callback/discord → set the four variables (and DISCORD_WEBHOOK_URL for the webhook publish path) → Connect → Test → publish test.',
  },

  facebook: {
    id: 'facebook',
    label: 'Facebook Pages',
    purpose:
      'Connect a Meta account, list the Pages the user manages, select a Page, and publish approved text/link/image/video posts to that Page — never to personal profiles.',
    connectionKind: 'oauth',
    env: [
      { name: 'META_APP_ID', role: 'Meta app id (reuse the existing Meta app)', required: true },
      { name: 'META_APP_SECRET', role: 'Meta app secret (server-only)', required: true },
      {
        name: 'META_REDIRECT_URI',
        role: 'Registered redirect — must equal {origin}/api/social-engine/callback/facebook',
        required: true,
      },
      {
        name: 'SOCIAL_ENGINE_TOKEN_KEY',
        role: 'Key that encrypts stored OAuth tokens (32+ random chars, server-only)',
        required: true,
      },
    ],
    alternates: [
      {
        name: 'META_COMMERCE_ACCESS_TOKEN',
        role: 'Existing Commerce catalog-feed token — separate purpose, does NOT authorize Pages publishing',
        required: false,
      },
      { name: 'META_CATALOG_ID', role: 'Existing product catalog id (Commerce feed only)', required: false },
    ],
    additionalSetup: [
      'Graph API permissions: pages_read_engagement (read) + pages_manage_posts (publish). Enable them on the existing Meta app; do not overwrite META_COMMERCE_ACCESS_TOKEN / META_CATALOG_ID.',
      'App Review + Business Verification are required before anyone outside the app’s testers/roles can authorize — until then only test users in the app can connect.',
      'Publishing targets ONLY Pages returned by /me/accounts that the connected user manages — personal-profile publishing is unsupported and refused.',
      'Page insights are reported only when the app actually holds the insights permission — the dashboard never invents reach/view numbers.',
    ],
    approval: {
      required: true,
      note:
        'Meta App Review must grant pages_manage_posts (and Business Verification may be required) before publishing outside the app’s test users.',
    },
    readyBy: 'publish',
    connectPath: '/api/social-engine/facebook/connect',
    activation:
      'developers.facebook.com → reuse the Meta app → add Valid OAuth Redirect URI {origin}/api/social-engine/callback/facebook → set META_APP_ID / META_APP_SECRET / META_REDIRECT_URI → request pages_read_engagement + pages_manage_posts → complete App Review → Connect (choose a Page) → Test → publish test (neutral post to the selected Page).',
  },

  instagram: {
    id: 'instagram',
    label: 'Instagram',
    purpose:
      'Official Instagram Content Publishing for professional (Business/Creator) accounts linked to a managed Facebook Page — image/video posts through the Graph API.',
    connectionKind: 'oauth',
    env: [
      { name: 'META_APP_ID', role: 'Meta app id (same app as Facebook Pages)', required: true },
      { name: 'META_APP_SECRET', role: 'Meta app secret (server-only)', required: true },
      {
        name: 'META_REDIRECT_URI',
        role: 'Registered redirect — must equal {origin}/api/social-engine/callback/instagram',
        required: true,
      },
      {
        name: 'SOCIAL_ENGINE_TOKEN_KEY',
        role: 'Key that encrypts stored OAuth tokens (32+ random chars, server-only)',
        required: true,
      },
    ],
    alternates: [
      {
        name: 'META_COMMERCE_ACCESS_TOKEN',
        role: 'Existing Commerce catalog-feed token — not usable for Instagram publishing',
        required: false,
      },
    ],
    additionalSetup: [
      'Account type: the Instagram account must be professional (Business or Creator) and linked to a Facebook Page the connected user manages — personal/consumer accounts cannot publish via the API.',
      'Permissions: instagram_basic + instagram_content_publish (+ pages_read_engagement on the linked Page) — Meta App Review required before non-testers.',
      'Media must be a publicly reachable image/video URL; the engine uses Vidnov’s own media URLs (one storage system, no uploads to third parties).',
    ],
    approval: {
      required: true,
      note:
        'instagram_content_publish requires Meta App Review, and the account must be professional and linked to a managed Page — Facebook Page access alone does NOT imply Instagram publishing is ready.',
    },
    readyBy: 'publish',
    connectPath: '/api/social-engine/instagram/connect',
    activation:
      'Same Meta app → add redirect {origin}/api/social-engine/callback/instagram → set META_APP_ID / META_APP_SECRET / META_REDIRECT_URI → link a professional Instagram account to a managed Page → request instagram_basic + instagram_content_publish (App Review) → Connect → Test → publish test (neutral image post).',
  },

  google: {
    id: 'google',
    label: 'Google',
    purpose:
      'Google sign-in and Google-service integration points. NOT a generic social publishing API — Vidnov’s Google usage is listed in activation.',
    connectionKind: 'oauth',
    env: [
      { name: 'GOOGLE_CLIENT_ID', role: 'Google OAuth client id (Web application)', required: true },
      { name: 'GOOGLE_CLIENT_SECRET', role: 'Google OAuth client secret', required: true },
      {
        name: 'SOCIAL_ENGINE_TOKEN_KEY',
        role: 'Key that encrypts stored OAuth tokens (32+ random chars, server-only)',
        required: true,
      },
    ],
    approval: {
      required: true,
      note:
        'The OAuth consent screen must be verified by Google before non-test users can authorize, and every API (YouTube, People, …) needs its own enablement + scope review.',
    },
    readyBy: 'diagnostic',
    activation:
      'Existing Google services in Vidnov (no GOOGLE_CLIENT_ID needed today): Firebase Auth Google sign-in, Search Console + GA4 + Merchant Center via service accounts, Google Tag Manager. GOOGLE_CLIENT_ID/SECRET add the generic OAuth flow for future profile/API integrations — enable the target API in Google Cloud, add scopes, publish the consent screen.',
  },

  livekit: {
    id: 'livekit',
    label: 'LiveKit',
    purpose:
      'The existing live-session infrastructure — reused for approved live-session promotion and live-event share links. NOT a social publishing credential.',
    connectionKind: 'builtin',
    env: [
      { name: 'LIVEKIT_URL', role: 'wss:// LiveKit server URL', required: true },
      { name: 'LIVEKIT_API_KEY', role: 'LiveKit API key', required: true },
      { name: 'LIVEKIT_API_SECRET', role: 'LiveKit API secret', required: true },
    ],
    readyBy: 'diagnostic',
    activation:
      'Already wired for broadcasts (src/lib/live/service.ts). The Social Engine only reuses it: diagnose config, mint viewer tokens for approved sessions, and build shareable live-event links. Set the three variables on the VPS to enable.',
  },

  pocketbase: {
    id: 'pocketbase',
    label: 'PocketBase',
    purpose:
      'The VPS-side secondary store (gradual self-hosting migration). Role: MIRROR for migrated sections — Firestore remains the source of truth. Not a publishing integration.',
    connectionKind: 'builtin',
    env: [
      { name: 'POCKETBASE_URL', role: 'Instance URL, e.g. http://127.0.0.1:8090', required: true },
      { name: 'POCKETBASE_ADMIN_EMAIL', role: 'Superuser identity', required: true },
      { name: 'POCKETBASE_ADMIN_PASSWORD', role: 'Superuser password', required: true },
    ],
    readyBy: 'diagnostic',
    activation:
      'No data migration is part of the Social Engine. Set the three variables on the VPS to let mirrored sections (shops, carts, logs, notifications, growth jobs) write through pbRequest; every helper falls back to Firestore when unset. Health check = /api/health on the instance.',
  },

  media: {
    id: 'media',
    label: 'Media preparation',
    purpose:
      'One configuration for validating and preparing images/videos for every platform: variants, thumbnails, and honest unsupported-media reports — reusing the existing Vidnov media pipeline (one storage system, no duplicates).',
    connectionKind: 'builtin',
    // All values have safe defaults in MEDIA_CONFIG — one configuration even
    // though config.ts and limits.ts both read the same names (task §11:
    // repeated names = one configuration, not separate integrations).
    env: [
      { name: 'VIDNOV_MAX_IMAGE_UPLOAD_MB', role: 'Image upload cap (MB)', required: false },
      { name: 'VIDNOV_MAX_IMAGE_DIMENSION', role: 'Max image edge (px)', required: false },
      { name: 'VIDNOV_IMAGE_QUALITY', role: 'Stored WebP quality', required: false },
      { name: 'VIDNOV_THUMBNAIL_DIMENSION', role: 'Thumbnail edge (px)', required: false },
      { name: 'VIDNOV_MAX_VIDEO_UPLOAD_MB', role: 'Video upload cap (MB)', required: false },
      { name: 'VIDNOV_MAX_VIDEO_DURATION_SECONDS', role: 'Video duration cap (s)', required: false },
      { name: 'VIDNOV_VIDEO_MAX_HEIGHT', role: 'Max video height (px)', required: false },
      { name: 'VIDNOV_VIDEO_CRF', role: 'H.264 CRF for stored video', required: false },
    ],
    readyBy: 'publish',
    activation:
      'Defaults already apply when the variables are unset. The engine validates against platform caps BEFORE publishing, reuses stored originals when they already fit (no needless recompression), and generates variants/thumbnails through the existing image/video pipeline.',
  },

  urls: {
    id: 'urls',
    label: 'URLs & referral tracking',
    purpose:
      'One canonical origin (https://vidnov.com) for shop/product/service links, campaign landing pages, OAuth callbacks, UTM parameters and social referral codes — with outbound handoffs tracked separately from confirmed posts.',
    connectionKind: 'builtin',
    env: [
      { name: 'NEXT_PUBLIC_SITE_URL', role: 'Public origin override (highest precedence)', required: false },
      { name: 'NEXT_PUBLIC_BASE_URL', role: 'Payment/OAuth callback origin (second precedence)', required: false },
      { name: 'NEXT_PUBLIC_APP_URL', role: 'Internal-testing app URL (notifications)', required: false },
      { name: 'APP_PUBLIC_URL', role: 'Public notification link origin', required: false },
      { name: 'APP_URL', role: 'Server-internal link origin (email, Postiz)', required: false },
    ],
    readyBy: 'diagnostic',
    activation:
      'Unset variables fall back to https://vidnov.com through publicOrigin() (src/lib/site-url.ts) — the canonical production URL. Track handoffs (share URL generated) separately from published posts (remoteId recorded); incoming visits flow through the existing events/referral pipeline (?ref= codes).',
  },

  publishing: {
    id: 'publishing',
    label: 'Publishing engine',
    purpose:
      'The shared queue every module publishes through — the existing growth-posts engine: admin approval, scheduling, per-channel retry, duplicate protection (cooldown + per-channel results), publishing history and error reporting. Sellers promote only their own approved products; tenant checks live server-side.',
    connectionKind: 'builtin',
    env: [],
    readyBy: 'diagnostic',
    activation:
      'No new queue is created: campaigns are growth-posts drafts written by an administrator (Firestore growthPosts), approved by an admin, scheduled by the existing scheduler tick, published through publishSocial() with idempotency (a channel with a recorded result is never re-sent). No AI service is involved. Audit entries land in social_engine_audit.',
  },
};

export const MODULE_LIST: ModuleSpec[] = Object.values(MODULE_SPECS);

/** Env names a module cannot function without (for the dashboard). */
export function requiredEnvNames(spec: ModuleSpec): string[] {
  return spec.env.filter((e) => e.required).map((e) => e.name);
}
