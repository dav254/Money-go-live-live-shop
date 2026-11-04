# Vidnov AI Headquarters — VPS Installation Handover

Installation for **Paperclip** (HQ) and **Hermes** (worker) on the existing
Vidnov VPS, plus the loopback/private-network and persistence rules each
stage must meet. Nothing here installs, restarts, or changes production
secrets: those are the founder's job, and the gates are marked `[GATE]`.

**Rule: nothing risky runs without explicit founder approval.**

---

## 0. Verified facts (from official sources)

| Fact | Value |
|---|---|
| Paperclip repo | `github.com/paperclipai/paperclip` (MIT) |
| Paperclip docs | `docs.paperclip.ing` (marketing `paperclip.ing`; `/docs/install` is 404) |
| Paperclip latest release | **v2026.1023.0** (2026-10-23); `v2026.626.0` is real but older |
| Hermes adapter requirement | **Paperclip ≥ v2026.626.0** → latest release satisfies it |
| Paperclip install | `npx paperclipai@latest onboard --yes` (needs **Node 24.11+**, pnpm 9.15+) or Docker Compose `docker/docker-compose.quickstart.yml` **with `--target production`** |
| Paperclip DB | **PostgreSQL only** — embedded (default), Docker Postgres 17, or hosted. No SQLite |
| Paperclip data | `~/.paperclip/instances/default/{db,logs,data/storage,secrets/master.key,config.json}` (`PAPERCLIP_HOME` overrides) |
| Paperclip port | 3100 (default), health `GET /api/health` |
| Paperclip modes | `local_trusted` (no auth, loopback-only) → must run **`authenticated`** before any exposure; one-time board-claim URL promotes the signing-in user to instance admin |
| Hermes repo | `github.com/NousResearch/hermes-agent` (MIT) |
| Hermes docs | `hermes-agent.nousresearch.com/docs/` |
| Hermes install | `curl -fsSL https://hermes-agent.nousresearch.com/install.sh \| bash` (clones source, bootstraps `uv`, pinned Python 3.14/Node/npm/ripgrep/FFmpeg) — or official Docker image `nousresearch/hermes-agent` |
| Hermes data | `~/.hermes/{config.yaml,.env,auth.json,memories/,skills/,sessions/,state.db,logs/}`; in Docker all mutable state goes in `/opt/data` volume |
| Hermes gateway | port **8642** (OpenAI-compatible API + health), dashboard :9119; `hermes gateway run --replace --accept-hooks` |
| Hermes provider | `hermes setup --portal` (Nous Portal OAuth), Codex/ChatGPT OAuth, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, custom OpenAI-compatible endpoint, Ollama (needs ≥64k context + tool calling) |
| Hermes↔Paperclip | Built-in **`hermes_gateway`** adapter (Paperclip ≥ v2026.626.0): Paperclip invite prompt → Hermes join request → admin approves → Hermes claims one-time key. Loopback HTTP accepted; non-loopback HTTP denied (use HTTPS) |
| Known trap | paperclip issue #8924: old Paperclip + Hermes v0.17.0 → 401. Keep both current; two DIFFERENT keys (gateway key ≠ Paperclip agent key) |
| Budgets | `budgetMonthlyCents` on company/agent/project/goal; 80 % soft alert, 100 % hard stop + auto-pause; `GET /api/companies/{id}/costs/summary` |

**VPS constraints (historical, must re-verify in Phase 1):** Ubuntu 24.04,
4 vCPU, 8 GB RAM, system **Node.js 22** (PM2 `goearnvid`, `/root/app`,
:3000, nginx + certbot for vidnov.com). ⇒ **Do not upgrade system Node.**
Run Paperclip with its own runtime (Docker image ships Node+Python+prebuilt
Rust runner; or a service-user nvm with Node 24.x used only by
Paperclip).

**Default VPS (must re-verify):** `pm2 list` shows `goearnvid` online and
`https://vidnov.com` returns 200.

---

## 1. Phase 1 — Inspection (read-only)

Run on the VPS:

```bash
bash ops/ai-headquarters/phase1-inspect.sh
```

