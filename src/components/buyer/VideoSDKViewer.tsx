'use client';

import React, { useRef, useEffect, useState } from 'react';
import { MeetingProvider, MeetingConsumer, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { VideoOff, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
          <p>The seller has paused their video</p>
        </div>
      )}
    </div>
  );
};

const ViewerMeetingView = () => {
  const { join, participants, isMeetingJoined } = useMeeting();
  const [error, setError] = useState<string | null>(null);
  const joinedRef = useRef(false);
  
  useEffect(() => {
    if (!isMeetingJoined && !joinedRef.current) {
      console.log("Viewer attempting to join meeting...");
      join();
      joinedRef.current = true;
    }
  }, [join, isMeetingJoined]);

  // Timeout for joining
  useEffect(() => {
    const timer = setTimeout(() => {
        if (!isMeetingJoined) {
            setError("Could not connect to the stream. The seller might be offline.");
        }
    }, 20000); // 20 seconds timeout for viewers
    return () => clearTimeout(timer);
  }, [isMeetingJoined]);

  // Find the host (the seller)
  const participantsArray = Array.from(participants.values());
  const host = participantsArray.find(p => !p.local); 

  if (error) {
      return (
          <div className="h-full w-full flex items-center justify-center p-6">
            <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Stream Offline</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
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
          <p className="text-white font-bold">Connecting to Stream...</p>
          <p className="text-xs text-neutral-500 mt-2">Waiting for host to broadcast</p>
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
        <p className="text-white font-bold">Fetching Access Token...</p>
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
      }}
      token={token}
    >
      <MeetingConsumer>
        {() => <ViewerMeetingView />}
      </MeetingConsumer>
    </MeetingProvider>
  );
}
