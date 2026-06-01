'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, Video, Camera, BadgeCent, Zap, PowerOff, Type, Share2, Rocket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const [isStarting, setIsStarting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [token, setToken] = setTokenState => setToken(setTokenState);
  const [currentToken, setToken] = useState<string | null>(null);
  const [isConfigMissing, setIsConfigMissing] = useState(false);
  const [wantsToSetup, setWantsToSetup] = useState(false);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  const [streamTitle, setStreamTitle] = useState('');
  
  const [isHardwareReleased, setIsHardwareReleased] = useState(true);

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch('/api/videosdk/token');
      const data = await res.json();
      if (!res.ok) {
          if (data.error === 'CONFIG_MISSING') setIsConfigMissing(true);
          throw new Error(data.message || "Authentication failure");
      }
      if (data.token) setToken(data.token);
    } catch (err: any) {
      console.error("Error fetching VideoSDK token:", err);
    }
  }, []);

  const handleStartBroadcastDirect = useCallback(async () => {
    if (!user || !currentToken) return;
    setIsStarting(true);
    setIsHardwareReleased(false);
    
    // Cleanup local preview stream
    if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
    }

    try {
      // Start as 'live' immediately
      const response = await fetch('/api/live-session', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: streamTitle, status: 'live' })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      
      setMeetingId(result.videosdkMeetingId);
      setIsLive(true);
      setWantsToSetup(true);
      toast({ title: "BROADCAST STARTING", description: "Your studio is initializing and you are going live!" });
    } catch (err: any) { 
        toast({ variant: 'destructive', title: 'Setup Failed', description: err.message });
        setIsHardwareReleased(true);
    } finally { 
        setIsStarting(false);
    }
  }, [user, currentToken, toast, streamTitle]);

  useEffect(() => { fetchToken(); }, [fetchToken]);

  const getCameraPermission = useCallback(async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setHasPermissions(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { setHasPermissions(false); }
  }, []);

  useEffect(() => {
    if (!wantsToSetup && !isHardwareReleased) {
        getCameraPermission();
    }
    
    return () => {
        if (videoRef.current?.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
    };
  }, [wantsToSetup, getCameraPermission, isHardwareReleased]);

  const handleEndBroadcast = async () => {
    if (!user) return;
    
    if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
    }

    setWantsToSetup(false);
    setIsLive(false);
    setMeetingId(null);
    setIsHardwareReleased(true);
    
    toast({ 
        title: "SHOW ENDED", 
        description: "Broadcast terminated. Camera and Mic are now OFF.",
    });

    try {
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

  const handleReactivateCamera = () => {
      setIsHardwareReleased(false);
  };

  if (isConfigMissing) {
    return (
      <SellerLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] p-8">
          <Card className="max-w-md w-full border-yellow-500/20 bg-yellow-500/5">
            <CardHeader className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <CardTitle className="uppercase tracking-tighter text-white">Setup Required</CardTitle>
              <CardDescription className="text-neutral-400">VideoSDK credentials are missing on the server. Please check your environment variables.</CardDescription>
            </CardHeader>
            <CardFooter><Button className="w-full font-black uppercase" onClick={() => router.push('/dashboard/seller')}>BACK TO DASHBOARD</Button></CardFooter>
          </Card>
        </div>
      </SellerLayout>
    );
  }

  if (isStarting && !wantsToSetup) {
      return (
          <SellerLayout>
              <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                    <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
                </div>
                <h2 className="font-cyber text-xl font-black uppercase tracking-tighter">Initializing Broadcast...</h2>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-2">Connecting to global discovery pipe</p>
              </div>
          </SellerLayout>
      )
  }

  if (!wantsToSetup || !meetingId) {
      return (
          <SellerLayout fullWidth>
              <div className="relative h-[calc(100vh-4rem)] w-full bg-black overflow-hidden flex flex-col">
                  <div className="absolute inset-0 z-0">
                    <video ref={videoRef} autoPlay muted playsInline className={cn("h-full w-full object-cover transition-all duration-700", isHardwareReleased ? "opacity-20 grayscale blur-xl" : "opacity-60")} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  </div>

                  <div className="absolute top-6 left-6 z-10 flex items-center gap-4 pointer-events-auto">
                     <div className={cn(
                        "px-4 py-2 rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-3 backdrop-blur-xl border border-white/10",
                        "bg-neutral-800 text-neutral-400"
                     )}>
                        <div className={cn("h-2 w-2 rounded-full bg-neutral-600")} />
                        PREVIEW MODE
                     </div>
                     
                     <Badge variant="outline" className="h-10 px-4 rounded-xl border-white/10 bg-black/40 backdrop-blur-md text-white font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
                        <BadgeCent className="h-4 w-4 text-primary" />
                        Balance: {(userProfile?.aiPoints || 0).toLocaleString()}
                     </Badge>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center relative z-20 p-6 text-center">
                      <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500 space-y-6">
                          {isHardwareReleased ? (
                              <div className="mb-4 p-6 rounded-full bg-neutral-900 border border-white/10 w-fit mx-auto shadow-2xl">
                                <PowerOff className="h-16 w-16 text-neutral-600" />
                              </div>
                          ) : (
                              <div className="mb-4 p-6 rounded-full bg-primary/10 border border-primary/20 w-fit mx-auto shadow-2xl shadow-primary/20">
                                <Video className="h-16 w-16 text-primary" />
                              </div>
                          )}

                          {!isHardwareReleased && (
                              <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                                  <div className="text-left space-y-2">
                                      <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Show Title (What viewers see)</Label>
                                      <div className="relative">
                                          <Type className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                                          <Input 
                                              value={streamTitle}
                                              onChange={(e) => setStreamTitle(e.target.value)}
                                              placeholder="E.g. FLASH DEALS & NEW STOCK!"
                                              className="h-14 bg-black/40 border-white/10 rounded-2xl pl-12 font-bold text-white uppercase tracking-tight"
                                          />
                                      </div>
                                  </div>
                                  
                                  <Button 
                                    size="lg" 
                                    className="w-full h-20 rounded-[2rem] font-black text-2xl bg-red-600 hover:bg-red-700 text-white shadow-2xl shadow-red-600/40 group transition-all" 
                                    onClick={handleStartBroadcastDirect} 
                                    disabled={isStarting || (userProfile?.aiPoints || 0) < 100 || !currentToken}
                                  >
                                      {isStarting ? <Loader2 className="animate-spin mr-3 h-8 w-8" /> : <Rocket className="mr-3 h-8 w-8 group-hover:scale-110 transition-transform" />} 
                                      START BROADCAST
                                  </Button>
                              </div>
                          )}

                          {isHardwareReleased && (
                              <Button 
                                size="lg" 
                                className="w-full h-20 rounded-[2rem] font-black text-xl bg-white text-black hover:bg-neutral-200 shadow-2xl transition-all" 
                                onClick={handleReactivateCamera}
                              >
                                  <Camera className="mr-3 h-8 w-8" /> 
                                  PREPARE STUDIO
                              </Button>
                          )}
                          
                          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                             {isHardwareReleased ? "Hardware Disconnected for Privacy" : "100 Points per 70-minute session"}
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
                          <p className="text-[9px] font-black uppercase tracking-widest text-primary">System</p>
                          <p className="text-[10px] font-bold text-white max-w-[200px]">{isHardwareReleased ? 'Cam/Mic: Offline' : 'Cam/Mic: Active'}</p>
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
        {currentToken && (
            <VideoSDKStudio 
              meetingId={meetingId} 
              participantName={userProfile?.shopName || "Seller"} 
              token={currentToken}
              isLive={isLive}
              onBroadcast={() => setIsLive(true)}
              onEnd={handleEndBroadcast}
            />
        )}
      </div>
    </SellerLayout>
  );
}
