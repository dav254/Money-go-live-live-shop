'use client';

import React, { useRef, useEffect, useState } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { VideoOff, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
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
          <p className="font-semibold">Seller is checking something...</p>
          <p className="text-xs text-muted-foreground">Video will resume shortly</p>
        </div>
      )}
    </div>
  );
};

const ViewerMeetingView = () => {
  const { join, participants, isMeetingJoined } = useMeeting();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Connecting...");
  const joinedRef = useRef(false);
  
  useEffect(() => {
    if (!isMeetingJoined && !joinedRef.current) {
      console.log("Viewer attempting to join meeting...");
      join();
      joinedRef.current = true;
    }
  }, [join, isMeetingJoined]);

  useEffect(() => {
    if (isMeetingJoined) {
        setStatusMessage("Joining stream...");
    }
  }, [isMeetingJoined]);

  // Timeout for joining
  useEffect(() => {
    const timer = setTimeout(() => {
        if (!isMeetingJoined) {
            setError("We're having trouble connecting to the stream. Your internet might be slow or the seller just went offline.");
        }
    }, 25000); // 25 seconds timeout for mobile
    return () => clearTimeout(timer);
  }, [isMeetingJoined]);

  // Find the host (the seller)
  const participantsArray = Array.from(participants.values());
  const host = participantsArray.find(p => !p.local); 

  if (error) {
      return (
          <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-neutral-950 rounded-xl">
            <Alert variant="destructive" className="max-w-md border-red-900/50 bg-red-950/20">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Connection Problem</AlertTitle>
                <AlertDescription className="text-xs mt-1">{error}</AlertDescription>
            </Alert>
            <Button variant="outline" className="mt-6 border-white/10 text-white hover:bg-white/5" onClick={() => window.location.reload()}>
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
        <div className="h-full w-full flex flex-col items-center justify-center bg-black rounded-xl border border-white/5">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-white font-bold text-lg">{statusMessage}</p>
          <p className="text-xs text-neutral-500 mt-2 px-8 text-center">
              Waiting for the seller to start broadcasting.
          </p>
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
        <p className="text-white font-bold">Securely Connecting...</p>
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
        multiStream: false, // Essential for mobile performance
      }}
      token={token}
    >
      <MeetingConsumer>
        {() => <ViewerMeetingView />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}
