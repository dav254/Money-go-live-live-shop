'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useUserProfile, useMemoFirebase, useDoc } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, AlertCircle, Video, Camera, Clock, BadgeCent, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import type { LiveSession } from '@/lib/types';

const SESSION_LIMIT_MS = 70 * 60 * 1000;

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
  const [token, setToken] = useState<string | null>(null);
  const [isConfigMissing, setIsConfigMissing] = useState(false);
  const [wantsToSetup, setWantsToSetup] = useState(false);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

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

  useEffect(() => { fetchToken(); }, [fetchToken]);

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

  const getCameraPermission = useCallback(async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setHasPermissions(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { setHasPermissions(false); }
  }, []);

  useEffect(() => {
    if (!wantsToSetup) getCameraPermission();
    return () => {
        if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    };
  }, [wantsToSetup, getCameraPermission]);

  const handleStartBroadcast = async () => {
    if (!user || !firestore) return;
    try {
        await updateDoc(doc(firestore, 'liveSessions', user.uid), {
            status: 'live',
            startTime: serverTimestamp(),
            lastStartedAt: serverTimestamp()
        });
        setIsLive(true);
        toast({ title: "BROADCAST STARTED", description: "You are now live to all buyers!" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Failed to go live" });
    }
  }

  const handleSetupPreview = async () => {
    if (!user || !firestore || !token) return;
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
    } catch (err: any) { 
        toast({ variant: 'destructive', title: 'Setup Failed', description: err.message });
    } finally { setIsStarting(false); }
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

  if (!wantsToSetup || !meetingId) {
      return (
          <SellerLayout>
              <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] p-4">
                  <Card className="w-full max-w-2xl bg-neutral-900/50 backdrop-blur-xl border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                      <CardHeader className="text-center pb-0 pt-8">
                          <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-6">
                            <Video className="h-12 w-12 text-primary" />
                          </div>
                          <CardTitle className="text-4xl font-black uppercase tracking-tighter text-white">Live Studio</CardTitle>
                          <CardDescription className="uppercase font-bold text-[10px] tracking-[0.2em] text-neutral-500 mt-2">Professional Broadcast Hub</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-8 p-8">
                          <div className="relative aspect-video w-full bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl group">
                              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                              {hasPermissions === false && (
                                  <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-8">
                                      <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                                      <p className="text-white font-black uppercase tracking-widest text-xs">Camera Access Denied</p>
                                      <p className="text-neutral-500 text-[10px] mt-2 max-w-[200px]">Please enable your camera and microphone in browser settings.</p>
                                  </div>
                              )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="p-6 rounded-3xl bg-white/5 border border-white/5 text-center">
                                  <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest mb-1">Session Limit</p>
                                  <p className="text-2xl font-black text-white">70 MINS</p>
                              </div>
                              <div className="p-6 rounded-3xl bg-white/5 border border-white/5 text-center">
                                  <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest mb-1">Point Balance</p>
                                  <p className="text-2xl font-black text-primary">{(userProfile?.aiPoints || 0).toLocaleString()}</p>
                              </div>
                          </div>
                      </CardContent>
                      <CardFooter className="p-8 pt-0">
                          <Button size="lg" className="w-full h-16 rounded-2xl font-black text-xl bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20" onClick={handleSetupPreview} disabled={isStarting || (userProfile?.aiPoints || 0) < 100}>
                              {isStarting ? <Loader2 className="animate-spin" /> : <Camera className="mr-2 h-6 w-6" />} ENTER STUDIO
                          </Button>
                      </CardFooter>
                  </Card>
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
              onEnd={() => setWantsToSetup(false)}
            />
        )}
      </div>
    </SellerLayout>
  );
}