Covers: OS/CPU/RAM/swap/disk, Node/Python, PM2/systemd, Docker, nginx,
databases, Ollama, AI-provider env key **names** (values never printed),
existing Paperclip/Hermes installs, Vidnov process health, firewall,
Tailscale.

**Checkpoint — baseline must still be green:**

```bash
pm2 list | grep goearnvid    # online
curl -fsS -o /dev/null -w '%{http_code}\n' https://vidnov.com   # 200
```

Also record:

- CPU/RAM/swap/disk (must cover Paperclip, Hermes, and the 2 GB VPS budget
  for `goearnvid`).
- Whether Docker is present — `command -v docker` + `docker compose version`.
- Existing installs: `command -v paperclipai hermes`, `docker ps -a`,
  systemd units matching `paperclip|hermes`.
- Listen ports 3000/3100/8642/9119: `ss -ltnp`.
- AI-provider key **names** (values never printed): `GEMINI_API_KEY`,
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `Nous Portal` client id/secrets.

**Termux note (Android):** run through an SSH session, not a plain
Termux shell. Install the OpenSSH client (`pkg install openssh`) and
`ssh -p <port> root@<vps-ip>`. Use the same SSH session for every stage so
interactive prompts (`initctl`, service managers) behave normally.

---

## 2. Phase 2 — Paperclip (HQ)

Decision after Phase 1: **Docker present → Docker Compose (official)**,
isolated, no host Node change. **No Docker → npx path** under a dedicated
system user with its own Node 24 via nvm (system Node 22 untouched).

```bash
git clone https://github.com/paperclipai/paperclip.git /opt/ai-hq/paperclip-src
cd /opt/ai-hq/paperclip-src
docker compose -f docker/docker-compose.quickstart.yml up -d --build   # builds --target production
```

Persist under a dedicated dir: `PAPERCLIP_DATA_DIR=/opt/ai-hq/paperclip-data`.

No Docker → npx path:

```bash
sudo useradd -m -s /bin/bash paperclip
sudo -u paperclip bash -lc 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash'
sudo -u paperclip bash -lc 'source ~/.nvm/nvm.sh && nvm install 24 && nvm use 24'
sudo -u paperclip bash -lc 'PAPERCLIP_HOME=/opt/ai-hq/paperclip npx paperclipai@latest onboard --yes --bind lan'
```

**Configuration gates:**

1. **Auth — never expose `local_trusted`.** Onboard into `authenticated`
   mode: `PAPERCLIP_DEPLOYMENT_MODE=authenticated PAPERCLIP_BIND=loopback`.
   Public exposure only after Phase 9 decision. One-time board-claim URL →
   founder signs in and claims instance admin.
2. **Dedicated database:** default embedded PostgreSQL under
   `PAPERCLIP_HOME` (isolated from Vidnov's Firebase/PocketBase — no shared
   DB). If Phase 1 finds an existing local Postgres, an isolated database
   name `paperclip` may be used instead — never Vidnov's data.
3. **Auto-start:** Docker `restart: unless-stopped` (preferred) or a systemd
   unit that runs `npx paperclipai run` as the `paperclip` user. **Not PM2**
   (official docs don't support PM2; keeps `goearnvid`'s PM2 untouched).
4. **Loopback bind + health:** `PAPERCLIP_BIND=loopback`;
   `PAPERCLIP_DEPLOYMENT_MODE=authenticated`; `curl -fsS
   http://127.0.0.1:3100/api/health` + `paperclipai doctor`.
5. **HTTPS:** loopback bind + nginx reverse proxy only when Phase 9
   requires a public name; WebSocket upgrade forwarding for
   `PAPERCLIP_RUNNER_PUBLIC_URL`.
6. **Backups + resource cap:** nightly cron tar of `PAPERCLIP_HOME` (db +
   storage + `secrets/master.key`) to `/opt/ai-hq/backups/`, 14-day
   retention, off-VPS copy [GATE: destination]. Losing `master.key`
   ⇒ losing encrypted secrets. **Resource cap (default VPS: 4 vCPU / 8 GB
   RAM):** `docker compose` is not given unlimited CPU; Paperclip's own
   container resource limits are set in `docker-compose.yml` or the nvm
   service user's systemd unit (`CPUQuota=800%` / `MemoryLimit=4G`). No
   change to the Vidnov `goearnvid` PM2 process.

