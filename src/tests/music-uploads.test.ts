/**
 * Seller music uploads (Section 2) + homepage VPS migration (Section 3).
 * Run: npx tsx --test src/tests/music-uploads.test.ts
 *
 * The 30-second cap and the owner-scoped folder contract are pure logic and
 * are tested directly; the rest are source-level guards keeping the routes,
 * page and studio flow actually wired together (the same style as
 * security-rules.test.ts — no database or ffmpeg needed).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const music = require(join(ROOT, 'src', 'lib', 'media', 'music.ts')) as {
  MUSIC_MAX_SECONDS: number;
  MUSIC_FOLDER_ROOT: string;
  musicFolderFor: (uid: string) => string;
  isMusicFolder: (f?: string | null) => boolean;
  isMusicPath: (p?: string | null) => boolean;
  musicDurationOk: (s: number, max?: number) => boolean;
};

describe('music uploads: the 30-second rule', () => {
  it('caps seller music at exactly 30 seconds', () => {
    assert.equal(music.MUSIC_MAX_SECONDS, 30);
  });

  it('accepts clips within the cap (ffprobe rounding tolerance of 0.5s)', () => {
    assert.equal(music.musicDurationOk(0.5), true);
    assert.equal(music.musicDurationOk(29.9), true);
    assert.equal(music.musicDurationOk(30), true);
    assert.equal(music.musicDurationOk(30.4), true);
  });

  it('rejects clips over the cap', () => {
    assert.equal(music.musicDurationOk(30.6), false);
    assert.equal(music.musicDurationOk(31), false);
    assert.equal(music.musicDurationOk(120), false);
  });

  it('rejects unmeasurable durations instead of waving them through', () => {
    for (const s of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, undefined as unknown as number]) {
      assert.equal(music.musicDurationOk(s), false, `${s} must not pass the gate`);
    }
  });
});

describe('music uploads: owner-scoped folder contract', () => {
  it('places uploads under music/<uid>', () => {
    assert.equal(music.musicFolderFor('abc123'), 'music/abc123');
    assert.equal(music.isMusicFolder('music/abc123'), true);
    assert.equal(music.isMusicFolder('music'), true);
  });

  it('never mistakes other owner folders for music', () => {
    assert.equal(music.isMusicFolder('chats/abc123'), false);
    assert.equal(music.isMusicFolder('avatars/abc123'), false);
    assert.equal(music.isMusicFolder(undefined), false);
    assert.equal(music.isMusicPath('videos/2026/x.mp4'), false);
    assert.equal(music.isMusicPath('music/abc123/x.mp3'), true);
  });
});

describe('music wiring (source-level guards)', () => {
  const engine = readFileSync(join(ROOT, 'src', 'lib', 'media', 'engine.ts'), 'utf8');

  it('engine authorizes the music owner folder', () => {
    assert.match(engine, /FOLDER_ROOTS = new Set\(\[[^\]]*'music'/);
  });

  it('engine enforces the 30s cap server-side (ffprobe) before storing bytes', () => {
    assert.match(engine, /validateAudioFile\(tmpPath, mime/);
    assert.match(engine, /maxDurationSeconds: MUSIC_MAX_SECONDS/);
  });

  it('engine refuses non-audio files into the music folder', () => {
    assert.match(engine, /isMusicFolder\(destFolder\) && !isAudio/);
  });

  it('/api/music/mine reads only the caller token folder, never a query param', () => {
    const route = readFileSync(join(ROOT, 'src', 'app', 'api', 'music', 'mine', 'route.ts'), 'utf8');
    assert.match(route, /MUSIC_FOLDER_ROOT, user\.uid/);
    assert.doesNotMatch(route, /searchParams|request\.url/, 'uid must come from the verified token only');
    assert.match(route, /verifyRequestUser/);
  });

  it('there is NO standalone seller Music section — music lives only in the Living Picture flow', () => {
    const sidebar = readFileSync(join(ROOT, 'src', 'components', 'seller', 'seller-sidebar.tsx'), 'utf8');
    assert.doesNotMatch(sidebar, /dashboard\/seller\/music/, 'sidebar must not link a Music page');
    let pageExists = true;
    try {
      readFileSync(join(ROOT, 'src', 'app', 'dashboard', 'seller', 'music', 'page.tsx'), 'utf8');
    } catch {
      pageExists = false;
    }
    assert.equal(pageExists, false, 'the seller Music page should have been removed');
  });

  it('the Living Picture flow uploads music INLINE (photo + your own clip in one place)', () => {
    const flow = readFileSync(join(ROOT, 'src', 'components', 'studio', 'living-picture-flow.tsx'), 'utf8');
    // Loads the caller's own uploads and merges them into the track list.
    assert.match(flow, /\/api\/music\/mine/);
    assert.match(flow, /sellerTracks/);
    // Inline upload into the owner-scoped folder with the 30s constant.
    assert.match(flow, /pickMusic/);
    assert.match(flow, /musicFolderFor\(user\.uid\)/);
    assert.match(flow, /MUSIC_MAX_SECONDS/);
    // No link out to a deleted page.
    assert.doesNotMatch(flow, /\/dashboard\/seller\/music/);
    assert.doesNotMatch(flow, /from 'next\/link'/);
  });
});

describe('homepage VPS migration (Section 3)', () => {
  it('the homepage reads the live strip from our own origin, not the client Firestore SDK', () => {
    const home = readFileSync(join(ROOT, 'src', 'app', 'page.tsx'), 'utf8');
    assert.match(home, /\/api\/home\/live/);
    assert.doesNotMatch(home, /firebase\/firestore/, 'homepage must not query Firestore from the browser');
    assert.doesNotMatch(home, /useCollection/, 'homepage must not subscribe with the client SDK');
  });

  it('/api/home/live is public, VPS-first, and answers safely on failure', () => {
    const route = readFileSync(join(ROOT, 'src', 'app', 'api', 'home', 'live', 'route.ts'), 'utf8');
    assert.match(route, /pbListLiveSessions\(\{ status: 'live', limit: 6 \}\)/);
    assert.match(route, /NextResponse\.json\(\{ rooms: \[\] \}\)/);
    assert.doesNotMatch(route, /verifyUserContext|Authorization/, 'the landing strip is public on purpose');
  });

  it('the homepage demo-tile fallback still exists (graceful empty state)', () => {
    const home = readFileSync(join(ROOT, 'src', 'app', 'page.tsx'), 'utf8');
    assert.match(home, /DEMO_ROOMS/);
  });
});