'use client';

/**
 * LIVEKIT VIEWER — buyer side of a LiveKit live session.
 *
 * Obtains a subscribe-only token for ONE session from the server
 * (`GET /api/live-session/token?sessionId=…`): the room name is chosen by the
 * server from the session record, never by the client, and the token carries
 * `canPublish: false` — a buyer cannot publish audio or video from this
 * screen, and cannot tokenize an arbitrary room.
 *
 * Responsibilities (migration spec §5):
 *  - connect to the seller's room and render their published video + audio;
 *  - handle tracks that arrive (or leave) after the viewer connects;
 *  - surface loading / waiting-for-host / connection-error states;
 *  - disconnect and detach everything when the buyer navigates away.
 *
 * Lifecycle: the `flags.cancelled` marker is installed BEFORE the first
 * `await`, so cleanup during an in-flight token fetch or connect still stops
 * every state write and disconnects the room the moment it exists — rerenders
 * and StrictMode double-mounts can never leave a duplicate connection behind.
 * Transient network drops are handled by LiveKit's built-in reconnect; only a
 * final Disconnected surfaces as an error, with a Retry that re-runs the whole
 * token + connect flow.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import type { RemoteVideoTrack, RemoteAudioTrack } from 'livekit-client';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useUser } from '@/firebase';

type Phase = 'loading' | 'watching' | 'error';

export default function LiveKitViewer({ sessionId }: { sessionId: string }) {
  const { user } = useUser();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const roomRef = useRef<Room | null>(null);
  /** Cancels the in-flight connect flow; installed before any await. */
  const cancelRef = useRef<(() => void) | null>(null);

  const [phase, setPhase] = useState<Phase>('loading');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [videoTrack, setVideoTrack] = useState<RemoteVideoTrack | null>(null);
  const [audioTrack, setAudioTrack] = useState<RemoteAudioTrack | null>(null);

  // Re-attach whenever the host's track object changes (arrives, swaps after
  // a restart, or leaves — leaving drops back to the waiting state).
  useEffect(() => {
    const el = videoRef.current;
    if (!videoTrack || !el) return;
    videoTrack.attach(el);
    el.play().catch(() => undefined);
    return () => {
      try {
        videoTrack.detach(el);
      } catch {
        // element already gone
      }
    };
  }, [videoTrack]);

  useEffect(() => {
    const el = audioRef.current;
    if (!audioTrack || !el) return;
    audioTrack.attach(el);
    el.play().catch(() => undefined);
    return () => {
      try {
        audioTrack.detach(el);
      } catch {
        // element already gone
      }
    };
  }, [audioTrack]);

  const connect = useCallback(async () => {
    const flags = { cancelled: false };
    cancelRef.current = () => {
      flags.cancelled = true;
    };
    setPhase('loading');
    setConnected(false);
    setError(null);

    try {
      const headers: Record<string, string> = {};
      if (user) {
        try {
          headers.Authorization = `Bearer ${await user.getIdToken()}`;
        } catch {
          // anonymous viewing is allowed for public sessions
        }
      }

      const res = await fetch(`/api/live-session/token?sessionId=${encodeURIComponent(sessionId)}`, {
        cache: 'no-store',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (flags.cancelled) return;
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Could not join the live session.');
      }
      if (data.provider !== 'livekit' || !data.wsUrl || !data.token) {
        throw new Error('The server did not return LiveKit connection details.');
      }
      if (flags.cancelled) return;

      const room = new Room();
      roomRef.current = room;

      /**
       * The host is whichever remote participant currently has a camera
       * published (only the seller can publish). Recomputed from scratch on
       * every membership/track event so late joins, track restarts and
       * departures all resolve to the right track.
       */
      const refreshHostTracks = () => {
        if (flags.cancelled) return;
        let video: RemoteVideoTrack | null = null;
        let audio: RemoteAudioTrack | null = null;
        for (const participant of room.remoteParticipants.values()) {
          const cam = participant.getTrackPublication(Track.Source.Camera);
          if (cam?.videoTrack) {
            video = cam.videoTrack as RemoteVideoTrack;
            const mic = participant.getTrackPublication(Track.Source.Microphone);
            if (mic?.audioTrack) audio = mic.audioTrack as RemoteAudioTrack;
            break;
          }
        }
        setVideoTrack(video);
        setAudioTrack(audio);
        setPhase(video ? 'watching' : 'loading');
      };

      const onDisconnected = () => {
        if (flags.cancelled) return;
        setConnected(false);
        setVideoTrack(null);
        setAudioTrack(null);
        setError('The stream ended or the connection was lost.');
        setPhase('error');
      };

      room.on(RoomEvent.TrackSubscribed, refreshHostTracks);
      room.on(RoomEvent.TrackUnsubscribed, refreshHostTracks);
      room.on(RoomEvent.ParticipantConnected, refreshHostTracks);
      room.on(RoomEvent.ParticipantDisconnected, refreshHostTracks);
      room.on(RoomEvent.Disconnected, onDisconnected);

      await room.connect(data.wsUrl, data.token);
      if (flags.cancelled) return;
      setConnected(true);
      refreshHostTracks();
    } catch (e) {
      if (flags.cancelled) return;
      setError(e instanceof Error ? e.message : 'Could not join the live session.');
      setPhase('error');
    }
  }, [sessionId, user, attempt]);

  useEffect(() => {
    void connect();
    return () => {
      cancelRef.current?.();
      cancelRef.current = null;
      const room = roomRef.current;
      roomRef.current = null;
      if (room) {
        try {
          (room as unknown as { removeAllListeners?: () => void }).removeAllListeners?.();
        } catch {
          // listener teardown is best-effort; every handler guards on flags
        }
        void room.disconnect().catch(() => undefined);
      }
    };
  }, [connect]);

  /* ------------------------------ states ------------------------------ */

  if (phase === 'error') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-black text-center p-12">
        <AlertCircle className="h-8 w-8 text-red-500/50" />
        <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest">
          {connected ? 'Connection Lost' : 'Signal Handshake Failed'}
        </p>
        {error && <p className="max-w-xs text-[11px] leading-relaxed text-neutral-600">{error}</p>}
        <button
          type="button"
          onClick={() => setAttempt((a) => a + 1)}
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-white/70 hover:bg-white/10 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    );
  }

  if (phase === 'watching' && videoTrack) {
    return (
      <div className="relative h-full w-full bg-black overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className="h-full w-full object-cover"
        />
        <audio ref={audioRef} autoPlay playsInline />
        {!connected && (
          <div className="absolute inset-x-0 top-0 flex justify-center">
            <span className="mt-4 rounded-full bg-amber-500/20 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-amber-300 backdrop-blur">
              Reconnecting…
            </span>
          </div>
        )}
      </div>
    );
  }

  // Loading, connected-but-hostless, or mid-reconnect without a track.
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-black">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
        <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
      </div>
      <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.3em] text-center px-8">
        {connected ? 'Waiting for the host to appear…' : 'Establishing Real-Time Signal...'}
      </p>
    </div>
  );
}