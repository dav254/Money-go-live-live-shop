/**
 * EDITOR STUDIO (preview/timeline/panels/export/AI).
 * Run: npx tsx --test src/tests/editor-studio.test.ts
 *
 * Three layers, same style as video-studio.test.ts:
 *   1. PURE logic — timeline math, split/trim invariants, the undo/redo
 *      reducer, filter/effect builders, crop geometry;
 *   2. CAPABILITY gating — what export and AI honestly offer;
 *   3. SOURCE-level guards — the panels actually dispatch edits, the routes
 *      authenticate and gate on real provider keys, and the recorder lands
 *      on the new editor route.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/* eslint-disable @typescript-eslint/no-explicit-any */
const timeline = require(join(ROOT, 'src', 'lib', 'editor', 'timeline.ts')) as any;
const filters = require(join(ROOT, 'src', 'lib', 'editor', 'filters.ts')) as any;
const reducer = require(join(ROOT, 'src', 'lib', 'editor', 'reducer.ts')) as any;
const render = require(join(ROOT, 'src', 'lib', 'editor', 'render.ts')) as any;
const captions = require(join(ROOT, 'src', 'lib', 'editor', 'captions.ts')) as any;
const exportLib = require(join(ROOT, 'src', 'lib', 'editor', 'export.ts')) as any;

const clip = (over: Record<string, unknown> = {}) => {
  // makeClip only accepts import-time fields; everything else (trim, speed,
  // transitions, effects…) is applied to the resulting clip.
  const { name, duration, width, height, ...rest } = over as Record<string, any>;
  return Object.assign(
    timeline.makeClip({
      src: 'blob:test',
      name: name ?? 'clip',
      duration: duration ?? 10,
      width: width ?? 1920,
      height: height ?? 1080,
    }),
    rest,
  );
};

/* ──────────────────────────────────────────────────────────────────── */
/* 1. Timeline math                                                     */
/* ──────────────────────────────────────────────────────────────────── */

describe('timeline layout — transitions overlap, never extend', () => {
  it('two 10s clips with a 0.6s transition total 19.4s — overlap shortens, never extends', () => {
    const a = clip();
    const b = clip({ transitionIn: { type: 'fade', duration: 0.6 } });
    const layout = timeline.layoutTimeline([a, b]);
    assert.equal(layout.total, 19.4, '10 + 10 − 0.6 overlap');
    assert.equal(layout.placed[1].start, 9.4);
    assert.equal(layout.placed[1].overlap, 0.6);
  });

  it('a transition never overlaps more than half of either neighbour', () => {
    const a = clip({ name: 'a', duration: 1, width: 16, height: 9 });
    const b = clip({ name: 'b', duration: 1, width: 16, height: 9, transitionIn: { type: 'slide', duration: 4 } });
    const layout = timeline.layoutTimeline([a, b]);
    assert.equal(layout.placed[1].overlap, 0.5, 'capped at half the previous clip');
    assert.equal(layout.total, 1.5);
  });

  it('no transition = hard cut at the seam', () => {
    const layout = timeline.layoutTimeline([clip(), clip({ transitionIn: { type: 'none', duration: 0 } })]);
    assert.equal(layout.placed[1].start, 10);
    assert.equal(layout.placed[1].overlap, 0);
  });

  it('locate reports outgoing+blend inside the overlap and pure primary after', () => {
    const a = clip();
    const b = clip({ transitionIn: { type: 'fade', duration: 1 } });
    const layout = timeline.layoutTimeline([a, b]);

    // Overlap here is 1.0s starting at t=9 → 9.5s sits exactly halfway.
    const mid = timeline.locate(layout, 9.5);
    assert.equal(mid.primary.clip.id, b.id);
    assert.equal(mid.outgoing.clip.id, a.id);
    assert.ok(Math.abs(mid.blend - 0.5) < 1e-9, `blend at half the overlap, got ${mid.blend}`);

    const settled = timeline.locate(layout, 12);
    assert.equal(settled.primary.clip.id, b.id);
    assert.equal(settled.outgoing, null);
    assert.equal(settled.blend, 1);
  });

  it('source time applies trim and speed', () => {
    const fast = clip({ speed: 2, inPoint: 1, outPoint: 5 });
    assert.equal(timeline.clipDuration(fast), 2, '(5-1)/2 = 2s on the timeline');
    const layout = timeline.layoutTimeline([fast]);
    const loc = timeline.locate(layout, 1);
    assert.ok(Math.abs(loc.sourceTime - 3) < 1e-9, `1s into a 2× clip = 3s of source`);
  });
});

