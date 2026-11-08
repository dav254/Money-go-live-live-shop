# Credential rotation and secret migration

**Status: prepared, NOT executed.** No credential has been rotated, revoked or
moved. Every step below needs owner approval and, for rotation itself, access to
the provider consoles.

This document contains **no credential values** and must never contain any.

## 1. What is exposed, and how bad it is

Run the audit at any time:

```bash
sh scripts/audit-secrets.sh
```

It prints file paths and commit hashes only. Current findings:

| Credential | Where | Classification |
|---|---|---|
| Twilio Account SID + Auth Token + WhatsApp numbers | `apphosting.yaml` (literal `env:` block) | **Real secret — rotate** |
| The same block, duplicated | `apphosting.yaml.save` (backup file, committed) | **Real secret — remove after rotation** |
| Twilio token + admin number in commit subjects | commits `619e1e43`, `c1d854e3`, `2c4f6f5f` | **Permanent disclosure in history** |
| Firebase web API key (`AIza…`) | `src/firebase/config.ts`, `mobile/src/lib/config.ts`, `set_admin_role.js` | **Not a secret** — public client identifier, protected by rules. Do not rotate for security reasons. |
| Google/Gemini key | commit `75b3ef6c` (subject) | **Real secret — rotate** |
| `GEMINI_API_KEY` in `DEPLOY.md` | line 79 | Placeholder (3-character value), no action |

Repo visibility is not known to this workspace. Treat every "real secret" row as
compromised.

### Who actually reads these values

- `TWILIO_*`, `ADMIN_WHATSAPP_NUMBER`: **only** `functions/src/index.ts`
  (`sendWhatsAppToAdmin`). Nothing under `src/**` (the Next.js app) reads them.
- `apphosting.yaml` targets **Firebase App Hosting**. Production runs on the VPS
  under pm2 according to `DEPLOY.md`, so the file is most likely legacy — but do
  not assume it; confirm which backend is live before deleting it.
- Failure mode if Twilio is revoked: admin WhatsApp alerts stop. The function
  falls back to `ADMIN_WHATSAPP_API_URL` and otherwise logs a warning. No
  account, order, listing, chat or payment depends on it.

## 2. Rotate Twilio (approval required)

1. Twilio Console → Account → **API keys & tokens** → create a new Auth Token.
2. Store the new value **only** in a secret store (step 3) — never in a file.
3. Deploy/restart the consumer that uses it (Cloud Functions), then test one
   admin notification.
4. Only after the test passes, **revoke the old token**.
5. Delete `apphosting.yaml.save` (a second copy of the same secret).

## 3. Move secrets out of the repository

Pick the store that matches where the code runs — do not duplicate values into
both unless both are live.

**Cloud Functions (the only reader today):**

```bash
firebase functions:secrets:set TWILIO_ACCOUNT_SID
firebase functions:secrets:set TWILIO_AUTH_TOKEN
firebase functions:secrets:set TWILIO_FROM_WHATSAPP_NUMBER
firebase functions:secrets:set ADMIN_WHATSAPP_NUMBER
```

Then in `functions/src/index.ts`:

```ts
import { defineSecret } from 'firebase-functions/params';
const twilioToken = defineSecret('TWILIO_AUTH_TOKEN');
export const onX = onDocumentCreated(
  { document: '...', secrets: [twilioToken] },
  async (event) => { /* process.env.TWILIO_AUTH_TOKEN is populated at runtime */ },
);
```

**Firebase App Hosting (only if it is actually the live backend):**

```bash
firebase apphosting:secrets:set TWILIO_AUTH_TOKEN --backend live-shopping-backend
```

and replace literals in `apphosting.yaml` with references:

```yaml
env:
  - variable: TWILIO_AUTH_TOKEN
    secret: TWILIO_AUTH_TOKEN
```

**VPS / pm2 (if the web app ever needs them):** put values in the server-side
environment file that pm2 loads — never in a tracked file.

## 4. Rotate the Gemini key (approval required)

1. Google AI Studio → API keys → create a replacement key.
2. Update `GEMINI_API_KEY` in the secret store for the environment that uses it.
3. Deploy, verify one AI request, then delete the old key.
4. The key in commit `75b3ef6c` remains readable in history — rotation is what
   neutralises it.

## 5. History cleanup (optional, coordinated)

Rotation is mandatory; rewriting history is hygiene. Rewriting changes every
commit hash and requires a force-push plus every clone to re-fetch.

```bash
# preferred: git-filter-repo
git filter-repo --replace-text replacements.txt   # replacements.txt maps literal -> ***REMOVED***
```

Do this only after rotation, only with the team aware, and only with a fresh
backup. It is **not** a substitute for rotation: assume the old values are
already harvested.

## 6. Verification checklist

- [ ] `sh scripts/audit-secrets.sh` reports no Twilio SID or Gemini key outside
      the "public Firebase key" rows.
- [ ] `apphosting.yaml` contains `secret:` references, not `value:` literals.
- [ ] `apphosting.yaml.save` is gone.
- [ ] Old Twilio token revoked in the console; new one tested.
- [ ] Old Gemini key deleted; AI features tested.
- [ ] No credential value appears in `git status`, docs, logs or screenshots.

## 7. Approval boundary

Nothing in this document has been executed. Required approvals:

1. Rotate Twilio token (console access).
2. Rotate Gemini key (console access).
3. Set the four Function secrets.
4. Delete `apphosting.yaml.save` and convert `apphosting.yaml` to references.
5. Optional history rewrite.
