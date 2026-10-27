# Growth Engine — Launch Readiness (Phase 2 handover)

_Last updated: 2026-10-27, from the Freebuff development workspace. Every claim
here was verified by a command in this session or carries an explicit
"unverified" marker. Nothing in this document describes the production VPS,
which was not touched._

## 1. Completed (implemented + tested in this repo)

| Component | Where | Evidence |
|---|---|---|
| Event spine (server-verified, deduped, TTL-retained) | `src/lib/growth/*`, `src/app/api/events` | `growth-events.test.ts` |
| Share/referral attribution on public links | `src/lib/vidnov-core/attribution/tracking.ts` | `vidnov-core*.test.ts` |
| Distribution job engine: validation, ownership, idempotency, retries, attempt caps, dead-letter, audit | `src/lib/vidnov-core/distribution/*` | `distribution-engine.test.ts` |
| Global pause / resume / emergency stop (honoured by every run, including cron) | `distribution/config.ts` + engine | `distribution-engine.test.ts` |
| Scheduled operation: secret-gated, fail-closed cron route (disabled by default) | `src/app/api/distribution/cron/route.ts`, `distribution/cron-auth.ts` | `distribution-cron.test.ts` |
| Adapters: local sitemap (verified), IndexNow, Bing, Search Console inspect, GA4 read (all real endpoints, none reachable without credentials) | `distribution/adapters.ts` | `distribution-engine.test.ts` |
| Destination analytics: qualified views, share clicks, server-verified attributed orders per channel | `distribution/analytics.ts` | covered via funnel tests |
| **Growth funnel: exposure → enquiry → offer → order with separated money buckets (GMV / delivered revenue / pending / disputed)** | `distribution/funnel.ts`, `api/admin/distribution/funnel` | `growth-funnel.test.ts` |
| Admin Control Center + admin-only APIs (`verifyAdminUid`, safe projections, `null` = unknown) | `api/admin/distribution/*`, `dashboard/admin/system/distribution` | `vidnov-core-routes.test.ts` + live 403 check |
| Buyer request marketplace + PocketBase mirrors (`requests`, `offers`, `live_streams`, `live_chat_messages`, `live_reports`) | `src/lib/pocketbase/*`, services | `pocketbase-live-requests.test.ts` |
| PocketBase-first public sitemap + robots (OAI-SearchBot allowed) | `sitemap.ts`, `sitemap-catalogue.ts`, `robots.ts` | `sitemap*.test.ts`, live 200s |
| Payment webhook hardening (PayPal API verification; Paystack constant-time HMAC + fail-closed secret) | `api/webhooks/*` | `payment-hardening.test.ts` |
| Seller opportunities (create / apply / review) — the acquisition surface | `src/lib/vidnov-core/opportunities/*`, `api/opportunities`, `api/admin/opportunities` | `vidnov-core.test.ts` |

## 2. Not completed (honest status)

| Item | Status | Why |
|---|---|---|
| Automated seller **outreach** (personalised invitations, follow-ups, suppression lists, bulk-approval gate) | **Not implemented** | Requires an approved messaging channel + your approval policy; no outbound sender exists today. Opportunities CRUD is the tracking surface that such a workflow would sit on. |
| AI promotional content pipeline (captions/variants → approval → publish) | **Not implemented** | Gemini provider wiring exists (`src/lib/ai/gemini-adapter.ts`) but no content-draft/approve state machine. Publishing must go through the distribution engine's approval rules. |
| Meta catalog, Google Merchant, TikTok Shop adapters | **Declared, `not_configured`** | Need credentials AND platform app review; adapters deliberately have no runtime implementation yet (`dispatch` returns `not_configured`). |
| Hermes Agent (or any external agent runtime) | **Not installed, not integrated** | Zero references in `src/`, `docs/`, `scripts/`. To activate: install the runtime, expose a task interface matching `distributionJobs` states, and gate spend/publish actions behind the existing admin approval surfaces. Nothing here claims it is active. |
| Mobile polish of every Control Center failure state | **Partially verified** | Layout is responsive; no device-level test was run. |

## 3. Firestore → VPS migration status — **NOT complete**

Firestore remains the source of truth. PocketBase is a mirror for the
sections below (best-effort, never authoritative), and **these collections are
still Firestore-only**: `studioVideos`, `liveStreams` chat/reports subcollections
(mirrored now), `requests`/`offers` (mirrored now), `chats`/`chat_messages`
(PB-primary), `resellActivities`, `referrals`, `referralGrants`, `supportTickets`,
`supportThreads`, `helpArticles`, `homepageSlides`, `boost_requests`, `aiJobs`,
`opportunities`, `distributionJobs/Audit/Config/Quotas`, `contentEvents`,
`errorLogs`, `activityLogs`, `securityEvents`, `fraudAlerts`,
`contentModerationQueue`, `tiktok_connections`, `products/{id}/comments|reviews`,
`pushSubscriptions` legacy FCM copies.

Never state that the migration is done. Each mirrored section keeps its
Firestore write; PB adds a VPS copy only.

## 4. Environment requirements (names only — values never printed here)

- **Cron (disabled by default):** `VIDNOV_CRON_ENABLED` (must be exactly `true`), `CRON_SECRET` (set by you, presented as `Authorization: Bearer …` or `?secret=`). Without both, `/api/distribution/cron` answers 204/403 and runs nothing.
- **Distribution channels:** `INDEXNOW_KEY`; `BING_WEBMASTER_API_KEY`, `BING_WEBMASTER_SITE_URL`; `GOOGLE_SEARCH_CONSOLE_CLIENT_ID`, `GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET`, `GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN`, `GOOGLE_SEARCH_CONSOLE_SITE_URL`; `GA4_PROPERTY_ID`, `GA4_SERVICE_ACCOUNT_JSON`.
- **Blank today (blocks payments/AI-web):** `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_GEMINI_API_KEY`.
- **Security:** `NODE_TLS_REJECT_UNAUTHORIZED` is present in the project `.env` with a certificate-verification-disabling value (proven by the Node warning on every dev/build run; the value was never printed). It is **not set anywhere in code** — verified by grep across `src/`, `scripts/`, `next.config.js`. Safe removal is a Settings → Environment change on the platform side (delete the key), not a code edit. Recommended before release.

## 5. Enabling the schedule safely (only after your authorization)

1. Set `VIDNOV_CRON_ENABLED=true` and your own `CRON_SECRET`.
2. Call `curl -H "Authorization: Bearer $CRON_SECRET" https://vidnov.com/api/distribution/cron` once.
3. Check Control Center → Overview (engine run recorded, counters moved) and Audit.
4. Add the VPS cron entry, e.g. `*/30 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://vidnov.com/api/distribution/cron -o /dev/null`.
5. Emergency stop: set `paused` in the Control Center (engine and cron honour it immediately) or unset `VIDNOV_CRON_ENABLED` and restart.

## 6. Release blockers (launch-gating)

1. VPS branch/ref unknown (repo has only `origin/main`; the previously described `vidnov-vps` branch does not exist) — confirm with `git -C /root/app status -sb` on the VPS.
2. All 98 pending working-tree changes are uncommitted — one atomic commit is the only release shape verified green end-to-end (see the release-readiness report).
3. No distribution channel has credentials; the engine can only ever touch the local sitemap destination until you provide them.
4. `NODE_TLS_REJECT_UNAUTHORIZED` should be removed from the production environment.
5. PayPal credentials blank (payments for PayPal unavailable; Paystack/Pesapal unaffected).