describe('split/trim/reorder invariants', () => {
  it('split divides source time exactly and gives the right half a clean head', () => {
    const a = clip({ transitionIn: { type: 'fade', duration: 0.5 }, effects: [{ id: 'fx1', type: 'blur', intensity: 60, start: 2, duration: 3 }] });
    const parts = timeline.splitClip(a, 4);
    assert.ok(parts);
    const [left, right] = parts;
    assert.ok(Math.abs(left.outPoint - right.inPoint) < 1e-9, 'cut points meet');
    assert.equal(left.inPoint, a.inPoint);
    assert.equal(right.outPoint, a.outPoint);
    assert.equal(right.transitionIn.type, 'none', 'second half starts clean');
    assert.equal(left.id !== a.id && right.id !== a.id && left.id !== right.id, true);
    assert.equal(right.effects[0].start, 0, 'effect time shifts by the cut');
  });

  it('split refuses cuts outside the trimmed range (nothing silently lost)', () => {
    const a = clip({ inPoint: 2, outPoint: 8 });
    assert.equal(timeline.splitClip(a, -1), null);
    assert.equal(timeline.splitClip(a, 0), null);
    assert.equal(timeline.splitClip(a, 7), null);
    assert.equal(timeline.splitClip(a, 100), null);
  });

  it('trim keeps a minimum clip length and stays inside the source', () => {
    const a = clip({ inPoint: 1, outPoint: 9 });
    const t1 = timeline.trimClip(a, 8.95, 9);
    assert.ok(t1.outPoint - t1.inPoint >= timeline.MIN_CLIP_SECONDS - 1e-9, 'never shorter than MIN_CLIP_SECONDS');
    const t2 = timeline.trimClip(a, -5, 999);
    assert.equal(t2.inPoint, 0);
    assert.equal(t2.outPoint, a.sourceDuration);
    const t3 = timeline.trimClip(a, 6, 3);
    assert.ok(t3.outPoint >= t3.inPoint, 'in never passes out');
  });

  it('reorder and duplicate keep every other clip intact', () => {
    const a = clip({ name: 'a' });
    const b = clip({ name: 'b' });
    const c = clip({ name: 'c' });
    const moved = timeline.moveClip([a, b, c], b.id, 0);
    assert.deepEqual(moved.map((x: any) => x.name), ['b', 'a', 'c']);
    assert.equal(timeline.moveClip([a, b, c], 'missing', 1).length, 3, 'unknown id is a no-op');
    const dup = timeline.duplicateClip([a, b], a.id);
    assert.equal(dup.length, 3);
    assert.equal(dup[1].name, 'a copy');
    assert.equal(dup[1].transitionIn.type, 'none');
    assert.notEqual(dup[0].effects, dup[1].effects, 'duplicate never shares mutable arrays');
  });

  it('project duration spans video AND every layer', () => {
    const project = timeline.emptyProject();
    project.clips = [clip()];
    project.texts = [{ id: 't1', text: 'hi', start: 11, duration: 4, x: 0.5, y: 0.5, style: {}, animation: 'none' }];
    project.captions = [{ id: 'k1', text: 'hey', start: 0, end: 25 }];
    assert.equal(timeline.totalDuration(project), 25, 'captions can outlast the video');
    assert.equal(timeline.itemsAt(project.texts, 12).length, 1);
    assert.equal(timeline.itemsAt(project.texts, 16).length, 0);
    assert.equal(timeline.captionsAt(project.captions, 24.9).length, 1);
    assert.equal(timeline.captionsAt(project.captions, 25).length, 0);
  });

  it('audio gain ramps fades in and out and never exceeds volume', () => {
    const track = { start: 10, duration: 6, offset: 0, volume: 0.8, fadeIn: 1, fadeOut: 1 };
    assert.equal(timeline.audioGainAt(track, 9), 0, 'silent before start');
    assert.equal(timeline.audioGainAt(track, 16), 0, 'silent at the end');
    assert.ok(timeline.audioGainAt(track, 10.5) < 0.8, 'fading in');
    assert.ok(Math.abs(timeline.audioGainAt(track, 13) - 0.8) < 1e-9, 'full at the middle');
    assert.ok(timeline.audioGainAt(track, 15.5) < 0.8, 'fading out');
  });
});

