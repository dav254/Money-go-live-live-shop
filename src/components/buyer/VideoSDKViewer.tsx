'use client';

import React, { useRef, useEffect } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { VideoOff, Loader2, AlertCircle } from 'lucide-react';
import { useUser, useUserProfile } from '@/firebase';

/**
 * Optimized Viewer for Buyers with instant attachment logic.
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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/80 backdrop-blur-sm z-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
          <p className="text-neutral-500 mt-4 text-[10px] font-black uppercase tracking-widest">Host adjusting signal...</p>
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

  // Find host or any active participant immediately
  const host = React.useMemo(() => {
    const participantsArray = Array.from(participants.values());
    return participantsArray.find(p => !p.local) || null;
  }, [participants]);

  return (
    <div className="h-full w-full flex flex-col bg-black">
      {host ? (
        <ParticipantView participantId={host.id} />
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-black">
           <Loader2 className="h-6 w-6 animate-spin text-primary opacity-20" />
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
        console.error("[Signal Token] fetch failed:", err);
        setError(err.message);
      }
    };
    fetchToken();
  }, []);

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black text-center p-12">
        <AlertCircle className="h-8 w-8 text-red-500/50 mb-4" />
        <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest">Signal Unavailable</p>
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