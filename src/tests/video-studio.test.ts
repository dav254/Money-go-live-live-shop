/**
 * VIDEO STUDIO (Sections A–J).
 * Run: npx tsx --test src/tests/video-studio.test.ts
 *
 * Two layers, same style as music-uploads.test.ts:
 *   1. PURE logic — every clamp, validation and the ffmpeg plan the server
 *      will execute, tested directly (no ffmpeg/spawn needed);
 *   2. SOURCE-level guards — the routes are authorized, idempotent and
 *      secret-free, the client never imports server-only code, the rules
 *      files stay identical, and the public surfaces are actually wired.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const vs = require(join(ROOT, 'src', 'lib', 'studio', 'video-studio.ts')) as {
  sanitizeSoundtrack: (raw: unknown) => Record<string, unknown> | null;
  sanitizeTrim: (raw: unknown, duration: number) => { startSeconds: number; endSeconds: number } | null;
  sanitizeOverlay: (raw: unknown) => { text: string; position: string } | null;
  sanitizeAspect: (raw: unknown) => string;
  validatePublishDetails: (raw: unknown) => string | null;
  sanitizePublishDetails: (raw: unknown) => Record<string, unknown>;
  buildStandaloneVideoDoc: (input: Record<string, unknown>) => Record<string, unknown>;
  buildAttachToProductPatch: (input: Record<string, unknown>) => Record<string, unknown>;
  croppedSize: (a: string, w: number, h: number) => { width: number; height: number };
  needsRender: (p: Record<string, unknown>) => boolean;
  buildMixArgs: (p: Record<string, unknown>) => string[];
  OVERLAY_MAX: number;
  CAPTION_MAX: number;
};

const plan = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  videoPath: '/var/lib/vidnov/tmp/src.mp4',
  outPath: '/var/lib/vidnov/tmp/out.mp4',
  durationSeconds: 20,
  width: 1080,
  height: 1920,
  videoHasAudio: true,
  ...over,
});

/* ──────────────────────────────────────────────────────────────────── */

describe('soundtrack sanitization (server trusts only this)', () => {
  it('refuses a soundtrack with no resolvable source', () => {
    assert.equal(vs.sanitizeSoundtrack(null), null);
    assert.equal(vs.sanitizeSoundtrack({}), null);
    assert.equal(vs.sanitizeSoundtrack({ musicVolume: 0.5 }), null);
    assert.equal(vs.sanitizeSoundtrack({ musicMediaId: '' }), null);
  });

  it('refuses ids that look like paths (raw paths can never reach the resolver)', () => {
    assert.equal(vs.sanitizeSoundtrack({ musicMediaId: 'music/abc/../etc' }), null);
    assert.equal(vs.sanitizeSoundtrack({ musicMediaId: '/etc/passwd' }), null);
    assert.equal(vs.sanitizeSoundtrack({ musicMediaId: 'short' }), null); // below 6 chars
    assert.equal(vs.sanitizeSoundtrack({ catalogueTrackId: '../../x' }), null);
  });

  it('accepts a bare id and clamps every number into safe bounds', () => {
    const s = vs.sanitizeSoundtrack({
      musicMediaId: 'a1b2c3d4e5f6',
      startSeconds: -5,
      musicVolume: 9,
      originalVolume: -1,
      fadeInSeconds: 99,
      fadeOutSeconds: 12,
      loop: 'yes', // not a boolean → off
    });
    assert.ok(s);
    assert.equal(s.startSeconds, 0);
    assert.equal(s.musicVolume, 1);
    assert.equal(s.originalVolume, 0); // clamp(-1) → 0
    assert.equal(s.fadeInSeconds, 5);
    assert.equal(s.fadeOutSeconds, 5);
    assert.equal(s.loop, false);
  });

  it('muteOriginal forces the original volume to zero', () => {
    const s = vs.sanitizeSoundtrack({
      catalogueTrackId: 'track-one',
      muteOriginal: true,
      originalVolume: 1,
    });
    assert.ok(s);
    assert.equal(s.originalVolume, 0);
    assert.equal(s.muteOriginal, true);
  });

  it('handles non-numeric garbage without NaN leaking into ffmpeg', () => {
    const s = vs.sanitizeSoundtrack({
      musicMediaId: 'a1b2c3d4e5f6',
      startSeconds: 'later',
      musicVolume: null,
      fadeInSeconds: {},
    });
    assert.ok(s);
    for (const v of [s.startSeconds, s.musicVolume, s.fadeInSeconds]) {
      assert.ok(Number.isFinite(v), `expected finite, got ${v}`);
    }
  });
});

