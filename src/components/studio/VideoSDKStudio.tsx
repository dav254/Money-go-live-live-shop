'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StopCircle, Loader2, Video, VideoOff, Mic, MicOff, AlertCircle, RefreshCw, SignalHigh, Globe, Radio } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

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
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={local}
        className="h-full w-full object-contain md:object-cover"
      />
      {!webcamOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900">
          <VideoOff className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mb-4" />
          <p className="text-white text-lg md:text-xl font-bold">Camera is Paused</p>
        </div>
      )}
    </div>
  );
};

const LiveStudioControls = ({ onEnd, isMeetingJoined }: { onEnd: () => void, isMeetingJoined: boolean }) => {
  const { leave, toggleWebcam, toggleMic, webcamOn, micOn } = useMeeting();

  const handleEnd = () => {
    leave();
    onEnd();
  };

  return (
    <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-4 p-1.5 md:p-2 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl z-50">
      <Button
        size="icon"
        variant={micOn ? "secondary" : "destructive"}
        onClick={() => toggleMic()}
        className="rounded-xl h-10 w-10 md:h-12 md:w-12"
      >
        {micOn ? <Mic className="h-4 w-4 md:h-5 md:w-5" /> : <MicOff className="h-4 w-4 md:h-5 md:w-5" />}
      </Button>
      <Button
        size="icon"
        variant={webcamOn ? "secondary" : "destructive"}
        onClick={() => toggleWebcam()}
        className="rounded-xl h-10 w-10 md:h-12 md:w-12"
      >
        {webcamOn ? <Video className="h-4 w-4 md:h-5 md:w-5" /> : <VideoOff className="h-4 w-4 md:h-5 md:w-5" />}
      </Button>
      <div className="w-px h-6 md:h-8 bg-white/10 mx-1 md:mx-2" />
      <Button
        variant="destructive"
        onClick={handleEnd}
        className="rounded-xl font-bold px-4 md:px-8 h-10 md:h-12 text-sm md:text-base shadow-lg shadow-red-600/20"
      >
        <StopCircle className="mr-2 h-4 w-4 md:h-5 md:w-5" /> 
        <span className="hidden sm:inline">End Broadcast</span>
        <span className="sm:hidden">End</span>
      </Button>
    </div>
  );
};

const MeetingView = ({ onEnd, onReady }: { onEnd: () => void, onReady: () => void }) => {
  const { join, localParticipant, isMeetingJoined } = useMeeting();
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedJoin = useRef(false);
  const hasTriggeredReady = useRef(false);
  const joinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleJoin = useCallback(() => {
    if (hasAttemptedJoin.current) return;
    setError(null);
    hasAttemptedJoin.current = true;
    // SPEED OPTIMIZATION: Immediate join without artificial delay
    join();

    joinTimeoutRef.current = setTimeout(() => {
        if (!isMeetingJoined) {
            setError("Connection timed out. Please check your signal strength and refresh.");
        }
    }, 45000);
  }, [join, isMeetingJoined]);

  useEffect(() => {
    handleJoin();
    return () => {
        if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
    };
  }, [handleJoin]);

  useEffect(() => {
    if (isMeetingJoined && !hasTriggeredReady.current) {
        hasTriggeredReady.current = true;
        onReady();
        if (joinTimeoutRef.current) {
            clearTimeout(joinTimeoutRef.current);
            joinTimeoutRef.current = null;
        }
    }
  }, [isMeetingJoined, onReady]);

  if (error) {
      return (
          <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-neutral-950">
            <div className="p-4 bg-red-500/10 rounded-full mb-6">
                <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 text-center">Connection Signal Lost</h2>
            <p className="text-neutral-400 text-center max-w-sm mb-8">{error}</p>
            <Button className="h-12 px-10 font-bold" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Hard Reset
            </Button>
          </div>
      )
  }

  return (
    <div className="relative h-full w-full flex flex-col bg-neutral-950 overflow-hidden group">
      {/* Top Status Bar - Compact for Mobile */}
      <div className="absolute top-0 left-0 right-0 z-30 p-2 md:p-4 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 md:gap-2 pointer-events-auto">
              <div className={cn(
                  "px-2 md:px-3 py-1 rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 md:gap-2 backdrop-blur-md border",
                  isMeetingJoined ? "bg-red-600/90 text-white border-red-500 animate-pulse" : "bg-neutral-800/90 text-neutral-400 border-white/5"
              )}>
                  <div className={cn("h-1 md:h-1.5 w-1 md:w-1.5 rounded-full", isMeetingJoined ? "bg-white" : "bg-neutral-600")} />
                  {isMeetingJoined ? "LIVE" : "SIGNAL"}
              </div>
              {isMeetingJoined && (
                  <div className="px-2 md:px-3 py-1 rounded-lg bg-black/40 text-white text-[8px] md:text-[10px] font-bold border border-white/5 backdrop-blur-md flex items-center gap-1.5 md:gap-2">
                      <Globe className="h-2.5 w-2.5 md:h-3 md:w-3 text-blue-400" />
                      <span className="hidden xs:inline">GLOBAL ACCESS</span>
                      <span className="xs:hidden">GLOBAL</span>
                  </div>
              )}
          </div>
          
          <div className="pointer-events-auto">
              {!isMeetingJoined && (
                  <div className="flex items-center gap-1.5 text-[8px] md:text-xs text-white/50 font-medium bg-black/40 px-2 py-1 rounded-lg border border-white/5 backdrop-blur-md">
                      <Loader2 className="h-2.5 w-2.5 md:h-3 md:w-3 animate-spin" />
                      <span className="hidden xs:inline">Connecting viewers...</span>
                      <span className="xs:hidden">Connecting...</span>
                  </div>
              )}
          </div>
      </div>

      <div className="flex-1 relative">
        {localParticipant ? (
          <ParticipantView participantId={localParticipant.id} />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center bg-black">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-white/50 text-sm font-medium">Opening Hardware...</p>
          </div>
        )}
        
        {/* Signal Optimization Overlay */}
        {!isMeetingJoined && localParticipant && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <div className="bg-neutral-900/90 p-6 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center text-center space-y-4 max-w-[200px] md:max-w-xs">
                    <div className="relative">
                        <Radio className="h-8 w-8 md:h-10 md:w-10 text-primary animate-ping absolute" />
                        <Radio className="h-8 w-8 md:h-10 md:w-10 text-primary relative" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-white text-sm md:text-base font-bold">Establishing Link</p>
                        <p className="text-[8px] md:text-[10px] text-neutral-400 uppercase tracking-widest">Optimising Network</p>
                    </div>
                </div>
            </div>
        )}
      </div>

      <LiveStudioControls onEnd={onEnd} isMeetingJoined={isMeetingJoined} />
    </div>
  );
};

export default function VideoSDKStudio({ meetingId, participantName, token, onEnd, onReady }: { meetingId: string, participantName: string, token: string, onEnd: () => void, onReady: () => void }) {
  return (
    <MeetingProvider
      config={{
        meetingId,
        micEnabled: true,
        webcamEnabled: true,
        name: participantName,
        mode: "CONFERENCE",
        multiStream: false, 
        notification: {
            title: "Go Earn Live",
            message: "Broadcasting from Studio",
        }
      }}
      token={token}
    >
      <MeetingConsumer>
        {() => <MeetingView onEnd={onEnd} onReady={onReady} />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}
