#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Vidnov × Postiz — restore script (runs ON THE VPS as root).
#
# Restores ONE snapshot produced by backup.sh into the running Postiz stack.
# It stops ONLY the postiz containers — the Vidnov app (PM2 goearnvid),
# its database and nginx site are never touched.
#
# Usage:  bash restore.sh /root/backups/postiz/<snapshot-dir> --yes
#
# DANGER: this overwrites the Postiz database and uploads volume contents
# with the snapshot. It never deletes volumes, never deletes files outside
# the Postiz stack, and requires the explicit --yes flag.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SNAPSHOT="${1:-}"
CONFIRM="${2:-}"

if [[ -z "$SNAPSHOT" || "$CONFIRM" != "--yes" ]]; then
  echo "Usage: bash restore.sh /root/backups/postiz/<snapshot-dir> --yes"
  echo "Aborted: no snapshot given or missing the explicit --yes flag."
  exit 2
fi
if [[ ! -d "$SNAPSHOT" ]]; then
  echo "ERROR: snapshot directory not found: $SNAPSHOT"
  exit 2
fi

COMPOSE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$COMPOSE_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
PG_USER="${POSTIZ_PG_USER:-postiz}"
PG_DB="${POSTIZ_PG_DB:-vidnov_postiz}"

echo "[restore] Snapshot : $SNAPSHOT"
echo "[restore] Stack    : vidnov-postiz (Postiz only — Vidnov/goearnvid untouched)"

# 1) Stop the app so the DB is quiescent (data volumes are kept).
docker compose stop postiz

# 2) Restore Postiz database.
echo "[restore] restoring postiz-db.sql.gz …"
gunzip -c "$SNAPSHOT/postiz-db.sql.gz" | docker exec -i postiz-postgres \
  psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 --quiet
echo "[restore] postiz database restored"

# 3) Restore Temporal database (best effort — schedules only).
if [[ -f "$SNAPSHOT/temporal-db.sql.gz" ]]; then
  echo "[restore] restoring temporal-db.sql.gz …"
  gunzip -c "$SNAPSHOT/temporal-db.sql.gz" | docker exec -i temporal-postgresql 
    psql -U temporal -d temporal --quiet || echo "[restore] WARN: temporal restore had errors (non-fatal)"
fi

# 4) Restore uploads volume (replaces volume contents; volume itself is kept).
if [[ -f "$SNAPSHOT/uploads.tar.gz" ]]; then
  UPLOAD_VOL="$(docker volume ls -q | grep -E 'vidnov-postiz_postiz-uploads$' | head -1 || true)"
  if [[ -n "$UPLOAD_VOL" ]]; then
    echo "[restore] restoring uploads.tar.gz …"
    docker run --rm -v "$UPLOAD_VOL":/v -v "$SNAPSHOT":/backup alpine \
      sh -c 'find /v -mindepth 1 -delete && tar xzf /backup/uploads.tar.gz -C /v'
    echo "[restore] uploads restored"
  fi
fi

# 5) Bring the app back up.
docker compose start postiz
docker compose up -d
echo "[restore] done. Verify: docker compose ps && curl -s -o /dev/null -w '%{http_code}\n' https://social.vidnov.com"
