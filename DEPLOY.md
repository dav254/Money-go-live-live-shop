# GoEarnvid — VPS Deployment Guide (Domain + SSL)

Deploy the site on your own VPS, point your domain at it, and serve it over HTTPS.
Tested path: **Ubuntu 22.04/24.04 + Node 20 + PM2 + Nginx + Let's Encrypt (Certbot)**.

> A budget VPS is enough to start (Hetzner CX22 / DigitalOcean $6 / Vultr $6):
> 2 vCPU, 4 GB RAM recommended — `next build` is memory hungry.

---

## 0. Prerequisites

- A VPS with Ubuntu + root/sudo access
- Your domain (e.g. `goearnvid.shop`) at any registrar
- Your secrets ready: Firebase service-account JSON, Cloudinary, Gemini key, etc.

DNS plan:

| Record | Name  | Value          |
|--------|-------|----------------|
| A      | `@`   | YOUR_VPS_IP    |
| A      | `www` | YOUR_VPS_IP    |

---

## 1. Server setup

```bash
ssh root@YOUR_VPS_IP

# Node 20 + essentials + ffmpeg (required by the media compression pipeline)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git nginx ffmpeg
npm install -g pm2
ffmpeg -version   # must print a version (ffprobe comes with it)
```

---

## 2. Get the code onto the VPS

```bash
adduser --disabled-password --gecos "" goearnvid
su - goearnvid
git clone <YOUR_REPO_URL> app && cd app
```

---

## 3. Environment variables

Create `.env.production` in the app root (never commit it):

```bash
cp .env .env.production   # then edit values
```

Required keys:

```
# Firebase (server/admin) — easiest on a VPS: paste the whole service-account JSON
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account", ...}
# (or point GOOGLE_APPLICATION_CREDENTIALS=/home/goearnvid/service-account.json)

# Firebase client (public by design)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Cloudinary (product images/videos)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
NEXT_PUBLIC_CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Gemini (Genkit AI)
GEMINI_API_KEY=...

# Payments / live (only if used)
PESAPAL_CONSUMER_KEY=...
PESAPAL_CONSUMER_SECRET=...

# LiveKit (REQUIRED — the only live transport; VideoSDK was removed)
# Self-hosted on the VPS (free) or any LiveKit host.
# LIVEKIT_URL is the websocket URL clients connect to, e.g. wss://live.yourdomain.com
LIVEKIT_URL=wss://...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...

# Vidnov media system (all optional — these are the defaults)
VIDNOV_MAX_IMAGE_UPLOAD_MB=10
VIDNOV_MAX_VIDEO_UPLOAD_MB=100
VIDNOV_MAX_VIDEO_DURATION_SECONDS=60
VIDNOV_MAX_IMAGE_DIMENSION=1600
VIDNOV_THUMBNAIL_DIMENSION=400
VIDNOV_VIDEO_MAX_HEIGHT=720
VIDNOV_VIDEO_CRF=28
VIDNOV_STORAGE_WARNING_PERCENT=70
VIDNOV_STORAGE_HIGH_PERCENT=80
VIDNOV_STORAGE_CRITICAL_PERCENT=90
VIDNOV_STORAGE_EMERGENCY_PERCENT=95
VIDNOV_MEDIA_ROOT=/var/lib/vidnov/media
VIDNOV_TMP_ROOT=/var/lib/vidnov/tmp
VIDNOV_TEMP_RETENTION_HOURS=6
```

The code already resolves Firebase admin creds in this order:
`GOOGLE_APPLICATION_CREDENTIALS` → `FIREBASE_SERVICE_ACCOUNT_JSON` → `./service-account.json` → ADC
(see `src/firebase/server.ts`), so any one of those works on a plain VPS.

> **Security:** the service-account key and Twilio credentials were previously
> committed. **Rotate them** before going live, and never put the new ones in git.

---

## 4. Build and run with PM2

