'use client';

/**
 * HOST PREVIEW STAGE (VIDNOV LIVE).
 *
 * One purpose only: while the seller is live, show THEM their own camera and
 * report the audience size. The chat rail, product shelf and pin controls are
 * composed around this stage by SellerLiveStudio; the public broadcast itself
 * is the viewer's screen (LiveKitViewer).
 *
 * Transport: LiveKit (`livekit-client`). The room name and websocket URL come
 * from POST /api/live-session together with a server-minted publish token;
 * the API key/secret pair never reaches the browser.
 *
 * Lifecycle rules (migration spec §4):
 *  - exactly one Room per mount; rerenders (toggles, timers) never connect
 *    again, and a StrictMode double-mount disconnects the first room in
 *    cleanup before creating the second;
 *  - cleanup detaches the local preview, stops published tracks, disconnects
 *    and drops listeners — navigating away or ending the stream leaves no
 *    camera light on and no socket open;
 *  - `cancelled` marks deliberate teardown so our own disconnect is never
 *    reported to the seller as a network failure.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client';
import type { LocalTrackPublication } from 'livekit-client';
import { Camera, CameraOff, Mic, MicOff, Loader2, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HostPreviewProps {
  /** LiveKit websocket URL (safe to expose — credentials stay server-side). */
  wsUrl: string;
  /** LiveKit room minted with the session. */
  roomName: string;
  /** Short-lived publish+subscribe token for the seller identity. */
  token: string;
  participantName: string;
  onEnd: () => void;
  /**
   * Live remote-participant (viewer) count, reported on every join/leave so
   * the seller can see an audience is present — the studio shows it on the
   * stage. Excluded from the effect deps on purpose: a parent that re-creates
   * this callback each render must not trigger a room reconnect.
   */
  onViewerCount?: (count: number) => void;
  className?: string;
}

type StageState = 'connecting' | 'live' | 'error';

