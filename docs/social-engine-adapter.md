# Vidnov Social Engine — Integration Adapter Guide

## 1. Purpose

The Social Engine wraps the existing `growth-posts` publishing queue so every
social platform can be connected, tested, scheduled and revoked from a single
administrator dashboard. It reuses everything that already works: token
encryption, media storage, the `publishSocial()` dispatcher, `site-url` for
canonical URLs, and the existing auth guards. No new queue or media storage
system is added.

**Storage (VPS-first):** Growth Posts and the Social Engine's own collections
(`social_engine_connections`, `social_engine_tests`, `social_engine_meta`,
`social_engine_audit`) are PRIMARY on PocketBase on the VPS. Firestore is a
best-effort mirror and the only store when `POCKETBASE_*` is unset; existing
rows are copied once by `scripts/migrate-social-engine.ts`.

## 2. How the pieces fit together

```
┌──────────────────────────────┐
│  Admin dashboard (page)      │  reads /api/social-engine/status
│  (seven-state readiness)     │  + POST test / publish-test / connect
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│  API routes                  │  auth (verifyUserContext) + tenant wall
│  /status /test /publish-test │  /connect /disconnect /callback/[module]
│  /approval                   │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│  Engine (engine.ts)          │  reads social_engine_tests/{module},
│  readiness + records         │  social_engine_meta/{module} + social_engine_audit
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│  Adapters (diagnostics.ts /  │  per-module checks
│  publishing.ts / flows.ts)   │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│  Shared queue (growth-posts) │  publishSocial(), drafts, scheduler,
│  reuse (not duplicated)      │  retry, idempotency, audit
└──────────────────────────────┘
```

## 3. Readiness states (seven)

`NOT CONFIGURED → CONFIGURED → CONNECTED → TESTED → READY`, plus two side
states: `APPROVAL_REQUIRED` (provider approval missing) and `ERROR` (a
recorded failure). Env var presence alone never reaches `READY`. Read the
`readyBy` per module from `MODULE_SPECS` in `src/lib/social-engine/modules.ts`:

- `readyBy: 'publish'` — Telegram, TikTok, Bluesky, Tumblr, Mastodon,
  Discord, Facebook, Instagram, Media. These need a successful `publish`
  test.
- `readyBy: 'diagnostic'` — Google, LiveKit, PocketBase, URLs, Publishing.
  These are proven by a successful diagnostic (config / health / queue).

`computeReadiness` in `src/lib/social-engine/readiness.ts` is pure and is
unit-tested exhaustively.

## 4. URL and referral tracking (Phase 1)

All public URL builders go through `canonicalOrigin()` (`src/lib/site-url.ts`
already selects the apex domain `https://vidnov.com` from
`NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_BASE_URL`, in that order). New builders
in `src/lib/social-engine/url-track.ts`:

- `canonicalOrigin()` — the single domain for everything.
- `publicUrl(path)` — same wrapper as the rest of the app.
- `buildShareUrl(kind, path, opts)` — home / seller / product / service /
  live / campaign links with `ref`, `camp`, `content`, `term` attached.
- `buildUtmQuery(opts)` — appends `utm_source/medium/campaign/content/term`.
- `buildSellerReferralUrl(path, code, opts)` and
  `buildProductReferralUrl(path, code, opts)` — reuse `withShareRef()` so
  the `?ref=` code is the same deterministic, 30-day TTL format the invite
  flow honours.
- `oauthCallbackUrl(module)` — fixed server-side path, never built from user
  input.

The six attribution events (in `types.ts`) are kept strictly separate:

| Event                        | Means                                                              |
|------------------------------|--------------------------------------------------------------------|
| `share_handoff_initiated`    | A handoff URL was generated — never a publish.                     |
| `post_confirmed_published`   | The platform answered with a real post id.                         |
| `referral_link_clicked`      | Visitor arrived through a tracked link (existing pipeline).        |
| `website_visit_received`     | Inbound server event (existing pipeline).                          |
| `enquiry_submitted`          | Form/lead (existing pipeline).                                     |
| `order_completed`            | Purchase (existing pipeline).                                      |

Outgoing handoffs and confirmed posts are recorded by the dashboard via
`/api/social-engine/{module}/publish-test`; incoming visits/referrer clicks/
enquiries/orders already flow through the existing growth-events pipeline
(`?ref=` / `?ch=` / `?camp=` on the URLs built here).

## 5. Shared publishing foundation (Phase 2)

The existing `publishSocial()` dispatcher (`src/lib/vidnov-core/growth-posts/social.ts`)
is the single publishing primitive. It enforces:

- **Queue/approval**: campaigns are drafts → admin approval → scheduler tick
  → publish.
