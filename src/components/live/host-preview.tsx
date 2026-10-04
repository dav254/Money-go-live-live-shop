'use client';

/**
 * HOST PREVIEW STAGE (VIDNOV LIVE).
 *
 * One purpose only: while the seller is live, show THEM their own camera and
 * nothing else. No product shelf, no viewer list, no chat — the public
 * broadcast is the viewer's screen (`VideoSDKViewer`).
 *
 * Transport: VideoSDK (the connected account). The token comes from the
 * Vidnov backend; the SDK secret never reaches the browser.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MeetingProvider, useMeeting } from '@videosdk.live/react-sdk';
import { Camera, CameraOff, Mic, MicOff, Loader2, Radio, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HostPreviewProps {
  meetingId: string;
  token: string;
  participantName: string;
  onEnd: () => void;
  className?: string;
}

type StageState = 'connecting' | 'live' | 'error';

function HostStage({ participantName, onEnd }: { participantName: string; onEnd: () => void }) {
  const { join, leave, localParticipant } = useMeeting() as unknown as {
    join: () => void;
    leave: () => void;
    localParticipant: {
      streams: Map<string, { track?: MediaStreamTrack }>;
      enableWebcam: () => void;
      disableWebcam: () => void;
      enableMic: () => void;
      disableMic: () => void;
    };
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioAttached = useRef(false);
  const joined = useRef(false);
  const [state, setState] = useState<StageState>('connecting');
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Join once, then attach the local camera to the preview element.
  useEffect(() => {
    if (joined.current) return;
    joined.current = true;
    try {
      join();
      setState('live');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join the live room.');
      setState('error');
    }
    return () => {
      try {
        leave();
      } catch {
        // already left
      }
    };
  }, [join, leave]);

  // Attach the local video track whenever it changes (enabled/disabled).
  useEffect(() => {
    const track = localParticipant?.streams?.get('video')?.track;
    if (videoRef.current && track) {
      const stream = new MediaStream();
      stream.addTrack(track);
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }
  }, [localParticipant, cameraOn, state]);

  // Local mic must be attached to an element to be audible by viewers.
  useEffect(() => {
    if (audioAttached.current || !localParticipant) return;
    const track = localParticipant.streams?.get('audio')?.track;
    if (!track) return;
    const audio = new Audio();
    audio.srcObject = new MediaStream([track]);
    audio.muted = false;
    audio.play().catch(() => undefined);
    audioAttached.current = true;
  }, [localParticipant, micOn, state]);

  const toggleCamera = useCallback(() => {
    if (!localParticipant) return;
    if (cameraOn) localParticipant.disableWebcam();
    else localParticipant.enableWebcam();
    setCameraOn((v) => !v);
  }, [cameraOn, localParticipant]);

  const toggleMic = useCallback(() => {
    if (!localParticipant) return;
    if (micOn) localParticipant.disableMic();
    else localParticipant.enableMic();
    setMicOn((v) => !v);
  }, [micOn, localParticipant]);

  if (state === 'error') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-red-400">Camera unavailable</p>
        <p className="max-w-xs text-xs text-white/50">{error ?? 'Allow camera and microphone access, then go live again.'}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />

      {(!cameraOn || state === 'connecting') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 text-white">
          {state === 'connecting' ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Connecting your camera…</p>
            </>
          ) : (
            <>
              <CameraOff className="h-8 w-8 text-white/40" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Camera off</p>
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

      {/* Bottom controls: camera, mic, end */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/85 to-transparent p-5">
        <button
          type="button"
          onClick={toggleCamera}
          aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full border transition',
            cameraOn ? 'border-white/15 bg-white/10 text-white' : 'border-red-500/40 bg-red-600 text-white',
          )}
        >
          {cameraOn ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
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
  );
}

export default function HostPreview({ meetingId, token, participantName, onEnd, className }: HostPreviewProps) {
  return (
    <MeetingProvider
      token={token}
      config={{
        meetingId,
        micEnabled: true,
        webcamEnabled: true,
        name: participantName,
        mode: 'CONFERENCE',
        debugMode: false,
      }}
      joinWithoutUserInteraction
    >
      <div className={cn('h-full w-full', className)}>
        <HostStage participantName={participantName} onEnd={onEnd} />
      </div>
    </MeetingProvider>
  );
}