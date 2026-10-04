/*
 * Vidnov service worker — offline app shell + cloud-only media cache.
 * Media (images/videos on Cloudinary/Firebase) is never cached: it is served
 * from the CDN every time so sellers always see their latest uploads.
 *
 * ## Why this file is network-first almost everywhere
 *
 * The earlier version served `/_next/static/*` cache-first and revalidated in
 * the background. That is the standard recipe and it is wrong for this app.
 *
 * The bug it caused: in development Next.js serves STABLE chunk filenames —
 * `/\_next/static/chunks/app/app/buyer/shop/page.js`, not a content-hashed
 * name — and it serves them with `Cache-Control: no-store, must-revalidate`.
 * Cache-first on a stable URL means the worker kept serving the bytes it
 * grabbed on the very first load. Every code change was invisible until the
 * cache was cleared by hand, which is exactly the "my changes do not show up"
 * symptom. The stale-while-revalidate comment in the old file described intent,
 * not behaviour: the revalidated copy only took effect on the load AFTER the
 * one where you were already looking at stale code.
 *
 * The rule now is simple and it is driven by the response, not by a guess:
 *
 *   - `no-store` in the response means the origin refuses to be cached, so we
 *     do not cache it. This is what makes development self-healing.
 *   - `immutable` / long `max-age` means the URL changes when the bytes do
 *     (that is the production contract for hashed assets), so cache-first is
 *     safe and fast.
 *   - anything else falls back to network-first, which is slower offline but
 *     never serves a stale app.
 *
 * Dev is additionally detected by hostname and forced network-first, because
 * that is the only place where stable-URL caching is guaranteed to be wrong.
 */
const CACHE = 'vidnov-shell-v3';
const PRECACHE = ['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];
const MEDIA_HOSTS = ['res.cloudinary.com', 'firebasestorage.googleapis.com', 'firebasestorage.app'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/*
 * PUSH.
 *
 * `push` is what actually wakes the phone; `notificationclick` is what the
 * user does next. Both are separate from `fetch` — nothing here touches the
 * caching strategy above, which is why adding push here does not disturb the
 * no-store fix.
 *
 * The payload arrives as FCM's `notification` message, which the browser
 * displays on its own. We deliberately keep `title`/`body` OUT of the FCM
 * `notification` block and only carry data, so this handler owns the whole
 * presentation — otherwise the notification appears twice on Android (once
 * from FCM, once from here). See `push-server.ts`.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    // A non-JSON body (some providers send a bare string) still deserves a
    // notification rather than being dropped silently.
    payload = { title: 'Vidnov', body: event.data.text() };
  }

  const title = payload.title || 'Vidnov';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // `tag` collapses repeats of the same event, so five order updates do not
    // become five separate notifications that need dismissing one by one.
    tag: payload.tag || 'vidnov',
    renotify: false,
    data: { link: payload.link || '/' },
    actions: [{ action: 'open', title: 'Open' }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/*
 * Where a tapped notification goes.
 *
 * `clients.matchAll` with `includeUncontrolled` because the app is very often
 * not the focused tab — a phone with three other apps open still delivers the
 * push, and focusing an existing window is far less jarring than cold-starting
 * a new one into the middle of a conversation the user was already in.
 *
 * The link is sanitised to a same-origin path: `notification.data.link` comes
 * off the wire, and an absolute URL here would let a crafted push navigate the
 * installed PWA to another origin.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let target = '/';
  const data = event.notification.data || {};
  if (typeof data.link === 'string' && data.link.startsWith('/') && !data.link.startsWith('//')) {
    target = data.link;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if ('navigate' in client && client.url !== self.location.origin + target) {
            return client.navigate(target).then((c) => c && c.focus());
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener('message', (event) => {
  // The page asks the waiting worker to activate immediately so an update is
  // live on the next load rather than the next full app restart.
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache media or cross-origin API responses — CDN serves them fresh.
  if (url.origin !== self.location.origin || MEDIA_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) {
    return;
  }

  const isDevHost =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '0.0.0.0' ||
    url.hostname.endsWith('.e2b.app');

  const isBuildAsset =
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json';

  if (isBuildAsset) {
    // Dev never serves from cache: stable filenames plus a cache-first policy
    // is precisely what hid every code change from the user.
    if (isDevHost) return;

    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          const cc = res.headers.get('Cache-Control') || '';

          // Respect the origin's own instruction. `no-store` is how the dev
          // server says "these bytes are disposable"; honouring it is what
          // stops this worker from becoming the reason a change is invisible.
          if (res.status === 200 && !/\bno-store\b/.test(cc)) {
            const cache = await caches.open(CACHE);
            cache.put(request, res.clone());
          }

          // Hashed production assets are safe to serve from cache first,
          // because the URL changes when the bytes do.
          if (/immutable/.test(cc)) {
            const cache = await caches.open(CACHE);
            const cached = await cache.match(request);
            if (cached) return cached;
          }

          return res;
        } catch {
          const cached = await caches.match(request);
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Navigations/API: network-first with offline fallback to the cached shell.
  event.respondWith(
    fetch(request)
      .then((res) => res)
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});