/* ──────────────────────────────────────────────────────────────────── */
/* 2. Crop geometry (preview == export contract)                        */
/* ──────────────────────────────────────────────────────────────────── */

describe('crop helpers', () => {
  it('cropForAspect returns null for the original aspect', () => {
    assert.equal(timeline.cropForAspect(clip(), null), null);
    assert.equal(timeline.cropForAspect(clip(), 16 / 9), null, 'already 16:9');
  });

  it('cropForAspect centre-crops a wide frame to a square window', () => {
    const crop = timeline.cropForAspect(clip(), 1);
    assert.ok(crop, 'square crop exists for 16:9 source');
    assert.ok(Math.abs(crop.w - crop.h * (1080 / 1920)) < 1e-9 || Math.abs(crop.h - 1) < 1e-9);
    assert.ok(crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= 1.0001 && crop.y + crop.h <= 1.0001, 'window inside the frame');
  });

  it('zoomCrop shrinks the visible window around the centre', () => {
    const z = timeline.zoomCrop(clip(), 2);
    assert.ok(z.w <= 0.51 && z.h <= 0.51, 'zoomed window is smaller');
    assert.ok(Math.abs(z.x - (1 - z.w) / 2) < 1e-9, 'centred horizontally');
    assert.ok(Math.abs(z.y - (1 - z.h) / 2) < 1e-9, 'centred vertically');
  });

  it('rotation swaps the displayed size and the preview/export agree on geometry', () => {
    const rotated = clip({ rotation: 90 });
    assert.equal(timeline.displayedAspect(rotated), 1080 / 1920, '90° swaps aspect');
    const box = render.fitRect({ w: 100, h: 100 }, render.rotatedSize(1920, 1080, 0));
    assert.ok(Math.abs(box.w - 100) < 1e-9 && Math.abs(box.h - 100 * (1080 / 1920)) < 1e-9, 'contain-fit');
    const path = render.cropClipPath({ x: 0.25, y: 0, w: 0.5, h: 1 });
    assert.equal(path, 'inset(0.000% 25.000% 0.000% 25.000%)', 'clip-path insets match the canvas rect');
    const rect = render.cropRectPx({ x: 0, y: 0, w: 100, h: 50 }, { x: 0.25, y: 0, w: 0.5, h: 1 });
    assert.deepEqual(rect, { x: 25, y: 0, w: 50, h: 50 }, 'same crop in frame space');
  });
});

/* ──────────────────────────────────────────────────────────────────── */
/* 3. Undo/redo reducer                                                 */
/* ──────────────────────────────────────────────────────────────────── */