**Checkpoint — Paperclip:**

```bash
curl -fsS http://127.0.0.1:3100/api/health   # 200
paperclipai doctor                              # no warnings
ss -ltnp | grep 3100                            # 127.0.0.1:3100 only
```

---

## 3. Phase 3 — Hermes Agent

Isolated execution (preferred: Docker — official image):

```bash
mkdir -p /opt/ai-hq/hermes-data
docker run -d --name hermes --restart unless-stopped \
  -v /opt/ai-hq/hermes-data:/opt/data \
  -p 127.0.0.1:8642:8642 \
  nousresearch/hermes-agent gateway run
```

Source install alternative (official one-liner) under a dedicated `hermes`
user if Docker is unavailable:

`curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`

**Configuration:**

| Requirement | How |
|---|---|
| Persistent memory | `/opt/ai-hq/hermes-data/memories/` (MEMORY.md + USER.md, volume-mounted) + `state.db` sessions (FTS5 task history) |
| Tool access | `hermes tools` allowlist: start with `safe,web,search,file,memory,session_search,todo`; **`terminal` only inside the container backend** |
| Skills | `/opt/ai-hq/hermes-data/skills/` (read-only to runtime; Paperclip-managed skills merge in later) |
| Secure execution | `approvals.mode: smart` (default, fail-closed), `approvals.cron_mode: deny`, hardline blocklist always on, `terminal.env_passthrough: []` (allowlist), **no** `/root/app` mount, **no** production secrets in `~/.hermes/.env` |
| Task history | `state.db` + `sessions/` in the data volume |
| Model provider | Phase 4 |
| Health monitoring | `hermes doctor`, gateway health on `127.0.0.1:8642`, optional dashboard on 9119 (**loopback only**) |
| **Loopback + isolation** | port **8642 bound to `127.0.0.1` only** (`-p 127.0.0.1:8642:8642`); dashboard **9119 loopback-only**; outbound rules in `~/.hermes/config.yaml` `tools.http.allow`; **no** `/root/app` mount; no Vidnov `.env`/`.env.production`, Firebase service accounts, payment keys or deploy keys in `~/.hermes/.env` or the container. |

**Explicitly denied:** mount of `/root/app`, Vidnov `.env`/`.env.production`,
Firebase service accounts, payment keys, deploy keys.

**Checkpoint — Hermes:**

```bash
hermes doctor                                   # healthy
docker inspect -f '{{.State.Running}}' hermes   # true
ss -ltnp | grep 8642                            # 127.0.0.1:8642 only
```

---

## 4. Phase 4 — Model provider (inspect first, one provider, real test)

Order of preference (no new purchases without approval):

1. **Existing authorized subscription on the VPS** (Phase 1 shows key names:
   `GEMINI_API_KEY` etc. → Gemini supports tool calling, but confirm context
   ≥ 64k for the chosen model).
2. **Nous Portal** — `hermes setup --portal` (OAuth; official fast path).
3. **OpenAI Codex / ChatGPT subscription** — `hermes model` → device-code
   OAuth.
4. **Self-hosted/Ollama** — only if Phase 1 finds a GPU-capable Ollama; must
   be ≥ 64k context **with** tool calling (`--jinja` / tool-call parser) —
   an 8 GB VPS without GPU is not a candidate for local inference.
5. Paid API key — **[GATE: founder approves spend]**.

Acceptance: a **real conversation** (`hermes chat -q "…"`) returns a correct
answer with at least one tool call, before any automation is enabled.

**Checkpoint — model:**

```bash
hermes chat -q "…"
```

---

## 5. Phase 5 — Hermes ↔ Paperclip (built-in adapter only)

Prereqs: Paperclip ≥ v2026.626.0 running authenticated, Hermes gateway on
loopback:8642 with `API_SERVER_ENABLED=true` + fresh random
`API_SERVER_KEY`.

1. Paperclip → Agents → New Agent → **Invite an external agent** →
   **Generate onboarding prompt** (one-time).
