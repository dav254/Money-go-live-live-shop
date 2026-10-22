/**
 * COOKIE CONSENT — the single source of truth.
 *
 * The banner used to write a `cookie_consent` cookie that nothing ever read,
 * while Google Analytics loaded on every visit regardless of the visitor's
 * choice. Consent is now a real gate:
 *
 *   • the choice is persisted in a first-party cookie (180 days, SameSite=Lax,
 *     Secure on https) so it survives reloads and returns;
 *   • `AnalyticsGate` (src/components/analytics-gate.tsx) loads Google
 *     Analytics ONLY when this cookie says `granted`;
 *   • declining stores `denied` and analytics never loads — every feature on
 *     the site keeps working, because nothing essential depends on it;
 *   • the footer's "Cookie settings" reopens the banner to change the choice.
 *
 * The cookie name is unchanged (`cookie_consent`) and legacy `true`/`false`
 * values are still understood, so visitors who already answered the old
 * banner are not prompted again.
 */

export const CONSENT_COOKIE = 'cookie_consent';

/** Fired on window whenever the consent changes or the banner is reopened. */
export const CONSENT_CHANGED_EVENT = 'vidnov:consent-changed';

export type CookieConsent = 'granted' | 'denied';

/** How long the choice is remembered, in days. */
export const CONSENT_DURATION_DAYS = 180;

/** Maps a raw cookie value to a decision. Legacy banners wrote true/false. */
export function parseConsentCookie(raw: string | null | undefined): CookieConsent | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (value === 'granted' || value === 'true') return 'granted';
  if (value === 'denied' || value === 'false') return 'denied';
  return null;
}

/** Builds the Set-Cookie value for a decision. Pure, so it is unit-testable. */
export function serializeConsentCookie(
  value: CookieConsent,
  now: number = Date.now(),
  secure: boolean = typeof window !== 'undefined' && window.location.protocol === 'https:',
): string {
  const expires = new Date(now + CONSENT_DURATION_DAYS * 24 * 60 * 60 * 1000).toUTCString();
  return `${CONSENT_COOKIE}=${value}; expires=${expires}; path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** Reads the persisted decision, or null while the visitor has not chosen. */
export function readConsent(): CookieConsent | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsentCookie(entry?.slice(CONSENT_COOKIE.length + 1) ?? null);
}

/** Persists the decision and notifies listeners (analytics gate, banner). */
export function writeConsent(value: CookieConsent): void {
  if (typeof document === 'undefined') return;
  document.cookie = serializeConsentCookie(value);
  window.dispatchEvent(new CustomEvent<CookieConsent>(CONSENT_CHANGED_EVENT, { detail: value }));
}

/** "Cookie settings" links call this to reopen the banner for a new choice. */
export function requestConsentBanner(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT));
}
