import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/video-studio/transcribe — speech-to-text for the video editor's
 * caption generator.
 *
 * The client (src/lib/editor/captions.ts) sends the clip as raw base64 plus
 * its duration, and expects `{ cues: [{text,start,end}] }`. Honesty rules the
 * UI depends on:
 *
 *   - no GEMINI_API_KEY server-side → 503 `{code:'no-provider'}` — the panel
 *     then tells the user no speech-to-text provider is connected (it never
 *     fakes cues);
 *   - oversized payloads → 413 `{code:'too-large'}` (inline data cap ~12MB
 *     base64 ≈ 9MB of video);
 *   - provider failure → 502 `{code:'failed'}` with the provider's message.
 *
 * Gemini receives the video as `inline_data` and is asked (via a JSON
 * response schema) for an array of {text, start, end} objects — nothing else.
 * Every cue is clamped and sorted server-side before it leaves.
 */

const MODEL = 'gemini-3.8-flash';
/** Base64 grows input by 4/3 — 12MB of base64 ≈ 9MB of video. */
const MAX_BASE64_CHARS = 12 * 1024 * 1024;
const MAX_DURATION_SECONDS = 600;

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      text: { type: 'STRING' },
      start: { type: 'NUMBER' },
      end: { type: 'NUMBER' },
    },
    required: ['text', 'start', 'end'],
  },
} as const;

const PROMPT =
  'Transcribe the speech in this video for subtitles. Return ONLY the JSON array ' +
  'required by the schema. Each item is one caption line: its transcribed text, and ' +
  'its start and end times in SECONDS relative to the beginning of the video. Use ' +
  'short lines that fit on one screen (max ~6 words), merge tiny fragments, keep ' +
  'speech order, and omit silence. Timestamps must be numbers, end > start.';

/** Sniff mp4 (ftyp) vs webm (EBML magic) from base64 — the client sends no mime. */
function sniffMime(base64: string): string {
  const head = base64.slice(0, 64);
  if (head.startsWith('AAAAHGZ0eXB') || head.startsWith('AAAAIGZ0eXB')) return 'video/mp4';
  if (head.startsWith('GkXf')) return 'video/webm';
  return 'video/mp4';
}

function safeJsonParse(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(trimmed);
}

interface RawCue {
  text?: unknown;
  start?: unknown;
  end?: unknown;
}

export async function POST(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'seller' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Only sellers can generate captions.' }, { status: 403 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        code: 'no-provider',
        error: 'No speech-to-text provider is connected on this server yet.',
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    videoBase64?: unknown;
    durationSeconds?: unknown;
  };
  const videoBase64 = typeof body.videoBase64 === 'string' ? body.videoBase64 : '';
  if (!videoBase64) {
    return NextResponse.json({ code: 'failed', error: 'No video was sent.' }, { status: 400 });
  }
  if (videoBase64.length > MAX_BASE64_CHARS) {
    return NextResponse.json(
      {
        code: 'too-large',
        error: 'This clip is over the 9MB transcription limit. Split it or type captions manually.',
      },
      { status: 413 },
    );
  }
  const durationSeconds = Math.min(
    MAX_DURATION_SECONDS,
    Math.max(1, Number(body.durationSeconds) || MAX_DURATION_SECONDS),
  );

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: sniffMime(videoBase64), data: videoBase64 } },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            response_schema: RESPONSE_SCHEMA,
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(90_000),
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      return NextResponse.json(
        {
          code: 'failed',
          error: `Speech-to-text provider returned ${res.status}.${detail ? ` ${detail}` : ''}`,
        },
        { status: 502 },
      );
    }

    const data = (await res.json().catch(() => null)) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    } | null;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return NextResponse.json(
        { code: 'failed', error: 'The provider returned no transcription.' },
        { status: 502 },
      );
    }

    let parsed: unknown;
    try {
      parsed = safeJsonParse(text);
    } catch {
      return NextResponse.json(
        { code: 'failed', error: 'The transcription came back in an unreadable format.' },
        { status: 502 },
      );
    }

    const cues = (Array.isArray(parsed) ? (parsed as RawCue[]) : [])
      .map((cue) => ({
        text: String(cue.text ?? '').trim().slice(0, 300),
        start: Math.max(0, Math.min(durationSeconds, Number(cue.start) || 0)),
        end: Math.max(0, Math.min(durationSeconds, Number(cue.end) || 0)),
      }))
      .filter((cue) => cue.text.length > 0 && cue.end > cue.start)
      .sort((a, b) => a.start - b.start)
      .slice(0, 400);

    if (cues.length === 0) {
      return NextResponse.json(
        { code: 'failed', error: 'No speech was found in that clip.' },
        { status: 200 },
      );
    }

    return NextResponse.json({ cues });
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'TimeoutError'
        ? 'Transcription timed out — try a shorter clip.'
        : error instanceof Error
          ? error.message
          : 'Transcription failed.';
    return NextResponse.json({ code: 'failed', error: message }, { status: 502 });
  }
}