- **Retry**: per-channel retry with bounded attempts.
- **Duplicate prevention**: a channel with a recorded result is never resent.
- **Tenant isolation**: the `*Service` functions take a caller and gate on
  the seller's own products; the admin guard is enforced server-side.
- **Audit**: every publish writes an entry to `social_engine_audit`.
- **Honesty contract**: `ok: true` only when the platform returned its own
  id; nothing upstream is logged.

New, one-time tests reuse it without rebuilding it: `publishing.ts`
reuses `publishSocial()` for Telegram/Bluesky/Mastodon/Discord (the env
channels). The diagnostics module is the shared "safe check" path.

## 6. Per-platform adapters

### 6.1 Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`,
`TELEGRAM_CHANNEL_ID`)

Server-level credentials, not OAuth. Diagnostics call
`https://api.telegram.org/bot{TOKEN}/getMe` then `getChat` + `getChatMember`
to verify the bot is an administrator with post permission. Publishing sends
`sendPhoto` when the test payload has an image URL (the image is passed by
URL, so nothing is downloaded) and falls back to `sendMessage`. Publish test
reuses `publishSocial()` with `channel: 'telegram'`.

### 6.2 Bluesky (`BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD`)

Server-level credentials. Diagnostics sign in with
`com.atproto.server.createSession` and verify the profile. Publishing uses
the AT Protocol `createRecord` flow (reused from `growth-posts/social.ts`).

### 6.3 TikTok (`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`,
`TIKTOK_OAUTH_SECRET`)

OAuth via the existing, hardened `/api/tiktok/connect` and `/api/tiktok/callback`
routes — reused, never rebuilt. The connection (tokens + scope names) lives in
the server-only `tiktok_connections/{uid}` collection. Diagnostics check the
token and report whether `video.publish` is granted. Publishing:

- **Direct publish** (Content Posting API, `video.publish` granted): the
  admin runs a publish test with a real video asset URL. The engine publishes
  through the existing pipeline and records the platform's `publish_id`. It
  only claims *published* when `getTikTokPublishStatus()` returns
  `PUBLISH_COMPLETE`; anything else (queue processing, user inbox,
  failed_audit) is an ongoing handoff, never a published post.
- **Share-to-TikTok fallbacks** — a handoff, *never* recorded as published.
  Recorded with action `handoff`, event `share_handoff_initiated`.

### 6.4 Mastodon (`MASTODON_INSTANCE_URL`, `MASTODON_CLIENT_ID`,
`MASTODON_CLIENT_SECRET`, `MASTODON_REDIRECT_URI`)

OAuth instance discovery + connection. Diagnostics fetch the instance info,
then verify the account. Publishing reuses `publishSocial()` with the
existing `MASTODON_API_URL` / `MASTODON_ACCESS_TOKEN` env pair when no
account is connected, and with the connection token when one is.

### 6.5 Tumblr (`TUMBLR_CONSUMER_KEY`, `TUMBLR_CONSUMER_SECRET`,
`TUMBLR_CALLBACK_URL`)

OAuth 1.0a (HMAC-SHA1, `oauth1AuthorizationHeader` in `oauth.ts`). The
connect route starts the request-token step, redirects to
`/oauth/authorize?oauth_token=...`, and the callback exchanges the verifier
for an access token. Publishing posts text directly to the account's blog.

### 6.6 Discord (`DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`,
`DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`)

OAuth: `/api/oauth2/authorize` + token exchange. Diagnostics fetch the
authorized guilds and report the count; the webhook URL (existing env
path) is reported alongside. **The client secret is NOT a bot token** — the
dashboard documents that a bot must be created separately and that the
`DISCORD_WEBHOOK_URL` publish path needs no bot at all. Publish tests reuse
`publishSocial()` with `DISCORD_WEBHOOK_URL`.

### 6.7 Facebook Pages (`META_APP_ID`, `META_APP_SECRET`,
`META_REDIRECT_URI`)

OAuth connect + page listing. The connect route exchanges the code for an
access token and records the managed Pages list in the sealed connection
metadata (`meta.pages`). Publish test posts a neutral message to a managed
Page (`POST /{page-id}/feed`) using the page access token. No personal
profile publishing is supported or advertised.

### 6.8 Instagram (`META_APP_ID`, `META_APP_SECRET`,
`META_REDIRECT_URI`)

Official Content Publishing for professional (Business/Creator) accounts
linked to a managed Page. Connect records the linked
`instagram_business_account` id in the sealed metadata. Publish test creates
a media container from the site's own public icon (`/icons/icon-512.png`,
same storage system — no third-party upload), then `media_publish`s it.

### 6.9 Google (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)

