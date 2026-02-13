'use client';

import React, { useRef, useEffect, useState } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StopCircle, Loader2, Video, VideoOff, Mic, MicOff, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const ParticipantView = ({ participantId }: { participantId: string }) => {
  const { webcamStream, webcamOn, local } = useParticipant(participantId);
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
        muted={local}
        className="h-full w-full object-cover"
      />
      {!webcamOn && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
          <VideoOff className="h-12 w-12 text-muted-foreground" />
        </div>
      )}
      <div className="absolute bottom-4 left-4 bg-black/50 px-2 py-1 rounded text-xs text-white">
        {local ? "You (Host)" : "Participant"}
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
  const [error, setError] = useState<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!isMeetingJoined && !joinedRef.current) {
      console.log("Attempting to join meeting...");
      join();
      joinedRef.current = true;
    }
  }, [join, isMeetingJoined]);

  // Timeout for joining
  useEffect(() => {
    const timer = setTimeout(() => {
        if (!isMeetingJoined) {
            setError("Connection timed out. Please check your internet and refresh.");
        }
    }, 15000); // 15 seconds timeout
    return () => clearTimeout(timer);
  }, [isMeetingJoined]);

  if (error) {
      return (
          <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
          </Alert>
      )
  }

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
        mode: "CONFERENCE",
      }}
      token={token}
    >
      <MeetingConsumer>
        {() => <MeetingView onEnd={onEnd} />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}
