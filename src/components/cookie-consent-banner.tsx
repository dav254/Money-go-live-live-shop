'use client';

import * as React from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  CONSENT_CHANGED_EVENT,
  needsConsentChoice,
  readConsentState,
  writeConsentState,
  type ConsentState,
} from '@/lib/cookie-consent';

/**
 * COOKIE CONSENT BANNER — the real consent dialog.
 *
 * Two optional purposes, each with its own switch and its own cookie:
 *
 *   • **Analytics** (Google Analytics) → `AnalyticsGate`;
 *   • **Marketing** (Meta Pixel) → `MetaPixel`.
 *
 * They are answered together but stored separately, so a visitor can keep
 * analytics while refusing advertising measurement — which is the whole point
 * of a per-purpose choice. Essential cookies (sign-in, preferences) are always
 * on and are described, not offered, because the site cannot work without them.
 *
 * Shows until BOTH purposes have been answered. A visitor who decided under the
 * old single-purpose banner keeps their analytics answer and is asked only the
 * new marketing question. Listens for the footer's "Cookie settings" event so
 * the decision can be changed at any time; declining changes nothing else on
 * the site.
 */
export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = React.useState(false);
  const [hasChosen, setHasChosen] = React.useState(false);
  const [analytics, setAnalytics] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);

  React.useEffect(() => {
    const stored = readConsentState();
    setAnalytics(stored.analytics === 'granted');
    // Marketing starts OFF unless it was explicitly granted: a purpose that has
    // never been answered must never be pre-ticked.
    setMarketing(stored.marketing === 'granted');
    setHasChosen(stored.analytics !== null || stored.marketing !== null);
    setIsVisible(needsConsentChoice());

    // "Cookie settings" anywhere on the site reopens the dialog.
    const reopen = () => setIsVisible(true);
    window.addEventListener(CONSENT_CHANGED_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, reopen);
  }, []);

  const save = (next: ConsentState) => {
    writeConsentState(next);
    setAnalytics(next.analytics === 'granted');
    setMarketing(next.marketing === 'granted');
    setHasChosen(true);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 motion-safe:animate-in motion-safe:slide-in-from-bottom-10"
    >
      <Card className="container mx-auto max-w-xl border-border bg-background/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Cookie className="h-8 w-8 shrink-0 text-primary" aria-hidden />
          <div className="flex-1">
            <h3 className="font-semibold">We use cookies</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Essential cookies keep you signed in and remember your settings —
              they are always on. Two optional purposes help us understand the
              site and our advertising; both are off unless you allow them.
              Declining changes nothing else on the site.{' '}
              <Link href="/privacy" className="underline hover:text-primary">
                Learn more in our Privacy Policy
              </Link>
              .
            </p>

            <div className="mt-3 grid gap-2 text-sm">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={analytics}
                  onChange={(event) => setAnalytics(event.target.checked)}
                />
                <span>
                  <span className="font-medium">Analytics</span>
                  <span className="block text-xs text-muted-foreground">
                    Google Analytics, with anonymised IP addresses.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={marketing}
                  onChange={(event) => setMarketing(event.target.checked)}
                />
                <span>
                  <span className="font-medium">Marketing</span>
                  <span className="block text-xs text-muted-foreground">
                    Meta Pixel, which measures visits from Facebook and Instagram
                    ads.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="rounded-lg text-xs font-semibold"
                onClick={() =>
                  save({
                    analytics: analytics ? 'granted' : 'denied',
                    marketing: marketing ? 'granted' : 'denied',
                  })
                }
              >
                Save choices
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg text-xs font-semibold"
                onClick={() => save({ analytics: 'granted', marketing: 'granted' })}
              >
                Accept all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-lg text-xs font-semibold"
                onClick={() => save({ analytics: 'denied', marketing: 'denied' })}
              >
                Decline optional
              </Button>
              {hasChosen && (
                <span className="self-center text-[11px] text-muted-foreground">
                  You can change this anytime in the footer under Cookie settings.
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
