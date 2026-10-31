# Vidnov × Postiz — Deployment Runbook

Isolated self-hosting of [Postiz](https://github.com/gitroomhq/postiz-app) (AGPL-3.0)
for Vidnov's marketing team at **https://social.vidnov.com**.

**Non-negotiables baked into this bundle**
- Lives in `/root/postiz`, own Docker project `vidnov-postiz`, own volumes.
- App port `127.0.0.1:4007` only — public traffic via nginx vhost.
- Vidnov app (PM2 `goearnvid`, `:3000`, `vidnov.com`) is never modified.
- No existing DNS record, MX/SPF/DKIM record, or nginx site is edited —
  `social.vidnov.com` is a **new** A record and a **new** site file.
- Postgres, Redis, Temporal, Temporal UI are never published publicly.
- Image pinned: `ghcr.io/gitroomhq/postiz-app:v2.25.3`.

---

## Phase 1 — VPS pre-checks (read-only; run as root, paste results if unsure)

```bash
# Capacity
nproc; free -h; df -h /; docker --version; docker compose version
# Port availability (4007/8080/7233 must be free or already ours)
ss -ltnp | grep -E ':(4007|8080|7233)\b' || echo "ports free"
# Vidnov must stay healthy before/after everything
pm2 status; curl -s -o /dev/null -w '%{http_code}\n' https://vidnov.com
# Existing uncommitted work (do not discard)
cd /root/app && git status --porcelain | wc -l
```

**Stop rule:** if `free -h` shows under ~4 GB available RAM or `/` has under
~10 GB free, do NOT deploy — report back instead.

## Phase 2 — Place the bundle

```bash
mkdir -p /root/postiz && cd /root/postiz
# Copy these files from the repo (ops/postiz/*) into /root/postiz:
#   docker-compose.yml  env.template  social.vidnov.com.conf
#   backup.sh  restore.sh  README.md  CHANNELS.md
cp env.template .env
nano .env          # generate + fill the three secrets (commands are in the file)
chmod 600 .env
```

Temporal's dynamic-config file (referenced by compose):
```bash
mkdir -p dynamicconfig
curl -fsSL https://raw.githubusercontent.com/gitroomhq/postiz-docker-compose/main/dynamicconfig/development-sql.yaml \
  -o dynamicconfig/development-sql.yaml
```

`.gitignore` reminder: this bundle lives on the VPS; never commit a filled `.env`.

## Phase 3 — DNS (new record only; done in your DNS panel)

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `social` | `<VPS public IPv4>` | 1800 |

No other record changes. **Do not touch** MX/SPF/DKIM/`@`/`www`.

## Phase 4 — Install Docker (only if Phase 1 showed it missing)

```bash
apt-get update && apt-get install -y docker.io docker-compose-v2
systemctl enable --now docker
docker --version && docker compose version
```

## Phase 5 — First start (registration temporarily open)

```bash
cd /root/postiz
# env.template ships POSTIZ_DISABLE_REGISTRATION=false for this one step only:
docker compose pull          # pulls ONLY the pinned images (no prune commands)
docker compose up -d
docker compose ps            # all services should reach healthy
docker compose logs postiz --tail 50
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4007   # expect 200/302
```

Create the **owner account** immediately at `http://social.vidnov.com` (or
`http://127.0.0.1:4007` from the VPS), organization name: **Vidnov Marketing**.

## Phase 6 — Close registration (mandatory)

```bash
cd /root/postiz
sed -i 's/^POSTIZ_DISABLE_REGISTRATION=.*/POSTIZ_DISABLE_REGISTRATION=true/' .env
docker compose up -d --force-recreate postiz
grep -c '^POSTIZ_DISABLE_REGISTRATION=true' .env   # must print 1
```

## Phase 7 — HTTPS + nginx vhost (new file, existing sites untouched)

```bash
cp social.vidnov.com.conf /etc/nginx/sites-available/social.vidnov.com
ln -sf /etc/nginx/sites-available/social.vidnov.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d social.vidnov.com
nginx -t && systemctl reload nginx
curl -s -o /dev/null -w '%{http_code}\n' https://social.vidnov.com   # expect 200
```

## Phase 8 — Backups

```bash
bash /root/postiz/backup.sh                       # first snapshot
crontab -e    # add:
# 0 4 * * * cd /root/postiz && bash backup.sh >> /root/backups/postiz/backup.log 2>&1
```
Restore: `bash restore.sh /root/backups/postiz/<dir> --yes` (Postiz stack only).

## Phase 9 — Health & regression checks

```bash
docker compose -f /root/postiz/docker-compose.yml ps
docker compose -f /root/postiz/docker-compose.yml logs --since 10m | grep -iE 'error|fatal' || echo clean
curl -s -o /dev/null -w 'postiz=%{http_code}\n' https://social.vidnov.com
curl -s -o /dev/null -w 'vidnov=%{http_code}\n' https://vidnov.com      # must stay 200
pm2 status                                            # goearnvid still online
ss -ltnp | grep -E ':(5432|6379|9200)\b' | grep -v 127.0.0.1 || echo "no internal port public"
```

## Rollback (removes ONLY this deployment)

```bash
cd /root/postiz && docker compose down          # stops containers, KEEPS all volumes/data
rm /etc/nginx/sites-enabled/social.vidnov.com   # remove our vhost only
nginx -t && systemctl reload nginx
# DNS: delete only the `social` A record.
# Data kept: docker volume ls (vidnov-postiz_* volumes are NOT removed)
# Full removal of data (only if explicitly intended later):
#   docker compose down -v   # ← NEVER run without explicit approval
```

Vidnov rollback: **none needed** — nothing of `/root/app`, PM2, or `vidnov.com`
is modified at any point. If Vidnov ever misbehaves during this work,
`pm2 status` + `pm2 logs goearnvid --lines 100` and revert the *Postiz* steps above.

## New environment variable names (Vidnov side, server-only)

| Key | Where it lives | Purpose |
|---|---|---|
| `POSTIZ_API_URL` | Vidnov server env (NOT `NEXT_PUBLIC_`) | Base URL, `https://social.vidnov.com` |
| `POSTIZ_API_KEY` | Vidnov server env (NOT `NEXT_PUBLIC_`) | Public API key created in Postiz UI |

Compose-side key names (never printed, only in `/root/postiz/.env`):
`POSTIZ_JWT_SECRET`, `POSTIZ_PG_PASSWORD`, `TEMPORAL_PG_PASSWORD`,
`POSTIZ_PG_USER`, `POSTIZ_PG_DB`, `POSTIZ_DISABLE_REGISTRATION`,
`POSTIZ_API_LIMIT` + optional provider keys (see `env.template`).
