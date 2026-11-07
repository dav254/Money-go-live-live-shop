'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import {
  CONSENT_CHANGED_EVENT,
  hasMarketingConsent,
} from '@/lib/cookie-consent';
import { META_PIXEL_ID, META_PIXEL_SCRIPT_SRC } from '@/lib/meta-pixel';

export { META_PIXEL_ID };

/**
 * META PIXEL — installed once, after marketing consent, across App Router
 * navigations.
 *
 * ## The pixel ID lives here
 *
 * `28731676109830564` is the Vidnov Meta Pixel. It is a public identifier (it
 * ships in the page source of every site that has one), not a secret.
 *
 * ## Consent is the gate, not a nicety
 *
 * The official snippet loads `connect.facebook.net/en_US/fbevents.js` and
 * fires `PageView` on every page. This component does neither until
 * `hasMarketingConsent()` is true — i.e. until the visitor answered the
 * marketing question in the cookie banner with "Allow". Visitors who declined,
 * or who have not been asked, get no script, no cookie and no request to
 * Facebook. It subscribes to `CONSENT_CHANGED_EVENT`, so allowing marketing in
 * the banner starts measurement immediately without a reload, and revoking it
 * stops all further PageView tracking (a loaded script cannot be un-loaded, so
 * this degrades to "track nothing else" — the honest limit).
 *
 * ## App Router navigation without duplicate PageViews
 *
 * A single-page app does not reload the document on navigation, so Meta's
 * snippet alone would record one PageView for a whole session. This component
 * tracks `usePathname()` changes, and guards against the two ways that turns
 * into double counting:
 *
 *   • `initialised` — `fbq('init', …)` runs exactly once per document, even
 *     after a consent change or a remount;
 *   • `lastTracked` — the current path is only sent when it actually changed,
 *     so a re-render (or navigating to the page you are already on) never
 *     fires a second event.
 *
 * Google Analytics, Google Ads and Tag Manager are untouched: they live in
 * `AnalyticsGate` and the root layout and this component never touches
 * `window.dataLayer` or `window.gtag`.
 */


type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: unknown;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

/** Document-wide flag: the pixel queue/script is installed at most once. */
const INIT_FLAG = '__vidnovMetaPixelInit';

/**
 * The queue half of Meta's official snippet.
 *
 * Order matters and mirrors Meta's code: `fbq` pushes onto a queue until
 * fbevents.js loads and replaces `callMethod`, which is why `init` and the
 * first `track` can be called before the script arrives.
 */
function installQueue(): void {
  if (typeof window === 'undefined') return;
  if (window.fbq && (window as unknown as Record<string, unknown>)[INIT_FLAG]) return;

  if (!window.fbq) {
    const fbq = function (this: unknown, ...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else (fbq.queue = fbq.queue ?? []).push(args);
    } as FbqFn;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = META_PIXEL_SCRIPT_SRC;
  document.head.appendChild(script);

  (window as unknown as Record<string, unknown>)[INIT_FLAG] = true;
}

export function MetaPixel() {
  const pathname = usePathname();
  const initialised = React.useRef(false);
  const lastTracked = React.useRef<string | null>(null);
  const [allowed, setAllowed] = React.useState(false);

  // Consent can change at any time (banner, footer "Cookie settings").
  React.useEffect(() => {
    const sync = () => setAllowed(hasMarketingConsent());
    sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
  }, []);

  React.useEffect(() => {
    if (!allowed || typeof window === 'undefined') return;

    if (!initialised.current) {
      installQueue();
      initialised.current = true;
      window.fbq?.('init', META_PIXEL_ID);
      window.fbq?.('track', 'PageView');
      lastTracked.current = pathname ?? null;
      return;
    }

    // Client-side route change: one PageView per distinct path.
    if (pathname && lastTracked.current !== pathname) {
      window.fbq?.('track', 'PageView');
      lastTracked.current = pathname;
    }
  }, [allowed, pathname]);

  return null;
}
