'use client';

import * as React from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  CONSENT_CHANGED_EVENT,
  readConsent,
  writeConsent,
} from '@/lib/cookie-consent';

/**
 * COOKIE CONSENT BANNER — the real consent dialog.
 *
 * Shows until the visitor chooses, remembers the choice for 180 days and
 * drives `AnalyticsGate`: Accept loads Google Analytics, Decline keeps it
 * blocked. Listens for the footer's "Cookie settings" event so a decision can
 * be changed later. The copy states exactly what is used — essential cookies
 * for sign-in and preferences (always on, no consent needed) and Google
 * Analytics (optional, anonymised IPs, off unless accepted).
 */
export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = React.useState(false);
  const [hasChosen, setHasChosen] = React.useState(false);

  React.useEffect(() => {
    const existing = readConsent();
    if (existing) {
      setHasChosen(true);
    } else {
      setIsVisible(true);
    }

    // "Cookie settings" anywhere on the site reopens the dialog.
    const reopen = () => setIsVisible(true);
    window.addEventListener(CONSENT_CHANGED_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, reopen);
  }, []);

  const decide = (value: 'granted' | 'denied') => {
    writeConsent(value);
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
      <Card className="container mx-auto max-w-lg border-border bg-background/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Cookie className="h-8 w-8 shrink-0 text-primary" aria-hidden />
          <div className="flex-1">
            <h3 className="font-semibold">We use cookies</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Essential cookies keep you signed in and remember your settings —
              they are always on. With your permission, Google Analytics (with
              anonymised IP addresses) helps us understand how the site is
              used. Declining changes nothing else on the site.{' '}
              <Link href="/privacy" className="underline hover:text-primary">
                Learn more in our Privacy Policy
              </Link>
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-lg text-xs font-semibold"
                onClick={() => decide('granted')}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg text-xs font-semibold"
                onClick={() => decide('denied')}
              >
                Decline
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