```bash
npm ci
npm run build
pm2 start npm --name goearnvid -- start   # runs `next start` on :3000
pm2 save && pm2 startup                   # start on boot (follow printed instruction)
```

---

## 5. Nginx reverse proxy

```bash
sudo tee /etc/nginx/sites-available/goearnvid <<'EOF'
server {
    listen 80;
    server_name goearnvid.shop www.goearnvid.shop;

    client_max_body_size 100m;   # allow video uploads through the proxy

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;        # socket.io / live streams
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -s /etc/nginx/sites-available/goearnvid /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 6. Free SSL with Let's Encrypt

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d goearnvid.shop -d www.goearnvid.shop
# auto-renewal is installed by default; verify with:
certbot renew --dry-run
```

Your site is now live at **https://goearnvid.shop**.

---

## 7. Firebase console changes (important)

1. **Authentication → Settings → Authorized domains** — add `goearnvid.shop`
   and `www.goearnvid.shop`, otherwise Google sign-in and email links fail.
2. If you use OAuth (Google/TikTok login), add `https://goearnvid.shop` as an
   authorized redirect in each provider's developer console.
3. PESAPAL / Cloudinary callback URLs: update any `localhost` or
   `*.e2b.app` URLs to `https://goearnvid.shop`.

---

## 8. Updates

```bash
su - goearnvid && cd ~/app
git pull
npm ci && npm run build
pm2 restart goearnvid
```

Zero-downtime tip: `pm2 reload goearnvid` instead of `restart`.

---

## 9. Media storage — compressed files on your VPS (Vidnov system)

All uploads are processed on the VPS and only optimized files are kept:

- **Images** → resized to max 1600px, converted to WebP (~q80), metadata
  stripped, plus a 400px thumbnail. A 10MB phone photo becomes ~100–300 KB.
- **Videos** → FFmpeg transcode to H.264/AAC MP4, max 720p, CRF 28, max 60s,
  plus a 400px poster thumbnail. A 100MB clip becomes ~5–15 MB.
- **Originals are always deleted** after processing; only the optimized file
  + thumbnail remain (see `src/lib/media/`).
- Uploads are gated by disk protection: 70% warn → 80% high → 90% critical
  (uploads restricted) → 95% emergency (uploads disabled). It never deletes
  published content automatically.
- A daily cleanup sweep removes abandoned temp files and orphaned media
  (built into the app via `src/instrumentation.ts` — no cron needed).
- The **media index** (which file belongs to which seller, its status, its
  paths) is mirrored to the local PocketBase (`media_files` collection),
  same as profiles/roles/email-logs. Uploads, the "my uploads" list and
  video serving all read the VPS store first and only fall back to Firestore
  when PocketBase is off — so a Firestore problem can no longer hide a
  seller's uploads.
- The **product catalog** is mirrored the same way (`products` collection on
  PocketBase). Every listing create / edit / delete syncs to the VPS, and the
  seller stock screen + admin product console merge in VPS-only rows, so a
  Firestore outage can never make a seller's whole shop look empty. One-time
  backfill of existing listings: `npx -y tsx scripts/migrate-products.ts`.

### Migrated sections — live sessions, orders, wallet

The same mirror-with-VPS-first-reads pattern now covers the three sections
where a Firestore outage used to halt the business rather than just hide data:

- **Live sessions** (`live_sessions`). `POST /api/live-session` reads the
  profile, balance and session VPS-first and writes the session (and the
  100-point charge) there first; the buyer's viewer-token route and the LIVE
  NOW grid read VPS-first too. Firestore gets the same writes best-effort.
  Backfill (sessions **and** profile balances — the charge refuses to invent
  a balance it cannot read): `npx -y tsx scripts/migrate-live-sessions.ts`
