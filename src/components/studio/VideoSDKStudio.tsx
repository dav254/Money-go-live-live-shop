
'use client';

import React, { useRef, useEffect } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting } from '@videosdk.live/react-sdk';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StopCircle, Loader2, Video, VideoOff, Mic, MicOff } from 'lucide-react';

const ParticipantView = ({ participantId }: { participantId: string }) => {
  const { webcamStream, webcamOn, isLocal } = useMeeting();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && webcamStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(webcamStream.track);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch((err) => console.error("video play failed", err));
    }
  }, [webcamStream, webcamOn]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black border-2 border-primary/20">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="h-full w-full object-cover"
      />
      {!webcamOn && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
          <VideoOff className="h-12 w-12 text-muted-foreground" />
        </div>
      )}
      <div className="absolute bottom-4 left-4 bg-black/50 px-2 py-1 rounded text-xs">
        {isLocal ? "You (Host)" : "Participant"}
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
        className="rounded-full"
      >
        {micOn ? <Mic /> : <MicOff />}
      </Button>
      <Button
        size="icon"
        variant={webcamOn ? "secondary" : "destructive"}
        onClick={() => toggleWebcam()}
        className="rounded-full"
      >
        {webcamOn ? <Video /> : <VideoOff />}
      </Button>
      <Button
        variant="destructive"
        onClick={handleEnd}
        className="rounded-full font-bold px-6"
      >
        <StopCircle className="mr-2 h-4 w-4" /> End Live
      </Button>
    </div>
  );
};

const MeetingView = ({ onEnd }: { onEnd: () => void }) => {
  const { join, localParticipant, isMeetingJoined } = useMeeting();

  // CRITICAL: Join the meeting when the component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      join();
    }, 500);
    return () => clearTimeout(timer);
  }, [join]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {isMeetingJoined && localParticipant ? (
          <ParticipantView participantId={localParticipant.id} />
        ) : (
          <Card className="aspect-video flex flex-col items-center justify-center bg-muted">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="font-bold">Joining Stream...</p>
            <p className="text-xs text-muted-foreground">Please allow camera/mic access if prompted</p>
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
      }}
      token={token}
    >
      <MeetingConsumer>
        {() => <MeetingView onEnd={onEnd} />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}
