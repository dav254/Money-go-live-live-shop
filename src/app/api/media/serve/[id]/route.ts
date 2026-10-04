import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import type { NextRequest } from 'next/server';
import { MEDIA_COLLECTION } from '@/lib/media/config';
import type { MediaRecord } from '@/lib/media/service';
import { getStorageAdapter } from '@/lib/media/storage-adapter';
import { authorizeMediaView } from '@/lib/media/service';

export const runtime = 'nodejs';

const MIME_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
};

/** Outcome of parsing a `Range` header against a known file size. */
type RangeSpec =
  | { kind: 'range'; start: number; end: number }
  | { kind: 'unsatisfiable' }
  | null;

/**
 * GET /api/media/serve/<mediaId>?thumb=1 — authorization-checked delivery
 * for PRIVATE media (spec §32). Filenames are server-generated, but
 * unguessable names are not authorization: every request is resolved
 * through the media record and the viewer's relationship to it.
 *
 * Range requests (which is what every <video> element sends) read only the
 * requested bytes off disk, so playback starts on the first chunk instead of
 * waiting for the whole file. Safari refuses media elements outright unless
 * the response honours Range, so this applies to every media type, not just
 * mp4.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || !/^[a-f0-9]{32}$/.test(id)) {
    return new Response('Not found', { status: 404 });
  }

  const viewer = await verifyUserContext(request).catch(() => null);

  try {
    const media = await authorizeMediaView(id, viewer?.uid ?? null, viewer?.isAdmin ?? false);
    if (!media) {
      return viewer
        ? new Response('Forbidden', { status: 403 })
        : new Response('Unauthorized', { status: 401 });
    }

    const wantThumb = request.nextUrl.searchParams.get('thumb') === '1';
    const relPath = wantThumb && media.thumbnailPath ? media.thumbnailPath : media.storagePath;
    if (!relPath) return new Response('Not found', { status: 404 });

    const adapter = getStorageAdapter();
    const abs = adapter.resolve(relPath);
    const stat = await adapter.stat(abs);
    if (!stat) return new Response('Not found', { status: 404 });

    const ext = relPath.slice(relPath.lastIndexOf('.')).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
    const downloadName = media.originalName || media.storedName;

    const baseHeaders: Record<string, string> = {
      'Content-Type': mime,
      'Cache-Control': 'private, max-age=600',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename="${encodeURIComponent(downloadName)}"`,
    };

    const range = resolveRange(request.headers.get('range'), stat.size);

    if (range?.kind === 'unsatisfiable') {
      return new Response(null, {
        status: 416,
        headers: { ...baseHeaders, 'Content-Range': `bytes */${stat.size}` },
      });
    }

    if (range?.kind === 'range') {
      // Read only the requested bytes — never the whole file.
      const slice = await adapter.readSlice(abs, range.start, range.end);
      void touchViewedAt(id);
      return new Response(new Uint8Array(slice), {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Length': String(slice.byteLength),
          'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
        },
      });
    }

    const buf = await adapter.readFile(abs);
    void touchViewedAt(id);

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: { ...baseHeaders, 'Content-Length': String(buf.byteLength) },
    });
  } catch (error) {
    console.error('[media/serve]', error);
    return new Response('Server error', { status: 500 });
  }
}

/**
 * Parse a single-range `Range: bytes=…` header against a known file size.
 * Returns null when there is no usable range (serve the whole file) and
 * `unsatisfiable` when the range is valid but out of bounds.
 */
function resolveRange(header: string | null, size: number): RangeSpec {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  if (!rawStart) {
    // Suffix range: the last N bytes.
    const wanted = Number(rawEnd);
    if (!Number.isFinite(wanted) || wanted <= 0) return null;
    const start = Math.max(0, size - wanted);
    return { kind: 'range', start, end: size - 1 };
  }

  const start = Number(rawStart);
  if (!Number.isFinite(start)) return null;
  if (start >= size) return { kind: 'unsatisfiable' };

  const end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
  if (!Number.isFinite(end) || end < start) return { kind: 'unsatisfiable' };
  return { kind: 'range', start, end };
}

/** Best-effort view counter for request insights. */
function touchViewedAt(mediaId: string): void {
  void db
    .collection(MEDIA_COLLECTION)
    .doc(mediaId)
    .update({ lastViewedAt: FieldValue.serverTimestamp() })
    .catch(() => undefined);
}