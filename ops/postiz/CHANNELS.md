# Phase 4 — Connecting social channels to Postiz

Workspace: **Vidnov Marketing** (create at first login; owner = your admin account).

Rules for this phase:
- Connect **only** accounts/credentials you legitimately own.
- No invented OAuth apps, no permission escalation, no public publishing
  without explicit approval.
- Zero-app channels can be connected immediately inside Postiz
  (Integrations → add channel). App-gated channels need a developer
  application first — those instructions are below.

## Tier 1 — Connect now (no developer app required)

Docs: https://docs.postiz.com/self-host/providers/overview

| Channel | What you need |
|---|---|
| **Bluesky** | Vidnov's Bluesky handle + app password (App Passwords in Bluesky settings) |
| **Mastodon** | Instance URL (e.g. mastodon.social) + create an app in Preferences → Development → New application, scopes: `write:statuses write:media` |
| **Telegram** | Talk to @BotFather → new bot → paste bot token (only ONE polling process may use it) |
| **Medium / Dev.to / Hashnode / WordPress** | Account credentials / application password per https://docs.postiz.com/self-host/providers/overview |

Vidnov already runs its own Bluesky/Mastodon/Telegram adapters in the Growth
Posts engine — those keep working unchanged; this is a **separate** workspace.

## Tier 2 — Developer application required (prepare, do not rush)

Create each app before you need the channel; reviews take days–weeks.

| Channel | Steps | Docs |
|---|---|---|
| **X** | developer.x.com → create app → set keys in `.env` (`X_API_KEY`, `X_API_SECRET`) | https://docs.postiz.com/self-host/providers/x-twitter |
| **LinkedIn** | linkedin.com/developers → app → request product access (Share on LinkedIn / Marketing API) → `LINKEDIN_CLIENT_ID/SECRET` | https://docs.postiz.com/self-host/providers/linkedin |
| **Facebook Pages** | developers.facebook.com → app → business verification may be required → `FACEBOOK_APP_ID/SECRET` | https://docs.postiz.com/self-host/providers/facebook |
| **Instagram** | via Facebook-linked app; publishing permission needs review | https://docs.postiz.com/self-host/providers/instagram |
| **Threads** | Meta developer app + Threads API product → `THREADS_APP_ID/SECRET` | https://docs.postiz.com/self-host/providers/threads |
| **YouTube** | Google Cloud → OAuth client + YouTube Data API enabled → `YOUTUBE_CLIENT_ID/SECRET` | https://docs.postiz.com/self-host/providers/youtube |
| **TikTok** | developers.tiktok.com → app; unaudited apps can only post privately, and media must be on a public HTTPS URL | https://docs.postiz.com/self-host/providers/tiktok |
| **Reddit** | reddit.com/prefs/apps → script app → `REDDIT_CLIENT_ID/SECRET` | https://docs.postiz.com/self-host/configuration/reference |

Redirect URI to register: `https://social.vidnov.com/integrations/social/<provider>`

After adding any key to `/root/postiz/.env`:
```bash
cd /root/postiz && docker compose up -d --force-recreate postiz
```

## Phase 5 setup — Vidnov → Postiz API key

1. In Postiz: **Settings → API keys** → create key (name: `vidnov-server`).
2. Store on the Vidnov server only (Freebuff Keys/API keys UI for the hosted
   workspace, or `/root/app/.env` on the VPS):
   - `POSTIZ_API_URL=https://social.vidnov.com`
   - `POSTIZ_API_KEY=<key>`  ← never `NEXT_PUBLIC_`, never client bundles
3. Grant the key only the channels the marketing team has approved.

## Publishing policy (enforced by the Vidnov integration code)

- Vidnov admin UI can only **schedule drafts**; public publishing requires
  the marketing team's approval inside Postiz (or a later explicit feature).
- Campaign content is rendered only from saved Vidnov records; listings with
  missing prices or unavailable status are excluded automatically.
- "Published" is reported only when Postiz confirms it (webhook/callback) —
  "accepted"/"scheduled" are shown as such, never upgraded.
