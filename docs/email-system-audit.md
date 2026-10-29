# Vidnov Email System — Stage 1 Audit

_Last updated: 2026-10-29 (Freebuff workspace). Every claim here is marked
verified (with how it was checked) or open (needs a check on the VPS). No
secret values were read or printed for this audit; only env key NAMES and
public DNS were inspected._

## 1. Current state — verified

### Sending pipeline (already exists, central)

| Piece | Where | State |
|---|---|---|
| Single entry point `sendTemplateEmail` | `src/lib/notifications/email-service.ts` | Exists. Renders template → provider → logs to `emailLogs` (PocketBase-first, Firestore fallback). |
| Provider abstraction | `src/lib/notifications/email-provider.ts` | `console`, `resend`, `postmark`, `sendgrid`. Resend via `EMAIL_PROVIDER=resend` + `EMAIL_API_KEY`. |
| Template registry | `src/lib/notifications/templates.ts` | 39 templates (account, orders, payments, support, AI, growth…). |
| Renderer | `src/lib/notifications/renderer.ts` | Safe `{{var}}` substitution, HTML-escaping, link anchors, conditionals. **Text-first: HTML is a crude `<br/>` conversion, not branded/responsive.** |
| Rate limiting | email-service | Per-recipient bucket: 30/hour, 120/day (in-memory, per instance). |
| Dev capture | `EMAIL_MODE=development` (the default) | Mail is captured to `devMailbox` and **never sent** — logged `provider: 'dev-mailbox', devMode: true`. |
| Admin surfaces | `/dashboard/admin/system/email` (status + test send), `/dashboard/admin/communication` (log list) | Exist, admin-gated (`verifyAdminUid`). |
| Auth flows | `forgot-password` (hashed single-use tokens, IP rate limit, generic responses), `reset-password`, `notify-password-changed` | Exist and are sound. |

### Environment key names (values never read)

- `.env.local`: `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_MODE`, `NEXT_PUBLIC_SITE_URL` — provider credentials are present **in the sandbox**.
- `.env`: `EMAIL_MODE`, `EMAIL_FROM`, `SUPPORT_EMAIL`, `APP_URL`.
- **Absent everywhere:** `EMAIL_WEBHOOK_SECRET` (no webhook configured), `EMAIL_DEV_INBOX`, anything named `RESEND_API_KEY`.

### DNS (verified live via DNS-over-HTTPS, 2026-10-29)

| Record | Value | Meaning |
|---|---|---|
| MX | `10 eforward1-5.registrar-servers.com` | **Namecheap eForwarding** — a forwarding service, not a mailbox host. Inbound mail is forwarded somewhere else (destination to be confirmed by you). |
| TXT (SPF) | `v=spf1 include:spf.efwd.registrar-servers.com ~all` | **Authorizes only Namecheap forwarding — Resend is NOT in SPF.** Mail sent via Resend fails SPF (softfail). |
| TXT `resend._domainkey` | RSA key present | **Resend DKIM is published → the domain is verified in Resend.** |
| `_dmarc.vidnov.com` | **NXDOMAIN** | **No DMARC record at all.** |

## 2. Likely cause of the previously missing email (ranked)

I cannot read the VPS environment or PM2 logs from this workspace, so these
are ranked by probability with the exact check for each:

1. **`EMAIL_MODE` is not `production` on the VPS** (it defaults to
   `development`). Symptom: the send "succeeds" and appears in the admin log
   with `provider: dev-mailbox / devMode: true`, but nothing leaves the
   server. *Check on VPS:* `grep -E '^(EMAIL_MODE|EMAIL_PROVIDER|EMAIL_FROM)=' /root/app/.env.production /root/app/.env` (these three are not secrets).
2. **`EMAIL_PROVIDER` / `EMAIL_API_KEY` missing on the VPS.** The provider
   silently falls back to the `console` provider which logs the mail and
   returns `accepted: true` — the log says `SENT` while **nothing was sent**.
   This is an honesty hole in the current code and is fixed in Stage 2.
   *Check:* same grep, plus the admin Email Delivery page's "required keys" row.
3. **Provider rejected the API call** (bad key, wrong from-address).
   *Check:* admin → Communication → email-logs, status `FAILED`,
   `failureReason` shows `resend <status>: …`.
4. **Accepted by Resend but landed in spam or was filtered.** Plausible given
   SPF does not authorize Resend and DMARC is absent — DKIM passes, but
   reputation signals are weak. *Check:* Resend dashboard → Emails → status;
   and fix DNS per §5.
5. **Recipient-side problem** (typo address, Namecheap forward destination
   full/blocked). *Check:* Resend dashboard delivery status per message.

Dead code found: `src/app/actions/email-actions.ts` `sendMarketingEmail` is a
placeholder that **returns success without sending** (real body commented
out, wrong key name `RESEND_API_KEY`). It has no callers today; it must never
be wired up as-is.

## 3. Feature gaps vs. the specification (what Stage 2 builds)

1. **No delivery webhooks** — status stops at `SENT`; nothing ever becomes
   `DELIVERED` / `BOUNCED` / `DELAYED`, and nothing suppresses hard bounces.
