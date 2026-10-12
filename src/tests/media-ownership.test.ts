/**
 * MEDIA MUST STAY OURS.
 *
 * ## The failure this file exists to prevent
 *
 * The shop logo and banner used to upload straight to Firebase Storage —
 * `uploadBytes(ref(storage, …))` — on a paid bucket shared by every seller on
 * the platform. When that bucket filled, every branding upload on the app
 * failed with `storage/quota-exceeded`, and no amount of client-side work
 * could fix it. Product images already went through `/api/media/upload` to the
 * VPS disk; branding was the outlier.
 *
 * Nothing in the code stopped it drifting back: it compiled, it type-checked,
 * and it failed only in production, once the free quota ran out. These tests
 * are that stop.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/**
 * Source with comments stripped.
 *
 * These files carry long doc comments that quote the code they replaced — the
 * branding section explains in prose that it "used to call
 * uploadBytes(ref(storage, …))". Matching against prose would either fail on a
 * correct file or force the comment to be reworded every time it is updated,
 * so the assertions below run on code only.
 */
function readCode(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('seller uploads go to our own server, not Firebase Storage', () => {
  it('the branding section must not touch firebase/storage', () => {
    const source = readCode('src/components/app/seller/shop-branding-section.tsx');
    assert.equal(
      /from 'firebase\/storage'/.test(source),
      false,
      'shop-branding-section imports firebase/storage — uploads must go through ' +
        '/api/media/upload to the VPS disk',
    );
    for (const call of ['uploadBytes(', 'uploadBytesResumable(', 'getDownloadURL(']) {
      assert.equal(
        source.includes(call),
        false,
        `shop-branding-section still calls ${call}`,
      );
    }
  });

  it('the branding section must post through the shared media client', () => {
    const source = read('src/components/app/seller/shop-branding-section.tsx');
    assert.ok(
      source.includes("from '@/lib/media/upload-client'"),
      'branding uploads must use the shared uploadMedia() client',
    );
    assert.ok(source.includes('uploadMedia('), 'branding upload must call uploadMedia()');
  });

  it('the seller settings page must not hold a Storage instance at all', () => {
    const source = readCode('src/app/app/seller/account/page.tsx');
    assert.equal(
      /useStorage/.test(source),
      false,
      'the settings page still takes a Firebase Storage handle',
    );
    assert.ok(
      !/firebase\/storage/.test(source),
      'the settings page still imports firebase/storage',
    );
  });

  it('the WEBSITE seller settings screen must not upload to Firebase Storage either', () => {
    // Same screen, same quota. It was fixed on the app surface first, which
    // would have left a seller who used the website hitting the identical
    // `storage/quota-exceeded` failure one tap away.
    const source = readCode('src/app/dashboard/seller/settings/page.tsx');
    assert.ok(
      !/firebase\/storage/.test(source),
      'dashboard/seller/settings still imports firebase/storage',
    );
    for (const call of ['uploadBytesResumable(', 'getDownloadURL(']) {
      assert.equal(
        source.includes(call),
        false,
        `dashboard/seller/settings still calls ${call}`,
      );
    }
    assert.ok(
      source.includes('uploadMedia('),
      'website branding uploads must use the shared uploadMedia() client',
    );
  });
});

describe('the media limits the browser shows match the ones the server enforces', () => {
  it('image cap, dimension cap and quality agree with the server config', () => {
    const { MEDIA_CONFIG } = require('../lib/media/config.ts');
    const { IMAGE_LIMITS } = require('../lib/media/limits.ts');

    assert.equal(
      IMAGE_LIMITS.maxUploadMb,
      MEDIA_CONFIG.IMAGE_MAX_UPLOAD_MB,
      'the UI would reject an image the server would accept (or the reverse)',
    );
    assert.equal(
      IMAGE_LIMITS.maxDimension,
      MEDIA_CONFIG.IMAGE_MAX_DIMENSION,
      'the size shown after upload disagrees with what is stored',
    );
    assert.equal(
      IMAGE_LIMITS.quality,
      MEDIA_CONFIG.IMAGE_QUALITY,
      'the quality promised to a seller is not the quality used',
    );
  });

  it('video cap agrees with the server config', () => {
    const { MEDIA_CONFIG } = require('../lib/media/config.ts');
    const { IMAGE_LIMITS } = require('../lib/media/limits.ts');

    assert.equal(IMAGE_LIMITS.videoMaxUploadMb, MEDIA_CONFIG.VIDEO_MAX_UPLOAD_MB);
    assert.equal(
      IMAGE_LIMITS.videoMaxSeconds,
      MEDIA_CONFIG.VIDEO_MAX_DURATION_SECONDS,
    );
  });

  it('compression is genuinely lossy-but-invisible, not a no-op', () => {
    const { MEDIA_CONFIG } = require('../lib/media/config.ts');
    assert.ok(
      MEDIA_CONFIG.IMAGE_QUALITY >= 80 && MEDIA_CONFIG.IMAGE_QUALITY <= 95,
      `quality ${MEDIA_CONFIG.IMAGE_QUALITY} is outside the range that still looks like the original`,
    );
    assert.ok(
      MEDIA_CONFIG.IMAGE_MAX_DIMENSION <= 4096,
      'a cap that high stores phone photos at full resolution and saves nothing',
    );
  });
});

describe('the file library only ever answers for its own caller', () => {
  it('the route verifies the bearer token before touching Firestore', () => {
    const source = readCode('src/app/api/media/mine/route.ts');
    assert.ok(
      source.includes('verifyRequestUser'),
      'the media list route must authenticate the request',
    );
    assert.ok(
      source.includes("status: 401"),
      'an unauthenticated request must be rejected',
    );
  });

  it('the query is scoped to the caller, not the whole collection', () => {
    const source = readCode('src/app/api/media/mine/route.ts');
    assert.ok(
      /where\('userId',\s*'==',\s*user\.uid\)/.test(source),
      "the media query must filter on the caller's own uid — firestore.rules " +
        'permits a list only when every returned document belongs to the caller',
    );
  });

  it('it does not sort in the query, which would need a composite index', () => {
    const source = readCode('src/app/api/media/mine/route.ts');
    assert.equal(
      /orderBy\(/.test(source),
      false,
      'orderBy createdAt would need a userId+createdAt composite index in the ' +
        'Firebase console before this route returns anything but a 500',
    );
  });
});