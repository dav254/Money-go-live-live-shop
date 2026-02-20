'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useUserProfile, useMemoFirebase, useDoc } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, AlertCircle, MessageSquare, ShoppingBag, BadgeCent, Share2, Copy, Sparkles, CreditCard, Video, Camera, Clock, Zap, X, Tag, Send, VideoOff, PauseCircle, PlayCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { LiveChat } from '@/components/buyer/LiveChat';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import type { Product, LiveSession } from '@/lib/types';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SESSION_LIMIT_MS = 70 * 60 * 1000; // 70 minutes

const VideoSDKStudio = dynamic(() => import('@/components/studio/VideoSDKStudio'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-black">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      <p className="text-white/70 font-medium uppercase tracking-widest text-xs">Initializing Signal...</p>
    </div>
  ),
});

const BuyPointsDialog = () => {
    const { user } = useUser();
    const { toast } = useToast();
    const router = useRouter();
    const [isLoadingPayment, setIsLoadingPayment] = useState<string | null>(null);

    const pointPackages = [
        { points: 500, price: 5, description: 'Get started' },
        { points: 1200, price: 10, description: 'Best value' },
        { points: 3000, price: 25, description: 'Power user' },
    ];

    const handlePayment = async (gateway: 'paystack' | 'paypal', points: number, price: number) => {
        if (!user?.email) {
            toast({
                variant: 'destructive',
                title: 'Cannot initiate payment',
                description: 'User email is missing.',
            });
            return;
        }
        setIsLoadingPayment(gateway);

        try {
            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transactionType: 'points-purchase',
                    amount: price,
                    email: user.email,
                    gateway: gateway,
                    metadata: {
                        userId: user.uid,
                        points: points
                    }
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || 'Failed to create payment intent.');
            }

            const data = await response.json();
            
            if (data.checkoutUrl) {
                router.push(data.checkoutUrl);
            } else {
                throw new Error('No checkout URL received.');
            }

        } catch (err: any) {
            toast({
                variant: 'destructive',
                title: 'Payment Error',
                description: err.message || 'Could not initiate payment. Please try again.',
            });
            setIsLoadingPayment(null);
        }
    };

    return (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Buy AI Points</DialogTitle>
                <DialogDescription>
                    Points are used to power your AI tools and Live Shows. Choose a package to top up.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                {pointPackages.map(pkg => (
                    <Card key={pkg.points}>
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="font-bold text-lg">{pkg.points.toLocaleString()} Points</p>
                                <p className="text-sm text-muted-foreground">{pkg.description}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xl font-bold text-primary">${pkg.price}</p>
                                <div className="flex gap-2 mt-1">
                                    <Button size="sm" onClick={() => handlePayment('paystack', pkg.points, pkg.price)} disabled={!!isLoadingPayment}>
                                        {isLoadingPayment === 'paystack' ? <Loader2 className="animate-spin" /> : 'Paystack'}
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => handlePayment('paypal', pkg.points, pkg.price)} disabled={!!isLoadingPayment}>
                                         {isLoadingPayment === 'paypal' ? <Loader2 className="animate-spin" /> : 'PayPal'}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </DialogContent>
    );
};

const promoIdeas = [
    "🔥 Join my LIVE shopping show now for exclusive deals! Tap here:",
    "🎥 I'm selling LIVE right now! Come hung out and shop with me:",
    "⚡ FLASH SALE happening LIVE! Join now before items sell out:",
    "👋 Hey everyone! Starting my live show on Go Earn. Tap to watch:"
];

export default function SellerGoLivePage() {
  const { user } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinnedProductId, setPinnedProductId] = useState<string | null>(null);
  const [wantsToSetup, setWantsToSetup] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(SESSION_LIMIT_MS);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  
  const [offerTitle, setOfferTitle] = useState('');
  const [offerCode, setOfferCode] = useState('');
  const [isPublishingOffer, setIsPublishingOffer] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const sessionRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'liveSessions', user.uid);
  }, [firestore, user]);

  const { data: activeSession, isLoading: isSessionCheckLoading } = useDoc<LiveSession>(sessionRef);

  // Instant Camera Preview for Lobby
  useEffect(() => {
    if (!wantsToSetup) {
        const getCameraPermission = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setHasPermissions(true);
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.warn("Hardware access denied in lobby:", err);
                setHasPermissions(false);
            }
        };
        getCameraPermission();
    }
    return () => {
        if (videoRef.current?.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        }
    };
  }, [wantsToSetup]);

  useEffect(() => {
    if (activeSession && activeSession.status !== 'ended' && !wantsToSetup) {
        const now = new Date();
        const initialStart = activeSession.initialStartTime?.toDate();
        const hoursPassed = initialStart ? (now.getTime() - initialStart.getTime()) / (1000 * 60 * 60) : 999;

        if (hoursPassed < 24 && (activeSession.timeRemainingMs || 0) > 0) {
            let currentRemaining = activeSession.timeRemainingMs;
            
            if (activeSession.status === 'live' && activeSession.lastStartedAt) {
                const lastStart = activeSession.lastStartedAt.toDate().getTime();
                const elapsed = now.getTime() - lastStart;
                currentRemaining = Math.max(0, currentRemaining - elapsed);
                
                updateDoc(doc(firestore, 'liveSessions', user!.uid), {
                    timeRemainingMs: currentRemaining,
                    status: 'paused'
                }).catch(console.error);
            }

            if (currentRemaining > 0) {
                setMeetingId(activeSession.videosdkMeetingId || null);
                setIsLive(activeSession.status === 'live');
                setIsPaused(true);
                setTimeRemaining(currentRemaining);
                setWantsToSetup(true);
                toast({ 
                    title: "Active Session Recovered", 
                    description: `Resuming your broadcast with ${formatTime(currentRemaining)} remaining.` 
                });
            }
        }
    }
  }, [activeSession, wantsToSetup, firestore, user, toast]);

  const handleRetryHardware = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setHasPermissions(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
        toast({ title: "Hardware Enabled", description: "Camera and microphone are now ready." });
    } catch (err) {
        setHasPermissions(false);
        toast({ 
            variant: "destructive", 
            title: "Access Denied", 
            description: "Go to browser settings to allow camera/mic access for this site." 
        });
    }
  };

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch('/api/videosdk/token');
      if (!res.ok) throw new Error("Authentication failure");
      const data = await res.json();
      if (data.token) setToken(data.token);
    } catch (err) {
      console.error("Error fetching VideoSDK token:", err);
      setError("Network latency detected. Please refresh.");
    }
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  useEffect(() => {
    if (isLive && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const nextValue = prev - 1000;
          if (nextValue <= 0) {
            handleEndLive(true);
            return 0;
          }
          return nextValue;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLive, isPaused]);

  useEffect(() => {
      if (!isLive || isPaused || !user) return;
      const syncInterval = setInterval(() => {
          updateDoc(doc(firestore, 'liveSessions', user.uid), {
              timeRemainingMs: timeRemaining
          }).catch(console.error);
      }, 30000);
      return () => clearInterval(syncInterval);
  }, [isLive, isPaused, timeRemaining, firestore, user]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours > 0 ? hours + ':' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSetupPreview = async () => {
    if (!user || !firestore || !token) return;
    
    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch('/api/live-session', {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${await user.getIdToken()}`,
              'Content-Type': 'application/json'
          }
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.details || result.error || "Could not start session.");

      let id = result.videosdkMeetingId;
      if (!id) {
          const createMeeting = async (authToken: string) => {
            const res = await fetch("https://api.videosdk.live/v2/rooms", {
                method: "POST",
                headers: { authorization: authToken, "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            const { roomId } = await res.json();
            return roomId;
          };
          id = await createMeeting(token);
      }
      
      if (!id) throw new Error("Could not reach media bridge.");
      
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await updateDoc(sessionRef, { 
          videosdkMeetingId: id,
          status: 'upcoming' 
      });

      setMeetingId(id);
      setWantsToSetup(true);
      if (result.resumed) {
          setTimeRemaining(result.timeRemainingMs);
          setIsPaused(true);
      } else {
          setTimeRemaining(SESSION_LIMIT_MS);
      }
    } catch (err: any) {
      setError(err.message || "Connection failed.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleBroadcastStart = async () => {
    if (!user || !firestore) return;
    try {
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await updateDoc(sessionRef, { 
          status: 'live',
          lastStartedAt: serverTimestamp()
      });
      setIsLive(true);
      setIsPaused(false);
      toast({ title: "You are LIVE!" });
    } catch (e) {
      console.error("Failed to go live:", e);
    }
  };

  const handleTogglePause = async () => {
      if (!user || !firestore) return;
      const newPausedState = !isPaused;
      
      try {
          const sessionRef = doc(firestore, 'liveSessions', user.uid);
          if (newPausedState) {
              await updateDoc(sessionRef, {
                  status: 'paused',
                  timeRemainingMs: timeRemaining
              });
              setIsPaused(true);
          } else {
              await updateDoc(sessionRef, {
                  status: 'live',
                  lastStartedAt: serverTimestamp()
              });
              setIsPaused(false);
          }
      } catch (e) {
          console.error("Pause/Resume failed:", e);
      }
  };

  const handleEndLive = async (isTimeout = false) => {
    if (!user || !firestore) return;
    try {
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await updateDoc(sessionRef, {
        status: 'ended',
        videosdkMeetingId: null,
        pinnedProductId: null,
        activeOffer: null,
        timeRemainingMs: 0
      });
      
      setMeetingId(null);
      setIsLive(false);
      setPinnedProductId(null);
      setWantsToSetup(false);
      
      if (isTimeout) {
        toast({
          variant: "destructive",
          title: "Session Expired",
          description: "Your session has ended. Top up points to start again.",
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handlePinProduct = async (product: Product) => {
      if (!user || !firestore) return;
      try {
          const sessionRef = doc(firestore, 'liveSessions', user.uid);
          await updateDoc(sessionRef, { pinnedProductId: product.id });
          setPinnedProductId(product.id);
          toast({ title: "Product Pinned" });
      } catch (e) {
          console.error(e);
      }
  };

  const handleUnpinProduct = async () => {
      if (!user || !firestore) return;
      try {
          const sessionRef = doc(firestore, 'liveSessions', user.uid);
          await updateDoc(sessionRef, { pinnedProductId: null });
          setPinnedProductId(null);
          toast({ title: "Product Unpinned" });
      } catch (e) {
          console.error(e);
      }
  };

  const handlePublishOffer = async () => {
      if (!user || !firestore || !offerTitle || !offerCode) return;
      setIsPublishingOffer(true);
      try {
          const sessionRef = doc(firestore, 'liveSessions', user.uid);
          await updateDoc(sessionRef, {
              activeOffer: {
                  title: offerTitle,
                  code: offerCode,
                  publishedAt: serverTimestamp(),
              }
          });
          toast({ title: "Deal Published!" });
      } catch (e) {
          console.error(e);
      } finally {
          setIsPublishingOffer(false);
      }
  };

  const handleClearOffer = async () => {
      if (!user || !firestore) return;
      try {
          const sessionRef = doc(firestore, 'liveSessions', user.uid);
          await updateDoc(sessionRef, { activeOffer: null });
          setOfferTitle('');
          setOfferCode('');
          toast({ title: "Offer Cleared" });
      } catch (e) {
          console.error(e);
      }
  };

  const copyToClipboard = (text: string, label: string) => {
      navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: `${label} ready to share.` });
  };

  const streamUrl = `https://goearnvid.shop/buyer/live/${user?.uid}`;

  if (error) {
    return (
      <SellerLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button className="mt-6 font-black" onClick={() => window.location.reload()}>TRY AGAIN</Button>
        </div>
      </SellerLayout>
    );
  }

  if (!wantsToSetup || !meetingId) {
      return (
          <SellerLayout>
              <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] p-4 md:p-8">
                  <Card className="w-full max-w-2xl shadow-2xl border-white/5 bg-neutral-900/50 backdrop-blur-xl">
                      <CardHeader className="text-center space-y-4">
                          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
                              <Video className="h-12 w-12 text-primary animate-pulse" />
                          </div>
                          <div className="space-y-2">
                              <CardTitle className="font-headline text-3xl font-black uppercase tracking-tighter">Live Studio Lobby</CardTitle>
                              <CardDescription className="text-base">Host your shopping show and reach thousands of buyers.</CardDescription>
                          </div>
                      </CardHeader>
                      <CardContent className="space-y-8">
                          {/* LOBBY CAMERA PREVIEW */}
                          <div className="relative aspect-video w-full bg-black rounded-2xl overflow-hidden border border-white/10 group shadow-2xl">
                              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover grayscale-[20%]" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                              <div className="absolute top-4 left-4">
                                  <Badge className="bg-black/40 backdrop-blur-md border-white/10 text-[9px] font-black tracking-widest uppercase">Signal Preview</Badge>
                              </div>
                              {!hasPermissions && (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center p-6">
                                      <VideoOff className="h-10 w-10 text-destructive mb-3" />
                                      <p className="text-white font-black uppercase tracking-tighter text-sm">Camera Permission Required</p>
                                      <p className="text-white/40 text-[10px] mt-1 max-w-[200px]">We need to verify your gear before you can pay to start a session.</p>
                                  </div>
                              )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                                  <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Session Airtime</p>
                                  <div className="flex items-center gap-2">
                                      <BadgeCent className="h-5 w-5 text-primary" />
                                      <p className="text-xl font-black">70 Minutes <span className="text-xs font-normal text-neutral-500">(100 pts)</span></p>
                                  </div>
                              </div>
                              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                                  <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Your Balance</p>
                                  <div className="flex items-center gap-2">
                                      <CreditCard className="h-5 w-5 text-neutral-400" />
                                      {isProfileLoading ? <Skeleton className="h-6 w-16" /> : (
                                          <p className={cn("text-xl font-black", (userProfile?.aiPoints || 0) < 100 && !activeSession ? "text-red-500" : "text-white")}>
                                              {(userProfile?.aiPoints || 0).toLocaleString()} <span className="text-xs font-normal text-neutral-500">Points</span>
                                          </p>
                                      )}
                                  </div>
                              </div>
                          </div>
                      </CardContent>
                      <CardFooter className="flex flex-col gap-4">
                          <Button 
                            size="lg" 
                            className={cn(
                                "w-full h-14 rounded-2xl font-black text-lg shadow-xl text-white transition-all transform active:scale-95",
                                !hasPermissions ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"
                            )}
                            onClick={!hasPermissions ? handleRetryHardware : handleSetupPreview}
                            disabled={isStarting || ((userProfile?.aiPoints || 0) < 100 && !activeSession)}
                          >
                              {isStarting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Camera className="mr-2 h-6 w-6" />}
                              {!hasPermissions ? 'ENABLE CAMERA' : (activeSession ? 'RESUME MY SHOW' : 'ENTER STUDIO')}
                          </Button>
                          
                          {(userProfile?.aiPoints || 0) < 100 && !activeSession && (
                              <Dialog>
                                  <DialogTrigger asChild>
                                      <Button variant="outline" className="w-full h-12 rounded-2xl border-primary/20 text-primary">
                                          <BadgeCent className="mr-2 h-4 w-4" /> REPLENISH AI POINTS
                                      </Button>
                                  </DialogTrigger>
                                  <BuyPointsDialog />
                              </Dialog>
                          )}
                      </CardFooter>
                  </Card>
              </div>
          </SellerLayout>
      )
  }

  return (
    <SellerLayout fullWidth>
      <div className={cn(
        "flex-1 relative bg-black transition-all duration-500",
        meetingId ? "h-[calc(100vh-4rem)] overflow-hidden" : "p-8"
      )}>
        <div className="h-full w-full">
          {token && (
            <VideoSDKStudio 
              meetingId={meetingId} 
              participantName={userProfile?.shopName || userProfile?.fullName || "Seller"} 
              token={token}
              isLive={isLive && !isPaused}
              onBroadcast={handleBroadcastStart}
              onEnd={() => handleEndLive(false)}
            />
          )}
        </div>

        {isLive && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2">
                <div className={cn(
                    "px-4 py-2 rounded-full backdrop-blur-xl border flex items-center gap-3",
                    isPaused ? "bg-yellow-600/80 border-yellow-500" : "bg-black/40 border-white/10"
                )}>
                    <Clock className={cn("h-4 w-4", isPaused ? "text-white" : "text-primary")} />
                    <span className="text-sm font-black tracking-widest text-white uppercase tabular-nums">
                        {isPaused ? "PAUSED" : formatTime(timeRemaining)}
                    </span>
                </div>
                
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                    onClick={handleTogglePause}
                >
                    {isPaused ? <PlayCircle className="h-6 w-6 text-green-400" /> : <PauseCircle className="h-6 w-6 text-yellow-400" />}
                </Button>
            </div>
        )}
        
        <div className="absolute left-4 bottom-32 z-[60] flex flex-col gap-3">
            <Sheet>
                <SheetTrigger asChild>
                    <Button size="icon" className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 border-2 border-white/20">
                        <ShoppingBag className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full sm:w-80 bg-neutral-950 border-white/10 text-white p-0">
                    <SheetHeader className="p-4 border-b border-white/10">
                        <SheetTitle className="text-white text-xs uppercase tracking-widest font-black">Catalog Bag</SheetTitle>
                    </SheetHeader>
                    <div className="h-[calc(100vh-5rem)]">
                        <LiveProductShelf 
                            sellerId={user?.uid || ''} 
                            onPinProduct={handlePinProduct} 
                            onUnpinProduct={handleUnpinProduct}
                            pinnedProductId={pinnedProductId}
                        />
                    </div>
                </SheetContent>
            </Sheet>

            <Sheet>
                <SheetTrigger asChild>
                    <Button size="icon" className="h-12 w-12 rounded-full bg-yellow-600 hover:bg-yellow-700 border-2 border-white/20">
                        <Zap className="h-6 w-6 text-white" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full sm:w-80 bg-neutral-950 border-white/10 text-white p-0">
                    <SheetHeader className="p-4 border-b border-white/10">
                        <SheetTitle className="text-white text-xs uppercase tracking-widest font-black">Offer Center</SheetTitle>
                    </SheetHeader>
                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-neutral-500">Offer Title</Label>
                                <Input placeholder="e.g., FLASH SALE: 20% OFF" value={offerTitle} onChange={e => setOfferTitle(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-neutral-500">Coupon Code</Label>
                                <Input placeholder="e.g., LIVE20" value={offerCode} onChange={e => setOfferCode(e.target.value.toUpperCase())} className="font-mono" />
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    className="flex-1 bg-yellow-600 font-black text-[10px] uppercase"
                                    onClick={handlePublishOffer}
                                    disabled={!offerTitle || !offerCode || isPublishingOffer}
                                >
                                    {isPublishingOffer ? <Loader2 className="animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
                                    Blast Deal
                                </Button>
                                <Button variant="outline" onClick={handleClearOffer}><X className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>

        <div className="absolute right-4 bottom-32 z-[60]">
            <Sheet>
                <SheetTrigger asChild>
                    <Button size="icon" className="h-12 w-12 rounded-full bg-primary border-2 border-white/20">
                        <MessageSquare className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-80 bg-black border-white/10 text-white p-0">
                    <SheetHeader className="p-4 border-b border-white/10">
                        <SheetTitle className="text-white text-xs uppercase tracking-widest font-black text-center">Viewer Chat</SheetTitle>
                    </SheetHeader>
                    <div className="h-[calc(100vh-5rem)]">
                        <LiveChat streamId={user?.uid || ''} />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
      </div>
    </SellerLayout>
  );
}
