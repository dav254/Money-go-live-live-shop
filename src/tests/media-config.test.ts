/**
 * THE ENCODER MUST MATCH WHAT WE ADVERTISE.
 *
 * The seller-facing UI promises a maximum duration. The encoder had its own
 * literal of 60, and the marketplace path had 30 — so a seller who recorded 90
 * seconds had it silently trimmed with nothing on screen saying so. That is
 * the exact class of bug this file exists to prevent: copy in one module, a
 * number in another, and nothing checking they agree.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const { MEDIA_CONFIG } = require('../lib/media/config.ts');
const { MAX_VIDEO_SECONDS, MAX_VIDEO_LABEL } = require('../lib/listings/limits.ts');

test('the encoder allows exactly what the UI advertises', () => {
  assert.equal(
    MEDIA_CONFIG.VIDEO_MAX_DURATION_SECONDS,
    MAX_VIDEO_SECONDS,
    'encoder cap has drifted from the advertised limit',
  );
});

test('marketplace uploads get the same ceiling, not a shorter one', () => {
  // It was 30. A seller attaching evidence to a request would have had it cut
  // at half the length we promise everywhere else.
  assert.equal(MEDIA_CONFIG.REQUEST_VIDEO_MAX_DURATION_SECONDS, MAX_VIDEO_SECONDS);
});

test('the advertised limit is generous, and the label agrees with it', () => {
  /*
   * CHANGED deliberately: was "the advertised limit is still two minutes".
   * Video is a paid feature of this marketplace, so the ceiling was lifted.
   * What matters now is that the LABEL and the NUMBER still agree — a seller
   * told "10 minutes" and cut at 2 is the bug this file exists to prevent.
   */
  assert.ok(MAX_VIDEO_SECONDS >= 600, `${MAX_VIDEO_SECONDS}s is not generous`);
  assert.equal(MAX_VIDEO_LABEL, '10 minutes');
  assert.ok(
    MAX_VIDEO_LABEL.startsWith(String(MAX_VIDEO_SECONDS / 60)),
    `the label "${MAX_VIDEO_LABEL}" does not match the ${MAX_VIDEO_SECONDS}s ceiling`,
  );
});

test('live sessions run the full paid 70 minutes', () => {
  const { MAX_LIVE_SECONDS } = require('../lib/listings/limits.ts');
  /*
   * CHANGED deliberately (owner decision): a live session is a PAID product —
   * 100 points buys a 70-minute broadcast — so it runs the full paid window
   * instead of mirroring the 10-minute recorded-upload ceiling. What this test
   * now guards: the broadcast can never silently be cut BEFORE the window the
   * seller paid for (the old equality would have capped paid shows at the
   * clip limit).
   */
  assert.equal(MAX_LIVE_SECONDS, 70 * 60, 'live must match the paid 70-minute session');
  assert.ok(
    MAX_LIVE_SECONDS > MAX_VIDEO_SECONDS,
    'a paid live session must not be shorter than a recorded clip',
  );
});

test('stored video is compressed for a phone, not archived', () => {
  // CRF 18 is visually lossless and invisible waste at feed size: with no CDN,
  // every byte is paid for twice — once on disk, once per view.
  assert.ok(
    MEDIA_CONFIG.VIDEO_CRF >= 24 && MEDIA_CONFIG.VIDEO_CRF <= 30,
    `CRF ${MEDIA_CONFIG.VIDEO_CRF} is outside the sensible band for a marketplace feed`,
  );
  assert.equal(MEDIA_CONFIG.VIDEO_LOSSLESS, false, 'a marketplace feed must not store lossless masters');
});