describe('trim / overlay / details validation', () => {
  it('treats a full-length trim as "no trim" and refuses slivers', () => {
    assert.equal(vs.sanitizeTrim({ startSeconds: 0, endSeconds: 20 }, 20), null);
    assert.equal(vs.sanitizeTrim({ startSeconds: 5, endSeconds: 5.2 }, 20), null);
    assert.equal(vs.sanitizeTrim(null, 20), null);
  });

  it('clamps out-of-range trim into the clip', () => {
    // -3 clamps to 0; 999 clamps to the clip end — which here collapses to
    // the full clip, i.e. genuinely "no trim" (the correct refusal).
    assert.equal(vs.sanitizeTrim({ startSeconds: -3, endSeconds: 999 }, 20), null);
    const t = vs.sanitizeTrim({ startSeconds: -3, endSeconds: 15 }, 20);
    assert.ok(t);
    assert.equal(t.startSeconds, 0);
    assert.equal(t.endSeconds, 15);
    const u = vs.sanitizeTrim({ startSeconds: 5, endSeconds: 999 }, 20);
    assert.ok(u);
    assert.equal(u.endSeconds, 20);
    assert.ok(u.endSeconds - u.startSeconds >= 0.5);
  });

  it('overlay text is trimmed to the cap and position defaults to top', () => {
    const o = vs.sanitizeOverlay({ text: 'x'.repeat(500), position: 'sideways' });
    assert.ok(o);
    assert.equal(o.text.length, vs.OVERLAY_MAX);
    assert.equal(o.position, 'top');
    assert.equal(vs.sanitizeOverlay({ text: '   ' }), null);
  });

  it('publish details: short titles and oversized captions are rejected', () => {
    assert.notEqual(vs.validatePublishDetails({ title: 'ab' }), null);
    assert.notEqual(vs.validatePublishDetails({}), null);
    assert.notEqual(
      vs.validatePublishDetails({ title: 'Good', caption: 'x'.repeat(vs.CAPTION_MAX + 1) }),
      null,
    );
    assert.equal(vs.validatePublishDetails({ title: 'Handmade leather tote' }), null);
  });

  it('product ids with traversal characters can never pass as a link target', () => {
    const d = vs.sanitizePublishDetails({
      title: 'Video',
      productId: '../../other-sellers-listing',
    });
    assert.equal(d.productId, null);
    const ok = vs.sanitizePublishDetails({ title: 'Video', productId: 'abc-123_XYZ' });
    assert.equal(ok.productId, 'abc-123_XYZ');
    assert.equal(vs.sanitizePublishDetails({ title: 'V', visibility: 'weird' }).visibility, 'public');
  });
});

describe('publish document builders', () => {
  it('standalone videos become zero-stock listings the feed renders as video', () => {
    const doc = vs.buildStandaloneVideoDoc({
      sellerId: 'seller1',
      details: {
        title: 'My intro',
        caption: 'About the shop',
        category: '',
        hashtags: '#leather #tote handmade',
        visibility: 'public',
        location: 'Nairobi',
      },
      videoUrl: '/api/media/file/videos/x.mp4',
      posterUrl: '/api/media/file/thumbnails/x_t.jpg',
      studioVideoId: 'draft-1',
      createdAt: 'TS',
    });
    assert.equal(doc.stock, 0); // never buyable by accident
    assert.equal(doc.hasVideo, true);
    assert.deepEqual(doc.videoUrls, ['/api/media/file/videos/x.mp4']);
    assert.deepEqual(doc.videoThumbnailUrls, ['/api/media/file/thumbnails/x_t.jpg']);
    assert.equal(doc.studioVideoId, 'draft-1');
    assert.equal(doc.uploadDate, 'TS');
    assert.equal(doc.tags, 'leather, tote, handmade');
    assert.equal(doc.sellerId, 'seller1');
    assert.ok(!('price' in doc) || doc.price === 0);
  });

  it('attaching to an existing listing patches media only — never money or ownership', () => {
    const patch = vs.buildAttachToProductPatch({
      videoUrl: '/v/new.mp4',
      posterUrl: '/p/new.jpg',
      existingVideoUrls: ['/v/old.mp4'],
      existingPosters: ['/p/old.jpg'],
      updatedAt: 'NOW',
    });
    assert.deepEqual(patch.videoUrls, ['/v/old.mp4', '/v/new.mp4']);
    assert.deepEqual(patch.videoThumbnailUrls, ['/p/old.jpg', '/p/new.jpg']);
    assert.equal(patch.videoUrl, '/v/old.mp4');
    assert.equal(patch.hasVideo, true);
    for (const forbidden of ['price', 'stock', 'sellerId', 'imageUrl', 'name']) {
      assert.ok(!(forbidden in patch), `${forbidden} must never be patched by a video publish`);
    }
  });

  it('re-attaching the same clip dedupes instead of growing the list', () => {
    const patch = vs.buildAttachToProductPatch({
      videoUrl: '/v/new.mp4',
      posterUrl: '/p/new.jpg',
      existingVideoUrls: ['/v/old.mp4', '/v/new.mp4'],
      existingPosters: ['/p/old.jpg', ''],
      updatedAt: 'NOW',
    });
    assert.equal((patch.videoUrls as string[]).length, 2);
    assert.equal((patch.videoThumbnailUrls as string[])[1], '/p/new.jpg');
  });
});

