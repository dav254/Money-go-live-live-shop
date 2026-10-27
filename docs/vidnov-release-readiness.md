# Vidnov — Section-by-Section Release Readiness

_Audited 2026-10-27 against release candidate **8624fa0f** (`main`) in the
Freebuff development workspace. Statuses are evidence-based: tests actually
run, endpoints actually called, code actually inspected. **Code readiness and
production deployment readiness are separate** — see § "Deployment readiness"
at the end._

**Legend:** READY = complete, wired, tested, no known defect · NEEDS FIX =
works but a defect/config item remains · BLOCKED = needs a credential,
approval or access outside this repository · NOT IMPLEMENTED = intentionally
absent (no fake substitute exists).

## Inventory discovered

- **222** pages (`src/app/**/page.tsx`), **128** API routes (`src/app/api/**/route.ts`),
  **38** test files, 3 background-scheduler entry points, 8 external integrations.
- This document covers every section the assignment listed plus everything the
  API sweep surfaced (transactions/mux/checkout-simulate are 410 stubs kept
  intentionally disabled).

## Section table

| # | Section | Files / APIs inspected | Status | Evidence | Fixes | Remaining risks / dependencies |
|---|---|---|---|---|---|---|
| 1 | Homepage, navigation, search, discovery feed | `src/app/page.tsx`, `src/app/search/*`, `api/search/route.ts`, `components/discovery/*` | **READY** | Search API schema-validated (q≤200, limit≤50, internal caps); homepage honesty labels asserted in `payment-hardening` tests; live preview `GET /` → 200 | — | Search quality/typos not machine-verifiable |
| 2 | Listings, images, videos, uploads, media quality | `lib/media/{service,engine,storage-adapter}`, `api/upload`, `api/media/status`, `api/media/file` | **READY** | `media-config`, `media-ownership`, `music-uploads`, `studio-library`, `video-studio` tests; disk-backed status route audited this session (id-gated, no storage paths/owner ids in response — new hygiene test); live smoke of pages serving media | Public status poll hardened: field whitelist asserted (`public-endpoint-hygiene`) | ffmpeg must exist on the VPS (documented in DEPLOY.md) for video transcode |
| 3 | Seller registration, profiles, shop creation/edit, public shop links | `lib/auth/profile-ensure.ts`, `api/shops/sync`, `app/sellers/[sellerId]`, account/shop screens | **READY** | Profile written to Firestore (`set(..., {merge:true})`, source of truth) **and** PB upsert (line 94/117); `auth-surface-routing`, `business-location`, `vps-shops-cart-mirror` tests; `/sellers/[sellerId]` is a real route used by the sitemap | — | Shop logo/banner URLs depend on Cloudinary env (present) |
| 4 | Buyer registration, auth, profile persistence, admin visibility | `profile-ensure`, `api/users/sync`, `api/admin/users/list`, admin users pages | **READY** | Same persistence path as #3; admin list is PB-first with Firestore fallback (`api/admin/users/list` L31/L40); every admin route guarded — new repo-wide sweep `admin-authz` **37/37** incl. unauthenticated `/api/admin/distribution/*` → 403 live | Added `src/tests/admin-authz.test.ts` (34 routes walked) | Role-check helpers are inconsistent (works, but a future route could pick a wrong one — the sweep now fails it) |
| 5 | Buyer requests → media → offers → chat → orders → status | `lib/requests/*`, `lib/chat/store`, `api/requests/*`, `api/chat/*`, `api/orders/*`, `lib/pocketbase/{requests,orders}` | **READY** | `request-category-notifications`, `pocketbase-live-requests` (20 tests incl. mock-PB wire), `chat-vps-migration` tests; accept-offer → order → VPS mirror chain verified in code+tests; live `GET /api/requests?scope=mine` unauth → **401** | — | Firestore remains source of truth (mirrors best-effort by design) |
| 6 | Seller dashboard, product management, analytics, notifications | `dashboard/seller/**`, `app/seller/**`, `lib/notifications/*` | **READY** (code) | All dashboards read Firestore orders/products with bounded queries; `notifications-normalize` + push tests; push subscriptions PB-primary with legacy fallback documented | — | **UI walkthrough not performed in-session** — verify screens on first production smoke |
| 7 | Admin dashboard, Control Center, permissions, admin APIs | 34 `api/admin/**` routes, `dashboard/admin/system/*` | **READY** | `admin-authz` 37/37; overview/funnel/jobs/reconcile/run all `verifyAdminUid`; live: overview & funnel → **403** unauth; safe projections (no payloads/env values in responses) | Added repo-wide admin-route sweep test | Mobile readability of failure states unverified on device |
| 8 | Growth Engine: funnel, exposure, attribution, distribution jobs | `lib/vidnov-core/**`, `api/events`, `api/distribution/*`, `distribution/funnel` | **READY** (code) / **BLOCKED** (external submission) | `growth-funnel` 12/12, `distribution-cron` 12/12, `distribution-engine`, `growth-events` suites; funnel buckets (GMV/revenue/pending/disputed) with `null`=unknown; ownership + idempotency + pause honoured | Funnel endpoint added in Phase 2; admin sweep covers its 403 | All external channels `not_configured` (no credentials); cron disabled by default — scheduled runs unproven until you configure secret+scheduler |
| 9 | AI Studio / AI content generation | `api/ai/{generate,jobs,attach}`, `lib/ai/*`, `dashboard/seller/ai-tools/**` | **READY** (code) | All three AI routes `verifyUserContext` → **401** unauth; `ai-points-vps` tests charge/refund balance (VPS-first, no double charge); `GEMINI_API_KEY` present in workspace env (name only) | — | Production value of `GEMINI_API_KEY` unverified; generation is a **paid** API — cost caps are balance-gated, not hard-capped |
| 10a | Payments — Paystack / Pesapal, webhooks, wallets | `api/webhooks/{paystack,pesapal}`, wallet routes, `lib/pocketbase/wallet` | **READY** | `payment-hardening` **17/17**; Paystack HMAC now constant-time + fail-closed empty-secret (410) — **fixed this session**; PayPal verify-by-API pattern already present | Paystack hardening + 3 regression tests | Payment end-to-end not run live (no test charges; deliberate) |
| 10b | Payments — PayPal | `api/webhooks/paypal` | **BLOCKED** | Signature verification code verified; `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` are **blank** in env (names only) | — | Supply credentials in production env to enable; UI hides the option honestly today |
| 10c | Invoices / revenue reporting | admin finance pages, `distribution/funnel` | **READY** (code) | Funnel separates GMV vs delivered revenue vs pending vs disputed from one bounded scan (`growth-funnel` tests) | — | Finance pages read Firestore directly; no index dependency (equality/range single-field) |
| 11 | Email, support workflows, account notifications | `lib/notifications/{email-service,store,engine}`, admin support routes | **READY** (code) | Template→renderer→provider→`emailLogs` flow; dev mailbox default, production needs `EMAIL_PROVIDER`+`EMAIL_API_KEY` (both present); complaints routes guarded (`admin-authz`); `notifications-normalize` tests | — | Real send unverified in-session; production `EMAIL_MODE` must be confirmed on the VPS |
| 12 | SEO: metadata, sitemap, robots, public seller indexing | `sitemap.ts`, `sitemap-catalogue.ts`, `robots.ts`, `sitemap-entries.ts` | **READY** | `sitemap` + `sitemap-catalogue` suites (quota-failure, pagination, empty catalogue); live **200 application/xml**; robots starts with `OAI-SearchBot: Allow` + original disallows; PB-first with Firestore fallback | (Earlier session) PocketBase-first catalogue | Indexing itself not claimable — Search Console/IndexNow/Bing **BLOCKED** on credentials |
| 13 | Local media storage, external integrations, adapters, error handling | `media/storage-adapter`, `pocketbase/*`, `d1/*`, cloudinary | **READY** (code) | VPS-disk adapter + PB mirrors verified by mock-wire tests; `connectivity-log-filter` tests; adapter failures return `false/null` (never throw) | `api/d1/health` no longer echoes raw upstream error text to anonymous callers (**fixed this session**, 8 tests added) | Cloudflare D1 adapter is **health-only** — nothing else uses it (NOT IMPLEMENTED as a data source, honestly reported as "not configured") |
| 14 | Cron, scheduled tasks, env config, monitoring, rollback | `api/{distribution/cron,media/cleanup-cron,live/watchdog}`, `server-health` | **READY** (code) | All three schedulers **fail closed** (flag+secret, flag+secret, header secret) — tested in `distribution-cron` (12) and `public-endpoint-hygiene` (8); live cron → **204** disabled; rollback procedure documented + backup restore verified by execution | Added hygiene tests pinning 403/503/204 behaviour | **TLS override removal pending** (below); no real scheduler is configured yet |
| 15 | Deprecated/dangerous endpoints | `api/{transactions,mux,checkout/simulate}` | **READY** | All three return **410** with zero data access (asserted in hygiene tests) | — | None |