2. Paste the prompt into Hermes: it verifies `GET <base>/api/health`, then
   runs `hermes gateway run --replace --accept-hooks`.
3. Hermes submits a join request (`adapterType: hermes_gateway`,
   `paperclipApiUrl: http://127.0.0.1:3100`, `apiKey` = gateway key).
4. **[GATE] Founder approves** the pending join request:
   `npx paperclipai join list --company-id <id> --status pending_approval`
   → `npx paperclipai join approve <request-id> --company-id <id>`.
5. Hermes claims its one-time Paperclip key (from the RAW claim response,
   not a masked preview): `npx paperclipai join claim-key <request-id>
   --company-id <id> --claim-secret <secret>`.
6. Trust rules: **two different keys**; loopback HTTP is fine, any remote
   hop must be HTTPS; no `HERMES_GATEWAY_ALLOW_INSECURE_HTTP` outside a lab.

No custom integration code — the built-in adapter is used end to end.

**Checkpoint — join proof:**

```bash
npx paperclipai join list --company-id <id> --status approved
# shows hermes_gateway with a status non-empty; this is the adapter link,
# not two separate processes.
```

---

## 6. Phase 6 — VIDNOV AI OPERATIONS company + 3 agents

Create company **VIDNOV AI OPERATIONS** in Paperclip, then exactly three
agents (create more only after these three prove reliable):

| Agent | Role | Adapter / toolsets |
|---|---|---|
| AI Operations Director | Plans, delegates, daily operational reports to the founder | `hermes_gateway`; toolsets: `memory,todo,file,web,search` (no terminal) |
| Growth & Marketing Agent | CCA research, seller recruitment, campaign drafts, promo content, campaign analysis, works with the Vidnov Social Engine (read + draft only) | `hermes_gateway`; toolsets: `web,search,file,memory,todo` (no terminal, no publishing) |
| Engineering Agent | Investigates errors, reviews approved code, prepares fixes, runs tests **in an isolated environment**, reports deploy risks | `hermes_gateway`; toolsets: `terminal` (container backend), `file,web,search,memory`; `worktreeMode`, `maxTurnsPerRun` capped |

Org chart: all three report to the founder; Director may delegate only to
the other two (`maxTurnsPerRun` + per-agent budgets cap loops).

---

## 7. Phase 7 — Read-only Vidnov integration (least privilege)

Initial scope — **read-only, approved data only**:

- Marketplace metrics, seller growth stats, product info, campaign
  performance, Social Engine publishing status, application health.

Mechanism (no secrets to agents): a **read-only** status/metrics endpoint or
export served by Vidnov with a scoped, revocable token; agents get
*prepare proposed actions and tasks* capability only.

