/**
 * Captions — cue helpers plus an honest capability probe.
 *
 * Speech-to-text exists in three genuinely different forms, and the panel
 * must never claim one is available when it is not:
 *
 *   1. Server transcription (POST /api/video-studio/transcribe) — only works
 *      when an STT provider is connected server-side; the route returns
 *      `no-provider` otherwise and the UI says so plainly.
 *   2. Browser dictation (Web Speech API) — real, on-device, but it listens
 *      to the MICROPHONE: useful for narrating a caption by talking, not for
 *      transcribing the clip's own audio. Offered only where supported.
 *   3. Manual cues — always available, always real.
 */

import { clamp } from './timeline';
import { uid, type CaptionCue } from './types';

/** A caption cue the user creates at the playhead. */
export function makeCue(text: string, start: number, duration = 2): CaptionCue {
  const cueStart = Math.max(0, start);
  return {
    id: uid('cue'),
    text: text.trim().slice(0, 300),
    start: cueStart,
    end: cueStart + Math.max(0.4, duration),
  };
}

/**
 * Evenly fit a list of lines across a time window — the honest version of
 * "auto-timing" that needs no speech model: each line gets an equal slice,
 * and the user can then drag any cue's timings.
 */
export function distributeCues(
  lines: string[],
  windowStart: number,
  windowEnd: number,
): CaptionCue[] {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  if (clean.length === 0) return [];
  const span = Math.max(1, windowEnd - windowStart);
  const slice = span / clean.length;
  return clean.map((text, i) => ({
    id: uid('cue'),
    text: text.slice(0, 300),
    start: windowStart + i * slice,
    end: windowStart + (i + 1) * slice,
  }));
}

/** Shift a cue by `delta` seconds, keeping it non-negative and ordered. */
export function shiftCue(cue: CaptionCue, delta: number): CaptionCue {
  const start = Math.max(0, cue.start + delta);
  const length = Math.max(0.4, cue.end - cue.start);
  return { ...cue, start, end: start + length };
}

export interface TranscribeResponse {
  ok: boolean;
  cues?: CaptionCue[];
  error?: string;
  code?: 'no-provider' | 'unauthorized' | 'too-large' | 'failed';
  message?: string;
}

/**
 * Ask the server to transcribe. Resolves with a structured result — never
 * throws, never invents cues: a `no-provider` answer is surfaced verbatim.
 */
export async function requestTranscription(
  video: Blob,
  token: string,
  durationSeconds: number,
): Promise<TranscribeResponse> {
  try {
    const base64 = await blobToBase64(video);
    const res = await fetch('/api/video-studio/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        videoBase64: base64,
        durationSeconds: clamp(durationSeconds, 1, 600),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      cues?: Array<{ text: string; start: number; end: number }>;
      error?: string;
      code?: TranscribeResponse['code'];
      message?: string;
    };
    if (!res.ok || !Array.isArray(data.cues)) {
      return {
        ok: false,
        code: data.code ?? 'failed',
        error: data.error ?? data.message ?? 'Transcription failed.',
      };
    }
    return {
      ok: true,
      cues: data.cues.map((c) => ({
        id: uid('cue'),
        text: String(c.text ?? '').slice(0, 300),
        start: Math.max(0, Number(c.start) || 0),
        end: Math.max(0.4, Number(c.end) || 0),
      })),
    };
  } catch (error) {
    return {
      ok: false,
      code: 'failed',
      error: error instanceof Error ? error.message : 'Transcription failed.',
    };
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read the file.'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(blob);
  });
}

/** True when this browser exposes the Web Speech API (dictation mode). */
export function dictationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function parseSrt(text: string): CaptionCue[] {
  const blocks = text.replace(/\r/g, '').split(/\n\n+/);
  const cues: CaptionCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    const timeIndex = lines.findIndex((l) => l.includes('-->'));
    if (timeIndex === -1) continue;
    const [rawStart, rawEnd] = lines[timeIndex].split('-->').map((s) => s.trim());
    const start = srtTime(rawStart);
    const end = srtTime(rawEnd);
    if (start === null || end === null || end <= start) continue;
    const content = lines.slice(timeIndex + 1).join('\n').trim();
    if (!content) continue;
    cues.push({ id: uid('cue'), text: content.slice(0, 300), start, end });
  }
  return cues;
}

function srtTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(value.trim());
  if (!match) return null;
  const [, h, m, s, ms] = match;
  return (
    Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000
  );
}