describe('every edit flows through undo/redo history', () => {
  it('add → edit → undo → redo restores exact projects', () => {
    let state = reducer.initialHistory(timeline.emptyProject());
    const a = clip({ name: 'a' });
    state = reducer.editorReducer(state, { type: 'add-clips', clips: [a] });
    const afterAdd = state.present;
    state = reducer.editorReducer(state, { type: 'clip-props', id: a.id, patch: { speed: 2 } });
    assert.equal(state.present.clips[0].speed, 2);
    assert.equal(state.past.length, 2);

    state = reducer.editorReducer(state, { type: 'undo' });
    assert.equal(state.present.clips[0].speed, 1, 'speed edit undone');
    assert.equal(state.future.length, 1);
    state = reducer.editorReducer(state, { type: 'undo' });
    assert.equal(state.present.clips.length, 0, 'add undone');
    state = reducer.editorReducer(state, { type: 'redo' });
    assert.equal(state.present, afterAdd, 'redo restores the identical project');
  });

  it('undo on an empty history is a no-op (never corrupts state)', () => {
    const state = reducer.initialHistory(timeline.emptyProject());
    const next = reducer.editorReducer(state, { type: 'undo' });
    assert.equal(next, state);
    assert.equal(reducer.editorReducer(state, { type: 'redo' }), state);
  });

  it('reducer clamps hostile trim/speed values', () => {
    let state = reducer.initialHistory(timeline.emptyProject());
    const a = clip();
    state = reducer.editorReducer(state, { type: 'add-clips', clips: [a] });
    state = reducer.editorReducer(state, { type: 'clip-props', id: a.id, patch: { speed: 99, inPoint: 99, outPoint: -5 } });
    const c = state.present.clips[0];
    assert.equal(c.speed, 4, 'speed capped at 4×');
    assert.ok(c.outPoint >= c.inPoint + timeline.MIN_CLIP_SECONDS, 'valid window preserved');
    assert.ok(c.outPoint <= c.sourceDuration, 'never beyond the source');
  });

  it('split action splices two clips where one was', () => {
    let state = reducer.initialHistory(timeline.emptyProject());
    const a = clip();
    state = reducer.editorReducer(state, { type: 'add-clips', clips: [a] });
    state = reducer.editorReducer(state, { type: 'split', id: a.id, local: 5 });
    assert.equal(state.present.clips.length, 2);
    const sum = state.present.clips[0].outPoint - state.present.clips[0].inPoint +
      (state.present.clips[1].outPoint - state.present.clips[1].inPoint);
    assert.ok(Math.abs(sum - a.sourceDuration) < 1e-9, 'no source time lost to the cut');
  });

  it('history is bounded so a phone-sized session cannot grow without limit', () => {
    let state = reducer.initialHistory(timeline.emptyProject());
    const a = clip();
    state = reducer.editorReducer(state, { type: 'add-clips', clips: [a] });
    for (let i = 0; i < reducer.MAX_HISTORY + 20; i += 1) {
      state = reducer.editorReducer(state, { type: 'clip-props', id: a.id, patch: { volume: (i % 10) / 10 } });
    }
    assert.ok(state.past.length <= reducer.MAX_HISTORY, `past bounded at ${state.past.length}`);
  });
});

/* ──────────────────────────────────────────────────────────────────── */
/* 4. Filters/effects builders (one builder for preview AND export)     */
/* ──────────────────────────────────────────────────────────────────── */