Hard deny list: customer passwords, payment data, private conversations,
seller credentials, production env secrets, deployment controls. Tenant
isolated; the token's grants are the ceiling. `[GATE: endpoint design +
token issuance approved by founder before any Vidnov code change]`

> **STATUS (implemented in the repository):** this endpoint set now exists as
> Orbit — `/api/orbit/status`, `/api/orbit/marketplace`, `/api/orbit/social`,
> `/api/orbit/proposals`, plus `/api/admin/ai-headquarters` for the console.
> Per-agent credentials are minted in the admin UI, stored as SHA-256 hashes,
> scope-checked per route, and every irreversible request is a digest-bound
> proposal the founder decides. See [`ORBIT-BRIDGE.md`](./ORBIT-BRIDGE.md).

---

## 8. Phase 7b — Wire Hermes to Orbit

1. Deploy the Vidnov app containing `/api/orbit/*` (founder-approved deploy).
2. Admin UI → System → **AI Headquarters** → register one agent per Paperclip
   agent, with the scopes from the table in `ORBIT-BRIDGE.md` §4.
3. Copy each credential into the Hermes container env as
   `VIDNOV_ORBIT_TOKEN` (one container per agent, or one Hermes with three
   agent profiles). Never put a credential in a Paperclip task description.
4. **Scoped token check:** the file used in this container is the agent's
   own. `hermes doctor` and `/api/orbit/status` from inside it must both
   answer `200` with that agent's scope list; no other agent's token may be
   used in this container.
5. Allowlist the four Orbit URLs in `~/.hermes/config.yaml`
   `tools.http.allow`:
   - `https://vidnov.com/api/orbit/status`
   - `https://vidnov.com/api/orbit/marketplace`
   - `https://vidnov.com/api/orbit/social`
   - `https://vidnov.com/api/orbit/proposals`
6. Acceptance: `GET /api/orbit/status` from inside the Hermes container
   returns `MODEL_NOT_CONFIGURED` (correct until PHASE 4 is done) and the
   agent's own scope list; the same call with a disabled agent returns 403.

---

## 9. Phase 8 — Budget controls

- Paperclip company budget `budgetMonthlyCents` + per-agent budgets —
  **start low** `[GATE: founder sets the numbers]`.
- 80 % soft alert → 100 % hard stop + agent auto-pause (built in).
- Cost reporting: `GET /api/companies/{id}/costs/summary`,
  `/costs/by-agent`.
- Hermes: `/usage` + provider usage tracking; no unlimited cron/routines —
  `approvals.cron_mode: deny` and routine schedules capped.
- **No ad spend, no purchased services without explicit approval.**

---

## 10. Phase 9 — Secure mobile access

Preferred: **Tailscale** (install on VPS + founder's Android;
Paperclip `--bind tailnet`) — private by default, no public exposure, no
DNS changes.

Alternative **[GATE: DNS change approval required — do NOT touch existing
vidnov.com DNS without it]**: new record `ai.vidnov.com` → VPS, nginx +
certbot TLS, Paperclip `authenticated + public` mode (stricter `doctor`
checks), login mandatory.

**Termux access:** founder's Android phone connects to the VPS over SSH
(`ssh -p <port> root@<vps-ip>`), never through a public HTTPS route to the
Paperclip/Hermes ports. Those ports stay loopback/private under all
modes. Use `tailscale up` on the Android phone as an alternative to the
bare SSH port.

Dashboard is never reachable unauthenticated in either mode.

---

## 11. Phase 10 — Live acceptance tests

| # | Test | Checkpoint command / proof |
|---|---|---|
| 1 | Paperclip running | `curl -fsS http://127.0.0.1:3100/api/health` → 200 |
| 2 | Hermes running | `docker inspect -f '{{.State.Running}}' hermes` → true |
| 3 | Survive terminal closure | detach + re-login, both still up (PHASE 8/9) |
| 4 | Survive reboot | `reboot`, both auto-start, `goearnvid` also back |
| 5 | Admin auth works | board-claim login as founder; anonymous request → 401 |
| 6 | DB + memory persist | write memory, restart Hermes, memory still present |
| 7 | Model responds | real `hermes chat -q "…"` exchange |
| 8 | Real task completes | assign a concrete task, Hermes completes it |
| 9 | Result returns to Paperclip | task shows completed + result in Paperclip UI |
| 10 | 3 agents operational | all three answer/act in their roles |
| 11 | Cost tracking works | `costs/summary` shows recorded usage after a run |
| 12 | Unauthorized ops blocked | unauthenticated API call denied; agent without `terminal` cannot exec; Orbit call with an unknown/disabled credential → 401/403 |
| 12b | Publishing stays gated | an approved publishing proposal does not publish — the post only goes out from the Social Engine publish test, by an admin |
| 13 | Vidnov healthy | `pm2 list` → `goearnvid` online, `https://vidnov.com` → 200 |

**Termux checkpoint** — run the same assertions from the phone over SSH:

```bash
ssh root@<vps-ip> '/opt/ai-hq/verify-integration.sh'   # same script, same PASS/FAIL
```

Fail any item ⇒ mark that component `CONFIGURED`/`CONNECTED`, not
`TESTED`/`LIVE`.

---

## 12. Component status legend

`NOT INSTALLED` → `INSTALLED` → `CONFIGURED` → `CONNECTED` → `TESTED` →
`LIVE` (plus `APPROVAL REQUIRED` where a gate is pending).

**[GATE]** = founder approval required before this step runs.
