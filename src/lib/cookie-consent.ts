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
 * ## Two independent choices (Meta Pixel)
 *
 * Analytics and marketing are separate purposes, so they are separate cookies:
 *
 *   cookie_consent    → analytics   (Google Analytics)   — unchanged name
 *   cookie_marketing  → marketing   (Meta Pixel)         — added later
 *
 * The analytics cookie keeps its original name AND its original `granted` /
 * `denied` / legacy `true` / `false` values, so nobody who already answered is
 * asked again or silently promoted. Marketing is a NEW purpose: an existing
 * `cookie_consent=granted` does NOT imply marketing consent, so `marketing`
 * stays `null` (undecided) until the visitor actually chooses. The banner
 * reopens once for those visitors to ask only that question, and
 * `MetaPixel` refuses to load until it is answered with `granted`.
 *
 * Nothing essential — sign-in, registration, checkout, the whole site — reads
 * either value, so declining both changes nothing functional.
 */

export const CONSENT_COOKIE = 'cookie_consent';
export const MARKETING_CONSENT_COOKIE = 'cookie_marketing';

/** Fired on window whenever the consent changes or the banner is reopened. */
export const CONSENT_CHANGED_EVENT = 'vidnov:consent-changed';

export type CookieConsent = 'granted' | 'denied';

/** One visitor decision. `null` means "not asked yet". */
export interface ConsentState {
  analytics: CookieConsent | null;
  marketing: CookieConsent | null;
}

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
  name: string = CONSENT_COOKIE,
): string {
  const expires = new Date(now + CONSENT_DURATION_DAYS * 24 * 60 * 60 * 1000).toUTCString();
  return `${name}=${value}; expires=${expires}; path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry?.slice(name.length + 1) ?? null;
}

/** Reads the persisted decision, or null while the visitor has not chosen. */
export function readConsent(): CookieConsent | null {
  return parseConsentCookie(readCookie(CONSENT_COOKIE));
}

/**
 * Both stored purposes, from the raw cookie values. Pure, so the migration
 * rule below is unit-testable.
 *
 * A visitor who answered the old single-purpose banner has an analytics value
 * and NO marketing cookie: analytics is preserved, marketing is `null`
 * (undecided) — never inherited from the analytics answer.
 */
export function consentStateFrom(
  analyticsRaw: string | null | undefined,
  marketingRaw: string | null | undefined,
): ConsentState {
  return {
    analytics: parseConsentCookie(analyticsRaw),
    marketing: parseConsentCookie(marketingRaw),
  };
}

/** Both stored purposes, as last decided. */
export function readConsentState(): ConsentState {
  return consentStateFrom(readCookie(CONSENT_COOKIE), readCookie(MARKETING_CONSENT_COOKIE));
}

/**
 * True only when the visitor explicitly granted marketing consent — the single
 * condition under which Meta Pixel may load.
 */
export function hasMarketingConsent(): boolean {
  return parseConsentCookie(readCookie(MARKETING_CONSENT_COOKIE)) === 'granted';
}

/**
 * True when the banner still has something to ask: the marketing purpose has
 * never been answered. Visitors from before the marketing cookie existed get
 * asked once, without losing their analytics choice.
 */
export function needsConsentChoice(): boolean {
  return readConsentState().marketing === null;
}

/** Persists the analytics decision and notifies listeners. */
export function writeConsent(value: CookieConsent): void {
  if (typeof document === 'undefined') return;
  document.cookie = serializeConsentCookie(value);
  window.dispatchEvent(new CustomEvent<CookieConsent>(CONSENT_CHANGED_EVENT, { detail: value }));
}

/**
 * Persists both decisions together (what the banner's "Save choices" does).
 * Each purpose gets its own cookie, so revoking one never touches the other.
 */
export function writeConsentState(state: ConsentState): void {
  if (typeof document === 'undefined') return;
  if (state.analytics) document.cookie = serializeConsentCookie(state.analytics);
  if (state.marketing) {
    document.cookie = serializeConsentCookie(state.marketing, Date.now(), undefined, MARKETING_CONSENT_COOKIE);
  }
  window.dispatchEvent(
    new CustomEvent<ConsentState>(CONSENT_CHANGED_EVENT, { detail: state }),
  );
}

/** "Cookie settings" links call this to reopen the banner for a new choice. */
export function requestConsentBanner(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT));
}
