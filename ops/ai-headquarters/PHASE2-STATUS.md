# Phase 2 status — what is proven, and what is still missing

Written 2026-11-04. This is the honest scoreboard, not a sales page.

Two environments matter here:

- **This repository** — code, tests, build. Everything below marked *proven*
  was executed here and can be re-run with `bunx tsx --test …`.
- **The production VPS** — Paperclip and Hermes processes, their database,
  their network. Nothing in this file claims those are running, because they
  are not: no install was possible from the workspace, and no deployment was
  made.

## Component status

| Component | Status | Why |
|---|---|---|
| Orbit (Vidnov bridge) | **TESTED** (in repo) | 31 tests, typecheck, production build. Not deployed → not yet reachable from a VPS. |
| Agent registry / scopes / approvals | **TESTED** | Digest binding, self-approval refusal, scope denial, revocation, secret rejection. |
| Worker run ledger (`/api/orbit/tasks`) | **NEW, TESTED** | Idempotent attempts, resume-appends, own-rows-only, usage accounting. |
| Founder console | **CONFIGURED** | Departments, agents, proposal queue, worker runs, model banner. Needs a live Firestore to render. |
| Social Engine | **CONFIGURED** | 14 modules, encrypted connections, honest readiness, gated publishing (81 tests). Platform credentials live only on the VPS. |
| Paperclip | **NOT INSTALLED** | Needs Node 24.11+/PostgreSQL or Docker on the VPS. |
| Hermes | **NOT INSTALLED** | Needs its own runtime/container on the VPS. |
| Paperclip ↔ Hermes adapter | **NOT CONNECTED** | Requires both running; approval gate is the founder's. |
| AI model | **MODEL_NOT_CONFIGURED** | No provider key, by design. Nothing anywhere pretends otherwise. |

## Requirements 1–9

| # | Requirement | Where it stands |
|---|---|---|
| 1 | Paperclip as HQ: departments, assignment, status, deadlines, budgets, reports, founder dashboard | Paperclip is the owner of that data and is **not installed**. Orbit already exposes the Vidnov-side equivalents it can: 8 departments, a founder dashboard, run status incl. `failed`/`delayed`, and usage/cost totals per run (`null` until measured). Assignment and deadlines stay in Paperclip — deliberately not duplicated. |
| 2 | Hermes as a managed worker | **Not installed.** The contract it needs is ready: receive a task, use only allowlisted tools, report a structured result here, resume as `attempt: N`. The *permission ceiling* is enforced by Orbit (scopes), not by trusting the worker. |
| 3 | Orbit bridge | **Built and tested.** Five routes + admin API, reuse of the existing credential/scope/approval design. No duplicate bridge was created. |
| 4 | Social Engine for agents | **Built.** Agents can read all module readiness states, missing env **names**, connection/diagnostic outcomes, and file campaign/post/link/publish proposals. They cannot publish; publishing still needs the existing approval + confirmation path and an admin session. |
| 5 | Marketplace intelligence | **Built.** Counts of shops, listings, requests, offers, orders + growth funnel and distribution aggregates. No customer PII, no payment data, no credentials. |
| 6 | Growth department's first mission (20 sellers) | **Partially.** The Growth agent can read the marketplace, prepare invitations/content/links as proposals and report progress runs. It cannot send messages, and it will not invent prospects — the ledger stores only what a worker actually returned. The 20-seller target is a Paperclip objective, and Paperclip is not installed. |
| 7 | Provider readiness | **Done.** `MODEL_NOT_CONFIGURED` from the same env-name-only check used by the console; installation and all non-AI tests work without a key; mock runs are labelled `mock: true` everywhere. A key is added to the server env, never through the UI, a proposal or a log. |
| 8 | Operations & reliability | **Partly.** In-repo: no public agent endpoint (401 verified in tests), rules deny all five collections, worker caps. On-VPS assets exist (`phase1-inspect.sh`, `verify-integration.sh`, RUNBOOK PHASE 2–9: restart policy, volumes, logrotate, backups, resource limits, loopback binds, HTTPS gate). Not executed — no VPS access. |
| 9 | End-to-end tests | **A–J proven at the Orbit boundary in mock mode; the live half is blocked** (see next table). |

## A–J, item by item

