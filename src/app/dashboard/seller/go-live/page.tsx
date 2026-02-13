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
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import type { Product } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const VideoSDKStudio = dynamic(() => import('@/components/studio/VideoSDKStudio'), {
  ssr: false,
  loading: () => (
    <Card className="aspect-video flex flex-col items-center justify-center bg-black border-none shadow-2xl">
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
  const [pinnedProductId, setPinnedProductId] = useState<string | null>(null);
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

    // 1. Request permissions directly
    try {
      setPermissionState('checking');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissionState('granted');
    } catch (err) {
      setPermissionState('denied');
      setIsStarting(false);
      return;
    }

    // 2. Create meeting
    const id = await createMeeting(token);
    if (!id) {
      setIsStarting(false);
      toast({ 
        variant: "destructive", 
        title: "Connection Failed", 
        description: "Could not reach the media server. Please check your signal." 
      });
      return;
    }

    setMeetingId(id);
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
        videosdkMeetingId: null, // Clear the meeting ID to prevent buyer access
      });
      setMeetingId(null);
      setPinnedProductId(null);
      toast({ title: "Broadcast Ended" });
    } catch (error) {
      console.error(error);
    }
  };

  const handlePinProduct = async (product: Product) => {
      if (!user || !firestore) return;
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      try {
          await updateDoc(sessionRef, { pinnedProductId: product.id });
          setPinnedProductId(product.id);
          toast({ title: "Product Pinned!" });
      } catch (e) {
          console.error(e);
      }
  };

  const handleUnpinProduct = async () => {
      if (!user || !firestore) return;
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      try {
          await updateDoc(sessionRef, { pinnedProductId: null });
          setPinnedProductId(null);
      } catch (e) {
          console.error(e);
      }
  }

  return (
    <SellerLayout>
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
        {!meetingId ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
            <div className="text-center space-y-2">
                <h1 className="font-headline text-4xl font-bold tracking-tight text-white">Live Selling Studio</h1>
                <p className="text-muted-foreground text-lg">Your stage is ready. Connect with buyers in real-time.</p>
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
                {isStarting ? "Preparing Studio..." : "Open Studio & Go Live"}
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                {[
                    { icon: Camera, title: "Pro Lighting", text: "Ensure your face and products are well-lit." },
                    { icon: ShieldCheck, title: "Stable Signal", text: "Use 4G/5G or high-speed Wi-Fi for best results." },
                    { icon: Package, title: "Product Ready", text: "Have your items nearby to show the details." }
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
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-10rem)]">
            <div className="lg:col-span-3 flex flex-col space-y-4">
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
            <div className="lg:col-span-1">
                <Card className="h-full flex flex-col border-white/10 bg-neutral-900/50 backdrop-blur-sm">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            Product Shelf
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-0">
                        {user && (
                            <LiveProductShelf 
                                sellerId={user.uid} 
                                onPinProduct={handlePinProduct} 
                                onUnpinProduct={handleUnpinProduct}
                                pinnedProductId={pinnedProductId}
                            />
                        )}
                    </CardContent>
                </Card>
            </div>
          </div>
        )}
      </div>
    </SellerLayout>
  );
}