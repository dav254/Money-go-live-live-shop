# Vidnov Core Engine — Backend Audit & Design

Status: **audit complete, foundation implemented** (see §9 for what was actually built).
Scope: backend foundation only. No database replacement, no data migration, no payouts, no deploy.

---

## 1. What the existing backend actually uses

| Concern | Actual system (verified in code) | Source of truth |
|---|---|---|
| Primary data | **Firestore** via the Firebase client SDK in pages/components and the **Firebase Admin SDK** in API routes (`src/firebase/server.ts`) | **Firestore** for `products`, `userProfiles`, `orders`, `sellerShops`, `buyerRequests`, `notifications`, etc. |
| Mirroring | **PocketBase** is a *secondary mirror*, written by server routes (`src/lib/pocketbase/*`, `src/app/api/products/sync`) and migration scripts (`scripts/migrate-*.ts`). It never owns products/orders/users | Firestore (PocketBase mirrors it) |
| Authentication | **Firebase Auth** (client) + Bearer ID-token verification in routes (`verifyUserUid` / `verifyUserContext` in `src/lib/notifications/server-utils.ts`, `isAdminUid` in `src/lib/server/admin-guard.ts`). Admin role also mirrored in a local PocketBase admin store | Firebase Auth |
| Media | Local-disk **ffmpeg media engine** (`src/lib/media/*`) with status sidecars, plus Cloudinary/Firebase storage helpers for legacy images | Local disk (server), Firestore for records |
| Events / attribution | **Growth Engine Phase 1** (`src/lib/growth/*`, `POST /api/events`): deduplicated, hashed-viewer `contentEvents` collection, TTL `expiresAt`, qualified-view threshold, `ref=` share attribution reusing `lib/referrals` code format | Firestore `contentEvents` |
| Notifications | web-push (`public/sw.js`, `src/lib/notifications/push-*`) + email provider (`src/lib/notifications/email-*`) | Firestore |
| Payments | PayPal + Paystack webhooks (`src/app/api/webhooks/*`), server-side order status routes | Firestore `orders` |
| Search | **Client-side only**: `src/app/search/page.tsx` downloads the whole `products` collection and filters in the browser | Firestore |
| Validation | `zod` (dependency present, used in forms and several routes) | — |
| Tests | `tsx --test src/tests/*.test.ts` (`npm test`), `npm run typecheck` | — |

## 2. Reusable services identified

- `verifyUserContext` / `verifyAdminUid` / `logSecurityEvent` — established authz + audit-trail primitives.
- Growth event spine (`src/lib/growth/events.ts` + `server.ts`) — validation, dedup doc-id, viewer hashing, retention, `withShareRef` share attribution. **The Core Engine events layer reuses this instead of creating a second event system.**
- `mirrorProduct` / `products/sync` — existing Firestore→PocketBase mirroring contract.
- `src/lib/server/admin-guard.ts` — admin authorization for the status API.
- Firestore rules pattern: server-only collections are declared `allow read, write: if false` (see `tiktok_connections`, `contentEvents`) — the same treatment is used for the new engine collections.

## 3. Identified risks (pre-existing)

1. **Search downloads the entire catalog to the browser** — unbounded read cost and poor SEO-adjacent performance as the catalog grows.
2. **No server-side representation of channel distribution** — nothing tracks whether a listing was prepared/submitted to any external channel, and there is no safe place to add one without inventing "published" claims.
3. **No opportunity/task or value-ledger model** — business-funded tasks and earnings have no schema, so future features would be built ad-hoc and risk inventing money.
4. Firestore rules: `userProfiles` has `allow read: if true` (documented, unchanged here — separate audit).
5. Environment: `EVENTS_SESSION_SECRET` may be unset on the VPS (falls back safely per Growth Phase 1 audit).

## 4. Source-of-truth decisions (unchanged)

