'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, X } from 'lucide-react';

import { DOWNLOAD_PAGE_PATH, IS_PUBLISHED, PLAY_STORE_URL } from '@/lib/android-app';

/**
 * SMART INSTALL PROMOTION.
 *
 * A dismissal-respecting prompt, mounted only on the marketing surface (via
 * `LandingLayout`), so it can never interrupt someone mid-checkout or in the
 * seller studio.
 *
 * The rules it follows — each one deliberate:
 *
 *   1. NOTHING IS FAKED. While there is no verified Play listing the prompt says
 *      "coming soon" and links to `/download`. It never renders a button that
 *      looks like it will install something and does not.
 *   2. IT WAITS. It only appears after the visitor has actually read something
 *      (a quarter of the page scrolled, or 20 seconds), never on arrival.
 *   3. DISMISSAL IS PERMANENT. "Not now" and the close button both write a
 *      localStorage flag; we do not ask again on this device. Declining is a
 *      real answer, not a snooze.
 *   4. IT KNOWS WHEN IT IS POINTLESS. Already installed as a PWA, running inside
 *      the app's own browser handoff, or on a phone that has the Play listing —
 *      no prompt.
 *   5. IT DOES NOT REDIRECT. Tapping opens the store (a third-party install
 *      flow, a legitimate external hand-off) or `/download`; nothing navigates
 *      the page out from under anyone.
 *   6. iPHONE IS NOT ADVERTISED. There is no iOS build, so no iOS copy exists.
 */

const DISMISS_KEY = 'vidnov.android-prompt.dismissed.v1';

/** Routes where a promotion would be an interruption, never a help. */
const SUPPRESSED_PREFIXES = ['/buyer', '/seller', '/dashboard', '/admin', '/auth', '/app', '/download', '/checkout', '/cart'];

export function SmartInstallPrompt() {
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Private mode with storage disabled: honour the dismissal for this page.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      if (window.localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // Storage unavailable — treat as undecided and continue with the timing.
    }

    // Already running as an installed app (PWA or the Android app's own shell).
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Never inside an embedded preview frame — install flows do not work there.
    let framed = false;
    try {
      framed = window.self !== window.top;
    } catch {
      framed = true;
    }
    if (framed) return;

    if (SUPPRESSED_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix))) return;

    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      setVisible(true);
      cleanup();
    };

    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const height = document.documentElement.scrollHeight || 1;
      if (scrolled / height >= 0.25) show();
    };

    const timer = window.setTimeout(show, 20_000);
    window.addEventListener('scroll', onScroll, { passive: true });

    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    }

    return cleanup;
  }, []);

  if (!visible) return null;

  return (
    <div
      role="complementary"
      aria-label="Vidnov Android app"
      className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md rounded-2xl border border-[#ff5a36]/30 bg-[#101010]/96 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur md:inset-x-auto md:right-6 md:bottom-6 md:mx-0 md:w-[380px]"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ff5a36]/15">
          <Download className="h-4 w-4 text-[#ff5a36]" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">
            {IS_PUBLISHED ? 'Vidnov is on Google Play' : 'The Vidnov Android app is on its way'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#a79e95]">
            {IS_PUBLISHED
              ? 'Take the marketplace with you — same account, native app.'
              : 'A native Android app is being prepared for Google Play. The website stays complete in the meantime.'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {IS_PUBLISHED ? (
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center rounded-full bg-[#ff5a36] px-4 text-xs font-bold text-[#150d0b] hover:bg-[#ff6a49]"
              >
                Get it on Google Play
              </a>
            ) : (
              <Link
                href={DOWNLOAD_PAGE_PATH}
                className="inline-flex h-9 items-center rounded-full bg-[#ff5a36] px-4 text-xs font-bold text-[#150d0b] hover:bg-[#ff6a49]"
              >
                See the app status
              </Link>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-9 items-center rounded-full border border-white/12 px-4 text-xs font-semibold text-[#c9c1b8] hover:bg-white/5"
            >
              Not now
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss app promotion"
          className="rounded-md p-1 text-[#7d7570] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
