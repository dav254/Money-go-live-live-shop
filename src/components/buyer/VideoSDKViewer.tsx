'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { VideoOff, Loader2, AlertCircle, RefreshCw, Signal } from 'lucide-react';
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
      videoRef.current.play().catch((err) => console.error("video play failed", err));
    }
  }, [webcamStream, webcamOn]);

  return (
    <div className="relative h-full w-full bg-black overflow-hidden rounded-xl border border-white/10">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="h-full w-full object-contain"
      />
      {!webcamOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 text-white">
          <VideoOff className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="font-semibold text-lg text-center px-4">Seller is pausing the feed...</p>
          <p className="text-sm text-neutral-400 mt-1">Video will resume shortly</p>
        </div>
      )}
    </div>
  );
};

const ViewerMeetingView = () => {
  const { join, participants, isMeetingJoined } = useMeeting();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Connecting to Stream...");
  const hasAttemptedJoin = useRef(false);
  
  const handleJoin = useCallback(() => {
    if (hasAttemptedJoin.current) return;
    setError(null);
    setStatusMessage("Searching for media bridge...");
    hasAttemptedJoin.current = true;
    join();
  }, [join]);

  useEffect(() => {
    if (!isMeetingJoined && !hasAttemptedJoin.current) {
      handleJoin();
    }
  }, [handleJoin, isMeetingJoined]);

  useEffect(() => {
    if (isMeetingJoined) {
        setStatusMessage("Joining live session...");
    }
  }, [isMeetingJoined]);

  useEffect(() => {
    const timer = setTimeout(() => {
        if (!isMeetingJoined && hasAttemptedJoin.current) {
            setError("We're having trouble connecting to the stream. This often happens on unstable mobile networks. Please ensure your connection is strong.");
        }
    }, 60000); // 60 seconds timeout
    return () => clearTimeout(timer);
  }, [isMeetingJoined]);

  const participantsArray = Array.from(participants.values());
  const host = participantsArray.find(p => !p.local); 

  if (error) {
      return (
          <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-neutral-950 rounded-xl">
            <Alert variant="destructive" className="max-w-md border-red-900/50 bg-red-950/20">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Network Problem</AlertTitle>
                <AlertDescription className="text-xs mt-1">{error}</AlertDescription>
            </Alert>
            <Button variant="outline" className="mt-6 border-white/10 text-white h-12 px-8 font-bold" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Reconnecting
            </Button>
          </div>
      )
  }

  return (
    <div className="h-full w-full flex flex-col">
      {isMeetingJoined && host ? (
        <ParticipantView participantId={host.id} />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center bg-black rounded-xl border border-white/5 p-8 text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
          <p className="text-white font-bold text-xl">{statusMessage}</p>
          <div className="flex items-center gap-2 mt-6 text-sm text-neutral-500 bg-neutral-900 px-4 py-2 rounded-full">
              <Signal className="h-4 w-4" />
              <span>Stabilizing connection for mobile...</span>
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
        if (data.token) {
          setToken(data.token);
        }
      } catch (err) {
        console.error("Error fetching VideoSDK token for viewer:", err);
      }
    };
    fetchToken();
  }, []);

  if (!token) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black rounded-xl">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-white font-bold">Connecting Securely...</p>
      </div>
    );
  }

  return (
    <MeetingProvider
      config={{
        meetingId,
        micEnabled: false,
        webcamEnabled: false,
        name: "Buyer Viewer",
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