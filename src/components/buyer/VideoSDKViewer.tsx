'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { VideoOff, Loader2, AlertCircle, RefreshCw, SignalHigh } from 'lucide-react';
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
          <p className="font-headline text-xl font-bold text-white uppercase tracking-tighter text-center px-8">Direct Stream Paused</p>
          <p className="text-neutral-400 mt-2">The seller is adjusting their setup...</p>
        </div>
      )}
    </div>
  );
};

const ViewerMeetingView = () => {
  const { join, participants, isMeetingJoined } = useMeeting();
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedJoin = useRef(false);
  const joinTimer = useRef<NodeJS.Timeout | null>(null);
  
  const handleJoin = useCallback(() => {
    if (hasAttemptedJoin.current) return;
    setError(null);
    hasAttemptedJoin.current = true;
    // Zero-latency join
    join();
  }, [join]);

  useEffect(() => {
    if (!isMeetingJoined && !hasAttemptedJoin.current) {
      handleJoin();
    }
  }, [handleJoin, isMeetingJoined]);

  useEffect(() => {
    // Signal timeout for direct stream feel
    joinTimer.current = setTimeout(() => {
        if (!isMeetingJoined && hasAttemptedJoin.current) {
            setError("The direct stream connection timed out. Please refresh the signal.");
        }
    }, 25000); 
    
    return () => {
        if (joinTimer.current) clearTimeout(joinTimer.current);
    }
  }, [isMeetingJoined]);

  const participantsArray = Array.from(participants.values());
  const host = participantsArray.find(p => !p.local); 

  if (error) {
      return (
          <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-neutral-950 rounded-xl">
            <Alert variant="destructive" className="max-w-md border-red-900/50 bg-red-950/20">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Bridge Latency</AlertTitle>
                <AlertDescription className="text-xs mt-1">{error}</AlertDescription>
            </Alert>
            <Button variant="outline" className="mt-6 border-white/10 text-white font-black" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" /> REFRESH SIGNAL
            </Button>
          </div>
      )
  }

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
          <p className="text-white font-black text-xl tracking-tight uppercase">Opening Direct Stream</p>
          <div className="flex items-center gap-2 mt-6 text-[10px] text-neutral-500 uppercase font-black tracking-widest bg-neutral-900 px-4 py-2 rounded-full">
              <SignalHigh className="h-3 w-3 text-green-500" />
              <span>Optimizing Latency</span>
          </div>
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
        <p className="text-white font-black uppercase tracking-widest text-xs">Authenticating Signal...</p>
      </div>
    );
  }

  return (
    <MeetingProvider
      config={{
        meetingId,
        micEnabled: false,
        webcamEnabled: false,
        name: "Identified Viewer",
        mode: "VIEWER",
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