describe('ffmpeg plan', () => {
  it('knows when a render is genuinely needed', () => {
    assert.equal(vs.needsRender(plan()), false);
    assert.equal(vs.needsRender(plan({ trim: { startSeconds: 1, endSeconds: 5 } })), true);
    assert.equal(vs.needsRender(plan({ aspect: '9:16' })), true);
    assert.equal(vs.needsRender(plan({ overlay: { text: 'hi', position: 'top' } })), true);
    assert.equal(
      vs.needsRender(plan({ soundtrack: { musicMediaId: 'abc123' }, musicPath: '/m.mp3' })),
      true,
    );
    // A soundtrack WITHOUT a resolved path must not pretend a render is needed.
    assert.equal(vs.needsRender(plan({ soundtrack: { musicMediaId: 'abc123' } })), false);
  });

  it('output is always trimmed to the clip length with the mix duration=first', () => {
    const args = vs.buildMixArgs(
      plan({
        trim: { startSeconds: 2, endSeconds: 9 },
        soundtrack: { musicMediaId: 'abc123', startSeconds: 1, musicVolume: 0.6, originalVolume: 1 },
        musicPath: '/music.mp3',
      }),
    );
    const line = args.join(' ');
    assert.ok(args.includes('-ss') && args.includes('2'), 'input seek');
    assert.ok(args.includes('-t') && args.includes('7'), 'output duration = trim length');
    assert.ok(line.includes('amix=inputs=2:duration=first'), 'video length always wins');
    assert.ok(line.includes('volume=0.6'), 'music volume honoured');
    assert.ok(line.includes('atrim=start=1'), 'music start position honoured');
    assert.equal(line.includes('-stream_loop'), false, 'no loop unless requested');
  });

  it('loops only when the seller enabled it', () => {
    const args = vs.buildMixArgs(
      plan({
        soundtrack: { musicMediaId: 'abc123', startSeconds: 0, musicVolume: 1, originalVolume: 1, loop: true },
        musicPath: '/music.mp3',
      }),
    );
    const i = args.indexOf('-stream_loop');
    assert.ok(i !== -1);
    assert.equal(args[i + 1], '-1');
    assert.equal(args[i + 2], '-i');
  });

  it('gives a silent source an anullsrc bed so music still mixes', () => {
    const withAudio = vs.buildMixArgs(
      plan({ soundtrack: { musicMediaId: 'abc123', musicVolume: 1, originalVolume: 1 }, musicPath: '/m.mp3' }),
    ).join(' ');
    const noAudio = vs.buildMixArgs(
      plan({
        videoHasAudio: false,
        soundtrack: { musicMediaId: 'abc123', musicVolume: 1, originalVolume: 1 },
        musicPath: '/m.mp3',
      }),
    ).join(' ');
    assert.equal(withAudio.includes('anullsrc'), false);
    assert.ok(noAudio.includes('anullsrc'), 'missing audio stream gets silence to mix against');
  });

  it('applies fades only when configured, inside the music chain', () => {
    const args = vs.buildMixArgs(
      plan({
        soundtrack: {
          musicMediaId: 'abc123',
          startSeconds: 0,
          musicVolume: 1,
          originalVolume: 1,
          fadeInSeconds: 2,
          fadeOutSeconds: 3,
        },
        musicPath: '/m.mp3',
      }),
    ).join(' ');
    assert.ok(args.includes('afade=t=in:st=0:d=2'));
    assert.ok(args.includes('afade=t=out:st=17:d=3'), 'fades against the video length (20-3)');
    const noFade = vs.buildMixArgs(
      plan({ soundtrack: { musicMediaId: 'abc123', musicVolume: 1, originalVolume: 1 }, musicPath: '/m.mp3' }),
    ).join(' ');
    assert.equal(noFade.includes('afade'), false);
  });

  it('never interpolates seller text into the filter string (textfile only)', () => {
    const nasty = 'evil: text, $(rm -rf), [0:v]drawbox, \'; drop #f';
    const args = vs.buildMixArgs(
      plan({
        overlay: { text: nasty, position: 'bottom' },
        textFilePath: '/tmp/workdir/overlay.txt',
      }),
    );
    const line = args.join(' ');
    assert.ok(line.includes('drawtext=textfile=/tmp/workdir/overlay.txt'));
    assert.equal(line.includes(nasty), false, 'the text must live only in the file');
    assert.equal(line.includes('rm -rf'), false);
  });

  it('crops to even dimensions for every aspect', () => {
    for (const a of ['original', '9:16', '1:1', '16:9']) {
      const s = vs.croppedSize(a, 1920, 1080);
      assert.equal(s.width % 2, 0, `${a} width even`);
      assert.equal(s.height % 2, 0, `${a} height even`);
      assert.ok(s.width <= 1920 && s.height <= 1080, `${a} never upscales`);
    }
    assert.deepEqual(vs.croppedSize('original', 1920, 1080), { width: 1920, height: 1080 });
    assert.ok(Math.abs(vs.croppedSize('9:16', 1920, 1080).width / 1080 - 9 / 16) < 0.01);
  });
});