describe('filter builder', () => {
  it('original preset + neutral adjust produces only neutral multipliers', () => {
    const css = filters.clipFilterCss(clip(), 0);
    assert.ok(css.includes('brightness(1.000)'));
    assert.ok(css.includes('contrast(1.000)'));
    assert.ok(css.includes('saturate(1.000)'));
    assert.ok(!css.includes('sepia'), 'no temperature cast when neutral');
    assert.ok(!css.includes('blur'), 'no blur without an effect');
  });

  it('resolveAdjust clamps preset + user so values cannot run away', () => {
    const a = filters.resolveAdjust('vivid', { brightness: 500, contrast: -500, saturation: 0, temperature: 0, sharpness: 100 });
    assert.equal(a.brightness, 100);
    assert.equal(a.contrast, -100);
    assert.equal(a.sharpness, 100);
    const warm = filters.resolveAdjust('warm', filters.presetAdjust('original'));
    assert.ok(warm.temperature > 0, 'warm preset is warm');
  });

  it('temperature and sharpness produce real, distinct CSS', () => {
    const warm = filters.clipFilterCss({ ...clip(), adjust: { brightness: 0, contrast: 0, saturation: 0, temperature: 80, sharpness: 0 } }, 0);
    assert.ok(warm.includes('sepia('), 'warm = sepia wash');
    const cool = filters.clipFilterCss({ ...clip(), adjust: { brightness: 0, contrast: 0, saturation: 0, temperature: -80, sharpness: 0 } }, 0);
    assert.ok(cool.includes('hue-rotate('), 'cool = hue shift');
    const sharp = filters.clipFilterCss({ ...clip(), adjust: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, sharpness: 100 } }, 0);
    assert.ok(sharp !== cool, 'sharpness changes the filter string');
  });

  it('effect envelopes ramp and gate exactly at their window', () => {
    const fx = { id: 'e', type: 'vignette', intensity: 100, start: 2, duration: 2 };
    assert.equal(filters.effectEnvelope(fx, 1.99), 0, 'before window');
    assert.equal(filters.effectEnvelope(fx, 4), 0, 'at window end');
    assert.ok(filters.effectEnvelope(fx, 3) > 0, 'inside window');
    assert.ok(filters.effectEnvelope(fx, 2.05) < filters.effectEnvelope(fx, 3), 'ramps in');

    const clipObj = {
      ...clip(),
      effects: [
        { id: 'a', type: 'vignette', intensity: 100, start: 0, duration: 10 },
        { id: 'b', type: 'fade', intensity: 50, start: 0, duration: 10 },
      ],
    };
    const overlays = filters.effectOverlays(clipObj, 5);
    assert.ok(overlays.vignette > 0 && overlays.fade > 0 && overlays.grain === 0, 'only applied effects surface');
  });

  it('text animations produce progress, never NaN', () => {
    assert.equal(filters.animationProgress('none', 0).alpha, 1);
    assert.equal(filters.animationProgress('fade', 0).alpha, 0);
    assert.equal(filters.animationProgress('fade', 0.5).alpha, 1);
    assert.ok(filters.animationProgress('slide-up', 0).offset > 0, 'starts offset');
    assert.equal(filters.animationProgress('slide-up', 1).offset, 0);
    assert.ok(filters.animationProgress('typewriter', 0.5).chars !== null);
  });
});

/* ──────────────────────────────────────────────────────────────────── */
/* 5. Capability gates (export + captions are honest)                   */
/* ──────────────────────────────────────────────────────────────────── */

describe('export capability gating', () => {
  const report = (over: Record<string, boolean>) => ({
    mediaRecorder: true, mp4: false, webm: true, canvasFilter: true,
    largeCanvas: false, captureStream: true, ...over,
  });

  it('4K is offered only when a 4K canvas allocates, and is device-only', () => {
    const small = exportLib.resolutionOptions(report({}));
    assert.deepEqual(small.map((o: any) => o.id), ['720p', '1080p']);
    const large = exportLib.resolutionOptions(report({ largeCanvas: true }));
    const fourK = large.find((o: any) => o.id === '4k');
    assert.ok(fourK, '4K listed when supported');
    assert.equal(fourK.publishable, false, 'never claimed publishable at 4K');
    assert.equal(large.find((o: any) => o.id === '1080p').publishable, true);
  });

  it('container choice prefers MP4 and falls back to WebM honestly', () => {
    assert.equal(exportLib.pickContainer(report({ mp4: true })).extension, 'mp4');
    assert.equal(exportLib.pickContainer(report({ mp4: false })).extension, 'webm');
    assert.equal(
      exportLib.pickContainer(report({ mediaRecorder: false, mp4: false, webm: false })),
      null,
      'no recorder → null, not a lie',
    );
  });

  it('frame rates are the promised 24/30/60', () => {
    assert.deepEqual(exportLib.frameRateOptions(), [24, 30, 60]);
  });

  it('detectCapabilities guards every probe (safe on ancient browsers)', () => {
    const r = exportLib.detectCapabilities();
    for (const key of ['mediaRecorder', 'mp4', 'webm', 'canvasFilter', 'largeCanvas', 'captureStream']) {
      assert.equal(typeof r[key], 'boolean', `${key} is reported, not assumed`);
    }
  });
});

