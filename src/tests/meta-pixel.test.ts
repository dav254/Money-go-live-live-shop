import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  META_PIXEL_ID,
  META_PIXEL_SCRIPT_SRC,
  metaPixelNoScriptSrc,
} from '@/lib/meta-pixel';

/**
 * META PIXEL + CONSENT.
 *
 * Two properties must never regress, and neither is observable from a unit test
 * of a React component without a DOM, so they are asserted at the source and
 * constant level:
 *
 *   1. the pixel is the requested one, loaded from Meta's official URL, once;
 *   2. nothing about it can run before marketing consent — the component reads
 *      the marketing cookie and returns before touching `fbq`;
 *   3. Google Analytics, Google Ads and Tag Manager are untouched.
 *
 * A live event can only be proven with a browser and Meta Events Manager, so
 * no test here claims one was received.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${entry}`;
    const stat = statSync(join(process.cwd(), rel));
    if (stat.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(rel);
  }
  return out;
}

test('the pixel id and the official script URL are the requested ones', () => {
  assert.equal(META_PIXEL_ID, '28731676109830564');
  assert.equal(META_PIXEL_SCRIPT_SRC, 'https://connect.facebook.net/en_US/fbevents.js');
  assert.equal(
    metaPixelNoScriptSrc(),
    'https://www.facebook.com/tr?id=28731676109830564&ev=PageView&noscript=1',
  );
});

test('the pixel id is defined once and never inlined into a second init', () => {
  const files = walk('src').filter((file) => !file.startsWith('src/tests/'));
  // A string literal of the id may only exist in the shared constants module;
  // everywhere else reads `META_PIXEL_ID`, so a second hard-coded install (or a
  // stale copy after a pixel change) is impossible.
  const literalOwners = files.filter((file) => read(file).includes("'28731676109830564'"));
  assert.deepEqual(literalOwners, ['src/lib/meta-pixel.ts']);
  // The official library URL is referenced from that one module too.
  const scriptOwners = files.filter((file) =>
    read(file).includes("'https://connect.facebook.net/en_US/fbevents.js'"),
  );
  assert.deepEqual(scriptOwners, ['src/lib/meta-pixel.ts']);
});

test('the root layout mounts the pixel and its fallback exactly once', () => {
  const layout = read('src/app/layout.tsx');
  assert.equal([...layout.matchAll(/<MetaPixel \/>/g)].length, 1);
  assert.equal([...layout.matchAll(/<MetaPixelNoscript \/>/g)].length, 1);
});

test('nothing is loaded before marketing consent', () => {
  const pixel = read('src/components/meta-pixel.tsx');
  // The tracking effect returns immediately unless consent was granted…
  assert.match(pixel, /if \(!allowed \|\| typeof window === 'undefined'\) return;/);
  // …and `allowed` is only ever set from the marketing cookie.
  assert.match(pixel, /setAllowed\(hasMarketingConsent\(\)\)/);
  assert.doesNotMatch(pixel, /readConsent\(\)/, 'the analytics cookie must not enable the pixel');
});

test('the noscript fallback is server-gated by the marketing cookie', () => {
  const noscript = read('src/components/meta-pixel-noscript.tsx');
  assert.match(noscript, /MARKETING_CONSENT_COOKIE/);
  assert.match(noscript, /if \(decision !== 'granted'\) return null;/);
  assert.match(noscript, /metaPixelNoScriptSrc\(\)/);
});

test('PageView is tracked once per path and init only once per document', () => {
  const pixel = read('src/components/meta-pixel.tsx');
  assert.match(pixel, /initialised\.current/, 'init must be guarded by a document-wide ref');
  assert.match(pixel, /lastTracked\.current !== pathname/, 'a re-render must not re-track');
  assert.match(pixel, /'track', 'PageView'/);
  assert.equal(
    [...pixel.matchAll(/window\.fbq\?\.\('init'/g)].length,
    1,
    'init must be called exactly once',
  );
});

test('the pixel never touches the Google tags', () => {
  const pixel = read('src/components/meta-pixel.tsx');
  // Comments may name them; no executable line may touch them.
  assert.doesNotMatch(pixel, /dataLayer\.push/);
  assert.doesNotMatch(pixel, /gtag\(/);
  // And the Google tags are still installed where they always were.
  const layout = read('src/app/layout.tsx');
  assert.match(layout, /AW-18520240461/);
  assert.match(layout, /GTM-KKSDKPJC/);
  assert.match(read('src/components/analytics-gate.tsx'), /G-S7TZ4F1JMR/);
});

test('the consent banner offers marketing separately and never pre-ticks it', () => {
  const banner = read('src/components/cookie-consent-banner.tsx');
  assert.match(banner, /Meta Pixel/);
  assert.match(banner, /setMarketing\(stored\.marketing === 'granted'\)/);
  assert.match(banner, /save\(\{ analytics: 'denied', marketing: 'denied' \}\)/);
  assert.match(banner, /needsConsentChoice\(\)/);
});

test('the privacy policy discloses Meta Pixel tracking and the marketing choice', () => {
  const privacy = read('src/app/privacy/page.tsx');
  assert.match(privacy, /Meta Pixel/);
  assert.match(privacy, /28731676109830564/);
  assert.match(privacy, /Marketing \(optional/);
});
