'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const VideoSDKStudio = dynamic(() => import('@/components/studio/VideoSDKStudio'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-black">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      <p className="text-white/70 font-medium">Initializing Direct Stream...</p>
    </div>
  ),
});

export default function SellerGoLivePage() {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const { toast } = useToast();

  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasTriggeredSetup = useRef(false);

  // 1. Fetch token
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

  // 2. Automatic Setup on Load
  const handleSetupPreview = useCallback(async () => {
    if (!user || !firestore || !token || hasTriggeredSetup.current) return;
    
    hasTriggeredSetup.current = true;
    setIsStarting(true);
    setError(null);

    try {
      const id = await createMeeting(token);
      if (!id) throw new Error("Could not reach media bridge.");
      
      // Register session as 'upcoming' privately
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await setDoc(sessionRef, {
        id: user.uid,
        sellerId: user.uid,
        title: `${userProfile?.shopName || userProfile?.fullName || 'Seller'}'s Live Show`,
        status: 'upcoming',
        videosdkMeetingId: id,
        startTime: serverTimestamp(),
        viewerCount: 0,
      }, { merge: true });

      setMeetingId(id);
    } catch (err: any) {
      console.error("Setup failed:", err);
      setError(err.message || "Connection failed. Please refresh.");
      hasTriggeredSetup.current = false;
    } finally {
      setIsStarting(false);
    }
  }, [user, firestore, token, userProfile]);

  useEffect(() => {
    if (token && user && !meetingId) {
      handleSetupPreview();
    }
  }, [token, user, meetingId, handleSetupPreview]);

  const handleBroadcastStart = async () => {
    if (!user || !firestore) return;
    try {
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await updateDoc(sessionRef, { status: 'live' });
      setIsLive(true);
      toast({ title: "You are LIVE!", description: "Buyers can now see your broadcast." });
    } catch (e) {
      console.error("Failed to go live:", e);
    }
  };

  const handleEndLive = async () => {
    if (!user || !firestore) return;
    try {
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await updateDoc(sessionRef, {
        status: 'ended',
        videosdkMeetingId: null,
      });
      
      // Hardware release is handled inside VideoSDKStudio component
      setMeetingId(null);
      setIsLive(false);
      hasTriggeredSetup.current = false;
      toast({ title: "Broadcast Ended" });
    } catch (error) {
      console.error(error);
    }
  };

  if (error) {
    return (
      <SellerLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <Alert variant="destructive" className="max-w-md border-red-900/50 bg-red-950/20">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Bridge Latency</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button className="mt-6 font-black uppercase tracking-widest" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" /> REFRESH SIGNAL
          </Button>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className={cn(
        "flex-1 flex flex-col bg-black transition-all duration-500",
        meetingId ? "h-[calc(100vh-4rem)] overflow-hidden" : "p-8"
      )}>
        {meetingId ? (
          <div className="relative flex-1 h-full w-full">
            {token && (
              <VideoSDKStudio 
                meetingId={meetingId} 
                participantName={userProfile?.shopName || userProfile?.fullName || "Seller"} 
                token={token}
                isLive={isLive}
                onBroadcast={handleBroadcastStart}
                onEnd={handleEndLive}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center py-20">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Direct Signal Link</h1>
              <p className="text-muted-foreground text-sm font-medium">Opening hardware bridge to Go Earn Cloud...</p>
            </div>
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
