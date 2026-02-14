
'use client';

import React, { useRef, useEffect } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { Button } from '@/components/ui/button';
import { StopCircle, Loader2, Video, VideoOff, Mic, MicOff, SignalHigh } from 'lucide-react';
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
          if (err.name !== 'AbortError') console.error("Studio play failed:", err);
      });
    }
  }, [webcamStream, webcamOn]);

  return (
    <div className="relative h-full w-full bg-black">
      <video ref={videoRef} autoPlay playsInline muted={local} className="h-full w-full object-contain md:object-cover" />
      {!webcamOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/95 backdrop-blur-sm p-6 text-center">
          <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-4 shadow-2xl">
            <VideoOff className="h-12 md:h-16 md:w-16 text-primary animate-pulse" />
          </div>
          <p className="text-white text-lg md:text-xl font-black font-headline uppercase tracking-widest">Camera Preview Offline</p>
          <p className="text-neutral-500 text-xs mt-2 uppercase tracking-widest font-bold">Toggle the camera icon below to start your setup</p>
        </div>
      )}
    </div>
  );
};

const StudioControls = ({ onEnd, onBroadcast, isLive }: { onEnd: () => void, onBroadcast: () => void, isLive: boolean }) => {
  const { leave, enableWebcam, disableWebcam, unmuteMic, muteMic, webcamOn, micOn } = useMeeting();

  const handleEndInternal = () => {
    leave();
    onEnd();
  };

  return (
    <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-4 p-2 bg-black/60 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl z-50">
      <Button
        size="icon"
        variant={micOn ? "secondary" : "destructive"}
        onClick={() => micOn ? muteMic() : unmuteMic()}
        className="rounded-xl h-10 w-10 md:h-12 md:w-12"
      >
        {micOn ? <Mic className="h-4 w-4 md:h-5 md:w-5" /> : <MicOff className="h-4 w-4 md:h-5 md:w-5" />}
      </Button>
      <Button
        size="icon"
        variant={webcamOn ? "secondary" : "destructive"}
        onClick={() => webcamOn ? disableWebcam() : enableWebcam()}
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
          onClick={handleEndInternal}
          className="rounded-xl font-bold px-4 md:px-8 h-10 md:h-12 text-xs md:text-sm"
        >
          <StopCircle className="mr-2 h-4 w-4" /> END SHOW
        </Button>
      )}
    </div>
  );
};

const MeetingView = ({ onEnd, onBroadcast, isLive }: { onEnd: () => void, onBroadcast: () => void, isLive: boolean }) => {
  const { join, participants } = useMeeting();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
        hasInitialized.current = true;
        join();
    }
  }, [join]);

  return (
    <div className="relative h-full w-full flex flex-col bg-neutral-950 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-30 p-4 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
              <div className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest flex items-center gap-2 backdrop-blur-md border",
                  isLive ? "bg-red-600 text-white border-red-500 animate-pulse" : "bg-neutral-800 text-neutral-400 border-white/5"
              )}>
                  <div className={cn("h-1.5 w-1.5 rounded-full", isLive ? "bg-white" : "bg-neutral-600")} />
                  {isLive ? "LIVE BROADCAST" : "PREVIEW MODE"}
              </div>
          </div>
      </div>

      <div className="flex-1 relative">
        <MeetingConsumer>
          {({ participants }) => {
            const localParticipant = Array.from(participants.values()).find(p => p.local);
            return localParticipant ? (
              <ParticipantView participantId={localParticipant.id} />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center bg-black">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-white/50 text-sm font-medium uppercase tracking-widest font-headline">Studio Signal Sync...</p>
              </div>
            );
          }}
        </MeetingConsumer>
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
