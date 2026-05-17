'use client';

import React, { useRef, useEffect } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { VideoOff, Loader2, AlertCircle } from 'lucide-react';
import { useUser, useUserProfile } from '@/firebase';

/**
 * Optimized Viewer for Buyers.
 */
const ParticipantView = ({ participantId }: { participantId: string }) => {
  const { webcamStream, micStream, webcamOn } = useParticipant(participantId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current && webcamStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(webcamStream.track);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(err => {
          if (err.name !== 'AbortError') console.warn("[Live Sync] Video boost failed:", err);
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
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted={true} 
        className="h-full w-full object-contain md:object-cover"
      />
      <audio ref={audioRef} autoPlay playsInline />
      
      {!webcamOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 backdrop-blur-sm z-50">
          <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <VideoOff className="h-16 w-16 text-primary relative z-10" />
          </div>
          <p className="font-headline text-2xl font-black text-white uppercase tracking-tighter">Signal Paused</p>
          <p className="text-neutral-500 mt-2 text-[10px] font-black uppercase tracking-widest">Awaiting Host Data...</p>
        </div>
      )}
    </div>
  );
};

const ViewerMeetingView = () => {
  const { join, participants, isMeetingJoined } = useMeeting();
  const hasAttemptedJoin = useRef(false);
  
  useEffect(() => {
    if (!isMeetingJoined && !hasAttemptedJoin.current) {
      hasAttemptedJoin.current = true;
      join();
    }
  }, [join, isMeetingJoined]);

  const host = React.useMemo(() => {
    const participantsArray = Array.from(participants.values());
    return participantsArray.find(p => !p.local && p.webcamOn) || 
           participantsArray.find(p => !p.local) || 
           null;
  }, [participants]);

  return (
    <div className="h-full w-full flex flex-col">
      {isMeetingJoined && host ? (
        <ParticipantView participantId={host.id} />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center bg-black text-center p-8">
          <div className="relative mb-8">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
          </div>
          <p className="text-white font-black text-xl tracking-tight uppercase">Locking Live Signal</p>
          <div className="flex items-center gap-2 mt-6 text-[9px] text-neutral-500 uppercase font-black tracking-[0.2em] bg-neutral-900 px-6 py-2.5 rounded-full border border-white/5 shadow-2xl">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>Verifying Stream Quality...</span>
          </div>
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
  
  const displayName = userProfile?.fullName || userProfile?.username || user?.displayName || "Guest Buyer";

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/videosdk/token');
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Signal error');
        if (data.token) setToken(data.token);
      } catch (err: any) {
        console.error("[Performance Check] Signal token failed:", err);
        setError(err.message);
      }
    };
    fetchToken();
  }, []);

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black text-center p-12">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-white font-black uppercase tracking-widest text-xs">Signal Failed</p>
        <p className="text-neutral-500 text-[10px] mt-2 max-w-[200px]">{error}</p>
      </div>
    );
  }

  if (!token || !meetingId) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <MeetingProvider
      config={{
        meetingId,
        micEnabled: false,
        webcamEnabled: false,
        name: displayName,
        mode: "CONFERENCE",
        multiStream: false,
        subscribeFullStream: true,
        adaptiveStream: true,
      }}
      token={token}
    >
      <MeetingConsumer>
        {() => <ViewerMeetingView />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}