describe('captions capability honesty', () => {
  it('SRT parser reads real cues and rejects garbage', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,500\nHello there\n\n2\n00:00:03,000 --> 00:00:04,000\nSecond line\n';
    const cues = captions.parseSrt(srt);
    assert.equal(cues.length, 2);
    assert.equal(cues[0].text, 'Hello there');
    assert.equal(cues[0].start, 1);
    assert.equal(cues[0].end, 2.5);
    assert.deepEqual(captions.parseSrt('not an srt at all'), []);
    assert.deepEqual(captions.parseSrt('1\n00:00:05,000 --> 00:00:01,000\nbackwards'), [], 'end must exceed start');
  });

  it('manual cues are always creatable and clamped', () => {
    const cue = captions.makeCue('  spaced out  ', 5, 2);
    assert.equal(cue.text, 'spaced out');
    assert.equal(cue.start, 5);
    assert.equal(cue.end, 7);
    const negative = captions.makeCue('x', -3, 2);
    assert.equal(negative.start, 0, 'never negative');
  });

  it('distributeCues fits lines into the window without gaps', () => {
    const cues = captions.distributeCues(['a', 'b', 'c'], 10, 16);
    assert.equal(cues.length, 3);
    assert.equal(cues[0].start, 10);
    assert.equal(cues[2].end, 16);
    assert.equal(cues[1].start, 12, 'even slices');
  });

  it('dictation probe is false outside the browser (SSR-safe)', () => {
    assert.equal(captions.dictationSupported(), false);
  });
});

/* ──────────────────────────────────────────────────────────────────── */
/* 6. Source-level guards (the UI and routes are genuinely wired)       */
/* ──────────────────────────────────────────────────────────────────── */

const panelsSrc = read('src/components/studio/editor/panels.tsx');
const editorSrc = read('src/components/studio/editor/editor.tsx');
const transcribeSrc = read('src/app/api/video-studio/transcribe/route.ts');
const enhanceSrc = read('src/app/api/ai/enhance/route.ts');
const aiWsSrc = read('src/components/studio/editor/ai-workspace.tsx');
const exportSrc = read('src/components/studio/editor/export-studio.tsx');
const recorderSrc = read('src/components/studio/Recorder.tsx');

describe('every tool panel dispatches real edits', () => {
  const requiredDispatches = [
    "'split'", "'trim'", "'move-clip'", "'duplicate-clip'", "'delete-clip'",
    "'clip-props'", "'add-audio'", "'audio-props'", "'remove-audio'",
    "'add-text'", "'text-props'", "'remove-text'",
    "'add-overlay'", "'overlay-props'", "'remove-overlay'",
    "'add-caption'", "'caption-props'", "'remove-caption'", "'set-captions'",
  ];
  it('the panel surface covers split, trim, speed, crop, rotation, transitions, filters…', () => {
    for (const action of requiredDispatches) {
      assert.ok(panelsSrc.includes(action), `panels must dispatch ${action}`);
    }
  });

  it('filters panel offers presets, all five sliders and hold-to-compare', () => {
    for (const label of ['Brightness', 'Contrast', 'Saturation', 'Temperature', 'Sharpness', 'Hold to compare original']) {
      assert.ok(panelsSrc.includes(label), `missing filter control: ${label}`);
    }
    assert.ok(panelsSrc.includes('setCompare'), 'compare must reach the preview');
  });

  it('text panel covers font, colour, background, alignment, animation and duration', () => {
    for (const label of ['Font', 'Colour', 'Background', 'Align', 'Animation', 'Duration', 'Shadow']) {
      assert.ok(panelsSrc.includes(label), `missing text control: ${label}`);
      }
  });

  it('caption panel keeps manual, SRT, generate and dictation paths', () => {
    assert.ok(panelsSrc.includes('parseSrt'), 'SRT import wired');
    assert.ok(panelsSrc.includes('requestTranscription'), 'generate calls the real endpoint');
    assert.ok(panelsSrc.includes('dictationSupported'), 'dictation gated by support');
    assert.ok(panelsSrc.includes('no-provider'), 'missing provider is reported honestly');
  });
});

