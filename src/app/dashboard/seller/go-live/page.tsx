
'use client';

import React, { useState, useEffect } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Radio, StopCircle, Loader2, Video, VideoOff, Mic, MicOff, Settings } from 'lucide-react';
import { MeetingProvider, MeetingConsumer, useMeeting } from '@videosdk.live/react-sdk';

// --- Constants ---
const VIDEOSDK_TOKEN = process.env.NEXT_PUBLIC_VIDEOSDK_TOKEN || "";

// --- Internal Components ---

const ParticipantView = ({ participantId }: { participantId: string }) => {
  const { webcamStream, webcamOn, isLocal } = useMeeting();

  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
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

const LiveStudioControls = ({ sessionId, onEnd }: { sessionId: string, onEnd: () => void }) => {
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

const MeetingView = ({ sessionId, onEnd }: { sessionId: string, onEnd: () => void }) => {
  const { participants, localParticipant, isMeetingJoined } = useMeeting();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {isMeetingJoined && localParticipant ? (
          <ParticipantView participantId={localParticipant.id} />
        ) : (
          <Card className="aspect-video flex flex-col items-center justify-center bg-muted">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p>Initializing Studio...</p>
          </Card>
        )}
      </div>
      {isMeetingJoined && <LiveStudioControls sessionId={sessionId} onEnd={onEnd} />}
    </div>
  );
};

// --- Main Page Component ---

export default function SellerGoLivePage() {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const { toast } = useToast();

  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const createMeeting = async () => {
    if (!VIDEOSDK_TOKEN) {
      toast({
        variant: "destructive",
        title: "Configuration Missing",
        description: "VideoSDK Token is not configured. Please add it to your environment variables."
      });
      return null;
    }

    try {
      const res = await fetch("https://api.videosdk.live/v2/rooms", {
        method: "POST",
        headers: {
          authorization: VIDEOSDK_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const { roomId } = await res.json();
      return roomId;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const handleStartLive = async () => {
    if (!user || !firestore) return;
    setIsStarting(true);

    const id = await createMeeting();
    if (!id) {
      setIsStarting(false);
      return;
    }

    try {
      // Register the session in Firestore
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await setDoc(sessionRef, {
        id: user.uid,
        sellerId: user.uid,
        title: `${userProfile?.shopName || userProfile?.fullName || 'Seller'}'s Live Show`,
        status: 'live',
        videosdkMeetingId: id,
        startTime: serverTimestamp(),
        viewerCount: 0,
      }, { merge: true });

      setMeetingId(id);
      toast({ title: "You are Live!", description: "Buyers can now discover your stream." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Failed to go live", description: "Database error. Please try again." });
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndLive = async () => {
    if (!user || !firestore) return;
    try {
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await updateDoc(sessionRef, {
        status: 'ended',
        endTime: serverTimestamp(),
      });
      setMeetingId(null);
      toast({ title: "Stream Ended", description: "Your live session has been closed." });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <SellerLayout>
      <div className="flex-1 space-y-6 p-8 pt-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight flex items-center gap-3">
              <Radio className="h-8 w-8 text-red-600 animate-pulse" />
              Live Studio
            </h1>
            <p className="text-muted-foreground">Broadcast real-time shopping events to your followers.</p>
          </div>
        </div>

        {!meetingId ? (
          <Card className="border-dashed border-2 bg-muted/30">
            <CardHeader className="text-center">
              <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                <Video className="h-12 w-12 text-primary" />
              </div>
              <CardTitle className="text-2xl">Ready to go live?</CardTitle>
              <CardDescription>
                Make sure your lighting is good and your products are ready.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-8">
              <Button
                size="lg"
                className="font-bold text-lg px-12 bg-red-600 hover:bg-red-700 h-16 rounded-xl shadow-xl hover:shadow-red-600/20 transition-all"
                onClick={handleStartLive}
                disabled={isStarting}
              >
                {isStarting ? (
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                ) : (
                  <Radio className="mr-2 h-6 w-6" />
                )}
                {isStarting ? "Initializing..." : "Start Live Stream"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <MeetingProvider
            config={{
              meetingId: meetingId,
              micEnabled: true,
              webcamEnabled: true,
              name: userProfile?.fullName || "Seller",
            }}
            token={VIDEOSDK_TOKEN}
          >
            <MeetingConsumer>
              {() => <MeetingView sessionId={meetingId} onEnd={handleEndLive} />}
            </MeetingConsumer>
          </MeetingProvider>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Stream Setup Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>**Internet Connection**: Use a stable Wi-Fi or 4G/5G connection.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>**Lighting**: Face a window or a bright light so buyers can see products clearly.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>**Engagement**: Greet people as they join and answer questions from the chat.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
}
