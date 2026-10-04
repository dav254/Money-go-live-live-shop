import * as path from 'path';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { MEDIA_ROOT } from '@/lib/media/config';

export const runtime = 'nodejs';

const MIME_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
};

/**
 * Cache headers every response from this route carries.
 *
 * Files here are content-named and never rewritten, so a successful response is
 * immutable for a year and the browser stops asking at all. That matters most
 * for video: a feed scrolled back to a card already watched then plays from the
 * disk cache instead of re-downloading.
 */
const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * Resolve a `Range: bytes=…` header against a known file size.
 *
 * Returns null when the header is absent or unparseable (caller serves the
 * whole file), and `{ unsatisfiable: true }` when the range is syntactically
 * valid but points outside the file (caller answers 416).
 *
 * Suffix ranges (`bytes=-500`, the final N bytes) are handled explicitly.
 * Reading the missing start as 0 would ask for the whole file, which is wrong,
 * and browsers do send suffix ranges when resuming.
 */
function resolveRange(
  header: string,
  size: number,
): { start: number; end: number } | { unsatisfiable: true } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  // `bytes=-` is not a valid range.
  if (rawStart === '' && rawEnd === '') return null;

  let start: number;
  let end: number;

  if (rawStart === '') {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return { unsatisfiable: true };
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return { unsatisfiable: true };
  }

  return { start, end };
}

/** Wrap a Node read stream as the Web stream a Response body expects. */
function toWebStream(nodeStream: NodeJS.ReadableStream): ReadableStream {
  return Readable.toWeb(nodeStream as Readable) as unknown as ReadableStream;
}

/**
 * GET /api/media/file/<storagePath> — serves PUBLIC processed media from the
 * VPS disk with long-lived immutable caching (files are content-named, so they
 * never change once written).
 *
 * Security:
 *  - the resolved path must stay inside MEDIA_ROOT (blocks traversal and
 *    absolute paths);
 *  - the PRIVATE `requests/` namespace (request + offer attachments) is NEVER
 *    served here. Those files are delivered only through
 *    `/api/media/serve/<mediaId>`, which authorises the viewer on every
 *    request. An unguessable filename is not authorisation, so this route
 *    refuses the namespace outright.
 *
 * ## Why this streams byte ranges
 *
 * This route used to advertise `Accept-Ranges: bytes` and then ignore the
 * `Range` header completely: it read the entire file into memory and replied
 * `200 OK` with the whole body. That is a protocol contradiction, and it is why
 * product videos felt frozen.
 *
 * A `<video>` element opens with `Range: bytes=0-`. Answering that with the
 * complete file forces the browser to buffer the ENTIRE video before it will
 * show a moving picture — so a 100 MB product video spent seconds on a black
 * rectangle, which reads as a crash rather than a slow load. Every card in the
 * feed did it at once, and each request also allocated the whole file in memory.
 *
 * A range request is now answered with a real `206 Partial Content` streamed
 * straight off disk, so playback starts on the first chunk and memory stays
 * flat regardless of file size. The security model above is unchanged: the same
 * checks run before any range is honoured.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const rel = segments.map((s) => decodeURIComponent(s)).join('/');

  // Block traversal: no `..` segments, no absolute paths, no backslashes.
  if (!rel || rel.includes('..') || rel.includes('\\') || rel.startsWith('/')) {
    return new Response('Not found', { status: 404 });
  }

  // Private request/offer media (and the temp work dir) are never public.
  const firstSegment = rel.split('/')[0];
  if (firstSegment === 'requests' || firstSegment === 'tmp') {
    return new Response('Not found', { status: 404 });
  }

  const abs = path.resolve(MEDIA_ROOT, rel);
  if (!abs.startsWith(path.resolve(MEDIA_ROOT))) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const { stat } = await import('fs/promises');
    const st = await stat(abs);
    if (!st.isFile()) return new Response('Not found', { status: 404 });

    const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';

    // Ranges are honoured for every media type, not just video: Safari refuses
    // to play audio/video at all from a server that ignores Range, so gating
    // this on MIME type would leave iOS broken while Chrome limped along.
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      const range = resolveRange(rangeHeader, st.size);

      if (range && 'unsatisfiable' in range) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${st.size}`, 'Accept-Ranges': 'bytes' },
        });
      }

      if (range) {
        const length = range.end - range.start + 1;
        return new Response(
          toWebStream(createReadStream(abs, { start: range.start, end: range.end })),
          {
            status: 206,
            headers: {
              'Content-Type': mime,
              'Content-Length': String(length),
              'Content-Range': `bytes ${range.start}-${range.end}/${st.size}`,
              'Accept-Ranges': 'bytes',
              'Cache-Control': IMMUTABLE,
              'X-Content-Type-Options': 'nosniff',
            },
          },
        );
      }
    }

    // No range (or an unparseable one): stream the whole file rather than
    // buffering it, so a large video sent without a Range header cannot
    // exhaust memory either.
    return new Response(toWebStream(createReadStream(abs)), {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(st.size),
        'Cache-Control': IMMUTABLE,
        'X-Content-Type-Options': 'nosniff',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}