2. **Console-provider fallback lies** — `accepted: true` with no send.
3. **No retry of transient failures**, no durable outbox, no backoff.
4. **No dedupe/cooldown** on welcome/verification sends (reset already has
   IP rate limiting + token invalidation).
5. **No real email-verification flow.** `verify-email` template has zero
   callers; the welcome email says "Confirm your email: {{verification_link}}"
   but the caller never passes `verification_link`, so **the link renders
   empty**.
6. **Templates are plain text rendered to crude HTML** — not the premium
   responsive black/coral design required.
7. **Support tickets** (client-written Firestore `supportTickets`) send no
   acknowledgement and no admin notification.
8. **No inbound inbox** — Step 4 (see §4).

## 4. Recommended inbox approach (Step 4) — needs your choice

Verified facts from current provider documentation:

- **Resend now supports inbound receiving** (API + webhooks + dashboard),
  but its own docs warn **not to put its receiving MX at the root alongside
  another provider's MX**, and the `email.received` webhook is metadata-only —
  the body must be fetched with the Receiving API. Inbound messages also
  consume the same quota (Free: 3,000/mo combined, 100/day).
- Current root MX is **Namecheap eForward** (forwarding only — no storage,
  no threads, no reply API).

| Option | Cost | Real inbox? | Change needed |
|---|---|---|---|
| **Zoho Mail Free** (recommended starter) | $0 (5 users, 1 domain, 5 GB; region-dependent; free excludes IMAP — API is a paid-plan concern) | Yes — webmail for `support@`, `business@`, `payments@`, `admin@` | MX → Zoho; combined SPF; DKIM (Zoho) added alongside Resend's |
| Microsoft 365 shared mailbox | from ~$5.40–7/user/mo (shared mailbox itself unlicensed, 50 GB) | Yes — best true shared-inbox model | MX → Microsoft; combined SPF |
| Forward Email Enhanced | $3/mo (10 GB, webmail, send+receive) | Yes | MX → Forward Email |
| MXroute | $59/yr (10 GB, unlimited domains) | Yes (Roundcube/IMAP) | MX → MXroute |
| Resend Receiving (app-side inbox) | Free tier quota shared with sends | Developer inbox only — we would have to build the thread/reply UI | Receiving MX on **`inbound.vidnov.com` only**, never root |
| Self-hosted SMTP on the VPS | $0 extra | Technically possible | **Not recommended**: port-25 blocks on cloud providers, PTR/reverse-DNS, spam filtering, 24/7 ops burden |

**My recommendation:** keep Resend for sending; put **Zoho Mail Free** at the
root MX for the four human addresses; if you later want the app itself to
parse inbound mail, add Resend receiving on `inbound.vidnov.com` — never on
the root. A DB page of contact-form submissions alone would **not** count as
the inbox you asked for, and I won't build one as a substitute.

## 5. DNS risks (nothing will be changed without your approval)

Current state: SPF exists (Namecheap only, `~all`), Resend DKIM published,
**no DMARC**.

Proposed changes — **documented only, not applied**:

1. **One combined SPF** for `vidnov.com`, e.g.
   `v=spf1 include:spf.efwd.registrar-servers.com include:<resend-spf> include:<zoho-spf> ~all`
   — exact `include:` values copied from each provider's dashboard. **Never
   publish a second SPF TXT record**; two SPF records = `permerror` = broken
   authentication for everyone.
2. **DKIM:** keep `resend._domainkey` untouched; add the inbox provider's own
   DKIM record under a *different* selector (they coexist; never overwrite
   each other's selector).
3. **DMARC:** add `_dmarc.vidnov.com` starting at
   `v=DMARC1; p=none; rua=mailto:dmarc@vidnov.com`, review reports, then
   tighten to `quarantine`/`reject` later.
4. **MX swap is the risky one:** replacing eForward MX with the inbox
   provider's MX cuts off any address currently forwarding. Rollback plan =
   restore the five `eforward*.registrar-servers.com` records (documented
   above, TTL 1800). Sequence: create the inbox provider account and
   destinations FIRST, test with a temporary low-priority MX or during a
   short window, then cut over.
5. HTTPS, website routing and the Resend verified domain are untouched by
   all of the above.

## 6. Costs and manual account actions required

- **You:** decide the inbox provider (Zoho Free vs Microsoft vs other);
  create the account; approve the DNS edits; add `EMAIL_WEBHOOK_SECRET` after
  creating the webhook in Resend's dashboard; confirm VPS `EMAIL_MODE`.
- **Resend:** Free plan (3,000/mo combined, 100/day, 3 domains, 1 webhook
  endpoint) is likely enough at launch; Pro $20/mo when outgrowing it.
- **Zoho Mail Free:** $0 (if available in your region; otherwise Mail Lite
  from about $1/user/mo).

## 7. Verification status

- Verified here: code paths (read directly), env key names (`freebuff-env list`),
  live DNS (DoH queries), template registry, auth flows, admin surfaces.
- **Not verifiable from this workspace:** VPS `.env.production` values, PM2
  logs, Resend dashboard delivery records, and real send/receive tests — the
  exact commands and manual steps for each are in the final delivery report.
