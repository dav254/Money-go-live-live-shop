'use client';

import React, { useRef, useEffect, useState } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { Button } from '@/components/ui/button';
import { StopCircle, Loader2, Video, VideoOff, Mic, MicOff, SignalHigh, Globe } from 'lucide-react';
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
          if (err.name !== 'AbortError') console.error("Playback failed:", err);
      });
    }
  }, [webcamStream, webcamOn]);

  return (
    <div className="relative h-full w-full bg-black">
      <video ref={videoRef} autoPlay playsInline muted={local} className="h-full w-full object-contain md:object-cover" />
      {!webcamOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900">
          <VideoOff className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mb-4" />
          <p className="text-white text-lg md:text-xl font-bold font-headline uppercase tracking-tight">Camera Off</p>
        </div>
      )}
    </div>
  );
};

const StudioControls = ({ onEnd, onBroadcast, isLive }: { onEnd: () => void, onBroadcast: () => void, isLive: boolean }) => {
  const { leave, toggleWebcam, toggleMic, webcamOn, micOn } = useMeeting();

  const handleEnd = () => {
    // Aggressive track cleanup
    if (typeof navigator !== 'undefined') {
        navigator.mediaDevices.getUserMedia({ audio: true, video: true })
            .then(stream => stream.getTracks().forEach(t => t.stop()))
            .catch(() => {});
    }
    leave();
    onEnd();
  };

  return (
    <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-4 p-2 bg-black/60 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl z-50">
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
      
      <div className="w-px h-8 bg-white/10 mx-1 md:mx-2" />

      {!isLive ? (
        <Button
          onClick={onBroadcast}
          className="rounded-xl font-black px-6 md:px-10 h-10 md:h-12 text-xs md:text-sm bg-red-600 hover:bg-red-700 animate-pulse shadow-lg shadow-red-600/40"
        >
          START BROADCAST
        </Button>
      ) : (
        <Button
          variant="destructive"
          onClick={handleEnd}
          className="rounded-xl font-bold px-4 md:px-8 h-10 md:h-12 text-xs md:text-sm"
        >
          <StopCircle className="mr-2 h-4 w-4" /> END SHOW
        </Button>
      )}
    </div>
  );
};

const MeetingView = ({ onEnd, onBroadcast, isLive }: { onEnd: () => void, onBroadcast: () => void, isLive: boolean }) => {
  const { join, localParticipant, enableWebcam, unmuteMic } = useMeeting();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
        hasInitialized.current = true;
        join();
        // Fast-track hardware activation
        setTimeout(() => {
            enableWebcam();
            unmuteMic();
        }, 100);
    }
  }, [join, enableWebcam, unmuteMic]);

  return (
    <div className="relative h-full w-full flex flex-col bg-neutral-950 overflow-hidden">
      {/* HUD Header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
              <div className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest flex items-center gap-2 backdrop-blur-md border",
                  isLive ? "bg-red-600 text-white border-red-500 animate-pulse" : "bg-neutral-800 text-neutral-400 border-white/5"
              )}>
                  <div className={cn("h-1.5 w-1.5 rounded-full", isLive ? "bg-white" : "bg-neutral-600")} />
                  {isLive ? "LIVE BROADCAST" : "PREVIEW MODE"}
              </div>
              {isLive && (
                  <div className="px-3 py-1.5 rounded-lg bg-black/40 text-white text-[10px] font-bold border border-white/5 backdrop-blur-md flex items-center gap-2">
                      <Globe className="h-3 w-3 text-blue-400" />
                      GLOBAL
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
            <p className="text-white/50 text-sm font-medium">Opening Hardware Bridge...</p>
          </div>
        )}
      </div>

      <StudioControls onEnd={onEnd} onBroadcast={onBroadcast} isLive={isLive} />
    </div>
  );
};

export default function VideoSDKStudio({ meetingId, participantName, token, onEnd, onBroadcast, isLive }: { 
    meetingId: string, 
    participantName: string, 
    token: string, 
    onEnd: () => void,
    onBroadcast: () => void,
    isLive: boolean
}) {
  return (
    <MeetingProvider
      config={{
        meetingId,
        micEnabled: true,
        webcamEnabled: true,
        name: participantName,
        mode: "CONFERENCE",
        multiStream: false,
      }}
      token={token}
    >
      <MeetingConsumer>
        {() => <MeetingView onEnd={onEnd} onBroadcast={onBroadcast} isLive={isLive} />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}