describe('the shell keeps preview, timeline and selection in sync', () => {
  it('undo/redo, play/pause, fullscreen and search are wired to real handlers', () => {
    for (const token of ["type: 'undo'", "type: 'redo'", 'togglePlay', 'toggleFullscreen', 'setSearchOpen', 'setSelection', 'seek(']) {
      assert.ok(editorSrc.includes(token), `editor shell missing ${token}`);
    }
  });

  it('the preview mirrors the exporter geometry (same helpers)', () => {
    for (const helper of ['fitRect', 'rotatedSize', 'cropClipPath', 'clipFilterCss', 'animationProgress', 'effectOverlays']) {
      assert.ok(editorSrc.includes(helper), `preview must reuse ${helper} from the export contract`);
    }
  });

  it('recordings land on the new editor route', () => {
    assert.ok(recorderSrc.includes("router.push('/seller/studio/editor')"), 'Recorder must open /seller/studio/editor');
  });

  it('the editor route exists and renders the studio inside SellerLayout', () => {
    const page = read('src/app/seller/studio/editor/page.tsx');
    assert.ok(page.includes('SellerLayout'), 'auth/layout wrapper required');
    assert.ok(page.includes('VideoEditorStudio'), 'the studio must render');
  });
});

describe('AI and transcription routes gate on REAL providers', () => {
  it('transcribe authenticates, role-gates, and returns no-provider without a key', () => {
    assert.ok(transcribeSrc.includes('verifyUserContext'), 'must authenticate');
    assert.ok(transcribeSrc.includes("user.role !== 'seller'"), 'must role-gate');
    assert.ok(transcribeSrc.includes('GEMINI_API_KEY'), 'must read the key server-side');
    assert.ok(transcribeSrc.includes("'no-provider'"), 'must report a missing provider');
    assert.ok(transcribeSrc.includes('code: \'too-large\''), 'must reject oversized payloads');
    assert.ok(!transcribeSrc.includes('console.log'), 'no payload logging');
    assert.ok(!transcribeSrc.includes('NEXT_PUBLIC'), 'key never exposed to the client');
  });

  it('enhance authenticates, checks ownership, and never fakes a provider', () => {
    assert.ok(enhanceSrc.includes('verifyUserContext'), 'must authenticate');
    assert.ok(enhanceSrc.includes('rec.userId !== user.uid'), 'an id alone must never grant access');
    assert.ok(enhanceSrc.includes('FAL_KEY'), 'provider detection is the real key check');
    assert.ok(enhanceSrc.includes("'no-provider'"), 'missing provider is surfaced');
    assert.ok(enhanceSrc.includes('storeGeneratedImage') && enhanceSrc.includes('storeGeneratedVideo'), 'results go to the real library');
    assert.ok(!enhanceSrc.includes('NEXT_PUBLIC'), 'key never exposed to the client');
  });

  it('the AI workspace disables itself when the server says unavailable', () => {
    assert.ok(aiWsSrc.includes("fetch('/api/ai/enhance')"), 'asks the server, never guesses');
    assert.ok(aiWsSrc.includes('No enhancement provider is connected'), 'states the gap in plain words');
    assert.ok(aiWsSrc.includes('disabled={!ready || !target || busy}'), 'run button is genuinely disabled');
  });

  it('export studio drives the real engine with progress + cancel + save', () => {
    assert.ok(exportSrc.includes('exportProject('), 'uses the real exporter');
    assert.ok(exportSrc.includes('cancel()'), 'cancel wired to the job');
    assert.ok(exportSrc.includes('saveToDevice'), 'file really saved');
    assert.ok(exportSrc.includes('uploadMedia('), 'publish uses the existing media pipeline');
    assert.ok(exportSrc.includes('transcodes'), 'WebM→MP4 path stated honestly');
  });
});
