'use client';

/**
 * useLiveRoom — thin LiveKit client wrapper for Vidnov LIVE.
 *
 * The hook never touches LIVEKIT_* configuration: the browser only ever
 * receives { wsUrl, token } from the Vidnov backend (spec §46).
 * LiveKit handles transport, reconnection and track events; Vidnov owns UX.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  type RemoteTrack,
  type LocalVideoTrack,
  VideoPresets,
  Track,
} from 'livekit-client';

export type LiveRole = 'seller' | 'viewer';

export interface LiveRoomState {
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'error';
  error: string | null;
  isCameraOn: boolean;
  isMicOn: boolean;
  /** Signal quality 0–5 (LiveKit strength), undefined when unknown. */
  signal: number | undefined;
}

export function useLiveRoom(role: LiveRole, videoEl: React.RefObject<HTMLVideoElement | null>) {
  const roomRef = useRef<Room | null>(null);
  const [state, setState] = useState<LiveRoomState>({
    status: 'idle',
    error: null,
    isCameraOn: false,
    isMicOn: false,
    signal: undefined,
  });

  const attachRemoteTrack = useCallback(
    (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video && videoEl.current) {
        track.attach(videoEl.current);
      } else if (track.kind === Track.Kind.Audio) {
        // LiveKit manages its own audio element for remote audio.
        track.attach();
      }
    },
    [videoEl],
  );

  /** Connect using credentials handed over by the Vidnov backend. */
  const connect = useCallback(
    async (wsUrl: string, token: string) => {
      if (roomRef.current) return;
      setState((s) => ({ ...s, status: 'connecting', error: null }));

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: role === 'seller' ? { resolution: VideoPresets.h720 } : undefined,
      });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, attachRemoteTrack);
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => track.detach());
      room.on(RoomEvent.Reconnecting, () => setState((s) => ({ ...s, status: 'reconnecting' })));
      room.on(RoomEvent.Reconnected, () => setState((s) => ({ ...s, status: 'connected' })));
      room.on(RoomEvent.Disconnected, () => {
        setState((s) => (s.status === 'error' ? s : { ...s, status: 'ended' }));
      });
      room.on(RoomEvent.ParticipantConnected, () => {
        // Presence-based signal hint: any participant event marks the link alive.
        setState((s) => ({ ...s, signal: 4 }));
      });

      try {
        await room.connect(wsUrl, token);
        if (role === 'seller') {
          await room.localParticipant.setCameraEnabled(true);
          await room.localParticipant.setMicrophoneEnabled(true);
          const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
          const camTrack = camPub?.track as LocalVideoTrack | undefined;
          if (camTrack && videoEl.current) camTrack.attach(videoEl.current);
        }
        setState((s) => ({ ...s, status: 'connected', isCameraOn: role === 'seller', isMicOn: role === 'seller' }));
      } catch (err) {
        setState((s) => ({
          ...s,
          status: 'error',
          error: err instanceof Error ? err.message : 'Could not connect to the live room.',
        }));
      }
    },
    [role, attachRemoteTrack, videoEl],
  );

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room || role !== 'seller') return;
    const next = !state.isCameraOn;
    await room.localParticipant.setCameraEnabled(next);
    const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const camTrack = camPub?.track as LocalVideoTrack | undefined;
    if (camTrack && videoEl.current && next) camTrack.attach(videoEl.current);
    setState((s) => ({ ...s, isCameraOn: next }));
  }, [role, state.isCameraOn, videoEl]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || role !== 'seller') return;
    const next = !state.isMicOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setState((s) => ({ ...s, isMicOn: next }));
  }, [role, state.isMicOn]);

  /** Cycle front/back camera on mobile. */
  const switchCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room || role !== 'seller') return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === 'videoinput');
      if (cams.length < 2) return;
      const current = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const facing = (current?.track?.mediaStreamTrack as MediaStreamTrack | undefined)?.getSettings().facingMode;
      const next = cams.find((d) => !d.label.toLowerCase().includes(facing === 'user' ? 'front' : 'back'));
      if (next) await room.switchActiveDevice('videoinput', next.deviceId);
    } catch {
      // best-effort
    }
  }, [role]);

  const leave = useCallback(async () => {
    const room = roomRef.current;
    if (room) {
      await room.disconnect();
      roomRef.current = null;
    }
    setState({ status: 'idle', error: null, isCameraOn: false, isMicOn: false, signal: undefined });
  }, []);

  useEffect(() => {
    return () => {
      void roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  return { ...state, connect, toggleCamera, toggleMic, switchCamera, leave, room: roomRef };
}
