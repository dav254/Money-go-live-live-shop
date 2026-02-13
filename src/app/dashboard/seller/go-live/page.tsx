'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Radio, Loader2, Video, Settings, CheckCircle, Package, Camera, ShieldCheck, AlertCircle, RefreshCw, StopCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const VideoSDKStudio = dynamic(() => import('@/components/studio/VideoSDKStudio'), {
  ssr: false,
  loading: () => (
    <Card className="h-full w-full flex flex-col items-center justify-center bg-black border-none shadow-2xl">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      <p className="text-white/70 font-medium">Entering Studio...</p>
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
  const [permissionState, setPermissionState] = useState<'idle' | 'checking' | 'granted' | 'denied'>('idle');

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/videosdk/token');
        const data = await res.json();
        if (data.token) {
          setToken(data.token);
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
        title: "Initialising...",
        description: "Please wait a moment for the secure token to load."
      });
      return;
    }
    
    setIsStarting(true);
    setPermissionState('checking');

    try {
      // SPEED OPTIMIZATION: Create meeting and check permissions in parallel
      const [id, stream] = await Promise.all([
        createMeeting(token),
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      ]);

      if (!id) {
        throw new Error("Could not reach the media server.");
      }

      // Close temporary stream immediately after validation
      stream.getTracks().forEach(track => track.stop());
      setPermissionState('granted');
      setMeetingId(id);

    } catch (err: any) {
      console.error("Failed to start live:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
      } else {
        toast({ 
          variant: "destructive", 
          title: "Connection Failed", 
          description: err.message || "Could not start broadcast. Please check your signal." 
        });
      }
      setIsStarting(false);
    }
  };

  const handleStudioReady = async (mid: string) => {
    if (!user || !firestore) return;
    try {
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await setDoc(sessionRef, {
        id: user.uid,
        sellerId: user.uid,
        title: `${userProfile?.shopName || userProfile?.fullName || 'Seller'}'s Live Show`,
        status: 'live',
        videosdkMeetingId: mid,
        startTime: serverTimestamp(),
        viewerCount: 0,
        pinnedProductId: null,
      }, { merge: true });
      
      toast({ title: "You are LIVE!", description: "Buyers can now see your broadcast." });
    } catch (e) {
      console.error("Failed to register live status:", e);
    }
  };

  const handleEndLive = async () => {
    if (!user || !firestore) return;
    try {
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await updateDoc(sessionRef, {
        status: 'ended',
        endTime: serverTimestamp(),
        pinnedProductId: null,
        videosdkMeetingId: null,
      });
      setMeetingId(null);
      toast({ title: "Broadcast Ended" });
    } catch (error) {
      console.error(error);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <SellerLayout>
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-500",
        meetingId ? "h-[calc(100vh-4rem)] overflow-hidden bg-black" : "p-4 md:p-8 max-w-7xl mx-auto space-y-6"
      )}>
        {!meetingId ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center">
            <div className="space-y-2">
                <h1 className="font-headline text-4xl font-bold tracking-tight">Direct Live Broadcast</h1>
                <p className="text-muted-foreground text-lg">Connect instantly with your audience.</p>
            </div>

            {permissionState === 'denied' && (
              <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Camera Access Required</AlertTitle>
                <AlertDescription>
                  Please enable camera and microphone permissions in your browser settings to start your stream.
                </AlertDescription>
              </Alert>
            )}

            <Button
                size="lg"
                className="font-bold text-xl px-16 h-20 rounded-2xl bg-red-600 hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all group"
                onClick={handleStartLive}
                disabled={isStarting || !token}
            >
                {isStarting ? (
                <Loader2 className="mr-3 h-8 w-8 animate-spin" />
                ) : (
                <Radio className="mr-3 h-8 w-8 group-hover:scale-110 transition-transform" />
                )}
                {isStarting ? "Going Live..." : "Go Live Now"}
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                {[
                    { icon: Camera, title: "Pro Lighting", text: "Ensure your face and products are well-lit." },
                    { icon: ShieldCheck, title: "Stable Signal", text: "Use high-speed Wi-Fi for best results." },
                    { icon: RefreshCw, title: "Instant Connect", text: "One-click connection to media servers." }
                ].map((item, i) => (
                    <Card key={i} className="bg-card/50 border-white/5">
                        <CardContent className="pt-6 text-center space-y-2">
                            <item.icon className="h-8 w-8 text-primary mx-auto mb-2" />
                            <h3 className="font-bold">{item.title}</h3>
                            <p className="text-xs text-muted-foreground">{item.text}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
          </div>
        ) : (
          <div className="relative flex-1 h-full w-full bg-black">
            {token && (
                <VideoSDKStudio 
                    meetingId={meetingId} 
                    participantName={userProfile?.fullName || "Seller"} 
                    token={token}
                    onEnd={handleEndLive}
                    onReady={() => handleStudioReady(meetingId)}
                />
            )}
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
