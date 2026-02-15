
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useUserProfile, useMemoFirebase, useDoc } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, AlertCircle, MessageSquare, ShoppingBag, BadgeCent, Share2, Copy, Sparkles, CreditCard, Video, Camera, Clock, Zap, X, Tag, Send, VideoOff } from 'lucide-react';
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

  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinnedProductId, setPinnedProductId] = useState<string | null>(null);
  const [wantsToSetup, setWantsToSetup] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(SESSION_LIMIT_MS);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  
  // Promotion State
  const [offerTitle, setOfferTitle] = useState('');
  const [offerCode, setOfferCode] = useState('');
  const [isPublishingOffer, setIsPublishingOffer] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- AUTOMATIC SESSION RESUMPTION ---
  const sessionRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'liveSessions', user.uid);
  }, [firestore, user]);

  const { data: activeSession, isLoading: isSessionCheckLoading } = useDoc<LiveSession>(sessionRef);

  useEffect(() => {
    if (activeSession && (activeSession.status === 'live' || activeSession.status === 'upcoming') && activeSession.videosdkMeetingId && !wantsToSetup) {
        setMeetingId(activeSession.videosdkMeetingId);
        setIsLive(activeSession.status === 'live');
        setWantsToSetup(true);
        
        // Calculate remaining time based on start time
        if (activeSession.startTime) {
            const startMs = typeof activeSession.startTime.toMillis === 'function' ? activeSession.startTime.toMillis() : new Date(activeSession.startTime).getTime();
            const elapsed = Date.now() - startMs;
            setTimeRemaining(Math.max(0, SESSION_LIMIT_MS - elapsed));
        }
    }
  }, [activeSession, wantsToSetup]);

  // --- AUTOMATIC PERMISSION REQUEST ---
  useEffect(() => {
    if (!wantsToSetup) {
        const triggerHandshake = async () => {
            try {
                await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setHasPermissions(true);
            } catch (err) {
                console.warn("Hardware access denied in lobby:", err);
                setHasPermissions(false);
            }
        };
        triggerHandshake();
    }
  }, [wantsToSetup]);

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

  // Session timer logic
  useEffect(() => {
    if (isLive) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1000) {
            handleEndLive(true);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLive]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours > 0 ? hours + ':' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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

  const handleSetupPreview = async () => {
    if (!user || !firestore || !token) return;
    
    if ((userProfile?.aiPoints || 0) < 100) {
        setError("Insufficient AI Points. You need 100 points ($1.00) to start a show.");
        return;
    }

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

      const id = await createMeeting(token);
      if (!id) throw new Error("Could not reach media bridge.");
      
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await updateDoc(sessionRef, { videosdkMeetingId: id });

      setMeetingId(id);
      setWantsToSetup(true);
      toast({ title: "Studio Ready", description: "Camera calibrated. You are in private preview." });
    } catch (err: any) {
      console.error("Setup failed:", err);
      setError(err.message || "Connection failed.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleBroadcastStart = async () => {
    if (!user || !firestore) return;
    try {
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await updateDoc(sessionRef, { status: 'live' });
      setIsLive(true);
      setTimeRemaining(SESSION_LIMIT_MS);
      toast({ title: "You are LIVE!", description: "Your broadcast is now global for 70 minutes." });
    } catch (e) {
      console.error("Failed to go live:", e);
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
      });
      
      setMeetingId(null);
      setIsLive(false);
      setPinnedProductId(null);
      setWantsToSetup(false);
      
      if (isTimeout) {
        toast({
          variant: "destructive",
          title: "Session Expired",
          description: "Your points session has ended (70 minutes limit). Buy more points to start a new show.",
        });
      } else {
        toast({ title: "Broadcast Ended" });
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
          toast({ title: "Deal Published!", description: "All viewers see your promotion now." });
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
          toast({ title: "Deal Removed" });
      } catch (e) {
          console.error(e);
      }
  };

  const copyToClipboard = (text: string, label: string) => {
      navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: `${label} ready to paste.` });
  };

  const streamUrl = `https://goearnvid.shop/buyer/live/${user?.uid}`;

  if (error) {
    const isLowPoints = error.toLowerCase().includes("points");
    return (
      <SellerLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{isLowPoints ? "Points Balance Low" : "Connection Interrupted"}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex gap-4 mt-6">
            {isLowPoints ? (
                <Dialog>
                    <DialogTrigger asChild>
                        <Button className="font-black bg-primary text-white">
                            <BadgeCent className="mr-2 h-4 w-4" /> BUY AI POINTS
                        </Button>
                    </DialogTrigger>
                    <BuyPointsDialog />
                </Dialog>
            ) : (
                <Button className="font-black" onClick={() => window.location.reload()}>
                    <RefreshCw className="mr-2 h-4 w-4" /> REFRESH SIGNAL
                </Button>
            )}
            <Button variant="outline" asChild>
                <Link href="/dashboard/seller">Return to Dashboard</Link>
            </Button>
          </div>
        </div>
      </SellerLayout>
    );
  }

  // --- LOBBY SCREEN ---
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
                              <CardTitle className="font-headline text-3xl font-black uppercase tracking-tighter">Ready to Sell Live?</CardTitle>
                              <CardDescription className="text-base">Host a 70-minute shopping show and sell directly to your audience.</CardDescription>
                          </div>
                      </CardHeader>
                      <CardContent className="space-y-8">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                                  <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Session Cost</p>
                                  <div className="flex items-center gap-2">
                                      <BadgeCent className="h-5 w-5 text-primary" />
                                      <p className="text-xl font-black">100 Points <span className="text-xs font-normal text-neutral-500">($1.00)</span></p>
                                  </div>
                              </div>
                              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                                  <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Your Balance</p>
                                  <div className="flex items-center gap-2">
                                      <CreditCard className="h-5 w-5 text-neutral-400" />
                                      {isProfileLoading || isSessionCheckLoading ? <Skeleton className="h-6 w-16" /> : (
                                          <p className={cn("text-xl font-black", (userProfile?.aiPoints || 0) < 100 ? "text-red-500" : "text-white")}>
                                              {(userProfile?.aiPoints || 0).toLocaleString()} <span className="text-xs font-normal text-neutral-500">Points</span>
                                          </p>
                                      )}
                                  </div>
                              </div>
                          </div>

                          {hasPermissions === false && (
                              <Alert variant="destructive">
                                  <VideoOff className="h-4 w-4" />
                                  <AlertTitle>Hardware Access Required</AlertTitle>
                                  <AlertDescription>Please allow camera and mic access in your browser to start the show.</AlertDescription>
                              </Alert>
                          )}

                          <div className="bg-black/40 rounded-2xl p-6 border border-white/5">
                              <h4 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-yellow-500" />
                                  Pro Tips for a Great Show
                              </h4>
                              <ul className="space-y-3">
                                  <li className="flex items-center gap-3 text-sm text-neutral-300">
                                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                      Ensure your lighting is bright and clear.
                                  </li>
                                  <li className="flex items-center gap-3 text-sm text-neutral-300">
                                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                      Have your products ready to show on camera.
                                  </li>
                                  <li className="flex items-center gap-3 text-sm text-neutral-300">
                                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                      Share your link on WhatsApp before you start!
                                  </li>
                              </ul>
                          </div>
                      </CardContent>
                      <CardFooter className="flex flex-col gap-4">
                          <Button 
                            size="lg" 
                            className="w-full h-14 rounded-2xl font-black text-lg bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20"
                            onClick={handleSetupPreview}
                            disabled={isStarting || (userProfile?.aiPoints || 0) < 100 || hasPermissions === false}
                          >
                              {isStarting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Camera className="mr-2 h-6 w-6" />}
                              {hasPermissions === false ? 'ENABLE CAMERA TO START' : 'ENTER STUDIO & SETUP CAMERA'}
                          </Button>
                          
                          {(userProfile?.aiPoints || 0) < 100 && (
                              <Dialog>
                                  <DialogTrigger asChild>
                                      <Button variant="outline" className="w-full h-12 rounded-2xl border-primary/20 text-primary hover:bg-primary/5">
                                          <BadgeCent className="mr-2 h-4 w-4" /> TOP UP POINTS TO GO LIVE
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
    <SellerLayout>
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
              isLive={isLive}
              onBroadcast={handleBroadcastStart}
              onEnd={() => handleEndLive(false)}
            />
          )}
        </div>

        {/* TIME LIMIT HUD */}
        {isLive && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60]">
                <div className={cn(
                    "px-4 py-2 rounded-full backdrop-blur-xl border flex items-center gap-3 transition-colors duration-500",
                    timeRemaining < (5 * 60 * 1000) ? "bg-red-600/80 border-red-500 animate-pulse" : "bg-black/40 border-white/10"
                )}>
                    <Clock className={cn("h-4 w-4", timeRemaining < (5 * 60 * 1000) ? "text-white" : "text-primary")} />
                    <span className="text-sm font-black tracking-widest text-white uppercase tabular-nums">
                        {formatTime(timeRemaining)}
                    </span>
                </div>
            </div>
        )}
        
        {/* HUD: LEFT HAND - Product Pinning */}
        <div className="absolute left-4 bottom-32 z-[60] flex flex-col gap-3">
            <Sheet>
                <SheetTrigger asChild>
                    <Button size="icon" className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-xl border-2 border-white/20">
                        <ShoppingBag className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full sm:w-80 bg-neutral-950 border-white/10 text-white p-0">
                    <SheetHeader className="p-4 border-b border-white/10">
                        <SheetTitle className="text-white flex items-center gap-2 text-sm uppercase tracking-widest font-black">
                            <ShoppingBag className="text-blue-500 h-4 w-4" />
                            Product Bag
                        </SheetTitle>
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
                    <Button size="icon" className="h-12 w-12 rounded-full bg-yellow-600 hover:bg-yellow-700 shadow-xl border-2 border-white/20">
                        <Zap className="h-6 w-6 text-white" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full sm:w-80 bg-neutral-950 border-white/10 text-white p-0">
                    <SheetHeader className="p-4 border-b border-white/10">
                        <SheetTitle className="text-white flex items-center gap-2 text-sm uppercase tracking-widest font-black">
                            <Zap className="text-yellow-500 h-4 w-4" />
                            Live Offer Center
                        </SheetTitle>
                    </SheetHeader>
                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-neutral-500">Offer Title</Label>
                                <Input 
                                    placeholder="e.g., FLASH SALE: 20% OFF" 
                                    value={offerTitle} 
                                    onChange={e => setOfferTitle(e.target.value)}
                                    className="bg-white/5 border-white/10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-neutral-500">Coupon Code</Label>
                                <Input 
                                    placeholder="e.g., LIVE20" 
                                    value={offerCode} 
                                    onChange={e => setOfferCode(e.target.value.toUpperCase())}
                                    className="bg-white/5 border-white/10 font-mono"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 font-black text-[10px] uppercase"
                                    onClick={handlePublishOffer}
                                    disabled={!offerTitle || !offerCode || isPublishingOffer}
                                >
                                    {isPublishingOffer ? <Loader2 className="animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
                                    Blast Offer
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="border-white/10 text-neutral-400"
                                    onClick={handleClearOffer}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-white/5">
                            <h4 className="text-[10px] font-black uppercase text-neutral-500 tracking-widest mb-4">Quick Templates</h4>
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    { t: "BUY 1 GET 1 FREE", c: "BOGO" },
                                    { t: "EXTRA $10 OFF", c: "LIVE10" },
                                    { t: "FREE SHIPPING NOW", c: "FREE" }
                                ].map((item, i) => (
                                    <Button 
                                        key={i} 
                                        variant="outline" 
                                        className="justify-start border-white/5 bg-white/5 hover:bg-white/10 text-xs text-neutral-300"
                                        onClick={() => { setOfferTitle(item.t); setOfferCode(item.c); }}
                                    >
                                        <Tag className="mr-2 h-3 w-3 text-yellow-500" />
                                        {item.t}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>

        {/* HUD: CENTER - Share Hub */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-32 z-[60]">
            <Sheet>
                <SheetTrigger asChild>
                    <Button size="icon" className="h-14 w-14 rounded-full bg-green-600 hover:bg-green-700 shadow-2xl border-2 border-white/20">
                        <Share2 className="h-7 w-7" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[80vh] bg-neutral-950 border-t-white/10 text-white rounded-t-3xl p-0">
                    <SheetHeader className="p-6 border-b border-white/10">
                        <SheetTitle className="text-white flex items-center gap-3 text-xl font-black uppercase tracking-tighter">
                            <Share2 className="text-green-500 h-6 w-6" />
                            Share & Grow Your Audience
                        </SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="h-full">
                        <div className="p-6 space-y-8 pb-24">
                            <section className="space-y-3">
                                <Label className="text-sm font-bold uppercase text-neutral-500 tracking-widest">Your Direct Stream Link</Label>
                                <div className="flex gap-2">
                                    <Input readOnly value={streamUrl} className="bg-neutral-900 border-white/10 h-12" />
                                    <Button className="h-12 px-6 bg-green-600 hover:bg-green-700" onClick={() => copyToClipboard(streamUrl, 'Link')}>
                                        <Copy className="h-4 w-4 mr-2" /> Copy
                                    </Button>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <Label className="text-sm font-bold uppercase text-neutral-500 tracking-widest flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    High-Conversion Templates
                                </Label>
                                <div className="grid grid-cols-1 gap-3">
                                    {promoIdeas.map((idea, i) => (
                                        <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/30 transition-colors group">
                                            <p className="text-sm text-neutral-300 mb-3 leading-relaxed">"{idea}"</p>
                                            <Button 
                                                variant="secondary" 
                                                size="sm" 
                                                className="w-full text-[10px] font-black uppercase tracking-widest group-hover:bg-primary group-hover:text-white"
                                                onClick={() => copyToClipboard(`${idea}\n${streamUrl}`, 'Template')}
                                            >
                                                Copy Template + Link
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </div>

        {/* HUD: RIGHT HAND - Sales Chat */}
        <div className="absolute right-4 bottom-32 z-[60]">
            <Sheet>
                <SheetTrigger asChild>
                    <Button size="icon" className="h-12 w-12 rounded-full bg-primary shadow-xl border-2 border-white/20">
                        <MessageSquare className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-80 bg-black border-white/10 text-white p-0">
                    <SheetHeader className="p-4 border-b border-white/10">
                        <SheetTitle className="text-white flex items-center gap-2 text-sm uppercase tracking-widest font-black">
                            <MessageSquare className="text-primary h-4 w-4" />
                            Sales Engagement
                        </SheetTitle>
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