- Canonical IDs: `products/{productId}`, `userProfiles/{uid}` (seller = `sellerId`), `orders/{orderId}`. The engine **references** these IDs; it never copies product/seller/user documents.
- New engine state lives in **new, additive Firestore collections written only by the Admin SDK**: `distributionJobs`, `opportunities`, `opportunityApplications`. Default-deny rules keep clients out (verified by tests); no existing rule or query changes.
- PocketBase: **not required** by the engine. If mirror support is wanted later, it follows the `/api/products/sync` contract.

## 5. Module layout (implemented)

```
src/lib/vidnov-core/
  types.ts            canonical entity refs, enums, shared types
  validation.ts       zod schemas for engine inputs (bounded, strict)
  distribution/
    channels.ts       channel registry, capability/credential metadata, status model
    job-utils.ts      pure: idempotent job ids, error sanitisation/classification, retry limits
    service.ts        job lifecycle: create (idempotent), transitions, retries, safe errors
  events/
    recorder.ts       server event recording over the growth spine (idempotent, observational vs verified)
  attribution/
    tracking.ts       tracked-link builder reusing the `ref=` referral format + channel ids
  opportunities/
    service.ts        schema + state machine + CRUD service (admin funder, applicant)
    types.ts          opportunity/application/review states
  trust/
    ledger.ts         ledger entry model + invariants (DESIGN ONLY — no writes, no payouts)
  catalog/
    search.ts         bounded server-side search over Firestore products/sellers
src/app/api/search/route.ts                      public, bounded search endpoint
src/app/api/opportunities/route.ts               GET list (public) / POST create (admin)
src/app/api/opportunities/[id]/apply/route.ts    POST apply (authenticated)
src/app/api/admin/core-engine/status/route.ts    GET status (admin only)
docs/vidnov-core-engine.md                       this document
src/tests/vidnov-core.test.ts                    tests
```

## 6. Distribution Hub design

- **States**: `not_configured → ready → queued → processing → submitted → live`, plus `failed` (retryable within limits) and `needs_attention` (human review). Adapter capability flags declare which states a channel can actually reach.
- **Honesty rule**: Google/Meta/TikTok adapters submit through each platform's **official API** (Merchant API `productInputs:insert`, Meta Catalog `items_batch`, TikTok Shop Create Product) and verify against a **real status source** (processed-product status, batch status, audit status). Without credentials `integrationStatus: 'not_configured'` ⇒ jobs stop at `ready` and no network call is made. A submit may only ever record `accepted`; `published` is claimed exclusively by a verify step reading the platform's status, and no code path claims `approved`/`indexed`.
- **Idempotency**: job doc id = deterministic hash of `(productId, channel, payloadVersion)` for "prepare once" jobs; caller-supplied `idempotencyKey` (validated) for explicit retries. Duplicate creates resolve to the same document — double-clicks cannot create two jobs.
- **Errors**: classified into `auth | validation | rate_limited | transient | not_configured | unknown`; stored as a short safe message + code, never raw upstream responses, tokens or URLs with credentials. Retry eligibility derives from the class, with `attempts < MAX_ATTEMPTS`.
- **Ownership**: job creation verifies the caller owns the product (`products/{id}.sellerId == uid`) or is admin.

## 7. Events & attribution design

- Reuses the growth spine's dedup/hash/retention helpers; engine event types are added as a separate, validated enum so browser-forged payloads still cannot invent server outcomes.
- Each event carries `origin: 'server' | 'client_observation'`. **Only `origin: 'server'` events (job succeeded/failed, order confirmed, task approved) may feed verified metrics.** Client observations never prove a sale or reward.
- Idempotent: deterministic event id for outcome events `(type, entityRef, day)` via the same dedupe helper — a retried job writes one outcome event, not two.
- Attribution: `attribution/tracking.ts` appends the **existing** `ref=<code>` parameter (`withShareRef` format) plus an optional `ch=<channel>` campaign id to product/shop links. Capture stays in the existing Growth Phase 1 arrival path; nothing new is trusted from the client.

## 8. Opportunity engine & ledger (safeguards)

