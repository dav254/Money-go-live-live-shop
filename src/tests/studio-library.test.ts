/**
 * CLASSIC STUDIO + LIVING PICTURES — the pure maths that decides what actually
 * lands in the exported file.
 *
 * The brief's hardest requirement is A2: "Controls must update the actual
 * image and final exported file, not merely change the appearance of the
 * preview." That guarantee lives in `lib/studio/filters.ts` (the one function
 * both preview and export call) and in the clamping/normalising helpers that
 * keep a malformed design from exporting a blank or off-canvas file. None of
 * it needs a DOM to test, so this file pins the behaviour directly.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const types = require('../lib/studio/types.ts');
const filters = require('../lib/studio/filters.ts');
const catalog = require('../lib/studio/music-catalog.ts');

/* ------------------------------------------------------------------ */
/* Adjustments → filter string                                         */
/* ------------------------------------------------------------------ */

test('identity adjustments produce an EMPTY filter (no colour round-trip)', () => {
  // A no-op edit must export a pixel-identical bitmap, not one that has been
  // pushed through the colour pipeline for nothing.
  assert.equal(filters.buildFilterString(types.IDENTITY_ADJUSTMENTS), '');
  assert.equal(filters.buildFilterString(null), '');
  assert.equal(filters.buildFilterString(undefined), '');
  assert.equal(filters.buildFilterString({}), '');
});

test('every control changes the filter string (no dead sliders)', () => {
  // The exact failure this feature exists to fix: a control that moves the
  // preview but not the export. Each axis in isolation must alter the output.
  for (const axis of ['brightness', 'contrast', 'saturation', 'warmth'] as const) {
    const adjusted = filters.buildFilterString({ ...types.IDENTITY_ADJUSTMENTS, [axis]: 0.5 });
    assert.notEqual(adjusted, '', `${axis} at 0.5 produced no filter`);
    const negative = filters.buildFilterString({ ...types.IDENTITY_ADJUSTMENTS, [axis]: -0.5 });
    assert.notEqual(negative, '', `${axis} at -0.5 produced no filter`);
    assert.notEqual(adjusted, negative, `${axis} positive and negative are identical`);
  }
});

test('the filter string is valid CSS-filter syntax', () => {
  const s = filters.buildFilterString({ brightness: 0.3, contrast: -0.2, saturation: 0.6, warmth: 0.4 });
  // brightness/contrast/saturate always present, warmth adds hue-rotate.
  assert.match(s, /brightness\(\d+\.\d+\)/);
  assert.match(s, /contrast\(\d+\.\d+\)/);
  assert.match(s, /saturate\(\d+\.\d+\)/);
  assert.match(s, /hue-rotate\(-?\d+\.\d+deg\)/);
});

test('out-of-range adjustments are clamped, not passed through', () => {
  // A hand-edited document could carry 99; that must not become an invalid
  // filter that silently renders a blank canvas.
  const s = filters.buildFilterString({ brightness: 99, contrast: -99, saturation: NaN, warmth: Infinity });
  assert.doesNotMatch(s, /NaN|Infinity|99/);
  // saturate(NaN) maps to the neutral 0 delta (never an invalid token).
  assert.match(s, /saturate\(1\.000\)/);
});

test('saturate(-1) reaches full grey (the Mono look really desaturates)', () => {
  const s = filters.buildFilterString({ ...types.IDENTITY_ADJUSTMENTS, saturation: -1 });
  assert.match(s, /saturate\(0\.000\)/);
});

/* ------------------------------------------------------------------ */
/* Clamping / normalising helpers                                      */
/* ------------------------------------------------------------------ */

test('clampUnit bounds to [-1,1] and maps non-finite to 0', () => {
  assert.equal(types.clampUnit(2), 1);
  assert.equal(types.clampUnit(-2), -1);
  assert.equal(types.clampUnit(0.4), 0.4);
  assert.equal(types.clampUnit(NaN), 0);
  assert.equal(types.clampUnit(Infinity), 0);
  assert.equal(types.clampUnit(undefined), 0);
});