### Status counts

- **READY: 13 rows** (incl. code-READY notes for #6, #10a, #11, #12, #13, #14)
- **NEEDS FIX: 1** — `NODE_TLS_REJECT_UNAUTHORIZED` present in production environment config (see below)
- **BLOCKED: 3** — PayPal credentials, all external distribution/search-channel credentials, production deployment access
- **NOT IMPLEMENTED: 3** — Meta catalog / Google Merchant / TikTok Shop adapters (need app review + credentials; declared `not_configured`, no fake runtime), automated seller bulk-outreach (needs an approved messaging channel + your approval policy; the `opportunities` tracking surface exists), Cloudflare D1 as a data source (health check only)

## Fixes completed in this audit

1. **`api/d1/health` stopped returning raw upstream error text** to an unauthenticated caller (Cloudflare error messages can carry account/token-shaped detail); failure now returns one static sentence, logs a static line. +8 regression tests in `src/tests/public-endpoint-hygiene.test.ts`, which also pins: 410 stubs stay disabled, system-status returns health only, media poll field whitelist, password-reset anti-enumeration, both schedulers fail closed.

## TLS override — investigation result (no value printed)

- `NODE_TLS_REJECT_UNAUTHORIZED` exists **only in environment configuration**; grep of `src/`, `scripts/`, `next.config.js`, `package.json` → **zero code references**.
- No code performs TLS against internal/self-signed HTTPS endpoints (`https://localhost|127.0.0.1` → none); PocketBase is plain `http://127.0.0.1:8090`. All external APIs (Firebase, PayPal, Paystack, Pesapal, Cloudinary, Google/Genkit, LiveKit) use publicly verified certificates.
- **Consequence check: nothing depends on disabled verification → removal is safe.** It cannot be done from this workspace: `freebuff-deploy env unset` reports *"no hosting project yet"* (production is PM2 on the Contabo VPS) and `.env` edits are user-managed here.
- **Required actions:** (1) delete the key from the VPS `/root/app/.env`, `pm2 reload goearnvid`; (2) optionally delete it from Settings → Environment for this workspace. No other environment setting should be changed at the same time.

## Migration status (explicit)

The Firestore → VPS migration is **NOT complete**. Firestore is the source of
truth; PocketBase mirrors: profiles, products, shops, orders, wallet
(payments/payouts/transactions), cart/payment/payout methods, live sessions,
media records, admins, notifications+push, email logs, chat (PB-primary),
requests, offers, live streams/chat/reports. Still Firestore-only:
`studioVideos`, `resellActivities`, `referrals`/`referralGrants`,
`supportTickets`/`supportThreads`, `helpArticles`, `homepageSlides`,
`boost_requests`, `aiJobs`, `opportunities*`, `distribution*`, `contentEvents`,
`errorLogs`/`activityLogs`/`securityEvents`/`fraudAlerts`/
`contentModerationQueue`, `tiktok_connections`, product `comments`/`reviews`,
legacy FCM push copies. Details: `docs/growth-engine-launch-readiness.md`.

## Release gates (run on candidate + audit fixes)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | **exit 0** |
| Tests | `npm test` | see final report (baseline 739 + 8 new) |
| Lint | `npm run lint` | **not runnable** — no ESLint config (pre-existing) |
| Build | isolated `next build` in `/tmp/vidnov-build-check` | see final report |
| Secrets | staged-file scan (private keys / AWS / Stripe-live / env files) | clean — re-run at commit |

## Deployment readiness (SEPARATE from code readiness)

**NOT READY — production access, not code, is the blocker.** The site runs on
a Contabo VPS (PM2 `goearnvid`); this workspace has no VPS access, and the
VPS branch/worktree must be verified read-only before any update (the repo
has only `main`; the historical `vidnov-vps` ref does not exist). Checklist:
`docs/vidnov-release-readiness` §VPS steps → run the exact commands in the
release report. Keep cron disabled until `VIDNOV_CRON_ENABLED` +
`CRON_SECRET` are deliberately configured.