- Opportunity states: `draft → open → closed → cancelled`. Application: `submitted → under_review → approved | rejected | withdrawn`. Completion: `evidence_ref` (string reference only — no file storage yet), review `pending → approved | disputed → resolved`.
- Budget is `amountMinor` (integer minor units) + explicit `currency` (ISO-4217, uppercase, 3 chars), validated as positive and bounded. Budget is a **funding declaration**, not a payable balance.
- **Ledger (`trust/ledger.ts`) is design-only**: entry kinds `funding_hold | reward_approved | fee | reversal | payout`; entries are immutable-by-convention (no update API exists), integer minor units, explicit currency, `idempotencyKey` unique per entry, double-entry style `accountId/from/to` references. **No endpoint creates entries; no payout is connected; existing wallet balances are untouched.**
- Production-enablement checklist is documented in the file header: verified funder KYC, server-side balance custody, webhook-verified funding, payout provider with reversal handling, admin approval separation, audit trail.

## 9. What was actually implemented (this change)

1. `src/lib/vidnov-core/**` modules as listed in §5.
2. Endpoints: `GET/POST /api/opportunities`, `POST /api/opportunities/[id]/apply`, `GET /api/search`, `GET /api/admin/core-engine/status`.
3. Bounded server-side search (`catalog/search.ts`) using Firestore `where`/`orderBy`/`limit` with a capped candidate window and substring scoring — **no new dependency, no search engine**. The live `/search` page is unchanged (still works); switching it to this endpoint is the documented next step (§12).
4. Tests in `src/tests/vidnov-core.test.ts` covering validation, state machines, idempotency, error classification, search bounds, authz expectations and rules deny-by-default for the new collections.
5. Smoke-tested the public endpoints on the local dev server: `GET /api/search?limit=999` → 400 (validation), unauthenticated `POST .../apply` → 401, admin status without a token → 403. Firestore-backed reads 500 **in the sandbox only** — the Admin SDK has no valid credentials here (the pre-existing `/api/system-status` health check logs the same `UNAUTHENTICATED` error). On the VPS the Admin SDK is credentialed; the unit suite exercises those code paths against injected fake Firestore instances instead.
6. No changes to: auth, payments, checkout, orders, products, discovery, storage, PocketBase, Firestore rules, `.env*`, `package.json`, or any production data.

## 10. Schema additions (documented, NOT applied anywhere)

New collections (Admin-SDK-only; adding the deny rules below is the only rules change proposed):

```
match /distributionJobs/{jobId}   { allow read, write: if false; }
match /opportunities/{oppId}     { allow read: if true;  allow write: if false; }  // reads via API only — may tighten to if false
match /opportunityApplications/{id} { allow read, write: if false; }
```

No indexes are strictly required for the bounded search as written. If the catalog outgrows the candidate window, the documented next step is a `searchTokens: string[]` field + composite index (`category` + `searchTokens`), applied with the existing deploy process — **not applied in this change**.

## 11. Security posture of the new surface

- Every endpoint: Bearer-token verification (`verifyUserContext`/`verifyAdminUid`) except `GET /api/search` (public data, but strictly bounded: ≤50 results, ≤2000-char query, capped scan window, no regex from user input).
- Admin endpoint returns counts and **boolean** integration flags only — never env values or credentials.
- Error responses: short safe messages; upstream errors classified, truncated, never logged with payloads.
- New collections are invisible to clients by default rules; a test asserts this.

## 12. Remaining work (explicitly not done)

1. Wire `src/app/search/page.tsx` to `GET /api/search` (removes the full-collection download).
2. Admin Core Engine status **UI page** — API is live; the page is a thin consumer (documented next step, skipped to avoid touching admin layout).
3. Apply the §10 rules additions (needs your approval + `firebase deploy --only firestore:rules`).
4. Real channel credentials/approvals (Google Merchant, Meta Commerce, TikTok Shop) before any adapter can leave `not_configured`.
5. Ledger enablement checklist (§8) before any money moves.
6. Search tokens + composite index if the bounded window becomes a real limit.