test('clampCrop keeps the crop inside the source and never zero-area', () => {
  const c = types.clampCrop({ x: -50, y: -50, width: 9999, height: 9999 }, 1000, 800);
  assert.equal(c.x, 0);
  assert.equal(c.y, 0);
  assert.equal(c.width, 1000);
  assert.equal(c.height, 800);

  const zero = types.clampCrop({ x: 10, y: 10, width: 0, height: 0 }, 1000, 800);
  assert.ok(zero.width >= 1 && zero.height >= 1, 'crop collapsed to zero area');

  const clamped = types.clampCrop({ x: 990, y: 790, width: 50, height: 50 }, 1000, 800);
  assert.ok(clamped.x + clamped.width <= 1000, 'crop overflows the right edge');
  assert.ok(clamped.y + clamped.height <= 800, 'crop overflows the bottom edge');
});

test('isFullCrop detects the no-op crop', () => {
  assert.ok(types.isFullCrop({ x: 0, y: 0, width: 1000, height: 800 }, 1000, 800));
  assert.ok(!types.isFullCrop({ x: 0, y: 0, width: 500, height: 800 }, 1000, 800));
});

test('clampOverlayPosition keeps an element on-canvas', () => {
  assert.deepEqual(types.clampOverlayPosition({ x: 5, y: -3 }), { x: 1, y: 0 });
  // A non-finite coordinate is treated as "unknown" and centred, not clamped
  // to an edge — losing an element off-canvas is worse than recentering it.
  assert.deepEqual(types.clampOverlayPosition({ x: NaN, y: Infinity }), { x: 0.5, y: 0.5 });
});

test('canvas presets stay within the 2048px media cap', () => {
  for (const p of types.CANVAS_PRESETS) {
    assert.ok(Math.max(p.width, p.height) <= 2048, `${p.id} exceeds the pipeline cap`);
  }
  assert.equal(types.presetById('nope').id, 'square', 'unknown preset must fall back to square');
});

/* ------------------------------------------------------------------ */
/* Export options                                                      */
/* ------------------------------------------------------------------ */

test('normalizeExport clamps quality and max dimension into a safe range', () => {
  const bad = types.normalizeExport({ format: 'image/webp', quality: 0, maxDimension: 1 });
  assert.equal(bad.quality, 0.5, 'quality floored to a usable minimum');
  assert.equal(bad.maxDimension, 256, 'max dimension floored');

  const wild = types.normalizeExport({ quality: 5, maxDimension: 99999, format: 'image/png' as any });
  assert.equal(wild.quality, 1);
  assert.equal(wild.maxDimension, 4096);
  assert.equal(wild.format, 'image/png');

  const bogus = types.normalizeExport({ format: 'image/tiff' as any });
  assert.equal(bogus.format, 'image/webp', 'unknown format falls back to webp');
});

test('the default export is lossless-leaning WebP (does not kill quality)', () => {
  assert.equal(types.DEFAULT_EXPORT.format, 'image/webp');
  assert.ok(types.DEFAULT_EXPORT.quality >= 0.9, 'default quality must stay high');
});

test('fitScale never upscales and survives a zero box', () => {
  assert.equal(types.fitScale(2000, 1000, 500, 500), 0.25);
  assert.equal(types.fitScale(100, 100, 500, 500), 1, 'must not upscale by default');
  assert.ok(types.fitScale(100, 100, 500, 500, true) > 1, 'allowUpscale can exceed 1');
  assert.equal(types.fitScale(0, 0, 500, 500), 1, 'zero source is safe');
  assert.equal(types.fitScale(100, 100, 0, 0), 1, 'zero box is safe');
});

test('withinExportBudget validates the byte size before upload', () => {
  assert.ok(types.withinExportBudget(1000, 10_000_000));
  assert.ok(!types.withinExportBudget(20_000_000, 10_000_000));
  assert.ok(!types.withinExportBudget(-1, 1000));
  assert.ok(!types.withinExportBudget(NaN, 1000));
});

