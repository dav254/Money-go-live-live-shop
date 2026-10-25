import { NextResponse } from 'next/server';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { MEDIA_ROOT } from '@/lib/media/config';
import { readStatus, engineMediaUrl } from '@/lib/media/engine';
import { MUSIC_FOLDER_ROOT, MUSIC_MAX_SECONDS } from '@/lib/media/music';
import { verifyRequestUser } from '@/lib/media/api-auth';

export const runtime = 'nodejs';

/**
 * GET /api/music/mine — the signed-in seller's own uploaded music.
 *
 * Reads the DISK (the same store the engine writes to) under the
 * caller's own folder `music/<uid>/` only — the uid comes from the verified
 * Bearer token, never from the query string, so no seller can list another
 * seller's tracks. Returns display-safe fields only: title, stream URL,
 * mime, duration, size, timestamp. Never storage paths, never other users'
 * data, never server internals.
 */
export async function GET(request: Request) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dir = path.join(MEDIA_ROOT, MUSIC_FOLDER_ROOT, user.uid);
  let names: string[] = [];
  try {
    names = await fsp.readdir(dir);
  } catch {
    names = []; // no uploads yet — an empty list, not an error
  }

  const tracks: Array<{
    id: string;
    title: string;
    url: string;
    mimeType: string;
    durationSeconds: number | null;
    sizeBytes: number;
    createdAtMs: number;
  }> = [];

  for (const name of names) {
    const id = path.basename(name, path.extname(name));
    const status = await readStatus(id);
    if (!status) continue;
    if (status.status !== 'READY' || status.type !== 'audio' || !status.storagePath) continue;
    // Belt and braces: only ever return files under THIS user's folder.
    if (!status.storagePath.startsWith(`${MUSIC_FOLDER_ROOT}/${user.uid}/`)) continue;
    if (status.userId !== user.uid) continue;

    tracks.push({
      id,
      title: (status.originalName || name).replace(/\.[^.]+$/, ''),
      url: status.url ?? engineMediaUrl(status.storagePath),
      mimeType: status.mimeType || 'audio/mpeg',
      durationSeconds:
        typeof status.durationSeconds === 'number' && Number.isFinite(status.durationSeconds)
          ? status.durationSeconds
          : null,
      sizeBytes: status.sizeBytes ?? 0,
      createdAtMs: status.createdAt ?? 0,
    });
  }

  tracks.sort((a, b) => b.createdAtMs - a.createdAtMs);

  return NextResponse.json({ tracks, maxSeconds: MUSIC_MAX_SECONDS });
}