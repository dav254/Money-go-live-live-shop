#!/usr/bin/env bash
#
# SECRET EXPOSURE AUDIT — reports WHERE credentials are exposed, never WHAT they are.
#
# Prints only file paths and commit hashes, never matched lines. That is the
# whole point: a remediation report that echoes the secret copies it into
# another log, another terminal buffer, another screenshot.
#
# Usage (works under sh or bash):
#   sh scripts/audit-secrets.sh
#
# Exit code is 0 even when findings exist — this is a report, not a gate.

set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

# pattern|label — deliberately high-confidence shapes. "Any 32 hex chars" is
# excluded: it matches hashes, ids and fixtures and makes the report noise.
PATTERN_LIST='AIza[0-9A-Za-z_-]{35}|Google API key
AC[0-9a-f]{32}|Twilio Account SID
sk_live_[0-9A-Za-z]{10,}|Stripe live secret key
pk_live_[0-9A-Za-z]{10,}|Stripe live publishable key
ghp_[0-9A-Za-z]{20,}|GitHub personal access token
xox[baprs]-[0-9A-Za-z-]{10,}|Slack token
-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|private key block
TWILIO_AUTH_TOKEN[[:space:]]*[:=][[:space:]]*["'"'"']?[0-9a-f]{32}|Twilio auth token literal'

FINDINGS=0

echo "Secret exposure audit — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Repository: $ROOT"
echo

while IFS='|' read -r pattern label; do
  [ -z "$pattern" ] && continue

  files="$(git grep -lE "$pattern" -- \
    ':(exclude)*/node_modules/*' \
    ':(exclude)*/.next/*' \
    ':(exclude)*/package-lock.json' \
    ':(exclude)*/bun.lock' 2>/dev/null)"

  commits="$(git log --all --format=%H --extended-regexp --grep="$pattern" 2>/dev/null)"

  if [ -n "$files" ] || [ -n "$commits" ]; then
    FINDINGS=$((FINDINGS + 1))
    echo "FINDING: $label"
    if [ -n "$files" ]; then
      printf '%s\n' "$files" | while IFS= read -r file; do
        [ -n "$file" ] && echo "  file:   $file"
      done
    fi
    if [ -n "$commits" ]; then
      printf '%s\n' "$commits" | while IFS= read -r hash; do
        [ -n "$hash" ] && echo "  commit: $hash (subject deliberately not printed)"
      done
    fi
    echo
  fi
done <<EOF
$PATTERN_LIST
EOF

# Weaker but useful signal: a credential NAME assigned a literal in a committed
# config. The value is never shown, only the file that holds it.
for name in TWILIO_AUTH_TOKEN TWILIO_ACCOUNT_SID GEMINI_API_KEY OPENAI_API_KEY PAYSTACK_SECRET_KEY; do
  files="$(git grep -lE "^[[:space:]]*-?[[:space:]]*$name[[:space:]]*[:=]" -- \
    ':(exclude)*/node_modules/*' \
    ':(exclude)*/.next/*' 2>/dev/null)"
  if [ -n "$files" ]; then
    echo "LITERAL: $name assigned in a committed config file"
    printf '%s\n' "$files" | while IFS= read -r file; do
      [ -n "$file" ] && echo "  file:   $file"
    done
    echo
  fi
done

if [ "$FINDINGS" -eq 0 ]; then
  echo "No high-confidence credential literals found in tracked files or commit subjects."
else
  echo "Action: rotate every credential named above, then move it to a secret store."
  echo "See docs/security-credential-rotation.md — values are never printed by this script."
fi
