#!/usr/bin/env bash
# VIDNOV AI HEADQUARTERS — Phase 2 integration verification (READ-ONLY except
# for one labelled mock run and one Hermes restart, both reversible).
#
# This exists because two healthy containers prove nothing. The questions are:
#   1. did the Hermes gateway actually JOIN the Paperclip company (adapter), or
#      are two processes merely running side by side?
#   2. does the worker really reach Vidnov Orbit, with a credential Vidnov
#      issued, and report a result Vidnov stored?
#   3. after a restart, is the task history and the credential still there?
#
# Usage (on the VPS, as root):
#   COMPANY_ID=<paperclip-company-id> \
#   ORBIT_TOKEN=orb_... \
#   ORBIT_BASE=https://vidnov.com \
#   bash ops/ai-headquarters/verify-integration.sh
#
# Optional: PAPERCLIP_CONTAINER (default: auto-detect), HERMES_CONTAINER
#           (default: hermes), SKIP_RESTART=1 to leave the service untouched.
#
# Secrets are never printed: the token is echoed masked, and no env file is read.
set -uo pipefail

ORBIT_BASE="${ORBIT_BASE:-https://vidnov.com}"
ORBIT_TOKEN="${ORBIT_TOKEN:-}"
COMPANY_ID="${COMPANY_ID:-}"
HERMES_CONTAINER="${HERMES_CONTAINER:-hermes}"
SKIP_RESTART="${SKIP_RESTART:-0}"

pass=0
fail=0
note() { printf '\n=== %s ===\n' "$1"; }
ok()   { pass=$((pass + 1)); printf '  PASS  %s\n' "$1"; }
bad()  { fail=$((fail + 1)); printf '  FAIL  %s\n' "$1"; }
info() { printf '  ....  %s\n' "$1"; }

mask() { printf '%s…%s' "${1:0:8}" "${1: -4}"; }

if [ -z "$ORBIT_TOKEN" ]; then
  printf 'ORBIT_TOKEN is required (Admin → System → AI Headquarters → register agent).\n' >&2
  exit 2
fi

orbit_get() { curl -sS -o "$2" -w '%{http_code}' -H "Authorization: Bearer $ORBIT_TOKEN" "$ORBIT_BASE$1"; }

# ── 1. Paperclip ────────────────────────────────────────────────────────────
note "1. Paperclip"
pc_code=$(curl -sS -o /tmp/hq-pc-health.json -w '%{http_code}' http://127.0.0.1:3100/api/health 2>/dev/null || echo 000)
if [ "$pc_code" = "200" ]; then
  ok "Paperclip health endpoint answered 200"
else
  bad "Paperclip /api/health answered $pc_code (not running, or not on 127.0.0.1:3100)"
fi

# ── 2. Hermes ───────────────────────────────────────────────────────────────
note "2. Hermes"
if docker inspect -f '{{.State.Running}}' "$HERMES_CONTAINER" 2>/dev/null | grep -q true; then
  ok "container $HERMES_CONTAINER is running"
else
  bad "container $HERMES_CONTAINER is not running"
fi
if docker exec "$HERMES_CONTAINER" hermes doctor >/tmp/hq-hermes-doctor.txt 2>&1; then
  ok "hermes doctor reported healthy"
else
  bad "hermes doctor failed (see /tmp/hq-hermes-doctor.txt)"
fi

# ── 3. The actual join: Hermes ↔ Paperclip adapter ──────────────────────────
note "3. Paperclip ↔ Hermes adapter (communication proof)"
if [ -z "$COMPANY_ID" ]; then
  info "COMPANY_ID not set — skipping the join check. Re-run with COMPANY_ID=<id>."
else
  if npx --yes paperclipai@latest join list --company-id "$COMPANY_ID" --status approved \
       >/tmp/hq-join.txt 2>&1 && grep -qi 'hermes' /tmp/hq-join.txt; then
    ok "an approved hermes_gateway join exists for company $COMPANY_ID"
  else
    bad "no approved Hermes join found (pending approval, or never submitted) — see /tmp/hq-join.txt"
  fi
fi

# ── 4. Orbit authentication ─────────────────────────────────────────────────
note "4. Orbit authentication"
code=$(orbit_get /api/orbit/status /tmp/hq-status.json)
if [ "$code" = "200" ]; then
  ok "credential $(mask "$ORBIT_TOKEN") accepted (200)"
  python3 - <<'PY'
import json
d = json.load(open('/tmp/hq-status.json'))
agent = d.get('agent', {})
print('  ....  agent=%s department=%s scopes=%s' % (
    agent.get('name'), agent.get('department'), ','.join(agent.get('scopes', []))))
model = d.get('model', {})
print('  ....  model state=%s configured=%s' % (model.get('state'), model.get('configured')))
PY
else
  bad "credential rejected ($code) — wrong token, disabled agent, or Orbit not deployed"
fi

anon_code=$(curl -sS -o /dev/null -w '%{http_code}' "$ORBIT_BASE/api/orbit/status")
if [ "$anon_code" = "401" ]; then
  ok "anonymous call rejected with 401"
else
  bad "anonymous call returned $anon_code — an agent endpoint is exposed unauthenticated"
fi

tampered="orb_$(printf '%s' "$ORBIT_TOKEN" | sed -E 's/^orb_([a-f0-9]+)_.*/\1/')_$(printf 'a%.0s' $(seq 1 64))"
tampered_code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $tampered" "$ORBIT_BASE/api/orbit/status")
if [ "$tampered_code" = "401" ]; then
  ok "forged secret rejected with 401"
else
  bad "forged secret returned $tampered_code — credential verification is broken"
fi

# ── 5. Orbit ledger: a real report written by the worker ────────────────────
note "5. Worker → Orbit ledger"
before=$(curl -sS -H "Authorization: Bearer $ORBIT_TOKEN" "$ORBIT_BASE/api/orbit/tasks" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("summary",{}).get("total",0))' 2>/dev/null || echo 0)
info "runs recorded before this check: ${before:-0}"

task_key="verify-$(date -u +%Y%m%dT%H%M%SZ)"
payload=$(cat <<JSON
{"taskKey":"$task_key","title":"Integration verification probe","status":"completed",
 "summary":"Written by verify-integration.sh — a labelled mock run, not AI output.",
 "result":{"probe":true,"phase":2},"mock":true}
JSON
)
post_code=$(curl -sS -o /tmp/hq-task.json -w '%{http_code}' -X POST \
  -H "Authorization: Bearer $ORBIT_TOKEN" -H 'Content-Type: application/json' \
  --data "$payload" "$ORBIT_BASE/api/orbit/tasks")
if [ "$post_code" = "201" ]; then
  ok "worker report accepted and stored (201, taskKey $task_key)"
else
  bad "worker report refused ($post_code) — see /tmp/hq-task.json"
fi

replay_code=$(curl -sS -o /tmp/hq-task-replay.json -w '%{http_code}' -X POST \
  -H "Authorization: Bearer $ORBIT_TOKEN" -H 'Content-Type: application/json' \
  --data "$payload" "$ORBIT_BASE/api/orbit/tasks")
if [ "$replay_code" = "200" ] && grep -q '"duplicate":true' /tmp/hq-task-replay.json; then
  ok "replaying the same attempt is idempotent (no duplicated history)"
else
  bad "replay returned $replay_code instead of a duplicate acknowledgement"
fi

# A result may not smuggle a credential.
secret_code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H "Authorization: Bearer $ORBIT_TOKEN" -H 'Content-Type: application/json' \
  --data '{"taskKey":"verify-secret-probe","title":"Secret probe","status":"completed","result":{"apiKey":"x"}}' \
  "$ORBIT_BASE/api/orbit/tasks")