/* ------------------------------------------------------------------ */
/* Look presets                                                        */
/* ------------------------------------------------------------------ */

test('every look preset is bounded and the Original is the identity', () => {
  for (const look of types.LOOK_PRESETS) {
    for (const axis of ['brightness', 'contrast', 'saturation', 'warmth'] as const) {
      const v = look.adjustments[axis];
      assert.ok(v >= -1 && v <= 1, `${look.id}.${axis} out of range`);
    }
  }
  const original = types.LOOK_PRESETS.find((l: { id: string }) => l.id === 'original');
  assert.ok(types.isIdentityAdjustments(original.adjustments), 'Original must be a no-op');
});

/* ------------------------------------------------------------------ */
/* Music catalogue — the licensing gate (spec §B2)                     */
/* ------------------------------------------------------------------ */

const licensedTrack = (id: string, overrides: Partial<ReturnType<typeof catalog.verifyLicence>> = {}) => ({
  id,
  title: 'Test Tone',
  artist: 'Vidnov',
  durationSeconds: 30,
  streamUrl: `/music/${id}.mp3`,
  mimeType: 'audio/mpeg',
  licence: {
    licenceId: 'CC0-1.0',
    summary: 'Public domain, commercial use allowed.',
    licensor: 'Vidnov',
    allowsCommercialUse: true,
    allowsMarketplaceUse: true,
    allowsWorldwide: true,
    allowsRedistribution: true,
    ...overrides,
  },
});

test('an unlicensed track is rejected and never listed', () => {
  // Every intended use must be granted; one missing right withholds the track.
  for (const flag of ['allowsCommercialUse', 'allowsMarketplaceUse', 'allowsWorldwide', 'allowsRedistribution'] as const) {
    const before = catalog.listAvailableTracks().length;
    const accepted = catalog.registerTrack(licensedTrack(`t-${flag}`, { [flag]: false }));
    assert.equal(accepted, false, `${flag}=false was accepted into the catalogue`);
    assert.equal(catalog.listAvailableTracks().length, before, 'unlicensed track leaked into the list');
  }
});

test('a licence with an empty id or licensor does not verify', () => {
  assert.equal(catalog.verifyLicence(licensedTrack('a').licence), true);
  const noId = licensedTrack('b').licence;
  noId.licenceId = '   ';
  assert.equal(catalog.verifyLicence(noId), false);
  assert.equal(catalog.verifyLicence(null), false);
});

test('a fully licensed track registers, lists, and is publishable', () => {
  catalog.unregisterTrack('good'); // idempotent across reruns
  assert.equal(catalog.registerTrack(licensedTrack('good')), true);
  assert.ok(catalog.getTrack('good'), 'registered track not retrievable');
  assert.ok(catalog.isTrackPublishable('good'));
  assert.equal(catalog.catalogueAvailability().available, true);
  catalog.unregisterTrack('good');
});

test('the EMPTY catalogue is honest — unavailable with an activation reason', () => {
  // Clear anything a prior test left behind.
  for (const t of catalog.listAvailableTracks()) catalog.unregisterTrack(t.id);
  const avail = catalog.catalogueAvailability();
  assert.equal(avail.available, false);
  assert.equal(avail.trackCount, 0);
  assert.match(avail.reason, /licensed music is available yet/i);
  // Nothing is publishable when the catalogue is empty — and that is fine:
  // publishing a Living Picture with NO music must still be allowed, which
  // the publish flow checks separately from the track gate.
  assert.equal(catalog.isTrackPublishable('anything'), false);
});

test('isTrackPublishable is false for unknown / removed tracks', () => {
  catalog.unregisterTrack('ghost');
  assert.equal(catalog.isTrackPublishable('ghost'), false);
  assert.equal(catalog.isTrackPublishable(''), false);
  assert.equal(catalog.isTrackPublishable(undefined), false);
});
