#!/usr/bin/env bash
# Vidnov AI Headquarters — PHASE 1 VPS INSPECTION (READ-ONLY).
#
# Safe to run as root on the production VPS. It only prints facts:
#   - system/runtime inventory, running services, listening ports
#   - environment key NAMES from env files (never values)
# It changes nothing: no installs, no writes, no restarts.
#
# Usage:  bash phase1-inspect.sh
# Then send the full output back to the installer.

set -uo pipefail

section() { printf '\n=== %s ===\n' "$1"; }

section "Host / OS"
hostnamectl 2>/dev/null | sed -n '1,8p' || { hostname; . /etc/os-release && echo "$PRETTY_NAME"; }
uptime

section "CPU / RAM / swap / disk"
echo "vCPU: $(nproc)"
lscpu 2>/dev/null | grep -E 'Model name|Architecture' | head -2
free -h
swapon --show || echo "(no swap)"
df -h / /root 2>/dev/null | sort -u

section "Runtimes"
for c in node npm npx pnpm yarn corepack python3 pip3 uv git curl; do
  if command -v "$c" >/dev/null 2>&1; then
    printf '%-10s %s (%s)\n' "$c" "$("$c" --version 2>&1 | head -1)" "$(command -v "$c")"
  else
    printf '%-10s MISSING\n' "$c"
  fi
done
[ -d /root/.nvm ] && { echo "nvm installed versions:"; ls /root/.nvm/versions/node 2>/dev/null; }

section "Process managers"
command -v pm2 >/dev/null 2>&1 && pm2 list 2>&1 | sed -n '1,25p' || echo "pm2: not installed"
echo "--- running services (filtered) ---"
systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null \
  | grep -Ei 'pm2|node|vidnov|goearnvid|ollama|docker|nginx|caddy|postgres|mysql|mariadb|redis|tailscale' \
  || echo "(none matched)"

section "Docker"
if command -v docker >/dev/null 2>&1; then
  docker --version 2>&1
  docker compose version 2>&1 | head -1
  echo "--- containers (running) ---"
  docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>&1 | head -20
  echo "--- containers (all) ---"
  docker ps -a --format '{{.Names}}\t{{.Status}}' 2>&1 | head -20
else
  echo "docker: not installed"
fi

section "Nginx / reverse proxy"
command -v nginx >/dev/null 2>&1 && nginx -v 2>&1 || echo "nginx: not installed"
echo "--- sites-enabled ---"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "(none)"
echo "--- server_name / proxy_pass lines only ---"
grep -rhE '^\s*(server_name|proxy_pass)\s' /etc/nginx/sites-enabled/ 2>/dev/null | sort -u || true
command -v caddy >/dev/null 2>&1 && caddy version 2>&1 | head -1 || true

section "Databases"
systemctl is-active postgresql 2>/dev/null || true
systemctl is-active mysql 2>/dev/null || true
systemctl is-active mariadb 2>/dev/null || true
systemctl is-active redis 2>/dev/null || true
echo "--- listening DB-ish ports ---"
ss -ltnp 2>/dev/null | grep -E ':(3306|5432|5433|6379|8090|27017)\b' || echo "(none)"

section "Ollama / local inference"
if command -v ollama >/dev/null 2>&1; then
  ollama --version 2>&1 | head -1
  echo "--- installed models (names only) ---"
  ollama list 2>&1 | sed -n '1,15p'
else
  echo "ollama: not installed"
fi
ss -ltnp 2>/dev/null | grep -E ':(11434|8080|1234)\b' || echo "(no local inference ports listening)"

section "AI provider env key NAMES (values never printed)"
for f in /root/app/.env.production /root/app/.env /root/.paperclip/instances/default/config.json; do
  if [ -f "$f" ]; then
    echo "--- $f ---"
    case "$f" in
      *.json) grep -oE '"[A-Za-z0-9_]*(KEY|SECRET|TOKEN|ID|URL|MODEL)[A-Za-z0-9_]*"\s*:' "$f" 2>/dev/null | sort -u | head -40 || true ;;
      *)     grep -oE '^[[:space:]]*(export[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*=' "$f" | sed -E 's/^[[:space:]]*//; s/^export[[:space:]]+//; s/=$//' | sort -u ;;
    esac
  else
    echo "--- $f : not present ---"
  fi
done
for d in /root/.hermes /root/.paperclip /opt/hermes /opt/paperclip; do
  [ -e "$d" ] && echo "EXISTS: $d" || echo "absent: $d"
done

section "Existing Paperclip / Hermes installations"
for c in paperclipai hermes; do
  command -v "$c" >/dev/null 2>&1 && echo "$c: $(command -v "$c")" || echo "$c: not on PATH"
done
docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' 2>/dev/null | grep -Ei 'paperclip|hermes' || echo "(no paperclip/hermes containers)"
systemctl list-units --all --no-pager --no-legend 2>/dev/null | grep -Ei 'paperclip|hermes' || true

section "Vidnov production processes (must stay untouched)"
command -v pm2 >/dev/null 2>&1 && pm2 describe goearnvid 2>&1 | grep -E 'name|status|restarts|memory|pid|script|cwd' | head -12 || true
echo "--- ports 3000 / 3100 / 8642 / 9119 ---"
ss -ltnp 2>/dev/null | grep -E ':(3000|3100|8642|9119)\b' || echo "(none)"
echo "--- site health ---"
curl -sS -o /dev/null -w 'https://vidnov.com -> %{http_code} (%{time_total}s)\n' -m 15 https://vidnov.com || echo "vidnov.com unreachable from VPS"

section "Firewall"
command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | sed -n '1,20p' || echo "ufw: not installed"
command -v iptables >/dev/null 2>&1 && iptables -S 2>/dev/null | head -10 || true

section "Tailscale (candidate for private access)"
command -v tailscale >/dev/null 2>&1 && tailscale status 2>&1 | sed -n '1,10p' || echo "tailscale: not installed"

printf '\n=== INSPECTION COMPLETE (read-only, nothing changed) ===\n'