if [ "$secret_code" = "400" ]; then
  ok "credential-shaped result rejected (400)"
else
  bad "credential-shaped result returned $secret_code — expected 400"
fi

# ── 6. Approval binding ─────────────────────────────────────────────────────
note "6. Approval binding"
prop_code=$(curl -sS -o /tmp/hq-prop.json -w '%{http_code}' -X POST \
  -H "Authorization: Bearer $ORBIT_TOKEN" -H 'Content-Type: application/json' \
  --data '{"kind":"publish","title":"Verification probe proposal","summary":"Filed by the verification script; approve it to test the queue.","action":{"type":"social_publish_test","params":{"module":"telegram","probe":true}}}' \
  "$ORBIT_BASE/api/orbit/proposals")
case "$prop_code" in
  201) ok "publishing proposal filed and pending founder review (201)" ;;
  403) info "agent lacks publish:propose — skipped (correct denial, nothing filed)" ;;
  *)   bad "proposal POST returned $prop_code — see /tmp/hq-prop.json" ;;
esac

# ── 7. Restart survival ─────────────────────────────────────────────────────
note "7. Restart survival"
if [ "$SKIP_RESTART" = "1" ]; then
  info "SKIP_RESTART=1 — not restarting Hermes"
else
  docker restart "$HERMES_CONTAINER" >/dev/null 2>&1 && sleep 12
  if docker inspect -f '{{.State.Running}}' "$HERMES_CONTAINER" 2>/dev/null | grep -q true; then
    ok "Hermes came back after restart"
  else
    bad "Hermes did not come back after restart"
  fi

  code=$(orbit_get /api/orbit/status /tmp/hq-status2.json)
  if [ "$code" = "200" ]; then
    ok "the same credential still authenticates after restart"
  else
    bad "credential failed after restart ($code)"
  fi

  after=$(curl -sS -H "Authorization: Bearer $ORBIT_TOKEN" "$ORBIT_BASE/api/orbit/tasks" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("summary",{}).get("total",0))' 2>/dev/null || echo 0)
  if [ "${after:-0}" -ge "${before:-0}" ] && [ "${after:-0}" -gt 0 ]; then
    ok "task history survived the restart (${before} → ${after} runs)"
  else
    bad "task history missing after restart (${before} → ${after})"
  fi
fi

# ── Summary ─────────────────────────────────────────────────────────────────
note "Summary"
printf '  %d passed, %d failed\n' "$pass" "$fail"
printf '  A PASS here proves the components are CONNECTED. A real model still\n'
printf '  needs a provider key: without one the console shows MODEL_NOT_CONFIGURED.\n'
[ "$fail" -eq 0 ] || exit 1
