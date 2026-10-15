/**
 * TEMPORARY end-to-end image batch verification: mint a token, POST three
 * real PNGs in sequence to /api/media/upload exactly like the product form's
 * photo loop, and assert each one comes back 200 with a final URL.
 * Removes its auth user, media files, thumbnails and status sidecars on the
 * way out. Usage: npx tsx scripts/tmp-verify-uploads.ts
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { MEDIA_ROOT } from '@/lib/media/config';

const UID = 'debug-images-probe';
const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3000';

const app =
  getApps().find((a) => a.name === '[DEFAULT]') ??
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync('service-account.json', 'utf8'))) });
const adminAuth = getAuth(app);

async function main() {
  // Three distinct real PNGs (different colours → different bytes/dimensions).
  const colors = ['red', 'green', 'blue'];
  const files = colors.map((c) => {
    const p = `/tmp/probe-${c}.png`;
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', `color=c=${c}:s=640x480:d=1`, '-frames:v', '1', p], { stdio: 'pipe' });
    return { path: p, name: `${c}.png`, type: 'image/png' };
  });

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

  const mediaIds: string[] = [];
  const urls: string[] = [];
  for (const f of files) {
    const form = new FormData();
    form.append('file', new File([fs.readFileSync(f.path)], f.name, { type: f.type }));
    const res = await fetch(`${BASE}/api/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.idToken}` },
      body: form,
    });
    const body = (await res.json().catch(() => ({}))) as {
      mediaId?: string;
      url?: string;
      thumbnailUrl?: string;
      error?: string;
    };
    console.log(f.name, '→', res.status, JSON.stringify(body).slice(0, 220));
    if (res.status !== 200 || !body.url || !body.mediaId) {
      throw new Error(`${f.name} failed: ${res.status} ${body.error || ''}`);
    }
    mediaIds.push(body.mediaId);
    urls.push(body.url, body.thumbnailUrl || '');
  }

  for (const u of urls) {
    if (u.startsWith('/api/media/file/')) {
      fs.rmSync(path.join(MEDIA_ROOT, u.replace('/api/media/file/', '')), { force: true });
    }
  }
  for (const id of mediaIds) {
    fs.rmSync(path.join('/var/lib/vidnov/media-status', `${id}.json`), { force: true });
  }
  await adminAuth.deleteUser(UID).catch(() => undefined);
  for (const f of files) fs.rmSync(f.path, { force: true });

  console.log('VERIFY PASSED');
  process.exit(0);
}

void main().catch((err) => {
  console.error('VERIFY ERROR:', err?.message || err);
  process.exit(1);
});
