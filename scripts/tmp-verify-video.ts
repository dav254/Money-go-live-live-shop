/**
 * TEMPORARY end-to-end video verification: mint a token, POST a real (tiny)
 * MP4 to /api/media/upload, poll /api/media/status until READY or FAILED.
 * Proves the 401 fix covers the async video path too.
 * Removes its auth user, media file, thumbnail and status sidecar on the way
 * out. Usage: npx tsx scripts/tmp-verify-video.ts
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { MEDIA_ROOT } from '@/lib/media/config';

const UID = 'debug-video-probe';
const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3000';
const CLIP = '/tmp/probe-clip.mp4';

const app =
  getApps().find((a) => a.name === '[DEFAULT]') ??
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync('service-account.json', 'utf8'))) });
const adminAuth = getAuth(app);

function filesFor(mediaId: string, statusUrls: string[]): string[] {
  const hits = new Set<string>();
  // Stored outputs are content-hash named; take their locations from the
  // status record the processor wrote, not from the mediaId.
  for (const u of statusUrls) {
    const rel = u.replace(/^\/api\/media\/file\//, '');
    if (rel && !rel.startsWith('http')) hits.add(path.join(MEDIA_ROOT, rel));
  }
  const sidecar = path.join('/var/lib/vidnov/media-status', `${mediaId}.json`);
  if (fs.existsSync(sidecar)) {
    // The sidecar names any output the poll loop never saw (e.g. a FAILED
    // transcode that still wrote a partial file).
    try {
      const rec = JSON.parse(fs.readFileSync(sidecar, 'utf8')) as { url?: string; thumbnailUrl?: string };
      for (const u of [rec.url, rec.thumbnailUrl]) {
        if (u && u.startsWith('/api/media/file/')) {
          hits.add(path.join(MEDIA_ROOT, u.replace(/^\/api\/media\/file\//, '')));
        }
      }
    } catch { /* sidecar unreadable — the id alone still deletes it */ }
    hits.add(sidecar);
  }
  return [...hits].filter((f) => fs.existsSync(f));
}

async function main() {
  // A real 1-second H.264 clip — content the transcoder must process.
  execFileSync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:d=1',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', CLIP,
  ], { stdio: 'pipe' });

  const configFile = fs.readFileSync('src/firebase/config.ts', 'utf8');
  const m = /"apiKey":\s*"([^"]+)"|apiKey:\s*"([^"]+)"/.exec(configFile);
  const key = m?.[1] || m?.[2];
  if (!key) throw new Error('no web API key found');

  const customToken = await adminAuth.createCustomToken(UID);
  const signIn = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const session = (await signIn.json()) as { idToken?: string; error?: { message?: string } };
  if (!session.idToken) throw new Error(`signIn failed: ${session.error?.message}`);

  const form = new FormData();
  form.append('file', new File([fs.readFileSync(CLIP)], 'probe.mp4', { type: 'video/mp4' }));
  const res = await fetch(`${BASE}/api/media/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.idToken}` },
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as {
    mediaId?: string;
    url?: string;
    error?: string;
  };
  console.log('upload status =', res.status, '→', JSON.stringify(body));

  let final = 'UNKNOWN';
  const seenUrls = new Set<string>();
  if (body.mediaId) {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const s = (await fetch(`${BASE}/api/media/status?id=${body.mediaId}`).then((r) => r.json())) as {
        status?: string;
        url?: string;
        thumbnailUrl?: string;
        error?: string;
      };
      if (s.url) seenUrls.add(s.url);
      if (s.thumbnailUrl) seenUrls.add(s.thumbnailUrl);
      final = `${s.status}${s.url ? ` url=${s.url}` : ''}${s.error ? ` error=${s.error}` : ''}`;
      if (s.status === 'READY' || s.status === 'FAILED') break;
      process.stdout.write('.');
    }
    console.log('\nfinal status →', final);
  }

  for (const file of filesFor(body.mediaId || 'never', [...seenUrls])) {
    fs.rmSync(file, { force: true });
    console.log('removed', file);
  }
  await adminAuth.deleteUser(UID).catch(() => undefined);
  fs.rmSync(CLIP, { force: true });

  const ok = res.status === 200 && body.mediaId && final.startsWith('READY');
  console.log(ok ? 'VERIFY PASSED' : 'VERIFY FAILED');
  process.exitCode = ok ? 0 : 1;
}

void main().catch((err) => {
  console.error('VERIFY ERROR:', err?.message || err);
  process.exitCode = 1;
});