**Not a generic social publishing API.** The env names are documented for the
future generic OAuth flow; today Google services in Vidnov are Firebase Auth
sign-in, Search Console/GA4/Merchant Center (service accounts), and GTM. The
marketing workflow itself is manual first and calls no AI service. `runDiagnostics` verifies the connected OAuth
account (`openidconnect` userinfo). Publishing is deliberately refused; an
admin should attest the intended service in the dashboard, and only then is
the module `READY`.

### 6.10 LiveKit (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`)

Existing broadcast infrastructure (`src/lib/live/service.ts`), reused. Not a
social publish credential.

### 6.11 PocketBase (`POCKETBASE_URL`, `POCKETBASE_ADMIN_EMAIL`,
`POCKETBASE_ADMIN_PASSWORD`)

VPS store. It is the PRIMARY store for Growth Posts and the Social Engine
collections listed in §1, and a mirror for every other migrated section;
those remain Firestore-sourced. Health check `/api/health` is the diagnostic.

### 6.12 Media + URLs + Publishing

- **Media**: content validation gate (`validateForPlatform`) defined once in
  `media.ts`, used by the publish test and by the publishing queue before
  any remote post. Defaults load without variables.
- **URLs**: the canonical origin and URL builders (see section 4).
- **Publishing**: the existing `growth-posts` queue itself.

## 7. Admin readiness dashboard (Phase 8)

`src/app/dashboard/admin/system/social-engine/page.tsx` renders one card per
module. A card shows:

- Label, purpose, and the seven-state badge.
- Required env var names and which are missing.
- Connection status + account label.
- Approval required/granted.
- Last auth/diagnostic/publish test (with timestamps and redacted notes).
- Last handoff (never shown as a publish).
- Last redacted error.
- Next activation step, from the module spec.
- Action buttons: Test, Publish test, Disconnect, Approval (for
  APPROVAL_REQUIRED).

Admin-only. The dashboard never reads `process.env` values and never
displays a token, credential, or secret.

## 8. Connections and tenant isolation (Phase 2)

`connections.ts` stores one document per module+owner keyed
`{module}__{ownerId}` in PocketBase `social_engine_connections` (Firestore
`social_connections` is the mirror/fallback). The `getConnection`/`saveConnection`/
`disconnectConnection`/`openConnectionTokens` functions enforce the tenant
wall: a seller can only touch their own connection; an admin can only touch
their own. Stored tokens are sealed (AES-256-GCM, `crypto.ts`) and never
logged or returned.

## 9. Security (Phase 8)

- All credentials are server-side only (routes and engine); no secrets reach
  the browser.
- OAuth state is HMAC-SHA256, expiring, single-use, and bound to the browser
  by an HttpOnly cookie — the same implementation as TikTok's existing flow.
- Callback URL validation is strict: `validateRegisteredCallback` compares
  the registered env variable to the fixed module callback path.
- Idempotent publishing; duplicate detection via recorded results.
- Disconnect marks the connection `disconnected`; the state machine turns it
  into `CONFIGURED`, and the scheduler refuses to publish to a disconnected
  account.
- Audit trail in `social_engine_audit`; every state-changing action is
  recorded with the actor and a sanitized note.

## 10. Activation

Per module: config names → provider app registration → OAuth connect →
`Test` → (for publish modules) `Publish test`. Infrastructure modules need
only their variables + a successful diagnostic.

## 11. Final report table

| Integration   | Configured | Connected | Tested | Ready | Remaining work                                                                              |
|---------------|------------|-----------|--------|-------|---------------------------------------------------------------------------------------------|
| Telegram      |            |           |        |       | Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_CHANNEL_ID` and grant post perm. |
| TikTok        |            |           |        |       | `TIKTOK_CLIENT_KEY/SECRET`, `TIKTOK_OAUTH_SECRET`, app review for `video.publish` (direct) or Share-to-TikTok. |
| Bluesky       |            |           |        |       | `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD`; generate app password.                            |
| Tumblr        |            |           |        |       | OAuth 1.0a app + `TUMBLR_CALLBACK_URL` registration.                                        |
| Mastodon      |            |           |        |       | Instance + OAuth app (scopes read write) + `MASTODON_REDIRECT_URI`.                         |
| Discord       |            |           |        |       | Application + OAuth app + `DISCORD_REDIRECT_URI`; optional bot + webhook.                   |
| Facebook Pages|            |           |        |       | `META_APP_ID/SECRET`, `META_REDIRECT_URI`, App Review + app password.                       |
| Instagram     |            |           |        |       | Professional account linked to a Page + `instagram_content_publish` App Review.             |
| Google        |            |           |        |       | Documented as integration points; intended services attested per admin.                     |
| URLs & refs   |            |           |        |       | `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_BASE_URL` set (defaults already to https://vidnov.com). |
