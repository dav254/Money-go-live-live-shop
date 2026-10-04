# VIDNOV — Authentication & Communication System

This document is the operating manual for Vidnov's auth, password recovery,
notification and email systems. **No domain is hard-coded anywhere in the
application** — every link is built from `APP_URL` and every sender address
from `EMAIL_FROM` / role mailboxes. Moving from the development domain to
`vidnov.com` is a pure configuration + DNS change.

---

## 1. Architecture

```
                 VIDNOV EVENT (order, signup, booking, payment…)
                        │
        ┌───────────────┼───────────────┐
        ↓               ↓               ↓
     DATABASE        REAL-TIME        QUEUE (email service)
        │               │               │
        └───────────────┼───────────────┘
                        ↓
              COMMUNICATION ENGINE  (src/lib/notifications/)
                        │
        ┌───────────────┼───────────────┐
        ↓               ↓               ↓
     IN-APP          EMAIL (now)      PUSH (future)
   notifications
   (Firestore)
```

Key files:

| File | Role |
|---|---|
| `src/lib/notifications/config.ts` | Env-driven config: `APP_URL`, `EMAIL_FROM`, mailboxes, mode, provider. The **only** link builder (`appLink()`). |
| `src/lib/notifications/templates.ts` | 30+ inert templates with `{{var}}` placeholders. |
| `src/lib/notifications/renderer.ts` | Safe whitelist substitution — no code execution, HTML-escaped. |
| `src/lib/notifications/email-provider.ts` | Provider abstraction: `resend`, `postmark`, `sendgrid`, `console`. |
| `src/lib/notifications/email-service.ts` | Central send entry point: rendering, dev capture, rate limits, delivery log. |
| `src/lib/notifications/engine.ts` | `notify()` — in-app + email fan-out in one call. |
| `src/lib/notifications/server-utils.ts` | Token hashing, device labels, admin verification, security events. |
| `src/app/api/auth/*` | forgot-password, reset-password, sessions, welcome, notify-password-changed. |
| `src/app/api/admin/communication/route.ts` | Admin-only email logs / dev mailbox / templates API. |

Firestore collections added:

- `notifications` — in-app notifications (`userId, type, category, title, message, entityType, entityId, link, isRead, readAt, createdAt`). Legacy docs using `status/timestamp` are still displayed.
- `emailLogs` — delivery log (`QUEUED / SENDING / SENT / DELIVERED / FAILED / BOUNCED`).
- `devMailbox` — dev-mode email capture (only when `EMAIL_MODE=development`).
- `passwordResetTokens` — **hashed** one-time tokens with expiry + attempt counters. Raw tokens are never stored.
- `passwordResetRequests` — IP rate-limit bookkeeping for forgot-password.
- `userSessions` — device/session registry for Settings → Security.
- `securityEvents` — audit trail (reset requests, new devices, logouts).

---

## 2. Environment variables

Add these in the platform **Settings → Environment** (sandbox) and
`freebuff-deploy env set` (production). Never commit secrets.

| Variable | Required | Purpose |
|---|---|---|
| `APP_URL` | ✅ | Absolute base URL for **every** generated link (reset, verification, email CTAs). Dev: your current domain. Prod: `https://vidnov.com`. |
| `EMAIL_FROM` | ✅ | Default From address, e.g. `customer@your-domain` → later `customer@vidnov.com`. |
| `EMAIL_MODE` | ✅ | `development` (default — capture only) or `production` (real sends). |
| `EMAIL_PROVIDER` | prod | `resend` \| `postmark` \| `sendgrid`. |
| `EMAIL_API_KEY` | prod | Provider API key. |
| `EMAIL_REPLY_TO` | opt | Defaults to the support mailbox. |
| `SUPPORT_EMAIL` | opt | Overrides `support@<domain>` role mailbox. |
| `BUSINESS_EMAIL` / `PAYMENTS_EMAIL` / `ADMIN_EMAIL` | opt | Overrides the other role mailboxes. |
| `EMAIL_DEV_INBOX` | opt | (Reserved) funnel all dev mail to one inbox. |

Role mailboxes are derived from configuration, never hardcoded:

```
customer@<domain>  → account communication (EMAIL_FROM)
support@<domain>   → general support (default sender)
business@<domain>  → business communication
payments@<domain>  → payment communication
admin@<domain>     → restricted administrative communication
```

---

## 3. Development email mode (test without sending)

Default mode. Nothing leaves the server:

1. Trigger any email — e.g. forgot-password, signup welcome, password change.
2. Open **Admin → Communication → Dev Mailbox** to read captured messages
   (subject, recipient, rendered body).
