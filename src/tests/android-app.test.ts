/**
 * ANDROID APP CONTRACT — the promises the marketing surface makes, checked.
 *
 * Three claims are load-bearing enough to break a release if they drift:
 *
 *   1. The app is NOT a website wrapper. A single `<WebView>` around
 *      vidnov.com would look identical in a screenshot and be a completely
 *      different product, so it is checked mechanically.
 *   2. The download CTA never invents a store link. `IS_PUBLISHED` must be
 *      false unless a real URL is configured, and the QR target must be the
 *      verified listing or the honest status page — never an APK.
 *   3. The published metadata (package id, version) matches the app that will
 *      actually be uploaded, because a Play listing that disagrees with the
 *      bundle is rejected.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  ANDROID_APP,
  ANDROID_PACKAGE_ID,
  DOWNLOAD_PAGE_PATH,
  IS_PUBLISHED,
  PLAY_STORE_URL,
  QR_TARGET_URL,
  installCtaLabel,
} from '../lib/android-app';

const ROOT = process.cwd();
const MOBILE = path.join(ROOT, 'mobile');

/** Every .ts/.tsx file under `mobile/app` and `mobile/src`. */
function mobileSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...mobileSources(full));
    } else if (/\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

test('the Android app contains no WebView or embedded browser surface', () => {
  const files = [...mobileSources(path.join(MOBILE, 'app')), ...mobileSources(path.join(MOBILE, 'src'))];

  const offenders: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    // Imports of the WebView module, and any JSX/JS usage of the component.
    if (/react-native-webview/.test(source)) offenders.push(`${path.relative(ROOT, file)} imports react-native-webview`);
    if (/<WebView\b/.test(source)) offenders.push(`${path.relative(ROOT, file)} renders <WebView>`);
    if (/expo-web-browser/.test(source) && /openBrowserAsync|openAuthSessionAsync/.test(source)) {
      offenders.push(`${path.relative(ROOT, file)} opens an in-app browser`);
    }
  }

  assert.deepEqual(offenders, [], `app surface must stay native:\n${offenders.join('\n')}`);
});

test('the app never renders a website URL as its main surface', () => {
  const files = [...mobileSources(path.join(MOBILE, 'app')), ...mobileSources(path.join(MOBILE, 'src'))];
  const offenders: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    // A `source={{ uri: 'https://vidnov.com' }}` on a view would be a wrapper in
    // disguise. The API base URL in `config.ts` is a fetch target, not a view.
    if (/<iframe\b/.test(source)) offenders.push(`${path.relative(ROOT, file)} renders an iframe`);
    // Only real usage counts — the layout's own comment says the word "WebView"
    // to explain that there is none.
    if (/<WebView\b/.test(source)) offenders.push(`${path.relative(ROOT, file)} renders <WebView>`);
    if (/require\(['"]react-native-webview['"]\)/.test(source)) {
      offenders.push(`${path.relative(ROOT, file)} loads react-native-webview`);
    }
  }

  assert.deepEqual(offenders, []);
});

test('the app declares its own package id, version and Android permissions', () => {
  const appJson = JSON.parse(readFileSync(path.join(MOBILE, 'app.json'), 'utf8')) as {
    expo: {
      name: string;
      version: string;
      android?: { package?: string; versionCode?: number; permissions?: string[] };
    };
  };

  assert.equal(appJson.expo.name, 'Vidnov');
  assert.equal(appJson.expo.android?.package, ANDROID_PACKAGE_ID);
  assert.equal(appJson.expo.version, ANDROID_APP.versionName);
  assert.equal(appJson.expo.android?.versionCode, ANDROID_APP.versionCode);

  // Only the permissions the product genuinely uses.
  const permissions = appJson.expo.android?.permissions ?? [];
  assert.ok(permissions.includes('android.permission.CAMERA'));
  assert.ok(permissions.includes('android.permission.POST_NOTIFICATIONS'));
  assert.ok(
    !permissions.some((p) => p.includes('READ_EXTERNAL_STORAGE') || p.includes('WRITE_EXTERNAL_STORAGE')),
    'broad storage permissions are not needed for the photo picker',
  );
});

test('no Google Play link is invented: IS_PUBLISHED tracks a configured URL', () => {
  assert.equal(IS_PUBLISHED, PLAY_STORE_URL.length > 0, 'publish state must be derived, never hardcoded');

  if (!IS_PUBLISHED) {
    assert.equal(installCtaLabel(), 'Android app coming soon');
    // The pre-publication QR must point at the honest status page, not an APK.
    assert.equal(QR_TARGET_URL, 'https://vidnov.com/download');
  } else {
    assert.ok(
      QR_TARGET_URL.startsWith('https://play.google.com/'),
      `published QR target must be the Play listing, got ${QR_TARGET_URL}`,
    );
    assert.equal(installCtaLabel(), 'Get it on Google Play');
  }

  assert.ok(!QR_TARGET_URL.endsWith('.apk'), 'never offer a raw APK');
  assert.ok(!/https?:\/\/[^/]*apk/i.test(QR_TARGET_URL));
});

test('the download page is a real page at the advertised path', () => {
  assert.equal(DOWNLOAD_PAGE_PATH, '/download');
  assert.ok(
    existsSync(path.join(ROOT, 'src', 'app', 'download', 'page.tsx')),
    'the permanent download page must exist',
  );
});

test('the app ships a launcher icon and splash asset', () => {
  for (const asset of ['icon.png', 'android-icon-foreground.png', 'android-icon-background.png', 'splash-icon.png']) {
    assert.ok(
      existsSync(path.join(MOBILE, 'assets', 'images', asset)),
      `missing app asset: ${asset}`,
    );
  }
});

test('no signing material is committed with the app', () => {
  const forbidden = ['.keystore', '.jks', 'google-services.json', 'key.properties'];
  const offenders: string[] = [];

  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.git') continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (forbidden.some((f) => name.endsWith(f))) offenders.push(path.relative(ROOT, full));
    }
  };

  walk(MOBILE);
  assert.deepEqual(offenders, [], `signing secrets must never be committed:\n${offenders.join('\n')}`);
});