/* ── source-level guards ───────────────────────────────────────────── */

describe('authorization and privacy of the API routes', () => {
  const mix = read('src/app/api/video-studio/mix/route.ts');
  const publish = read('src/app/api/video-studio/publish/route.ts');

  it('both routes authenticate with verifyUserContext and gate on the seller role', () => {
    for (const [name, src] of [
      ['mix', mix],
      ['publish', publish],
    ] as const) {
      assert.ok(src.includes('verifyUserContext'), `${name} must verify the caller`);
      assert.ok(
        src.includes("user.role !== 'seller'") && src.includes("user.role !== 'admin'"),
        `${name} must gate on role`,
      );
    }
  });

  it('never trusts a client-supplied seller id', () => {
    assert.equal(mix.includes('sellerId:'), false, 'mix derives ownership from the token only');
    assert.equal(/body\.sellerId/.test(publish), false);
  });

  it('publish is idempotent under a concurrent double-tap', () => {
    assert.ok(publish.includes('runTransaction'), 'claim must be transactional');
    assert.ok(publish.includes('alreadyPublished'), 'same result returned for a repeat');
    assert.ok(publish.includes('CLAIM_TTL_MS'), 'a stuck claim must expire');
  });

  it('published URLs come from the server-owned status record, not the client', () => {
    assert.ok(publish.includes('finalRec.url'));
    assert.ok(publish.includes('finalRec.userId !== user.uid'), 'final media must be owned');
    assert.equal(/body\.(videoUrl|posterUrl|finalUrl)/.test(publish), false);
  });

  it('responses and logs carry no storage paths, tokens or thrown errors', () => {
    for (const [name, src] of [
      ['mix', mix],
      ['publish', publish],
    ] as const) {
      assert.equal(src.includes('storagePath'), false, `${name} must not expose storage paths`);
      assert.equal(src.includes('console.log'), false, `${name} must not log freely`);
      assert.equal(
        /console\.error\([^)]*,\s*(err|error|e)\b/.test(src),
        false,
        `${name} must not log the error object (it can carry request detail)`,
      );
      assert.equal(src.includes('stack'), false);
    }
  });

  it('the draft store stays owner-only in BOTH rules files, byte-identical', () => {
    const a = read('firestore.rules');
    const b = read('src/firestore.rules');
    assert.equal(a, b, 'firestore.rules and src/firestore.rules must stay identical');
    assert.ok(a.includes('match /studioVideos/{videoId}'));
    // Scoped to the studioVideos block ([^}]* stops at its closing brace) so
    // a later public match in another collection can never satisfy it.
    assert.ok(
      /match \/studioVideos\/\{videoId\} \{[^}]*resource\.data\.sellerId == request\.auth\.uid/.test(a),
      'studioVideos must be owner-gated',
    );
    assert.equal(
      /match \/studioVideos\/\{videoId\} \{[^}]*allow read, list: if true/.test(a),
      false,
      'drafts must never be publicly readable',
    );
    assert.equal(
      /match \/studioVideos\/\{videoId\} \{[^}]*allow read: if true/.test(a),
      false,
      'drafts must never be publicly readable',
    );
  });
});