- **Orders** (`orders`). Seller order list/status, move-to-delivery, admin
  status, delete, both payment webhooks and the tier sweep read VPS-first;
  status changes land on the VPS first with a plain-JSON twin of every
  Firestore update. Checkout (both carts + buy-now), the dispute dialog and
  accepted request-offers mirror the order here (`/api/orders/sync`).
  Backfill: `npx -y tsx scripts/migrate-orders.ts`
- **Wallet** (`payouts`, `wallet_transactions`, `payments`). Payment webhook
  rows land VPS-first under a deterministic id (a gateway retry upserts the
  same row instead of double-crediting the ledger), points credits move both
  balances, refunds mirror their ledger rows, and the admin pending-payout
  total reads VPS-first. Seller payout requests and the checkout points
  simulation sync from the client (`/api/wallet/sync`).
  Backfill: `npx -y tsx scripts/migrate-wallet.ts`

Run the three backfills once, in any order, after setting the PocketBase env
vars — all are safe to re-run (matched by original Firestore id).

### Migrated sections — shops and per-user data

Two more sets of documents were only ever in Firestore, and each one was a
single point of failure for something the rest of the mirrored data points at:

- **Shops** (`seller_shops`). `sellerShops/{uid}` is the storefront — name,
  logo, banner, category, location, policies, links — and Discovery, the buyer
  dashboard, invoices and the LIVE grid all read it. The listings were already
  mirrored, so the catalog survived an outage while the shops in front of it
  did not. Every seller save (settings, branding, account, social links)
  syncs to the VPS (`/api/shops/sync`), the public business endpoint and the
  LIVE grid read the VPS copy first, and the LIVE grid resolves every shop in
  one request instead of one Firestore read per seller.
  Backfill: `npx -y tsx scripts/migrate-shops.ts`
- **Per-user data** (`user_carts`, `user_payment_methods`,
  `user_payout_methods`). The `payments`/`payouts` ledgers were mirrored but
  the documents they depend on were not: the cart both cart screens read at
  checkout, and the payout destinations a withdrawal is sent to. Every add,
  quantity change and removal syncs (`/api/users/sync`, always scoped to the
  caller's own profile — the route cannot name another account at all), and
  `GET /api/cart` serves the VPS copy first so a Firestore failure shows the
  buyer their cart instead of an empty one. Backfill (collection-group reads,
  one query per set): `npx -y tsx scripts/migrate-user-data.ts`

Like the others, both backfills are safe to re-run — shops match on their
Firestore id, per-user documents on owner + document id — and every mirror
helper returns `false`/`null` instead of throwing when PocketBase is off, so
deploying this changes nothing until the env vars are set.

One-time setup on the VPS:

```bash
sudo mkdir -p /var/lib/vidnov/media/images /var/lib/vidnov/media/videos \
              /var/lib/vidnov/media/thumbnails /var/lib/vidnov/tmp
sudo chown -R goearnvid:goearnvid /var/lib/vidnov
```

Admin monitoring: **Admin → System & Settings → Media Storage** shows disk
usage, thresholds, largest files, failed uploads and a "Run Cleanup" button.

Feeds use the lightweight 400px thumbnails; full videos load only when a user
presses play — this saves both VPS bandwidth and buyer mobile data.

When revenue starts, media can migrate to object storage/CDN without app
changes: the DB stores logical paths and everything is served through
`/api/media/file/*` — swap that route for a CDN redirect and you're done.

---

## 10. Checklist before launch

- [ ] `https://goearnvid.shop` loads over HTTPS (padlock)
- [ ] Sign-up/login works on the domain (Firebase authorized domains)
- [ ] `/api/system-status` shows Firestore/Cloudinary/Gemini operational
- [ ] Product upload puts a file in Cloudinary folder `sellers/<uid>/products`
- [ ] Live streaming works (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET set)
- [ ] PM2 running: `pm2 status`, logs: `pm2 logs goearnvid`
- [ ] `manifest.json` loads — "Install App" works (Android/desktop Chrome)
