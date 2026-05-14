'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { VideoOff, Loader2, SignalHigh, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * Renders the seller's video stream for the buyer.
 * Optimized for instant track attachment.
 */
const ParticipantView = ({ participantId }: { participantId: string }) => {
  const { webcamStream, webcamOn, isLocal } = useParticipant(participantId);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && webcamStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(webcamStream.track);
      videoRef.current.srcObject = mediaStream;
      
      // Force play and catch any autoplay blockages
      videoRef.current.play().catch(err => {
          if (err.name !== 'AbortError') {
              console.warn("[VideoSDK] Autoplay prevented, waiting for user interaction or sync:", err);
          }
      });
    }
  }, [webcamStream]);

  return (
    <div className="relative h-full w-full bg-black overflow-hidden rounded-xl border border-white/10 shadow-2xl">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="h-full w-full object-contain md:object-cover"
        style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }}
      />
      {!webcamOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/90 backdrop-blur-sm">
          <VideoOff className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="font-headline text-xl font-bold text-white uppercase tracking-tighter text-center px-8">Signal Paused</p>
          <p className="text-neutral-400 mt-2 text-xs uppercase tracking-widest">Seller is adjusting camera...</p>
        </div>
      )}
    </div>
  );
};

/**
 * Internal meeting logic for the buyer.
 * Prioritizes identifying the speaker (seller) instantly.
 */
const ViewerMeetingView = () => {
  const { join, participants, isMeetingJoined } = useMeeting({
    onStreamEnabled: (stream) => {
        if (stream.kind === 'video') console.log("[VideoSDK] Seller stream detected, attaching...");
    },
    onParticipantJoined: (participant) => {
        console.log("[VideoSDK] New participant:", participant.displayName);
    }
  });

  const hasAttemptedJoin = useRef(false);
  
  const handleJoin = useCallback(() => {
    if (hasAttemptedJoin.current) return;
    hasAttemptedJoin.current = true;
    join();
  }, [join]);

  useEffect(() => {
    if (!isMeetingJoined && !hasAttemptedJoin.current) {
      handleJoin();
    }
  }, [handleJoin, isMeetingJoined]);

  // Find the seller: The non-local participant who has a webcam enabled.
  // This is much faster than just looking for any participant.
  const host = useMemo(() => {
    const participantsArray = Array.from(participants.values());
    // The seller is the one with the webcam on. 
    // Fallback to the first non-local participant if necessary.
    return participantsArray.find(p => !p.local && p.webcamOn) || 
           participantsArray.find(p => !p.local) || 
           null;
  }, [participants]);

  return (
    <div className="h-full w-full flex flex-col">
      {isMeetingJoined && host ? (
        <ParticipantView participantId={host.id} />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center bg-black rounded-xl border border-white/5 text-center p-8">
          <div className="relative mb-8">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
          </div>
          <p className="text-white font-black text-xl tracking-tight uppercase">Synchronizing Live Feed</p>
          <div className="flex items-center gap-2 mt-6 text-[10px] text-neutral-500 uppercase font-black tracking-widest bg-neutral-900 px-4 py-2 rounded-full border border-white/5">
              <SignalHigh className="h-3 w-3 text-green-500" />
              <span>Searching for Host Signature...</span>
          </div>
          <Button 
            variant="ghost" 
            className="mt-8 text-neutral-500 hover:text-white text-[10px] font-black uppercase tracking-widest"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-3 w-3" /> Force Re-Sync
          </Button>
        </div>
      )}
    </div>
  );
};

export default function VideoSDKViewer({ meetingId }: { meetingId: string }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/videosdk/token');
        if (!res.ok) throw new Error("Token failure");
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
      <div className="h-full w-full flex flex-col items-center justify-center bg-black rounded-xl border border-white/5">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-white font-black uppercase tracking-widest text-[10px]">Connecting to Signal Network...</p>
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
      }}
      token={token}
    >
      <MeetingConsumer>
        {() => <ViewerMeetingView />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}