3. Every capture is also recorded in **Email Logs** marked `DEV`.

Flip to production by setting `EMAIL_MODE=production` plus `EMAIL_PROVIDER`
and `EMAIL_API_KEY`.

---

## 4. Password reset flow (implemented)

```
Forgot password → POST /api/auth/forgot-password
  ├─ IP rate limit (5/hour)          ← passwordResetRequests
  ├─ token = crypto.random(32B)      ← raw token ONLY in the email link
  ├─ store sha256(token), 60-min TTL, single-use
  ├─ invalidate previous tokens
  └─ send password-reset template    ← generic response ALWAYS

Reset → POST /api/auth/reset-password
  ├─ hash lookup + expiry + attempt cap (5)
  ├─ admin SDK updateUser(password)
  ├─ burn token (usedAt)
  ├─ revokeRefreshTokens → other sessions die
  └─ password-changed email + security event
```

Security properties: cryptographically random tokens, hashed at rest,
short-lived, single-use, brute-force capped, rate-limited per IP and per
mailbox, generic messaging (no account enumeration), old sessions revoked,
confirmation email sent **after** the change.

The Firebase Auth email template can also be used directly
(`sendPasswordResetEmail` from the client SDK); the custom flow above exists
so Vidnov controls branding, links and logging.

---

## 5. Sessions & devices

- `POST /api/auth/sessions` registers/refreshes the current device and emails
  a **new-login alert** when an unknown device appears.
- `GET /api/auth/sessions` lists devices for Settings → Security.
- `DELETE ?sessionId=…` logs out one device; `?allOthers=1` logs out the rest.
- Password changes revoke refresh tokens (Firebase) and clean the registry.

UI: `/dashboard/security` (linked from the seller sidebar and user menu).

---

## 6. Email preferences

Stored on `userProfiles/{uid}.emailPrefs`. Security/account-recovery mail is
**always** sent (mandatory category in `config.ts`); everything else is
toggleable per category (orders, bookings, messages, payments, AI Studio,
media, business, marketing). The Security page writes prefs with a merge —
no server round-trip needed for reads.

---

## 7. Admin Communication Center

`/dashboard/admin/communication` (sidebar: **Communication**):

- **Email Logs** — recipient, sender, subject, template, status, provider id,
  failure reason, time. Filterable by status. Bodies are intentionally **not**
  exposed in the logs list.
- **Dev Mailbox** — read dev-captured mail with rendered preview.
- **Templates** — the full catalog with variables.
- **Settings** — the live engine configuration read from env.

Access control: the API (`/api/admin/communication`) verifies a Firebase ID
token **and** `userProfiles/{uid}.userRole === 'admin'` server-side on every
request. The page additionally requires the admin layout.

---

## 8. DNS checklist (when vidnov.com is connected)

Website (registrar → VPS):

```
A     @    → <VPS IP>
A     www  → <VPS IP>
```

Email — use **exactly** the records your provider supplies (do not invent
values). Typical set:

```
MX    @    → provider mail servers (priority as specified)
TXT   @    → "v=spf1 include:<provider-spf> ~all"
CNAME/TXT     provider DKIM keys (per-record)
TXT   _dmarc  "v=DMARC1; p=quarantine; rua=mailto:admin@vidnov.com"
```

Providers with good transactional APIs: **Resend** (simplest), **Postmark**
(best deliverability support), **SendGrid**. Do not run your own MTA on the
Vidnov VPS.

---

## 9. Production go-live checklist

**Authentication**
- [ ] Registration / login / logout verified on the production domain
- [ ] Forgot + reset password flow end-to-end (real email received)
- [ ] New-device alert received; sessions page lists devices
- [ ] Password change revokes other sessions
- [ ] Admin routes protected (403 for non-admins on `/api/admin/*`)

**Communication**
- [ ] `EMAIL_MODE=production`, provider + key set, test send received
- [ ] SPF / DKIM / DMARC pass (check with provider's verifier)
- [ ] Welcome / verification / reset / password-changed templates verified
- [ ] Email Logs recording; failures visible in Admin Center

**Domain**
- [ ] `APP_URL=https://vidnov.com`, `EMAIL_FROM=customer@vidnov.com`
- [ ] A records for `@` + `www` point at the VPS
- [ ] HTTPS certificate issued and auto-renewing
- [ ] No `vidnov.com` literals needed in code — grep to confirm zero

**Security**
- [ ] Secrets only in environment (never in git)
- [ ] Firestore rules restrict `notifications`, `emailLogs`, `userSessions`,
      `passwordResetTokens` to owner/admin reads
- [ ] Rate limits active; admin endpoints verify role server-side