describe('client/server boundary', () => {
  const clientFiles = [
    'src/components/video-studio/video-studio.tsx',
    'src/components/video-studio/recorder.tsx',
    'src/components/video-studio/music-panel.tsx',
    'src/components/video-studio/my-videos.tsx',
  ];

  it('no client module imports the server-only renderer or process APIs', () => {
    for (const f of clientFiles) {
      const src = read(f);
      assert.ok(src.startsWith("'use client'"), `${f} must be a client component`);
      for (const banned of ["@/lib/media/soundtrack", 'child_process', "from 'fs'", 'process.env']) {
        assert.equal(src.includes(banned), false, `${f} must not reference ${banned}`);
      }
    }
  });

  it('the renderer resolves music only from owned uploads or the licensed catalogue', () => {
    const src = read('src/lib/media/soundtrack.ts');
    assert.ok(src.includes("music/${uid}/"), 'own-folder prefix required');
    assert.ok(src.includes("track.streamUrl.startsWith('/music/')"), 'catalogue confined to /music/');
    assert.ok(src.includes('abs.startsWith(root + path.sep)'), 'containment check on the resolved path');
    assert.ok(src.includes('rec.userId !== uid'), 'owner check on every resolve');
  });
});

describe('studio wiring (nav, registry, public surfaces)', () => {
  it('the seller sidebar links to the studio and the registry governs the route', () => {
    const sidebar = read('src/components/seller/seller-sidebar.tsx');
    assert.ok(sidebar.includes('/dashboard/seller/video-studio'));
    assert.ok(sidebar.includes('SectionNavItem'), 'entry must respect admin toggles');
    const sections = read('src/lib/app-sections.ts');
    assert.ok(sections.includes("prefixes: ['/dashboard/seller/video-studio']"));
    assert.ok(existsSync(join(ROOT, 'src/app/dashboard/seller/video-studio/page.tsx')));
  });

  it('homepage intro video uses only the configured asset, with a fallback', () => {
    const page = read('src/app/page.tsx');
    assert.ok(page.includes('process.env.NEXT_PUBLIC_VIDNOV_INTRO_VIDEO_URL'));
    assert.ok(page.includes('onError'), 'a broken video must fall back, not block the page');
    assert.ok(page.includes('INTRO_POSTER'), 'fallback image required');
    assert.equal(
      /src=\{?["'`][^"'`]*\.mp4["'`]/.test(page),
      false,
      'no hardcoded video URL may be invented',
    );
    assert.ok(page.includes('/dashboard/seller/video-studio'), 'CTA into the studio');
  });

  it('the recorder has camera switching, permission fallback and a file fallback', () => {
    const src = read('src/components/video-studio/recorder.tsx');
    assert.ok(src.includes('getUserMedia'));
    assert.ok(src.includes('facingMode'));
    assert.ok(src.includes('NotAllowedError'), 'permission denial must be handled');
    assert.ok(src.includes('MediaRecorder'), 'recording must use MediaRecorder');
    assert.ok(src.includes('type="file"'), 'always offer the existing-file fallback');
  });

  it('publishing requires the rendered final media to exist in the studio flow', () => {
    const src = read('src/components/video-studio/video-studio.tsx');
    assert.ok(src.includes('/api/video-studio/mix'), 'renders through the server');
    assert.ok(src.includes('/api/video-studio/publish'), 'publishes through the server');
    assert.ok(src.includes('/api/media/status'), 'polls real processing status');
    assert.equal(src.includes('Published') && src.includes('mock'), false);
    assert.ok(src.includes('disabled={publishing || !final}'), 'no publish before the final file exists');
  });
});