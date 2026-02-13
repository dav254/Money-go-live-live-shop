'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StopCircle, Loader2, Video, VideoOff, Mic, MicOff, AlertCircle, RefreshCw, SignalHigh } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const ParticipantView = ({ participantId }: { participantId: string }) => {
  const { webcamStream, webcamOn, local } = useParticipant(participantId);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && webcamStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(webcamStream.track);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch((err) => {
          if (err.name !== 'AbortError') {
              console.error("Video playback failed:", err);
          }
      });
    }
  }, [webcamStream, webcamOn]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black border-2 border-primary/20 shadow-2xl">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={local}
        className="h-full w-full object-cover"
      />
      {!webcamOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900">
          <VideoOff className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-white font-semibold">Camera is Paused</p>
        </div>
      )}
      <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-full text-xs font-bold text-white backdrop-blur-md border border-white/10 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        {local ? "Live Feed (You)" : "Participant"}
      </div>
    </div>
  );
};

const LiveStudioControls = ({ onEnd }: { onEnd: () => void }) => {
  const { leave, toggleWebcam, toggleMic, webcamOn, micOn } = useMeeting();

  const handleEnd = () => {
    leave();
    onEnd();
  };

  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-background/80 backdrop-blur-md rounded-full border shadow-lg max-w-fit mx-auto mt-6">
      <Button
        size="icon"
        variant={micOn ? "secondary" : "destructive"}
        onClick={() => toggleMic()}
        className="rounded-full h-12 w-12"
      >
        {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </Button>
      <Button
        size="icon"
        variant={webcamOn ? "secondary" : "destructive"}
        onClick={() => toggleWebcam()}
        className="rounded-full h-12 w-12"
      >
        {webcamOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
      </Button>
      <Button
        variant="destructive"
        onClick={handleEnd}
        className="rounded-full font-bold px-8 h-12 text-base"
      >
        <StopCircle className="mr-2 h-5 w-5" /> End Stream
      </Button>
    </div>
  );
};

const MeetingView = ({ onEnd }: { onEnd: () => void }) => {
  const { join, localParticipant, isMeetingJoined } = useMeeting();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Initializing Hardware...");
  const hasAttemptedJoin = useRef(false);
  const joinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleJoin = useCallback(() => {
    if (hasAttemptedJoin.current) return;
    setError(null);
    setStatusMessage("Negotiating Network Bridge...");
    hasAttemptedJoin.current = true;
    
    // Immediate join call
    join();

    // Set a robust timeout for mobile networks (60s)
    joinTimeoutRef.current = setTimeout(() => {
        if (!isMeetingJoined) {
            setError("The network connection is taking longer than expected. On mobile, this usually means the signal is too weak or restricted. Please try a different network or move to a better spot.");
        }
    }, 60000);
  }, [join, isMeetingJoined]);

  useEffect(() => {
    if (!isMeetingJoined && !hasAttemptedJoin.current) {
      handleJoin();
    }
  }, [handleJoin, isMeetingJoined]);

  useEffect(() => {
    if (isMeetingJoined) {
        setStatusMessage("Broadcast Ready");
        if (joinTimeoutRef.current) {
            clearTimeout(joinTimeoutRef.current);
            joinTimeoutRef.current = null;
        }
    }
  }, [isMeetingJoined]);

  useEffect(() => {
      return () => {
          if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      };
  }, []);

  const handleManualRetry = () => {
      window.location.reload();
  };

  if (error) {
      return (
          <div className="space-y-4 max-w-md mx-auto">
            <Alert variant="destructive" className="border-red-900/50 bg-red-950/20">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-bold">Connection Refused</AlertTitle>
                <AlertDescription className="text-sm mt-1">{error}</AlertDescription>
            </Alert>
            <Button className="w-full h-14 text-lg font-bold shadow-lg" onClick={handleManualRetry}>
                <RefreshCw className="mr-2 h-5 w-5" />
                Hard Refresh & Reconnect
            </Button>
          </div>
      )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {isMeetingJoined && localParticipant ? (
          <ParticipantView participantId={localParticipant.id} />
        ) : (
          <Card className="aspect-video flex flex-col items-center justify-center bg-neutral-950 border-2 border-primary/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent animate-pulse" />
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-6 relative z-10" />
            <p className="font-bold text-2xl text-white relative z-10">{statusMessage}</p>
            <div className="flex items-center gap-2 mt-6 text-sm text-neutral-400 bg-white/5 px-5 py-2.5 rounded-full border border-white/5 relative z-10 backdrop-blur-sm">
                <SignalHigh className="h-4 w-4 text-green-500" />
                <span>Optimizing media for mobile network...</span>
            </div>
          </Card>
        )}
      </div>
      {isMeetingJoined && <LiveStudioControls onEnd={onEnd} />}
    </div>
  );
};

export default function VideoSDKStudio({ meetingId, participantName, token, onEnd }: { meetingId: string, participantName: string, token: string, onEnd: () => void }) {
  return (
    <MeetingProvider
      config={{
        meetingId,
        micEnabled: true,
        webcamEnabled: true,
        name: participantName,
        mode: "CONFERENCE",
        multiStream: false, // CRITICAL: Reduces initial handshake overhead on mobile
        notification: {
            title: "Go Earn Live",
            message: "Your store is broadcasting...",
        }
      }}
      token={token}
    >
      <MeetingConsumer>
        {() => <MeetingView onEnd={onEnd} />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}