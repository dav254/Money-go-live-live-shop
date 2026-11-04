# Orbit — the Vidnov side of the AI headquarters

Paperclip runs the company. Hermes executes tasks. **Orbit is the only door
into Vidnov**, and it is the piece that lives in this repository.

This document covers what exists in code today, how to connect it, and what is
still missing. The VPS installation of Paperclip and Hermes itself is in
[`RUNBOOK.md`](./RUNBOOK.md) — that part cannot be done from a workspace
sandbox; it needs the server.

---

## 1. What Orbit is (and is not)

| Is | Is not |
|---|---|
| An authenticated HTTP bridge for registered agents | A second publishing engine |
| A scope-checked read layer over safe aggregates | A Firestore credential handed to an agent |
| A proposal + approval workflow tied to exact parameters | An executor of those proposals |
| A record of which machine identity did what | A replacement for Paperclip's own audit |

Agents can **read** status, marketplace aggregates and Social Engine readiness,
and **prepare** campaigns, content and investigations. They cannot publish,
spend, deploy, restart, delete or change credentials — those exist only as
proposals a human decides on.

---

## 2. Endpoints

All agent routes take `Authorization: Bearer orb_<agentId>_<secret>`.

| Method | Path | Scope | Returns |
|---|---|---|---|
| GET | `/api/orbit/status` | `status:read` | own identity, model state, platform-level Social Engine counts |
| GET | `/api/orbit/marketplace?days=30` | `marketplace:read` | counts (shops, listings, requests, offers, orders) + growth funnel |
| GET | `/api/orbit/social` | `social:read` | per-platform readiness, missing env **names**, approval state |
| GET | `/api/orbit/proposals` | any valid token | the caller's own proposals only |
| POST | `/api/orbit/proposals` | scope per kind | files a pending proposal |
| GET | `/api/orbit/tasks` | `tasks:read` | the caller's own runs + a status/usage roll-up |
| POST | `/api/orbit/tasks` | `tasks:report` | records one execution of one task |
| GET/POST | `/api/admin/ai-headquarters` | admin session | console: overview; create agent, enable/disable, decide |

Scope per proposal kind: `campaign:prepare`, `content:prepare`,
`investigation:prepare`, `publish:propose`.

---

## 2b. The worker ledger — how a run becomes evidence

Paperclip assigns a task; Hermes executes it; Hermes reports the run here.
A run is keyed by `(taskKey, attempt)`:

```bash
# 1. picked up (visible while it runs)
curl -sS -X POST https://vidnov.com/api/orbit/tasks \
  -H "Authorization: Bearer $VIDNOV_ORBIT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"taskKey":"PC-1042","title":"Prepare seller invitations","status":"running","mock":true}'

# 2. finished, with a bounded structured result
curl -sS -X POST https://vidnov.com/api/orbit/tasks \
  -H "Authorization: Bearer $VIDNOV_ORBIT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"taskKey":"PC-1042","title":"Prepare seller invitations","status":"completed",
       "summary":"20 drafts, 3 campaign links, nothing sent",
       "result":{"drafts":20,"links":3,"sent":0},"mock":true,
       "model":{"provider":"gemini","name":"gemini-2.5-pro","tokensIn":1200,"tokensOut":420,"costUsd":0.0031}}'
```

Rules that make this trustworthy:

- **An attempt may progress, never rewrite.** `running` → `completed` updates
the same row; once terminal (`completed`/`failed`/`cancelled`) a retry gets the
stored row back with `duplicate: true`. After a crash, a resume is `attempt: 2`
— history is appended, never overwritten.
- **Own rows only.** There is no parameter for whose run it is: the agent comes
from the credential.
- **No credentials in results.** Keys matching token/secret/password/api-key are
rejected, and results are capped at 4 KB.
- **`mock` is declared, not inferred.** Nothing in the console turns a mock run
into AI output; usage totals stay `null` until a run reports real token counts.
- **Daily cap** of 400 reported runs per agent, so a crash loop cannot fill the
ledger.

The console shows the runs, their status, their duration and whether each was
mock, which is what makes requirement "report failed, delayed and completed
tasks" true rather than asserted.

---

## 2c. Proving the integration (do not trust two running processes)

```bash
COMPANY_ID=<paperclip-company-id> ORBIT_TOKEN=orb_… ORBIT_BASE=https://vidnov.com \
  bash ops/ai-headquarters/verify-integration.sh
```

It checks the Paperclip health endpoint, `hermes doctor`, **the approved
`hermes_gateway` join** (the actual adapter link), Orbit credential acceptance,
anonymous and forged-secret rejection, a real worker report + idempotent replay,
secret-parameter rejection, the approval queue, and finally restarts Hermes and
re-reads history and the credential. It prints PASS/FAIL and exits non-zero on
any failure.

---

## 3. Managing agents

Admins use **Dashboard → Admin → System → AI Headquarters**
(`/dashboard/admin/system/ai-headquarters`).

