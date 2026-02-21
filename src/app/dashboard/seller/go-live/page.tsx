
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
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
    const [isLoadingPayment, setIsLoadingPayment] = useState<string | null>(null);

    const pointPackages = [
        { points: 500, price: 5, description: 'Get started' },
        { points: 1200, price: 10, description: 'Best value' },
        { points: 3000, price: 25, description: 'Power user' },
    ];

    const handlePayment = async (gateway: 'paystack' | 'paypal', points: number, price: number) => {
        if (!user?.email) {
            toast({ variant: 'destructive', title: 'User email is missing.' });
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
                    metadata: { userId: user.uid, points: points }
                }),
            });
            const data = await response.json();
            if (data.checkoutUrl) window.location.href = data.checkoutUrl;
            else throw new Error(data.error || 'Failed to initiate payment');
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Payment Error', description: err.message });
            setIsLoadingPayment(null);
        }
    };

    return (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Buy AI Points</DialogTitle>
                <DialogDescription>Choose a package to top up your balance.</DialogDescription>
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
                                    <Button size="sm" onClick={() => handlePayment('paystack', pkg.points, pkg.price)} disabled={!!isLoadingPayment}>Paystack</Button>
                                    <Button size="sm" variant="secondary" onClick={() => handlePayment('paypal', pkg.points, pkg.price)} disabled={!!isLoadingPayment}>PayPal</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </DialogContent>
    );
};

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
  const [isPaused, setIsPaused] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfigMissing, setIsConfigMissing] = useState(false);
  const [pinnedProductId, setPinnedProductId] = useState<string | null>(null);
  const [wantsToSetup, setWantsToSetup] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(SESSION_LIMIT_MS);
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
      setError(err.message || "Network error. Please refresh.");
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
      setTimeRemaining(result.timeRemainingMs || SESSION_LIMIT_MS);
    } catch (err: any) { setError(err.message); } finally { setIsStarting(false); }
  };

  if (isConfigMissing) {
    return (
      <SellerLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] p-8">
          <Card className="max-w-md w-full border-yellow-500/20 bg-yellow-500/5">
            <CardHeader className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <CardTitle className="uppercase tracking-tighter">Configuration Required</CardTitle>
              <CardDescription>VideoSDK API keys are missing from the environment variables.</CardDescription>
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
                  <Card className="w-full max-w-2xl bg-neutral-900/50 backdrop-blur-xl border-white/5">
                      <CardHeader className="text-center">
                          <Video className="h-12 w-12 text-primary mx-auto mb-4" />
                          <CardTitle className="text-3xl font-black uppercase tracking-tighter">Live Studio</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                          <div className="relative aspect-video w-full bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                              {hasPermissions === false && <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-red-500 p-4 text-center">Camera Access Denied</div>}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 rounded-2xl bg-white/5 border border-white/5"><p className="text-[10px] font-black uppercase text-neutral-500">Airtime</p><p className="text-lg font-black">70 Mins</p></div>
                              <div className="p-4 rounded-2xl bg-white/5 border border-white/5"><p className="text-[10px] font-black uppercase text-neutral-500">Balance</p><p className="text-lg font-black">{(userProfile?.aiPoints || 0).toLocaleString()} pts</p></div>
                          </div>
                      </CardContent>
                      <CardFooter>
                          <Button size="lg" className="w-full h-14 rounded-2xl font-black text-lg bg-primary hover:bg-primary/90" onClick={handleSetupPreview} disabled={isStarting || (userProfile?.aiPoints || 0) < 100}>
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
              isLive={isLive && !isPaused}
              onBroadcast={() => setIsLive(true)}
              onEnd={() => setWantsToSetup(false)}
            />
        )}
      </div>
    </SellerLayout>
  );
}
