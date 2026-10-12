'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { Loader2, AlertCircle } from 'lucide-react';
import { useUser, useUserProfile } from '@/firebase';

const ParticipantView = ({ participantId }: { participantId: string }) => {
  const { webcamStream, micStream } = useParticipant(participantId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current && webcamStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(webcamStream.track);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch((err) => {
        if (err.name !== 'AbortError') console.warn('[Live Sync] Video attachment delayed:', err);
      });
    }
  }, [webcamStream]);

  useEffect(() => {
    if (audioRef.current && micStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(micStream.track);
      audioRef.current.srcObject = mediaStream;
      audioRef.current.play().catch(console.warn);
    }
  }, [micStream]);

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <video ref={videoRef} autoPlay playsInline muted={false} className="h-full w-full object-cover" />
      <audio ref={audioRef} autoPlay playsInline />

      {!webcamStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/80 backdrop-blur-sm z-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
          <p className="text-neutral-500 mt-4 text-[10px] font-black uppercase tracking-widest">
            Optimizing Data Stream...
          </p>
        </div>
      )}
    </div>
  );
};

const ViewerMeetingView = () => {
  const { join, participants } = useMeeting();
  const hasAttemptedJoin = useRef(false);

  useEffect(() => {
    if (!hasAttemptedJoin.current) {
      hasAttemptedJoin.current = true;
      join();
    }
  }, [join]);

  const host = useMemo(() => {
    const participantsArray = Array.from(participants.values());
    return participantsArray.find((p) => !p.local) || null;
  }, [participants]);

  return (
    <div className="h-full w-full flex flex-col bg-black">
      {host ? (
        <ParticipantView participantId={host.id} />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center bg-black">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
            <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
          </div>
          <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.3em] text-center px-8">
            Establishing Real-Time Signal...
          </p>
        </div>
      )}
    </div>
  );
};

export default function VideoSDKViewer({ meetingId }: { meetingId: string }) {
  const [token, setToken] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);

  const displayName = userProfile?.fullName || userProfile?.username || user?.displayName || 'Global Buyer';

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/videosdk/token');
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Handshake failed');
        if (data.token) setToken(data.token);
      } catch (err: any) {
        console.error('[Signal Token] fetch failed:', err);
        setError(err.message);
      }
    };
    fetchToken();
  }, []);

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black text-center p-12">
        <AlertCircle className="h-8 w-8 text-red-500/50 mb-4" />
        <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest">
          Signal Handshake Failed
        </p>
      </div>
    );
  }

  if (!token || !meetingId) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  const meetingConfig = {
    meetingId,
    micEnabled: false,
    webcamEnabled: false,
    name: displayName,
    mode: 'CONFERENCE' as const,
    multiStream: false,
    debugMode: false,
  };

  return (
    <MeetingProvider token={token} config={meetingConfig}>
      <MeetingConsumer>
        {() => <ViewerMeetingView />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}