The credential is shown **once** at registration. Vidnov stores only
`sha256(secret)`, so a lost token is replaced, never recovered. Disabling an
agent takes effect on its very next request.

```bash
# Register an agent (admin session token required)
curl -sS -X POST https://vidnov.com/api/admin/ai-headquarters \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"action":"create_agent","name":"Growth Agent","department":"growth",
       "role":"seller acquisition","scopes":["status:read","marketplace:read","campaign:prepare"]}'
```

---

## 4. Connecting Hermes / Paperclip

Hermes needs no Vidnov code: give its tool layer two HTTP calls and the agent's
Orbit credential.

```yaml
# ~/.hermes/config.yaml (VPS, inside the hermes container/user)
tools:
  http:
    allow:
      - "https://vidnov.com/api/orbit/status"
      - "https://vidnov.com/api/orbit/marketplace"
      - "https://vidnov.com/api/orbit/social"
      - "https://vidnov.com/api/orbit/proposals"
```

Store the credential in Hermes' own env file (never in a task prompt, never in
Paperclip's task description):

```bash
# /opt/ai-hq/hermes-data/.env  (inside the container volume)
VIDNOV_ORBIT_TOKEN=orb_xxxxxxxxxxxxxxxxxx_yyyyyyyyyyyyyyyyyyyy
```

Recommended agent toolsets, matching the permissions Vidnov actually grants:

| Paperclip agent | Orbit scopes | Hermes toolsets |
|---|---|---|
| AI Operations Director | `status:read`, `social:read` | `memory,todo,web,search` |
| Growth & Marketing | `status:read`, `marketplace:read`, `status`, `campaign:prepare`, `content:prepare`, `publish:propose` | `web,search,file,memory,todo` |
| Engineering | `status:read`, `investigation:prepare` | `terminal` (container only), `file,web,search,memory` |

An agent holding `publish:propose` still cannot publish: it can only file a
proposal that a founder must approve **and** then run through
`/api/social-engine/*` with an admin session.

---

## 5. The approval contract

1. The agent posts a proposal: `kind`, `title`, `summary`, `action.type`,
   `action.params`.
2. Orbit validates the scope for that kind, rejects any parameter whose name
   looks like a credential, and freezes the action into a SHA-256 digest.
3. The founder sees the digest in the console.
4. Approving sends the digest back. If the stored action no longer hashes to
   that digest, approval is **refused** (`409 conflict`) rather than approving
   a different action.
5. `approvedDigest` is recorded with `decidedBy` and `decidedAt`. A proposer
   may never approve their own proposal.
6. Approval runs nothing. The human still executes the action through its
   normal, guarded route — for publishing, the Social Engine's publish test
   (which itself requires explicit confirmation and the approval attestation).

Limits: 30 proposals per agent per day, 10 s between proposals, 8 KB per
action, 160-char titles.

---

## 6. Data exposure

`GET /api/orbit/marketplace` returns **counts and funnel aggregates only**.
There is no buyer name, email, phone, address, message, payment reference,
seller credential, token or env value anywhere in the response. Every number
is `number | null` — `null` means "could not be read", never a fabricated zero.

`GET /api/orbit/social` returns env variable **names** and readiness states. It
never returns a token, a connection secret or an upstream error body.

Firestore rules deny `ai_hq_agents`, `ai_hq_proposals`, `ai_hq_audit` and
`ai_hq_meta` to every client; all access is Admin-SDK only, behind the routes
above.

---

## 7. Model configuration

Until a real provider is connected the console shows **MODEL_NOT_CONFIGURED**
and `/api/orbit/status` reports the same. Set these on the VPS when you have a
key:

```bash
HERMES_MODEL_PROVIDER=gemini          # or openai, anthropic, nous-portal
HERMES_MODEL=gemini-2.5-pro
HERMES_MODEL_API_KEY=<the key>
```

Only presence is checked; the value is never read into a response or a log. A
provider that does not match a safe identifier is reported as `custom` rather
than echoed back.

---

## 8. What is verified, and what is not

Verified in this repository (tests + build):

- agent creation, hashing, constant-time verification, disable/revoke,
- scope enforcement per route and per proposal kind,
- digest binding, self-approval refusal, secret-parameter rejection,
- proposal cooldown and daily cap,
- model state honesty,
- every `/api/orbit/*` route passes through the guard,
- Firestore rules deny all five headquarters collections,
- the worker ledger: idempotent attempts, resume-appends, own-rows-only,
  secret and size rejection, usage summed or `null`, and a full mock chain
  (task → run → proposal → founder queue → approval → restart) in
  `src/tests/ai-headquarters.test.ts`.

Not verified here, because it needs the server:

- Paperclip and Hermes installation, the `hermes_gateway` join, a real task
  handoff, restart recovery, and one real model round trip.

Those are covered by PHASE 2–5 and the acceptance table in `RUNBOOK.md`.
