# Business Discovery Agent — plan (DESIGN ONLY)

Status: **proposed, not implemented, not funded, not launched.**
This document is the review artifact for the *next* piece of work after the Core
Engine release. Nothing in this file ships code. It must not be started until
the Core Engine release is approved, and it needs its own separate review.

The goal: find real businesses that should be on Vidnov, verify they exist and
are reachable, and invite them — with an admin in the loop for every outbound
message, and with an auditable record of where each lead came from.

---

## 1. What we are deliberately NOT doing

- **No scraping of platforms that forbid it**, no purchased/warehoused lead
  lists, no data brokers, no "enrich everything" APIs. Sources must be
  permitted (see §3).
- **No automated sending.** No message leaves the system without an admin
  approving the exact recipient, channel and text (§5).
- **No fake scarcity or impersonation.** Outreach identifies Vidnov as the
  sender and never claims an existing relationship.
- **No new source of truth for products/sellers.** The agent only *proposes*
  candidates; a business becomes real in Vidnov only when a human or an
  existing seller flow creates it.
- **No money surface.** Leads, approvals and invitations carry no amounts, no
  balances and no ledger entries (the ledger remains design-only).

## 2. Architecture (fits the Core Engine, adds one new store)

```
collector (bounded, scheduled, server-only)
    → leadCandidates      ← DEDICATED lead store (new, server-only)
    → admin approval queue (UI + API, admin-guarded)
    → approved invites    → outreach log (append-only, auditable)
    → outcome events      → existing contentEvents spine (core vocabulary)
```

- **Dedicated lead store:** a new server-only Firestore collection
  `businessLeads` (+ `businessLeadOutreach` for the append-only send log).
  Read/write: Admin SDK only, exactly like `distributionJobs` /
  `opportunityApplications`. Firestore rules: default-deny (no client rule) —
  proposed alongside the existing §10 rules additions and **not applied until
  separately approved**.
- **Reuse, don't duplicate:**
  - admin authorization: `verifyAdminUid` / `verifyUserContext`
    (`src/lib/notifications/server-utils.ts`);
  - validation: zod schemas in the style of `src/lib/vidnov-core/validation.ts`
    (strict, bounded, no unknown keys);
  - events: `recordCoreEvent` with a new `origin: 'server'` type and a
    dedupe key, so outcome metrics stay in ONE spine;
  - audit: `logSecurityEvent` for every approval/rejection/send;
  - idempotency: deterministic document ids (one candidate per
    `(source, externalId)`; one invite per `(leadId, campaign)`).

## 3. Permitted business-data sources (allowlist, reviewed individually)

| Source | Why permitted | Capture |
|---|---|---|
| A. Vidnov's own data | Sellers who already exist but have incomplete shops | profile/product completeness signals already in Firestore |
| B. Opted-in referrals | A seller invites a business ("know a supplier?") | existing referral code format (`ref=`), double opt-in |
| C. Public official registers / open data | Government or municipal business registers that publish open licensing | batch import with licence recorded per record |
| D. Direct, user-initiated submissions | A business submits itself via a public "Claim your business" form | self-serve; no agent needed |
| E. Official partner/API feeds | Contracts that explicitly permit outreach | API-only, rate-limited, contract recorded |

Everything else is **out of scope by default**. Adding a source is a reviewed
change: licence/terms check, retention limit, and a documented field list.

Per-source record: `source`, `sourceLicence`, `collectedAt`, `externalId`,
`evidenceUrl` (a link to where the public data came from), `expiresAt`.

## 4. Lead store schema (proposed)

```
businessLeads/{leadId}            // deterministic id: hash(source + externalId)
  source: 'self_submit' | 'referral' | 'register' | 'partner_api' | 'own_catalogue_gap'
  sourceLicence: string
  externalId: string
  businessName, category, city?, country?
  contact: { email?, phone?, website? }        // minimised, never public
  evidenceUrl?: string
  status: 'new' | 'queued_for_review' | 'approved' | 'rejected' | 'contacted'
          | 'claimed' | 'expired'
  review: { by: uid, at: ts, reason?: string } // admin only
  dedupeKey: string                            // normalised name + location
  collectedAt, expiresAt
  createdBy: 'agent' | 'admin' | 'seller' | 'self'

businessLeadOutreach/{id}          // append-only; never updated in place
  leadId, channel: 'email' | 'none', templateId, approvedBy, sentAt,
  providerMessageId?, outcome: 'sent' | 'bounced' | 'opt_out' | 'failed',
  campaignId?
```

Retention: unapproved leads expire (suggested 90 days) and are deleted by a
documented cleanup job; opted-out contacts are suppressed permanently.

## 5. Admin approval queue and compliant outreach controls

- Queue UI in the admin dashboard (`/dashboard/admin/...`), same
  `AdminLayout` + Bearer-token API pattern as the Core Engine status and
  opportunity-review pages.
- Every candidate shows its **source, licence, evidence link and capture
  date** before an admin can approve it. Hidden source = not approvable.
- Approve/reject are explicit, transactional, idempotent (repeat decision =
  `changed:false`), audited with `logSecurityEvent`.
- Send requires a **separate** approval action with the exact rendered
  message; nothing auto-sends. Approved-but-unsent is the default state.
- Compliance controls:
  - opt-out list checked before every send (hard suppression);
  - frequency cap per business and per source;
  - one template at a time, reviewed text, no misleading subject lines;
  - sender identity and a working opt-out/claim link in every message;
  - full append-only log of who approved what and when;
  - kill switch (a config flag that refuses all sends without code changes).
- Delivery provider (when we get there): chosen through a dedicated search at
  implementation time, wired as a server action with the key read from the
  server environment only — **not part of this release**.

## 6. Measurement (real events only)

Recorded through the existing spine, `origin: 'server'` only:

- `lead_collected`, `lead_approved`, `lead_rejected`
- `lead_invited`, `lead_opted_out`
- `business_claimed` (the actual conversion: a business signs up and claims a
  shop)

No invented contact rates, no "estimated reach". Denominators come from the
lead store counts, not from estimates.

## 7. Build order (each step separately reviewable)

1. Schema + collector for ONE source (self-submits and catalogue gaps — no
   external data at all) + default-deny rules proposal.
2. Admin approval queue (UI + API + audit).
3. Opt-out/suppression store and frequency caps.
4. Second source only after the licence review in §3 is written down.
5. Outreach sending (provider integration, templates, kill switch) — last, and
   only after §5's controls exist.

## 8. Exit criteria before any outbound message

- [ ] Lead store + rules reviewed (default-deny for clients)
- [ ] Every source documented with licence/ToS basis
- [ ] Approval queue live with audit trail
- [ ] Opt-out + frequency caps enforced server-side
- [ ] Kill switch verified
- [ ] Separate approval for a *pilot* batch (e.g. 20 leads) before scale

## 9. Explicitly out of scope for now

Implementation of any of the above, provider contracts, sending, scraping,
purchased data, and any change to Firestore rules or production data.
