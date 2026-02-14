
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, AlertCircle, MessageSquare, ShoppingBag, BadgeCent, Share2, Copy, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { LiveChat } from '@/components/buyer/LiveChat';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import type { Product } from '@/lib/types';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

const VideoSDKStudio = dynamic(() => import('@/components/studio/VideoSDKStudio'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-black">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      <p className="text-white/70 font-medium uppercase tracking-widest text-xs">Initializing Signal...</p>
    </div>
  ),
});

const promoIdeas = [
    "🔥 Join my LIVE show now for exclusive deals you won't find anywhere else! Tap here to watch:",
    "🎥 I'm selling LIVE right now! Come ask me questions and see the products in action:",
    "⚡ FLASH SALE happening LIVE! Join now to grab your favorites before they sell out:",
    "👋 Hey everyone! Starting my live show on Go Earn. Come hang out and shop with me:"
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
  const hasTriggeredSetup = useRef(false);

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

  const handleSetupPreview = useCallback(async () => {
    if (!user || !firestore || !token || hasTriggeredSetup.current) return;
    
    if ((userProfile?.aiPoints || 0) < 100) {
        setError("You need at least 100 AI Points ($1.00) to start a live show.");
        return;
    }

    hasTriggeredSetup.current = true;
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
      toast({ title: "Studio Ready", description: "Camera calibrated. You are in private preview." });
    } catch (err: any) {
      console.error("Setup failed:", err);
      setError(err.message || "Connection failed.");
      hasTriggeredSetup.current = false;
    } finally {
      setIsStarting(false);
    }
  }, [user, firestore, token, userProfile, toast]);

  useEffect(() => {
    if (token && user && !meetingId && !isProfileLoading) {
      handleSetupPreview();
    }
  }, [token, user, meetingId, handleSetupPreview, isProfileLoading]);

  const handleBroadcastStart = async () => {
    if (!user || !firestore) return;
    try {
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await updateDoc(sessionRef, { status: 'live' });
      setIsLive(true);
      toast({ title: "You are LIVE!", description: "Your broadcast is now global." });
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
        pinnedProductId: null,
      });
      
      setMeetingId(null);
      setIsLive(false);
      setPinnedProductId(null);
      hasTriggeredSetup.current = false;
      toast({ title: "Broadcast Ended" });
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

  const copyToClipboard = (text: string, label: string) => {
      navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: `${label} ready to paste.` });
  };

  const streamUrl = `https://goearnvid.shop/buyer/live/${user?.uid}`;

  if (error) {
    return (
      <SellerLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Interrupted</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex gap-4 mt-6">
            <Button className="font-black" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" /> REFRESH SIGNAL
            </Button>
            <Button variant="outline" asChild>
                <Link href="/dashboard/reseller/toolkit">Buy Points</Link>
            </Button>
          </div>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className={cn(
        "flex-1 relative bg-black transition-all duration-500",
        meetingId ? "h-[calc(100vh-4rem)] overflow-hidden" : "p-8"
      )}>
        {meetingId ? (
          <>
            <div className="h-full w-full">
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
            
            {/* HUD: LEFT HAND - Product Pinning */}
            <div className="absolute left-4 bottom-32 z-[60]">
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
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full space-y-6 text-center py-20 bg-neutral-950 rounded-2xl border border-white/5 mx-auto max-w-4xl">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Opening Studio Signal</h1>
              <p className="text-muted-foreground text-sm font-medium">Validating AI Points & Media Bridge...</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 rounded-full border border-white/5">
                <BadgeCent className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Cost: 100 Points per session ($1.00)</span>
            </div>
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
