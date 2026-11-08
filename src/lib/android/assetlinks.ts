/**
 * DIGITAL ASSET LINKS for the Vidnov Android package.
 *
 * Google Play requires the app package and the website to prove they belong to
 * each other, or Android shows a browser address bar above the app. The proof
 * is `/.well-known/assetlinks.json` carrying the SHA-256 of the certificate
 * that signed the installed APK.
 *
 * The fingerprint is a production fact — it only exists after the signing key
 * does — so it is read from the environment and never invented. Play App
 * Signing adds a SECOND certificate, so several fingerprints are supported.
 *
 * Kept in a plain module (no Next.js imports) so the exact JSON shape can be
 * tested without a server or a real certificate.
 */

/** Android package id — kept in step with `mobile/app.json`. */
export const ANDROID_PACKAGE_NAME = 'com.vidnov.app';

/** Relation Android checks when handing a URL to an app. */
const HANDLE_ALL_URLS = 'delegate_permission/common.handle_all_urls';

/** Normalise keytool / Play Console output to `AA:BB:…` uppercase hex. */
export function normaliseFingerprint(raw: string): string | null {
  const hex = raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (hex.length !== 64) return null;
  const pairs = hex.match(/.{2}/g);
  return pairs ? pairs.join(':') : null;
}

/**
 * Parse the configured value: comma/space/semicolon separated fingerprints.
 * Anything that is not a 32-byte SHA-256 digest is dropped rather than
 * published — a malformed entry would silently fail verification.
 */
export function parseFingerprints(value: string | undefined | null): string[] {
  return (value ?? '')
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normaliseFingerprint)
    .filter((entry): entry is string => entry !== null);
}

/** The exact statements array Android expects. */
export function buildAssetLinks(fingerprints: string[]) {
  return fingerprints.map((fingerprint) => ({
    relation: [HANDLE_ALL_URLS],
    target: {
      namespace: 'android_app',
      package_name: ANDROID_PACKAGE_NAME,
      sha256_cert_fingerprints: [fingerprint],
    },
  }));
}
