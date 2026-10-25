'use client';

/**
 * RECORDER — record a clip in the browser and hand back a File.
 *
 * Built for phones first (spec A2): rear camera by default on devices that
 * have one, a front/rear switch where the browser exposes multiple cameras,
 * start/pause/resume/stop/discard, a live timer, and a preview of the clip
 * before the seller commits to it. Every failure path — permission denied,
 * no camera, no MediaRecorder — lands on the same honest fallback: choose an
 * existing video from the device, so a broken camera never dead-ends the
 * flow.
 */

import * as React from 'react';
import {
  Camera,
  Circle,
  FlipHorizontal,
  Pause,
  Play,
  RefreshCcw,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  onComplete: (file: File) => void;
  onCancel: () => void;
}

type Phase = 'requesting' | 'recording' | 'preview' | 'blocked';

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* isTypeSupported can throw on very old browsers */
    }
  }
  return '';
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function Recorder({ onComplete, onCancel }: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const facingRef = React.useRef<'user' | 'environment'>('environment');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [phase, setPhase] = React.useState<Phase>('requesting');
  const [blockedReason, setBlockedReason] = React.useState('');
  const [elapsed, setElapsed] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = React.useState(false);
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [recordedFile, setRecordedFile] = React.useState<File | null>(null);
  const [timerLabel, setTimerLabel] = React.useState('00:00');

  const stopStream = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const startTimer = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        setTimerLabel(formatTimer(next));
        return next;
      });
    }, 1000);
  }, []);

  const openCamera = React.useCallback(
    async (facing: 'user' | 'environment') => {
      setPhase('requesting');
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
          throw new Error('unsupported');
        }
        stopStream();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        streamRef.current = stream;
        facingRef.current = facing;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setHasMultipleCameras(devices.filter((d) => d.kind === 'videoinput').length > 1);
        setPhase('recording');
        setPaused(false);
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        setBlockedReason(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Camera permission was denied. Allow camera access in your browser settings, or choose a video you already have.'
            : 'No camera is available on this device right now. You can choose a video from your device instead.',
        );
        setPhase('blocked');
      }
    },
    [stopStream],
  );

  React.useEffect(() => {
    void openCamera('environment');
    return stopStream;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = React.useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      setBlockedReason('Recording is not supported by this browser. Choose an existing video instead.');
      setPhase('blocked');
      return;
    }
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stopStream();
      const type = recorder.mimeType || mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `vidnov_record_${Date.now()}.${ext}`, { type });
      setRecordedFile(file);
      setBlobUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      setPhase('preview');
    };
    recorderRef.current = recorder;
    recorder.start(250);
    setElapsed(0);
    setTimerLabel('00:00');
    startTimer();
    setPaused(false);
    setPhase('recording');
  }, [startTimer, stopStream]);

  const pauseResume = React.useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording') {
      rec.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setPaused(true);
    } else if (rec.state === 'paused') {
      rec.resume();
      startTimer();
      setPaused(false);
    }
  }, [startTimer]);

  const stopRecording = React.useCallback(() => {
    const rec = recorderRef.current;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  const discard = React.useCallback(() => {
    setRecordedFile(null);
    setBlobUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    void openCamera(facingRef.current);
  }, [openCamera]);

  const switchCamera = React.useCallback(() => {
    void openCamera(facingRef.current === 'environment' ? 'user' : 'environment');
  }, [openCamera]);

  const pickFromDevice = React.useCallback(
    (file: File) => {
      stopStream();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
      setRecordedFile(null);
      onComplete(file);
    },
    [onComplete, stopStream, blobUrl],
  );

  React.useEffect(
    () => () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    },
    [blobUrl],
  );

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) pickFromDevice(f);
        }}
      />

      {/* ── Camera / preview stage ─────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
        <video
          ref={videoRef}
          playsInline
          muted={phase === 'recording'}
          autoPlay
          controls={phase === 'preview'}
          src={phase === 'preview' ? (blobUrl ?? undefined) : undefined}
          className={cn(
            'max-h-[60vh] w-full bg-black',
            phase === 'preview' ? 'object-contain' : 'object-cover',
          )}
        />

        {phase === 'recording' && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <span className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white">
              <Circle className={cn('h-2.5 w-2.5 fill-red-500', !paused && 'animate-pulse text-red-500')} />
              {timerLabel}
            </span>
            {hasMultipleCameras && (
              <button
                type="button"
                onClick={switchCamera}
                aria-label="Switch camera"
                className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition hover:bg-black/90"
              >
                <FlipHorizontal className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {phase === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-center text-sm text-white/80">
            <Camera className="h-6 w-6 animate-pulse" />
            Starting camera…
          </div>
        )}

        {phase === 'blocked' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center">
            <Camera className="h-7 w-7 text-white/60" />
            <p className="max-w-sm text-sm text-white/85">{blockedReason}</p>
            <Button
              type="button"
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" /> Choose a video
            </Button>
          </div>
        )}
      </div>

      {/* ── Controls ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {phase === 'recording' && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={pauseResume}
              className="border-border"
            >
              {paused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={stopRecording}
            >
              <Square className="mr-2 h-4 w-4 fill-current" /> Stop
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const rec = recorderRef.current;
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;
                chunksRef.current = [];
                if (rec && rec.state !== 'inactive') {
                  rec.onstop = null;
                  rec.stop();
                }
                discard();
              }}
              className="text-muted-foreground"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Discard
            </Button>
          </>
        )}

        {phase === 'preview' && (
          <>
            <Button
              type="button"
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                if (recordedFile) onComplete(recordedFile);
              }}
            >
              Use this clip
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={discard} className="border-border">
              <RefreshCcw className="mr-2 h-4 w-4" /> Retake
            </Button>
          </>
        )}

        {phase === 'blocked' && (
          <Button type="button" variant="ghost" size="sm" onClick={() => openCamera('environment')} className="text-muted-foreground">
            <RefreshCcw className="mr-2 h-4 w-4" /> Try camera again
          </Button>
        )}
      </div>

      {/* Fallback offered in every phase: an existing file always works. */}
      {phase !== 'preview' && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-xl border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
        >
          Or choose an existing video from this device
        </button>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
          Cancel
        </Button>
      </div>
    </div>
  );
}