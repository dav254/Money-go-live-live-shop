'use client';

import { useEffect } from 'react';

/**
 * Registers the Vidnov service worker once, client-side.
 * Kept as a tiny client component so the root layout stays a server component.
 *
 * Also asks the browser to check for a new service worker on every load, so an
 * installed app picks up the latest version instead of staying on the one that
 * was cached at install time.
 *
 * Registered in every environment, not just production. Chrome only fires
 * `beforeinstallprompt` when the app has a registered service worker with a
 * fetch handler, so skipping this outside production left the "Install App"
 * button with no native prompt to show — Android users got the manual
 * instructions instead of the one-tap install they expected.
 *
 * Stale content is avoided by design rather than by disabling the worker:
 * sw.js serves navigations network-first, `/sw.js` is never cached, and every
 * load calls `registration.update()` plus `skipWaiting` below.
 *
 * Registration deliberately does not wait for the `load` event — see the note
 * in the effect below, which is about installability rather than performance.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(() => navigator.serviceWorker.getRegistration('/'))
        .then((registration) => {
          // Silent update check: fetches any newer sw.js in the background.
          registration?.update();
          registration?.addEventListener('updatefound', () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                // A new version is ready and takes over once every tab is closed
                // (or immediately, thanks to skipWaiting in sw.js).
                installing.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch((err) => {
          console.warn('[PWA] Service worker registration failed:', err);
        });
    };

    // Register as soon as the component mounts, NOT on `load`.
    //
    // Chrome only considers the app installable once a service worker with a
    // fetch handler is active and controlling the page, and it withholds
    // `beforeinstallprompt` until then. Waiting for the full `load` event meant
    // that a user who tapped Install straight after landing had no prompt to
    // show, which surfaced as "This app cannot be installed". Registering
    // during hydration gets the worker in place several seconds earlier, so the
    // prompt is usually already waiting by the time anyone looks at the button.
    register();
  }, []);

  return null;
}
