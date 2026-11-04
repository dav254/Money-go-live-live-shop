/**
 * Export engine — renders the project to a real video file.
 *
 * Architecture (mobile-first, no server round-trip, no fake progress):
 *
 *   1. Detect what THIS browser can genuinely do (codecs, canvas size,
 *      ctx.filter) — the UI shows exactly that, nothing is invented.
 *   2. Play the timeline headless: one <video>/<audio> element per source,
 *      drawn frame by frame into a canvas through the SAME drawFrame() the
 *      preview mirrors.
 *   3. Record canvas.captureStream() + a Web Audio mix with MediaRecorder.
 *      Progress = real elapsed/total; cancel stops immediately.
 *
 * MP4 vs WebM is a browser capability: Safari/iOS and recent Chrome record
 * MP4 directly; older browsers record WebM, and the Vidnov media pipeline
 * transcodes any uploaded clip to H.264 MP4 server-side — the export studio
 * states which path a given device will take instead of pretending.
 */

import { drawFrame } from './render';
import { audioGainAt, layoutTimeline, locate, totalDuration } from './timeline';
import type { EditorProject, VideoClip } from './types';

export interface CapabilityReport {
  mediaRecorder: boolean;
  mp4: boolean;
  webm: boolean;
  /** ctx.filter — without it, colour adjustments cannot be baked on export. */
  canvasFilter: boolean;
  /** 3840×2160 canvas allocatable (4K export possible on this device). */
  largeCanvas: boolean;
  captureStream: boolean;
}

export function detectCapabilities(): CapabilityReport {
  const hasRecorder = typeof MediaRecorder !== 'undefined';
  const supports = (type: string): boolean => {
    if (!hasRecorder || typeof MediaRecorder.isTypeSupported !== 'function') return false;
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  };
  let canvasFilter = false;
  try {
    canvasFilter =
      typeof CanvasRenderingContext2D !== 'undefined' &&
      'filter' in CanvasRenderingContext2D.prototype;
  } catch {
    canvasFilter = false;
  }
  let largeCanvas = false;
  try {
    if (typeof document !== 'undefined') {
      const probe = document.createElement('canvas');
      probe.width = 3840;
      probe.height = 2160;
      const ctx = probe.getContext('2d');
      if (ctx) {
        ctx.fillRect(0, 0, 4, 4);
        largeCanvas = true;
      }
    }
  } catch {
    largeCanvas = false;
  }
  return {
    mediaRecorder: hasRecorder,
    mp4: supports('video/mp4;codecs=avc1.42E01E,mp4a.40.2') || supports('video/mp4'),
    webm: supports('video/webm;codecs=vp9,opus') || supports('video/webm'),
    canvasFilter,
    largeCanvas,
    captureStream: typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype,
  };
}

export interface ResolutionOption {
  id: '720p' | '1080p' | '4k';
  label: string;
  /** Height; width derives from the project aspect. */
  height: number;
  /** False when Vidnov's ingest pipeline would downscale it (1080p cap). */
  publishable: boolean;
}

/**
 * Resolutions offered = resolutions actually supported by this device.
 * 4K needs an allocatable 4K canvas, and Vidnov's media pipeline tops out at
 * 1080p, so 4K is flagged "save to device only" rather than silently shrunk.
 */
export function resolutionOptions(report: CapabilityReport): ResolutionOption[] {
  const options: ResolutionOption[] = [
    { id: '720p', label: '720p HD', height: 720, publishable: true },
    { id: '1080p', label: '1080p Full HD', height: 1080, publishable: true },
  ];
  if (report.largeCanvas) {
    options.push({ id: '4k', label: '4K UHD', height: 2160, publishable: false });
  }
  return options;
}

export function frameRateOptions(): number[] {
  return [24, 30, 60];
}

export interface ChosenContainer {
  mime: string;
  extension: 'mp4' | 'webm';
}

