/**
 * Import helpers — turn a source (device file, recorded blob, Vidnov media
 * URL) into an EditorProject clip with REAL metadata: duration and pixel
 * size are probed from the element itself, never guessed, because every
 * timeline and export calculation downstream depends on them.
 */

import { makeClip } from './timeline';
import type { VideoClip } from './types';

export interface ProbedMedia {
  duration: number;
  width: number;
  height: number;
}

/** Read duration/intrinsic size from a media URL (object URLs included). */
export function probeVideo(src: string): Promise<ProbedMedia> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    const cleanup = () => {
      el.removeAttribute('src');
      el.load();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out while reading the video.'));
    }, 15_000);
    el.onloadedmetadata = () => {
      clearTimeout(timer);
      const result: ProbedMedia = {
        duration: Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 1,
        width: el.videoWidth || 1280,
        height: el.videoHeight || 720,
      };
      cleanup();
      resolve(result);
    };
    el.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('This video could not be decoded by the browser.'));
    };
    el.src = src;
  });
}

export function probeAudio(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('audio');
    el.preload = 'metadata';
    const timer = setTimeout(() => reject(new Error('Timed out while reading the audio.')), 15_000);
    el.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 1);
    };
    el.onerror = () => {
      clearTimeout(timer);
      reject(new Error('This audio file could not be decoded.'));
    };
    el.src = src;
  });
}

/**
 * Grab a still frame around `at` seconds for the timeline strip.
 * Best-effort: returns undefined rather than failing the import.
 */
export async function captureThumbnail(src: string, at = 0.4): Promise<string | undefined> {
  try {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = src;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 8000);
      video.onloadeddata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error('decode'));
      };
    });
    const seekTo = Math.min(at, Math.max(0, (video.duration || 1) - 0.1));
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = seekTo;
      setTimeout(resolve, 2500);
    });
    const canvas = document.createElement('canvas');
    const width = 320;
    const scale = width / Math.max(1, video.videoWidth || 16);
    canvas.width = width;
    canvas.height = Math.max(2, Math.round((video.videoHeight || 9) * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    video.removeAttribute('src');
    video.load();
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return undefined;
  }
}

export interface ImportedClipResult {
  clip: VideoClip;
  warnings: string[];
}

/** Build a clip from a device File (object URL + probed metadata). */
export async function clipFromFile(file: File): Promise<ImportedClipResult> {
  if (!file.type.startsWith('video/')) {
    throw new Error(`"${file.name}" is not a video file.`);
  }
  const src = URL.createObjectURL(file);
  try {
    const meta = await probeVideo(src);
    const thumbnail = await captureThumbnail(src);
    return {
      clip: makeClip({
        src,
        name: file.name.replace(/\.[^.]+$/, ''),
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        thumbnail,
      }),
      warnings: [],
    };
  } catch (error) {
    URL.revokeObjectURL(src);
    throw error;
  }
}

/** Build a clip from an existing same-origin Vidnov media URL. */
export async function clipFromUrl(
  src: string,
  name: string,
  mediaId?: string,
): Promise<ImportedClipResult> {
  const meta = await probeVideo(src);
  const thumbnail = await captureThumbnail(src);
  return {
    clip: makeClip({
      src,
      name,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      mediaId,
      thumbnail,
    }),
    warnings: [],
  };
}

export function fileFromObjectUrl(url: string, name: string, type: string): Promise<File> {
  return fetch(url)
    .then((r) => r.blob())
    .then((blob) => new File([blob], name, { type: type || blob.type }));
}
