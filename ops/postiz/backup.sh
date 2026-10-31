#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Vidnov × Postiz — backup script (runs ON THE VPS as root).
#
# Creates a timestamped snapshot of everything stateful in the Postiz stack:
#   • postiz-db.sql.gz     — Postiz PostgreSQL (orgs, channels, posts, API keys)
#   • temporal-db.sql.gz   — Temporal PostgreSQL (schedules/workflows)
#   • uploads.tar.gz       — post media volume
#
# Usage:   bash backup.sh              (snapshot to /root/backups/postiz/)
# Cron:    0 4 * * * cd /root/postiz && bash backup.sh >> /root/backups/postiz/backup.log 2>&1
# Retention: snapshots older than RETENTION_DAYS are removed (backups only —
#            this script NEVER touches docker volumes or app files).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/root/backups/postiz}"
RETENTION_DAYS="${RETENTION_DAYS:-21}"
PG_USER="${POSTIZ_PG_USER:-postiz}"
PG_DB="${POSTIZ_PG_DB:-vidnov_postiz}"
COMPOSE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load secrets for pg_dump only; never echo them.
if [[ -f "$COMPOSE_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$COMPOSE_DIR/.env"
  set +a
fi

TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_ROOT/$TS"
mkdir -p "$OUT"

echo "[backup] $TS — snapshot → $OUT"

# 1) Postiz application database
docker exec postiz-postgres pg_dump -U "$PG_USER" -d "$PG_DB" --clean --if-exists \
  | gzip > "$OUT/postiz-db.sql.gz"
echo "[backup] postiz-db.sql.gz: $(stat -c%s "$OUT/postiz-db.sql.gz") bytes"

# 2) Temporal database (schedules)
docker exec temporal-postgresql pg_dump -U temporal -d temporal \
  | gzip > "$OUT/temporal-db.sql.gz" || echo "[backup] WARN: temporal dump failed (non-fatal)"
echo "[backup] temporal-db.sql.gz: $(stat -c%s "$OUT/temporal-db.sql.gz" 2>/dev/null || echo 0) bytes"

# 3) Uploads volume (project prefix is 'vidnov-postiz_' from compose `name:`)
UPLOAD_VOL="$(docker volume ls -q | grep -E 'vidnov-postiz_postiz-uploads$' | head -1 || true)"
if [[ -n "$UPLOAD_VOL" ]]; then
  docker run --rm -v "$UPLOAD_VOL":/v:ro -v "$OUT":/backup alpine \
    tar czf /backup/uploads.tar.gz -C /v .
  echo "[backup] uploads.tar.gz: $(stat -c%s "$OUT/uploads.tar.gz") bytes"
else
  echo "[backup] WARN: uploads volume not found (stack not started yet?)"
fi

# 4) Retention — only ever removes old snapshot directories it created itself.
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +

echo "[backup] done. Restore with: bash restore.sh $OUT --yes"