/** First container this browser can record, preferring MP4. */
export function pickContainer(report: CapabilityReport): ChosenContainer | null {
  if (report.mp4) {
    return {
      mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      extension: 'mp4',
    };
  }
  if (report.webm) {
    return {
      mime: 'video/webm;codecs=vp9,opus',
      extension: 'webm',
    };
  }
  if (report.mediaRecorder) {
    return { mime: 'video/mp4', extension: 'mp4' };
  }
  return null;
}

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  /** Bits per second for the video encode (quality slider). */
  bitrate: number;
  withAudio: boolean;
}

export type ExportPhase =
  | { phase: 'preparing'; percent: 0 }
  | { phase: 'rendering'; percent: number; elapsed: number }
  | { phase: 'finalizing'; percent: number }
  | { phase: 'done'; percent: 100 }
  | { phase: 'error'; percent: number; error: string }
  | { phase: 'cancelled'; percent: number };

export interface ExportResult {
  ok: boolean;
  blob: Blob | null;
  mimeType: string;
  extension: 'mp4' | 'webm';
  error?: string;
  cancelled?: boolean;
}

export interface ExportJob {
  promise: Promise<ExportResult>;
  cancel: () => void;
}

const waitReady = (el: HTMLMediaElement, label: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (el.readyState >= 2) {
      resolve();
      return;
    }
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Could not load "${label}".`));
    };
    const cleanup = () => {
      el.removeEventListener('loadeddata', onReady);
      el.removeEventListener('error', onError);
    };
    el.addEventListener('loadeddata', onReady);
    el.addEventListener('error', onError);
    el.load();
  });

function makeElement(tag: 'video' | 'audio'): HTMLMediaElement {
  const el =
    tag === 'video'
      ? document.createElement('video')
      : document.createElement('audio');
  el.preload = 'auto';
  (el as HTMLVideoElement).playsInline = true;
  return el;
}

export function exportProject(
  project: EditorProject,
  options: ExportOptions,
  onStatus: (status: ExportPhase) => void,
): ExportJob {
  const report = detectCapabilities();
  const container = pickContainer(report);
  let cancelled = false;
  let raf = 0;
  let resolveJob!: (result: ExportResult) => void;
  const promise = new Promise<ExportResult>((resolve) => {
    resolveJob = resolve;
  });

  const cleanupFns: Array<() => void> = [];
  const finish = (result: ExportResult) => {
    cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch {
        /* teardown is best-effort */
      }
    });
    resolveJob(result);
  };

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
    finish({ ok: false, blob: null, mimeType: container?.mime ?? '', extension: container?.extension ?? 'webm', cancelled: true });
  };

  const fail = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error);
    finish({
      ok: false,
      blob: null,
      mimeType: container?.mime ?? '',
      extension: container?.extension ?? 'webm',
      error: message,
    });
  };

  const run = async (): Promise<void> => {
    onStatus({ phase: 'preparing', percent: 0 });

    if (!container || !report.captureStream) {
      fail(
        new Error(
          'This browser cannot record video (MediaRecorder/captureStream unavailable). Try Chrome or Safari on the device.',
        ),
      );
      return;
    }
    if (project.clips.length === 0) {
      fail(new Error('Add at least one video clip before exporting.'));
      return;
    }

    const layout = layoutTimeline(project.clips);
    const total = totalDuration(project);
    if (total <= 0) {
      fail(new Error('The timeline is empty.'));
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.round(options.width));
    canvas.height = Math.max(2, Math.round(options.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      fail(new Error('Canvas 2D is unavailable on this device.'));
      return;
    }

    // ---- media elements (one per source; loaded before recording starts)
    const videoEls = new Map<string, HTMLVideoElement>();
    const audioEls = new Map<string, HTMLAudioElement>();
    const images = new Map<string, HTMLImageElement>();

    let audioCtx: AudioContext | null = null;
    let audioDest: MediaStreamAudioDestinationNode | null = null;
    const gains = new Map<Element, GainNode>();

    const route = (el: HTMLMediaElement): void => {
      if (!audioCtx || !options.withAudio) return;
      try {
        const source = audioCtx.createMediaElementSource(el);
        const gain = audioCtx.createGain();
        source.connect(gain);
        gain.connect(audioDest!);
        gains.set(el, gain);
      } catch {
        // Already routed or unsupported — element audio then stays silent,
        // but the video render continues.
      }
    };

    try {
      for (const clip of project.clips) {
        if (videoEls.has(clip.id)) continue;
        const el = document.createElement('video');
        el.preload = 'auto';
        el.playsInline = true;
        el.src = clip.src;
        videoEls.set(clip.id, el);
      }
      if (options.withAudio && typeof AudioContext !== 'undefined') {
        audioCtx = new AudioContext();
        audioDest = audioCtx.createMediaStreamDestination();
        for (const el of videoEls.values()) route(el);
      }
      for (const clip of project.audio) {
        if (audioEls.has(clip.id)) continue;
        const el = document.createElement('audio');
        el.preload = 'auto';
        el.src = clip.src;
        audioEls.set(clip.id, el);
        route(el);
      }
      if (audioCtx && (await audioCtx.state) === 'suspended') {
        await audioCtx.resume().catch(() => undefined);
      }

      await Promise.all(
        [...videoEls.entries()].map(([id, el]) => {
          const clip = project.clips.find((c) => c.id === id);
          return waitReady(el, clip?.name ?? 'clip');
        }),
      );
      await Promise.all(
        [...audioEls.values()].map((el) => waitReady(el, 'audio').catch(() => undefined)),
      );
    } catch (error) {
      fail(error);
      return;
    }

    cleanupFns.push(() => {
      videoEls.forEach((el) => {
        el.pause();
        el.removeAttribute('src');
      });
      audioEls.forEach((el) => {
        el.pause();
        el.removeAttribute('src');
      });
      audioCtx?.close().catch(() => undefined);
    });

    // ---- stream + recorder
    let stream: MediaStream;
    try {
      stream = canvas.captureStream(options.fps);
      if (audioCtx && audioDest && options.withAudio) {
        for (const track of audioDest.stream.getAudioTracks()) stream.addTrack(track);
      }
    } catch (error) {
      fail(error);
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: container.mime,
        videoBitsPerSecond: options.bitrate,
        audioBitsPerSecond: 128_000,
      });
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch (error) {
        fail(error);
        return;
      }
    }

    const chunks: BlobPart[] = [];
    let stopReason: 'complete' | 'cancelled' | 'error' = 'complete';
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      stopReason = 'error';
    };
    recorder.onstop = () => {
      if (stopReason === 'cancelled' || cancelled) {
        finish({
          ok: false,
          blob: null,
          mimeType: container.mime,
          extension: container.extension,
          cancelled: true,
        });
        return;
      }
      if (stopReason === 'error' || chunks.length === 0) {
        finish({
          ok: false,
          blob: null,
          mimeType: container.mime,
          extension: container.extension,
          error: 'The recorder stopped unexpectedly. Try a lower resolution or frame rate.',
        });
        return;
      }
      onStatus({ phase: 'done', percent: 100 });
      finish({
        ok: true,
        blob: new Blob(chunks, { type: container.mime.split(';')[0] }),
        mimeType: container.mime,
        extension: container.extension,
      });
    };

    const failRecording = (error: unknown): void => {
      stopReason = 'error';
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        fail(error);
      }
      if (recorder.state === 'inactive') fail(error);
    };

    // ---- first frame, then record in real time
    const videoFor = (clip: VideoClip): HTMLVideoElement | null =>
      videoEls.get(clip.id) ?? null;
    const imageFor = (src: string): CanvasImageSource | null => {
      const existing = images.get(src);
      if (existing) return existing.complete && existing.naturalWidth > 0 ? existing : null;
      const img = new Image();
      img.onload = () => undefined;
      img.src = src;
      images.set(src, img);
      return null;
    };

    const drawAt = (t: number): void => {
      drawFrame({
        ctx,
        width: canvas.width,
        height: canvas.height,
        project,
        layout,
        t,
        videoFor,
        imageFor,
        supportFilter: report.canvasFilter,
      });
    };

    const initial = locate(layout, 0);
    if (initial.primary) {
      const el = videoEls.get(initial.primary.clip.id);
      if (el) el.currentTime = initial.primary.clip.inPoint;
    }
    drawAt(0);

    const startedAt = performance.now();

    const stopAll = (): void => {
      videoEls.forEach((el) => el.pause());
      audioEls.forEach((el) => el.pause());
    };

    const tick = (): void => {
      if (cancelled) return;
      try {
        const t = (performance.now() - startedAt) / 1000;
        if (t >= total) {
          stopAll();
          onStatus({ phase: 'finalizing', percent: 99 });
          try {
            if (recorder.state !== 'inactive') recorder.stop();
          } catch {
            failRecording(new Error('Could not finalize the recording.'));
          }
          return;
        }

        // ---- transport: keep every element locked to the clock
        const location = locate(layout, t);
        const activeIds = new Set<string>();
        if (location.primary) activeIds.add(location.primary.clip.id);
        if (location.outgoing) activeIds.add(location.outgoing.clip.id);

        for (const clip of project.clips) {
          const el = videoEls.get(clip.id);
          if (!el) continue;
          if (activeIds.has(clip.id)) {
            const isActivePrimary = location.primary?.clip.id === clip.id;
            const local = isActivePrimary
              ? location.local
              : location.outgoing
                ? Math.max(0, t - location.outgoing.start)
                : 0;
            const wanted = Math.min(
              clip.outPoint,
              Math.max(clip.inPoint, clip.inPoint + local * clip.speed),
            );
            if (el.paused) {
              el.playbackRate = Math.min(4, Math.max(0.25, clip.speed));
              try {
                el.currentTime = wanted;
              } catch {
                /* seek races are harmless — next frame corrects */
              }
              el.play().catch(() => undefined);
            } else if (Math.abs(el.currentTime - wanted) > 0.35) {
              el.currentTime = wanted;
            }
            el.volume = clip.muted ? 0 : Math.min(1, Math.max(0, clip.volume));
          } else if (!el.paused) {
            el.pause();
          }
        }

        for (const clip of project.audio) {
          const el = audioEls.get(clip.id);
          if (!el) continue;
          const gain = audioGainAt(clip, t);
          const playing = gain > 0;
          if (playing) {
            const wanted = clip.offset + Math.max(0, t - clip.start);
            if (el.paused) {
              try {
                el.currentTime = wanted;
              } catch {
                /* ignore */
              }
              el.play().catch(() => undefined);
            } else if (Math.abs(el.currentTime - wanted) > 0.35) {
              el.currentTime = wanted;
            }
            el.volume = gain;
            const gainNode = gains.get(el);
            if (gainNode) gainNode.gain.value = gain;
          } else if (!el.paused) {
            el.pause();
          }
        }

        drawAt(t);
        onStatus({
          phase: 'rendering',
          percent: Math.min(99, (t / total) * 100),
          elapsed: t,
        });
        raf = requestAnimationFrame(tick);
      } catch (error) {
        failRecording(error);
      }
    };

    try {
      recorder.start(500);
    } catch (error) {
      fail(error);
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  // cancel() called before run() starts is honoured by `cancelled` flag.
  void run().catch((error) => {
    if (!cancelled) fail(error);
  });
  if (cancelled) {
    // run() may have already bailed; make sure the job still resolves.
    cancel();
  }

  return { promise, cancel };
}

/** Bytes-per-second preset for the quality slider (bitrate = mbps × 1e6). */
export function qualityPresets(height: number): Array<{ id: string; label: string; mbps: number }> {
  const base = height >= 2160 ? 16 : height >= 1080 ? 8 : 4;
  return [
    { id: 'low', label: 'Smaller file', mbps: Math.max(1, Math.round(base / 2)) },
    { id: 'recommended', label: 'Recommended', mbps: base },
    { id: 'high', label: 'Higher quality', mbps: base * 2 },
  ];
}
