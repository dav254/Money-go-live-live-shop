/**
 * ANDROID LINKS.
 *
 * Two things must be exactly right before a Play build can claim vidnov.com
 * URLs, and neither is visible on a phone until it is too late:
 *
 *   • `/.well-known/assetlinks.json` must carry the REAL SHA-256 of the signing
 *     certificate, in the exact statements shape Android expects. A malformed
 *     or invented fingerprint silently keeps the browser bar and fails Play
 *     review.
 *   • A verified link arrives as a WEBSITE path, but the app's routes are named
 *     for its screens, so `/products/<id>` must become `/listing/<id>`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANDROID_PACKAGE_NAME,
  buildAssetLinks,
  normaliseFingerprint,
  parseFingerprints,
} from '../lib/android/assetlinks';
import { redirectSystemPath } from '../../mobile/app/+native-intent';

const SHA_A = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';
const SHA_B = '1122334455667788990011223344556677889900112233445566778899001122';

test('no configured fingerprint yields no statements, never a placeholder', () => {
  assert.deepEqual(parseFingerprints(undefined), []);
  assert.deepEqual(parseFingerprints(''), []);
  assert.deepEqual(parseFingerprints('   '), []);
  assert.deepEqual(buildAssetLinks([]), []);
});

test('a keytool fingerprint is normalised to the form Android compares', () => {
  assert.equal(normaliseFingerprint(SHA_A.toLowerCase().replace(/:/g, '')), SHA_A);
  const parsed = parseFingerprints(SHA_A);
  assert.deepEqual(parsed, [SHA_A]);

  const statements = buildAssetLinks(parsed);
  assert.equal(statements.length, 1);
  assert.deepEqual(statements[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(statements[0].target.namespace, 'android_app');
  assert.equal(statements[0].target.package_name, 'com.vidnov.app');
  assert.deepEqual(statements[0].target.sha256_cert_fingerprints, [SHA_A]);
  assert.equal(ANDROID_PACKAGE_NAME, 'com.vidnov.app');
});

test('Play signing and the upload key can both be published', () => {
  const parsed = parseFingerprints(`${SHA_A}, ${SHA_B}`);
  // A bare hex digest is published in the colonised form Android compares.
  assert.deepEqual(parsed, [SHA_A, normaliseFingerprint(SHA_B)]);
  assert.equal(buildAssetLinks(parsed).length, 2);
});

test('a malformed fingerprint is dropped instead of published', () => {
  assert.equal(normaliseFingerprint('not-a-fingerprint'), null);
  assert.equal(normaliseFingerprint('AA:BB'), null);
  assert.deepEqual(parseFingerprints(`bogus, ${SHA_A}`), [SHA_A]);
});

test('website URLs map to the Android routes', () => {
  const map = (path: string) => redirectSystemPath({ path, initial: true });

  assert.equal(map('https://vidnov.com/products/abc123'), '/listing/abc123');
  assert.equal(map('https://vidnov.com/sellers/seller9?tab=reviews'), '/shop/seller9?tab=reviews');
  assert.equal(map('https://vidnov.com/requests/req1'), '/request/req1');
});

test('custom-scheme links map too, and unrelated URLs are untouched', () => {
  const map = (path: string) => redirectSystemPath({ path, initial: true });

  assert.equal(map('vidnov://products/abc123'), '/listing/abc123');
  assert.equal(map('vidnov://privacy'), '/privacy');
  // Informational pages stay in the browser.
  assert.equal(map('https://vidnov.com/privacy'), 'https://vidnov.com/privacy');
  assert.equal(map('https://vidnov.com/about'), 'https://vidnov.com/about');
  // An ordinary in-app navigation is never rewritten.
  assert.equal(map('/orders'), '/orders');
});