| | Test | Status here |
|---|---|---|
| A | Founder creates a task in Paperclip | **Blocked** — Paperclip not installed. Simulated as `taskKey PC-5001`. |
| B | Paperclip assigns it to Hermes | **Blocked** — same. |
| C | Hermes processes it (mock provider, clearly labelled) | **Proven in mock**: `reportTaskRun(..., status: 'running', mock: true)` then `completed`. |
| D | Hermes returns a result | **Proven**: bounded structured `result` + `summary` stored; 4 KB cap, secret keys rejected. |
| E | Paperclip records the result | **Blocked** — Paperclip side. Orbit's record is the Vidnov half. |
| F | Orbit records the task and enforces permissions | **Proven**: own-rows-only, `tasks:report` required, forged/absent credential 401. |
| G | An agent prepares a publishing proposal | **Proven**: `kind: 'publish'` → pending, digest frozen. |
| H | It appears in the founder's dashboard | **Proven**: pending proposals listed with the exact digest the approver must echo. |
| I | An unapproved publishing attempt is rejected | **Proven at two layers**: a wrong digest → `conflict` (refused); and publishing itself never runs from Orbit — the Social Engine publish route still requires admin session + confirmation + its own approval record. |
| J | Restart does not destroy history or credentials | **Proven in the ledger** (new client over the same data: credential authenticates, runs list, replay is a no-op). **Not proven for the actual services** — that is what `verify-integration.sh` §7 does on the VPS. |

## Security assessment

- Agent credentials: `orb_<id>_<secret>`, SHA-256 of the secret only, constant-time compare, revocable instantly; shown once.
- No wildcard scopes; `publish:propose` ≠ publish; nothing an agent holds can write a business record.
- Approval is bound to the SHA-256 of the exact action; self-approval refused; approval executes nothing.
- Worker results are size-capped and rejected if they contain credential-shaped keys.
- Agent endpoints return 401 without a credential and 403 for a disabled agent; no route reads Firestore before the guard.
- Firestore rules deny `ai_hq_agents`, `ai_hq_proposals`, `ai_hq_audit`, `ai_hq_meta`, `ai_hq_tasks` to every client.
- Paperclip/Hermes are specified to run loopback-only, in their own containers, with no `/root/app` mount and no Vidnov secrets — untested, because they are not installed.

## Remaining blockers

1. **VPS access.** Paperclip + Hermes install, the adapter join, restart/reboot survival, log rotation and backups all require the server. This workspace has no Docker and ~500 MB free RAM.
2. **Founder approval gates.** The Hermes join request, budget numbers and any public exposure are explicitly the founder's decisions.
3. **No model key.** Until `HERMES_MODEL_PROVIDER` + `HERMES_MODEL_API_KEY` exist, tasks run in mock mode and say so. No claim of AI reasoning is made or implied.
4. **This commit is not deployed**, so `/api/orbit/*` is not yet reachable at `vidnov.com`.

## Next commands (VPS), in order

```bash
# 0. baseline must still be green
pm2 list && curl -fsS -o /dev/null -w '%{http_code}\n' https://vidnov.com

# 1. install + configure (RUNBOOK PHASE 2–3, Docker path)
bash ops/ai-headquarters/phase1-inspect.sh
git clone https://github.com/paperclipai/paperclip.git /opt/ai-hq/paperclip-src
cd /opt/ai-hq/paperclip-src
PAPERCLIP_DATA_DIR=/opt/ai-hq/paperclip-data \
PAPERCLIP_DEPLOYMENT_MODE=authenticated PAPERCLIP_BIND=loopback \
docker compose -f docker/docker-compose.quickstart.yml up -d --build

mkdir -p /opt/ai-hq/hermes-data
docker run -d --name hermes --restart unless-stopped \
  -v /opt/ai-hq/hermes-data:/opt/data -p 127.0.0.1:8642:8642 \
  nousresearch/hermes-agent gateway run

# 2. deploy the app that contains Orbit, then register the agents
cd /root/app && git pull && npm ci && npm run build && pm2 restart goearnvid

# 3. join Hermes to Paperclip (PHASE 5) — founder approves the join, then:
COMPANY_ID=<id> ORBIT_TOKEN=<agent token> ORBIT_BASE=https://vidnov.com \
  bash /root/app/ops/ai-headquarters/verify-integration.sh

# 4. only when a key is approved (PHASE 4):
#    hermes setup --portal   (or set HERMES_MODEL_PROVIDER / HERMES_MODEL / HERMES_MODEL_API_KEY)
#    then re-run verify-integration.sh — model state must read MODEL_CONFIGURED
```
