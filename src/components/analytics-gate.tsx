'use client';

import * as React from 'react';
import {
  CONSENT_CHANGED_EVENT,
  readConsent,
  type CookieConsent,
} from '@/lib/cookie-consent';

const GA_MEASUREMENT_ID = 'G-S7TZ4F1JMR';

type GtagArgs = unknown[];

/**
 * ANALYTICS GATE — Google Analytics runs only with consent.
 *
 * Replaces the two unconditional `next/script` tags that used to live in the
 * root layout and fired gtag on every visit, choice or not. This client
 * component:
 *
 *   • loads gtag (with `anonymize_ip`) only when the consent cookie says
 *     `granted` — on first paint of any page, so an accepted visitor is
 *     measured everywhere, not just after their next click;
 *   • listens for the consent event, so accepting in the banner starts
 *     measurement immediately;
 *   • if a visitor later declines via "Cookie settings", pushes a Consent
 *     Mode update so Google stops storing analytics for them.
 *
 * Nothing about sign-in, Firestore or the app depends on this component —
 * declining leaves every feature untouched, which is what makes declining a
 * real option.
 */
export function AnalyticsGate() {
  const loaded = React.useRef(false);

  const loadAnalytics = React.useCallback(() => {
    if (loaded.current || typeof window === 'undefined') return;
    loaded.current = true;

    const w = window as Window & { dataLayer?: GtagArgs[]; gtag?: (...args: GtagArgs) => void };
    w.dataLayer = w.dataLayer ?? [];
    // Same contract as the official snippet: gtag queues arguments for the
    // library, which is injected async below.
    const gtag = (...args: GtagArgs) => {
      w.dataLayer?.push(args);
    };
    w.gtag = gtag;

    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }, []);

  React.useEffect(() => {
    if (readConsent() === 'granted') loadAnalytics();

    const onConsent = (event: Event) => {
      const detail = (event as CustomEvent<CookieConsent | undefined>).detail;
      if (detail === 'granted') {
        loadAnalytics();
      } else if (detail === 'denied' && loaded.current) {
        // Consent Mode update: the tag stays but stops collecting and storing.
        (window as Window & { gtag?: (...args: GtagArgs) => void }).gtag?.(
          'consent',
          'update',
          { analytics_storage: 'denied' },
        );
      }
    };

    window.addEventListener(CONSENT_CHANGED_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onConsent);
  }, [loadAnalytics]);

  return null;
}
