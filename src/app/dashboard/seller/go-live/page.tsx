'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, Video, Camera, BadgeCent, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import type { LiveSession } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const VideoSDKStudio = dynamic(() => import('@/components/studio/VideoSDKStudio'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-black">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      <p className="text-white/70 font-medium uppercase tracking-widest text-xs">Initializing Signal...</p>
    </div>
  ),
});

export default function SellerGoLivePage() {
  const { user } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [prewarmedMeetingId, setPrewarmedMeetingId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [token, setToken] = setToken] = useState<string | null>(null);
  const [isConfigMissing, setIsConfigMissing] = useState(false);
  const [wantsToSetup, setWantsToSetup] = useState(false);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch('/api/videosdk/token');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Authentication failure");
      if (data.isFallback) setIsConfigMissing(true);
      if (data.token) setToken(data.token);
    } catch (err: any) {
      console.error("Error fetching VideoSDK token:", err);
    }
  }, []);

  const handleSetupPreview = useCallback(async (isAuto = false) => {
    if (!user || !token) return;
    setIsStarting(true);
    try {
      const response = await fetch('/api/live-session', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prewarmedMeetingId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      
      setMeetingId(result.videosdkMeetingId || prewarmedMeetingId);
      setWantsToSetup(true);
      if (isAuto) {
          toast({ title: "Welcome Back", description: "Resuming your active live session." });
      }
    } catch (err: any) { 
        if (!isAuto) {
            toast({ variant: 'destructive', title: 'Setup Failed', description: err.message });
        }
    } finally { 
        setIsStarting(false);
        setIsCheckingSession(false);
    }
  }, [user, token, prewarmedMeetingId, toast]);

  useEffect(() => { fetchToken(); }, [fetchToken]);

  // Pre-warm meeting room logic
  useEffect(() => {
    const prewarmMeeting = async () => {
        if (token && !prewarmedMeetingId) {
            try {
                const res = await fetch("https://api.videosdk.live/v2/rooms", {
                    method: "POST",
                    headers: { authorization: token, "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                });
                const { roomId } = await res.json();
                if (roomId) setPrewarmedMeetingId(roomId);
            } catch (err) { console.warn("Pre-warm failed", err); }
        }
    };
    prewarmMeeting();
  }, [token, prewarmedMeetingId]);

  // Auto-resume check
  useEffect(() => {
      if (user && token && isCheckingSession) {
          const checkActiveSession = async () => {
              try {
                  const snap = await getDoc(doc(firestore, 'liveSessions', user.uid));
                  if (snap.exists()) {
                      const data = snap.data() as LiveSession;
                      if (data.status !== 'ended' && data.timeRemainingMs > 0) {
                          handleSetupPreview(true);
                      } else {
                          setIsCheckingSession(false);
                      }
                  } else {
                      setIsCheckingSession(false);
                  }
              } catch (e) {
                  setIsCheckingSession(false);
              }
          };
          checkActiveSession();
      }
  }, [user, token, firestore, isCheckingSession, handleSetupPreview]);

  const getCameraPermission = useCallback(async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setHasPermissions(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { setHasPermissions(false); }
  }, []);

  useEffect(() => {
    if (!wantsToSetup && !isCheckingSession) getCameraPermission();
    return () => {
        if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    };
  }, [wantsToSetup, getCameraPermission, isCheckingSession]);

  const handleStartBroadcast = async () => {
    if (!user || !firestore || !meetingId) return;
    try {
        // UPDATE GLOBAL STATUS: Make the stream visible to all buyers instantly
        await updateDoc(doc(firestore, 'liveSessions', user.uid), {
            status: 'live',
            videosdkMeetingId: meetingId, 
            startTime: serverTimestamp(),
            lastStartedAt: serverTimestamp()
        });
        setIsLive(true);
        toast({ title: "BROADCAST STARTED", description: "You are now live to all buyers!" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Failed to go live" });
    }
  }

  const handleEndBroadcast = async () => {
    if (!user) return;
    
    // INSTANT FEEDBACK
    setWantsToSetup(false);
    setIsLive(false);
    setMeetingId(null);
    toast({ title: "SHOW ENDED", description: "Broadcast has been terminated." });

    try {
        // TELL FIRESTORE TO DISCONNECT BUYERS
        await fetch('/api/live-session', {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${await user.getIdToken()}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ liveSessionId: user.uid })
        });
    } catch (err) {
        console.error("Failed to sync session end to database", err);
    }
  };

  if (isConfigMissing) {
    return (
      <SellerLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] p-8">
          <Card className="max-w-md w-full border-yellow-500/20 bg-yellow-500/5">
            <CardHeader className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <CardTitle className="uppercase tracking-tighter text-white">Setup Required</CardTitle>
              <CardDescription className="text-neutral-400">VideoSDK credentials are missing. Contact admin to enable live streaming.</CardDescription>
            </CardHeader>
            <CardFooter><Button className="w-full font-black uppercase" onClick={() => router.push('/dashboard/seller')}>BACK TO DASHBOARD</Button></CardFooter>
          </Card>
        </div>
      </SellerLayout>
    );
  }

  if (isCheckingSession || (isStarting && !wantsToSetup)) {
      return (
          <SellerLayout>
              <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                    <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
                </div>
                <h2 className="font-cyber text-xl font-black uppercase tracking-tighter">Syncing Studio...</h2>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-2">Checking signal & session status</p>
              </div>
          </SellerLayout>
      )
  }

  if (!wantsToSetup || !meetingId) {
      return (
          <SellerLayout fullWidth>
              <div className="relative h-[calc(100vh-4rem)] w-full bg-black overflow-hidden flex flex-col">
                  <div className="absolute inset-0 z-0">
                    <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover opacity-60 transition-transform duration-700 hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  </div>

                  <div className="absolute top-6 left-6 z-10 flex items-center gap-4">
                     <Badge variant="outline" className="h-10 px-4 rounded-xl border-white/10 bg-black/40 backdrop-blur-md text-white font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
                        <BadgeCent className="h-4 w-4 text-primary" />
                        Balance: {(userProfile?.aiPoints || 0).toLocaleString()}
                     </Badge>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center relative z-20 p-6 text-center">
                      <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500">
                          <div className="mb-8 p-6 rounded-full bg-primary/10 border border-primary/20 w-fit mx-auto shadow-2xl shadow-primary/20">
                            <Video className="h-16 w-16 text-primary" />
                          </div>

                          <Button 
                            size="lg" 
                            className="w-full h-20 rounded-[2rem] font-black text-2xl bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/40 group transition-all" 
                            onClick={() => handleSetupPreview(false)} 
                            disabled={isStarting || (userProfile?.aiPoints || 0) < 100}
                          >
                              {isStarting ? <Loader2 className="animate-spin mr-3 h-8 w-8" /> : <Camera className="mr-3 h-8 w-8 group-hover:scale-110 transition-transform" />} 
                              START LIVE SESSION
                          </Button>
                          
                          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                             100 Points per 70-minute session
                          </p>

                          {hasPermissions === false && (
                              <Alert variant="destructive" className="mt-8 bg-red-950/50 border-red-500/50">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertTitle className="font-black uppercase text-[10px] tracking-widest">Camera Denied</AlertTitle>
                                  <AlertDescription className="text-xs font-medium">Please enable your camera and microphone in browser settings to start broadcasting.</AlertDescription>
                              </Alert>
                          )}
                      </div>
                  </div>

                  <div className="absolute bottom-8 left-8 right-8 z-20 flex justify-between items-end pointer-events-none opacity-40">
                      <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase tracking-widest text-primary">Pro Tip</p>
                          <p className="text-[10px] font-bold text-white max-w-[200px]">Keep your products within the center frame for mobile viewers.</p>
                      </div>
                      <Zap className="h-8 w-8 text-primary" />
                  </div>
              </div>
          </SellerLayout>
      );
  }

  return (
    <SellerLayout fullWidth>
      <div className="flex-1 relative bg-black h-[calc(100vh-4rem)] overflow-hidden">
        {token && (
            <VideoSDKStudio 
              meetingId={meetingId} 
              participantName={userProfile?.shopName || "Seller"} 
              token={token}
              isLive={isLive}
              onBroadcast={handleStartBroadcast}
              onEnd={handleEndBroadcast}
            />
        )}
      </div>
    </SellerLayout>
  );
}