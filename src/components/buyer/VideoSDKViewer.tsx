'use client';

import React, { useRef, useEffect } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { VideoOff, Loader2, SignalHigh } from 'lucide-react';

/**
 * Renders the seller's video stream for the buyer.
 * Focused purely on the media feed without manual mute controls.
 */
const ParticipantView = ({ participantId }: { participantId: string }) => {
  const { webcamStream, micStream, webcamOn, isLocal } = useParticipant(participantId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Handle Video Track
  useEffect(() => {
    if (videoRef.current && webcamStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(webcamStream.track);
      videoRef.current.srcObject = mediaStream;
      
      videoRef.current.play().catch(err => {
          if (err.name !== 'AbortError') console.warn("[VideoSDK] Video play prevented:", err);
      });
    }
  }, [webcamStream]);

  // Handle Audio Track
  useEffect(() => {
    if (audioRef.current && micStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(micStream.track);
      audioRef.current.srcObject = mediaStream;
      
      audioRef.current.play().catch(err => {
         console.warn("[VideoSDK] Audio play failed:", err);
      });
    }
  }, [micStream]);

  return (
    <div className="relative h-full w-full bg-black overflow-hidden rounded-xl border border-white/5 shadow-2xl">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted={true} 
        className="h-full w-full object-contain md:object-cover"
        style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }}
      />
      <audio ref={audioRef} autoPlay playsInline />
      
      {!webcamOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/90 backdrop-blur-sm">
          <VideoOff className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="font-headline text-xl font-bold text-white uppercase tracking-tighter text-center px-8">Signal Paused</p>
          <p className="text-neutral-400 mt-2 text-xs uppercase tracking-widest">Awaiting Signal...</p>
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

  // Priority Participant Selector: Always pick the host (seller)
  const host = React.useMemo(() => {
    const participantsArray = Array.from(participants.values());
    // In a live show, the one with webcamOn is the host
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
          <p className="text-white font-black text-xl tracking-tight uppercase">Synchronizing Live Feed</p>
          <div className="flex items-center gap-2 mt-6 text-[10px] text-neutral-500 uppercase font-black tracking-widest bg-neutral-900 px-4 py-2 rounded-full border border-white/5">
              <SignalHigh className="h-3 w-3 text-green-500" />
              <span>Scanning for Host...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default function VideoSDKViewer({ meetingId }: { meetingId: string }) {
  const [token, setToken] = React.useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/videosdk/token');
        const data = await res.json();
        if (data.token) setToken(data.token);
      } catch (err) {
        console.error("Signal token failed:", err);
      }
    };
    fetchToken();
  }, []);

  if (!token || !meetingId) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-white font-black uppercase tracking-widest text-[10px]">Initializing Sync...</p>
      </div>
    );
  }

  return (
    <MeetingProvider
      config={{
        meetingId,
        micEnabled: false,
        webcamEnabled: false,
        name: "Buyer",
        mode: "CONFERENCE",
        // FASTEST POSSIBLE LATENCY
        multiStream: false,
        subscribeFullStream: true, // Do not downscale quality
      }}
      token={token}
    >
      <MeetingConsumer>
        {() => <ViewerMeetingView />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}
