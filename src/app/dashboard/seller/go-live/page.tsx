'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Radio, Loader2, Video, Settings, CheckCircle, Package, Camera, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import type { Product } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const [pinnedProductId, setPinnedProductId] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'idle' | 'checking' | 'granted' | 'denied'>('idle');

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

  const checkPermissions = async () => {
    setPermissionState('checking');
    try {
      // Direct access request
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
        audio: true 
      });
      // Stop the test stream immediately to release hardware for the SDK
      stream.getTracks().forEach(track => track.stop());
      setPermissionState('granted');
      return true;
    } catch (err) {
      console.error("Permission check failed:", err);
      setPermissionState('denied');
      toast({
        variant: "destructive",
        title: "Camera Access Required",
        description: "Please enable camera and microphone permissions in your browser settings to go live."
      });
      return false;
    }
  };

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
        description: "The secure connection token is still loading. Please wait a moment."
      });
      return;
    }
    
    setIsStarting(true);

    // 1. Force a permission check before doing anything else
    const hasPermission = await checkPermissions();
    if (!hasPermission) {
      setIsStarting(false);
      return;
    }

    // 2. Create the meeting room
    const id = await createMeeting(token);
    if (!id) {
      setIsStarting(false);
      toast({ 
        variant: "destructive", 
        title: "Network Error", 
        description: "Could not establish a connection to the media server. Please check your signal strength." 
      });
      return;
    }

    try {
      // 3. Register the session in Firestore
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await setDoc(sessionRef, {
        id: user.uid,
        sellerId: user.uid,
        title: `${userProfile?.shopName || userProfile?.fullName || 'Seller'}'s Live Show`,
        status: 'live',
        videosdkMeetingId: id,
        startTime: serverTimestamp(),
        viewerCount: 0,
        pinnedProductId: null,
      }, { merge: true });

      setMeetingId(id);
      toast({ title: "Live Session Started", description: "You are now broadcasting to Go Earn!" });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Database Error", description: "Your session was created but could not be registered. Please try again." });
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
        pinnedProductId: null,
      });
      setMeetingId(null);
      setPinnedProductId(null);
      toast({ title: "Broadcast Ended", description: "Your live session is now closed." });
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
          toast({ title: "Product Pinned!", description: `${product.name} is now highlighted for viewers.` });
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
          toast({ title: "Product Unpinned" });
      } catch (e) {
          console.error(e);
      }
  }

  return (
    <SellerLayout>
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight flex items-center gap-3">
              <Radio className="h-8 w-8 text-red-600" />
              Live Selling Studio
            </h1>
            <p className="text-muted-foreground">Go live directly to your customers and boost your sales.</p>
          </div>
        </div>

        {!meetingId ? (
          <div className="space-y-6">
            {permissionState === 'denied' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Permission Denied</AlertTitle>
                <AlertDescription>
                  Go Earn needs camera and microphone access to start your stream. Please check your browser's site settings and ensure access is allowed.
                </AlertDescription>
              </Alert>
            )}

            <Card className="border-dashed border-2 bg-card/50">
              <CardHeader className="text-center">
                <div className="mx-auto bg-primary/10 p-6 rounded-full w-fit mb-4">
                  <Video className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="text-2xl">Start Your Broadcast</CardTitle>
                <CardDescription>
                  We recommend a well-lit area and a stable 4G/LTE or Wi-Fi connection.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center pb-8 gap-4">
                <Button
                  size="lg"
                  className="font-bold text-lg px-12 bg-red-600 hover:bg-red-700 h-16 rounded-xl shadow-xl hover:shadow-red-600/20 transition-all w-full sm:w-auto"
                  onClick={handleStartLive}
                  disabled={isStarting || !token}
                >
                  {isStarting ? (
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  ) : (
                    <Radio className="mr-2 h-6 w-6" />
                  )}
                  {isStarting ? "Validating Connection..." : "Go Live Now"}
                </Button>
                
                {isStarting && (
                  <p className="text-sm text-muted-foreground animate-pulse">
                    Connecting to the media bridge...
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                {token && (
                    <VideoSDKStudio 
                    meetingId={meetingId} 
                    participantName={userProfile?.fullName || "Seller"} 
                    token={token}
                    onEnd={handleEndLive} 
                    />
                )}
            </div>
            <div className="space-y-6">
                <Card className="h-[500px] flex flex-col border-primary/20">
                    <CardHeader className="pb-3 border-b bg-muted/30">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            Live Product Shelf
                        </CardTitle>
                        <CardDescription>Select a product to highlight it for buyers.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-0 pt-2">
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

        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Pro Tips for Success
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <li className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Stable Signal
                </div>
                <p className="text-muted-foreground">If you see a "Connection Timeout," try moving to an area with better 4G/5G coverage or switch to Wi-Fi.</p>
              </li>
              <li className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Great Lighting
                </div>
                <p className="text-muted-foreground">Viewers are 80% more likely to buy when they can see product details clearly.</p>
              </li>
              <li className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Pin Your Products
                </div>
                <p className="text-muted-foreground">Always pin the product you are talking about so buyers can "Add to Cart" instantly.</p>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
}
