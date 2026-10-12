#!/bin/bash
set -euo pipefail
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] starting builder process"
if command -v next >/dev/null 2>&1; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] building Next.js app"
  NODE_ENV=production next build
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] next cli not found on PATH"
  exit 1
fi
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] builder finished"
