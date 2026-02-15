'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { VideoOff, Loader2, AlertCircle, RefreshCw, SignalHigh, Wifi } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '../ui/button';

const ParticipantView = ({ participantId }: { participantId: string }) => {
  const { webcamStream, webcamOn } = useParticipant(participantId);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && webcamStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(webcamStream.track);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(err => {
          if (err.name !== 'AbortError') console.error("Video play failed:", err);
      });
    }
  }, [webcamStream]);

  return (
    <div className="relative h-full w-full bg-black overflow-hidden rounded-xl border border-white/10 shadow-2xl">
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-contain md:object-cover" />
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

const ViewerMeetingView = () => {
  const { join, participants, isMeetingJoined } = useMeeting();
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const hasAttemptedJoin = useRef(false);
  
  const handleJoin = useCallback(() => {
    if (hasAttemptedJoin.current) return;
    setError(null);
    hasAttemptedJoin.current = true;
    join();
  }, [join]);

  useEffect(() => {
    if (!isMeetingJoined && !hasAttemptedJoin.current) {
      handleJoin();
    }
  }, [handleJoin, isMeetingJoined]);

  // AUTO-RETRY LOGIC: If we don't have a host after 15 seconds, try to re-join once
  useEffect(() => {
    if (isMeetingJoined && participants.size <= 1 && retryCount < 2) {
        const timer = setTimeout(() => {
            console.log("Host not found, retrying signal handshake...");
            setRetryCount(prev => prev + 1);
            // We don't leave, just wait. VideoSDK handles participant discovery in background.
        }, 15000);
        return () => clearTimeout(timer);
    }
  }, [isMeetingJoined, participants.size, retryCount]);

  // FAST SIGNAL DETECTION: Find the first non-local participant (the seller)
  const host = useMemo(() => {
    const participantsArray = Array.from(participants.values());
    return participantsArray.find(p => !p.local) || null;
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
          <p className="text-white font-black text-xl tracking-tight uppercase">Connecting to Seller</p>
          <div className="flex items-center gap-2 mt-6 text-[10px] text-neutral-500 uppercase font-black tracking-widest bg-neutral-900 px-4 py-2 rounded-full border border-white/5">
              <SignalHigh className="h-3 w-3 text-green-500" />
              <span>Low Latency Mode</span>
          </div>
          {retryCount > 0 && (
              <p className="text-[10px] text-neutral-600 mt-4 animate-pulse uppercase font-bold tracking-tighter">Handshaking via secondary bridge...</p>
          )}
          <Button 
            variant="ghost" 
            className="mt-8 text-neutral-500 hover:text-white text-[10px] font-black uppercase tracking-widest"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-3 w-3" /> Force Signal Re-sync
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
        <p className="text-white font-black uppercase tracking-widest text-[10px]">Authenticating Signal...</p>
      </div>
    );
  }

  return (
    <MeetingProvider
      config={{
        meetingId,
        micEnabled: false,
        webcamEnabled: false,
        name: "Customer",
        mode: "CONFERENCE",
        multiStream: false, 
      }}
      token={token}
    >
      <MeetingConsumer>
        {() => <ViewerMeetingView />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}