function HostStage({
  wsUrl,
  roomName,
  token,
  participantName,
  onEnd,
  onViewerCount,
}: {
  wsUrl: string;
  roomName: string;
  token: string;
  participantName: string;
  onEnd: () => void;
  onViewerCount?: (count: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  /** Latest viewer-count callback, kept in a ref so it never re-connects the room. */
  const onViewerCountRef = useRef(onViewerCount);
  onViewerCountRef.current = onViewerCount;
  /** The camera track currently wired into the <video>, so re-attach events never double-attach. */
  const attachedTrackRef = useRef<{ detach: (el: HTMLMediaElement) => void } | null>(null);

  const [state, setState] = useState<StageState>('connecting');
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState('Camera unavailable');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraTimedOut, setCameraTimedOut] = useState(false);
  const [micDenied, setMicDenied] = useState(false);

  const attachLocal = useCallback((publication: LocalTrackPublication) => {
    if (publication.source !== Track.Source.Camera) return;
    const track = publication.videoTrack;
    const el = videoRef.current;
    if (!track || !el) return;
    if (attachedTrackRef.current === track) {
      setCameraReady(true);
      return;
    }
    if (attachedTrackRef.current) {
      try {
        attachedTrackRef.current.detach(el);
      } catch {
        // already gone
      }
    }
    track.attach(el);
    attachedTrackRef.current = track;
    setCameraReady(true);
    setCameraTimedOut(false);
  }, []);

  const detachLocal = useCallback(() => {
    const track = attachedTrackRef.current;
    const el = videoRef.current;
    if (track && el) {
      try {
        track.detach(el);
      } catch {
        // element already unmounted
      }
    }
    attachedTrackRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const room = new Room();
    roomRef.current = room;

    const onPublished = (publication: LocalTrackPublication) => {
      if (cancelled) return;
      attachLocal(publication);
    };
    const onUnpublished = (publication: LocalTrackPublication) => {
      if (cancelled) return;
      if (publication.source === Track.Source.Camera) detachLocal();
    };
    const onConnectionState = (s: ConnectionState) => {
      if (cancelled) return;
      if (s === ConnectionState.Reconnecting) setState('connecting');
    };
    const onDisconnected = () => {
      if (cancelled) return;
      setErrorTitle('Broadcast connection lost');
      setError('The connection to the live room dropped. Go live again to resume broadcasting.');
      setState('error');
    };

    const reportViewers = () => {
      if (cancelled) return;
      // remoteParticipants excludes the seller's own (local) participant.
      onViewerCountRef.current?.(room.remoteParticipants.size);
    };

    room.on(RoomEvent.LocalTrackPublished, onPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onUnpublished);
    room.on(RoomEvent.ConnectionStateChanged, onConnectionState);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.ParticipantConnected, reportViewers);
    room.on(RoomEvent.ParticipantDisconnected, reportViewers);

    (async () => {
      try {
        await room.connect(wsUrl, token);
      } catch (e) {
        if (cancelled) return;
        setErrorTitle('Could not connect');
        const raw = e instanceof Error ? e.message : '';
        // The LiveKit client reports an unreachable/mixed-content server as
        // "could not establish signal connection: Failed to fetch" — say what
        // to DO instead of handing the seller a transport-level string.
        const isSignalFailure = /signal connection|failed to fetch/i.test(raw);
        setError(
          isSignalFailure
            ? 'The broadcast server could not be reached from this device. This is a server setting: LIVEKIT_URL must be a wss:// address served over https (not http://localhost). Fix LIVEKIT_URL on the server, restart it, and press Go live again.'
            : raw || 'The live server could not be reached. Check your connection and try again.',
        );
        setState('error');
        return;
      }
      if (cancelled) return;
      setState('live');
      // Anyone who joined while we were connecting is already in the room.
      reportViewers();

      // Publish the seller's camera and microphone. A denial is surfaced,
      // not fatal — the seller can fix permissions and retry from the stage.
      try {
        const pub = await room.localParticipant.setCameraEnabled(true);
        if (!cancelled && pub) attachLocal(pub);
      } catch {
        if (!cancelled) {
          setCameraOn(true);
          setCameraTimedOut(true);
        }
      }
      if (cancelled) return;
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        if (!cancelled) setMicDenied(false);
      } catch {
        if (!cancelled) {
          setMicOn(false);
          setMicDenied(true);
        }
      }
    })();

    return () => {
      // Deliberate teardown FIRST, so the Disconnected handler stays silent.
      cancelled = true;
      // Stop requesting camera/mic BEFORE dropping the connection, so a publish
      // that was mid-flight cannot leave the camera light on after unmount;
      // disconnect(true) then stops + unpublishes whatever did publish and
      // detaches our local preview.
      void room.localParticipant.setCameraEnabled(false).catch(() => undefined);
      void room.localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
      detachLocal();
      void room.disconnect(true).catch(() => undefined);
      const emitter = room as unknown as {
        removeAllListeners?: () => void;
      };
      try {
        emitter.removeAllListeners?.();
      } catch {
        // listener cleanup is best-effort; every handler guards on `cancelled`
      }
      roomRef.current = null;
    };
  }, [wsUrl, roomName, token, attachLocal, detachLocal]);

  /*
   * Camera watchdog: connect + publish are awaited, but if no picture has
   * attached within 10s of going live (hung device, locked camera), tell the
   * seller instead of leaving a black stage with working controls on top.
   */
  useEffect(() => {
    if (state !== 'live' || cameraOn || cameraReady) return;
    const timeout = window.setTimeout(() => setCameraTimedOut(true), 10_000);
    return () => window.clearTimeout(timeout);
  }, [state, cameraOn, cameraReady]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !cameraOn;
    try {
      const pub = await room.localParticipant.setCameraEnabled(next);
      setCameraOn(next);
      if (next && pub && !attachedTrackRef.current) attachLocal(pub);
      if (!next) setCameraTimedOut(false);
    } catch {
      // Permission refused: keep the "on" intent visible and show the hint.
      setCameraOn(true);
      setCameraTimedOut(true);
    }
  }, [cameraOn, attachLocal]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
      if (next) setMicDenied(false);
    } catch {
      setMicOn(false);
      setMicDenied(true);
    }
  }, [micOn]);

  if (state === 'error') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-red-400">{errorTitle}</p>
        <p className="max-w-xs text-xs text-white/50">
          {error ?? 'Allow camera and microphone access, then go live again.'}
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />

      {(!cameraOn || state === 'connecting' || !cameraReady) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center text-white">
          {!cameraOn ? (
            <>
              <CameraOff className="h-8 w-8 text-white/40" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Camera off</p>
            </>
          ) : cameraTimedOut ? (
            <>
              <CameraOff className="h-8 w-8 text-white/40" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">No camera picture yet</p>
              <p className="max-w-xs text-[11px] leading-relaxed text-white/50">
                Allow camera access for this site in your browser settings, then tap the camera button to try again.
              </p>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">
                {state === 'connecting' ? 'Reconnecting to the room…' : 'Connecting your camera…'}
              </p>
            </>
          )}
        </div>
      )}

      {/* Top bar: live state + who is streaming */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
        </span>
        <span className="truncate rounded-full bg-black/50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70 backdrop-blur">
          {participantName} · only you can see this preview
        </span>
      </div>

      {/* Bottom controls: mic warning, camera, mic, end */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/85 to-transparent p-5">
        {micDenied && state === 'live' && (
          <p className="rounded-full bg-amber-500/15 px-3 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-amber-300">
            Microphone blocked — allow mic access in your browser to talk to viewers
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={toggleCamera}
            aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border transition',
              cameraOn && cameraReady ? 'border-white/15 bg-white/10 text-white' : 'border-red-500/40 bg-red-600 text-white',
            )}
          >
            {cameraOn && cameraReady ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={toggleMic}
            aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border transition',
              micOn ? 'border-white/15 bg-white/10 text-white' : 'border-red-500/40 bg-red-600 text-white',
            )}
          >
            {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="flex h-12 items-center gap-2 rounded-full bg-red-600 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-700"
          >
            <Square className="h-4 w-4 fill-current" /> End
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HostPreview({ wsUrl, roomName, token, participantName, onEnd, onViewerCount, className }: HostPreviewProps) {
  return (
    <div className={cn('h-full w-full', className)}>
      <HostStage
        wsUrl={wsUrl}
        roomName={roomName}
        token={token}
        participantName={participantName}
        onEnd={onEnd}
        onViewerCount={onViewerCount}
      />
    </div>
  );
}