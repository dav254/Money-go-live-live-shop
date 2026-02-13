
'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Radio, Loader2, Video, Settings, CheckCircle } from 'lucide-react';

const VideoSDKStudio = dynamic(() => import('@/components/studio/VideoSDKStudio'), {
  ssr: false,
  loading: () => (
    <Card className="aspect-video flex flex-col items-center justify-center bg-muted">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
      <p>Loading Studio components...</p>
    </Card>
  ),
});

export default function SellerGoLivePage() {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const { toast } = useToast();

  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Fetch the secure token on mount
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/videosdk/token');
        const data = await res.json();
        if (data.token) {
          setToken(data.token);
        } else {
          console.error("Token fetch failed:", data.error);
        }
      } catch (err) {
        console.error("Error fetching VideoSDK token:", err);
      }
    };
    fetchToken();
  }, []);

  const createMeeting = async (authToken: string) => {
    try {
      const res = await fetch("https://api.videosdk.live/v2/rooms", {
        method: "POST",
        headers: {
          authorization: authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const { roomId } = await res.json();
      return roomId;
    } catch (e) {
      console.error("Failed to create room:", e);
      return null;
    }
  };

  const handleStartLive = async () => {
    if (!user || !firestore || !token) {
      toast({
        variant: "destructive",
        title: "Initialization Error",
        description: "Secure token is not ready. Please refresh the page."
      });
      return;
    }
    
    setIsStarting(true);

    const id = await createMeeting(token);
    if (!id) {
      setIsStarting(false);
      toast({ variant: "destructive", title: "API Error", description: "Failed to create a live room. Check your API keys." });
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
      toast({ variant: "destructive", title: "Database Error", description: "Could not save session. Check permissions." });
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
                disabled={isStarting || !token}
              >
                {isStarting ? (
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                ) : (
                  <Radio className="mr-2 h-6 w-6" />
                )}
                {isStarting ? "Initializing..." : !token ? "Fetching Token..." : "Start Live Stream"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          token && (
            <VideoSDKStudio 
              meetingId={meetingId} 
              participantName={userProfile?.fullName || "Seller"} 
              token={token}
              onEnd={handleEndLive} 
            />
          )
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
