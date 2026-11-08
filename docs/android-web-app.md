# Shipping the Vidnov web app as the Android app (TWA)

## The short answer

A Next.js app cannot be "compiled" into an APK: every screen is rendered by the
server, so the APK would have to bundle a Node server. The supported Android
equivalent is a **Trusted Web Activity (TWA)** — a thin native shell around
`https://vidnov.com` that runs full-screen, with no URL bar, as a real Play
Store package.

That gives exactly what was asked for:

- **one product, not two** — the same `/app` web app (buyer and seller
  sections), no duplicated UI, no second codebase to keep in sync;
- **no design change** — the TWA renders the site as it is;
- **instant updates** — a web deploy reaches the installed app immediately,
  no Play review for UI changes;
- **nothing deleted** — the website keeps working for everyone.

The screens, the layout and the styles are untouched. The only new code is
`src/app/.well-known/assetlinks.json/route.ts`, which proves to Android that
this package owns this domain.

## 1. Build the Android package

Either route produces a signed bundle you can upload to Play.

### Route A — PWABuilder (no toolchain, ~5 minutes)

1. Open <https://www.pwabuilder.com> and enter `https://vidnov.com`.
2. Choose **Package for stores → Android**.
3. Set:
   - Package ID: `com.vidnov.app`
   - App name: `Vidnov`
   - Start URL: `/app`
   - Display mode: `standalone`
4. Download the package. It contains:
   - `*.aab` — the Play Store upload,
   - `signing.keystore` — **keep this file and its passwords safe forever**;
     losing it means you cannot update the app,
   - `assetlinks.json` — with your real SHA-256 fingerprint inside.
5. Copy the `sha256_cert_fingerprints` value out of that file.

### Route B — Bubblewrap CLI (on a machine with JDK 17 + Android SDK)

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://vidnov.com/manifest.json
# package id com.vidnov.app, start url /app
bubblewrap build          # produces app-release-bundle.aab + assetlinks.json
bubblewrap fingerprint    # prints the SHA-256
```

## 2. Publish the fingerprint on the server

`/.well-known/assetlinks.json` is generated from the environment, because a
fingerprint cannot be known until the key exists. On the VPS, add to the app's
`.env`:

```bash
ANDROID_APP_SHA256="AA:BB:CC:…"          # from assetlinks.json / keytool
# If Play App Signing is enabled, add Play's own certificate too:
# ANDROID_APP_SHA256="AA:BB:…,11:22:33:…"
```

Comma-separated values are supported — Play re-signs uploads with its own key,
so the Play certificate and the upload key are usually different.

Then redeploy:

```bash
su - goearnvid && cd ~/app && git pull && npm ci && npm run build && pm2 reload goearnvid
```

Verify it is live and valid:

```bash
curl -s https://vidnov.com/.well-known/assetlinks.json
curl -s "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://vidnov.com&relation=delegate_permission/common.handle_all_urls"
```

The second call must list your package under `statements`. Until it does,
Android shows the URL bar and Play review treats the package as a wrapper.

## 3. Play Console checklist

- Upload the `.aab` to a new app (`com.vidnov.app`), internal testing first.
- Store listing: name, short/full description, feature graphic, at least two
  phone screenshots, app icon 512×512 (`public/icons/icon-512.png`).
- Privacy policy URL: `https://vidnov.com/privacy`.
- Data safety form: account data (email, phone), photos, messages, purchases.
- Content rating questionnaire.
- **App access**: give reviewers a working test account, or the review fails —
  the app opens on a sign-in screen.
- Target API level: Play requires the current level; the generated project sets
  it, keep it when regenerating.

## 4. Things to know before shipping

- **Payments**: Paystack/PayPal checkout opens the system browser; that is
  normal for TWA and allowed by Play's payments policy for physical goods and
  services.
- **Camera / microphone / location**: Chrome inside the TWA asks for the
  permission and forwards it to the page — live streaming and photo upload work
  as they do in the browser. Grant them in the TWA's Android app info if a
  prompt does not appear.
- **Offline**: `public/sw.js` serves navigation network-first, so the app needs
  a connection; that is the current website behaviour, unchanged.
- **Sign-in persists** inside the TWA's Chrome instance, so users stay signed in
  between launches.

## 5. What happens to `mobile/`

The Expo/React Native project in `mobile/` is a second, parallel app. To have
**one** application, do not publish it alongside the TWA. Keep it in the repo
until the TWA is live, then either archive it or delete it in a dedicated
change — publishing both would be the "two applications" problem again.
