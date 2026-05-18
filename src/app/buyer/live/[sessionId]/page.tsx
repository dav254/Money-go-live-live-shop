'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { LiveSession, Product } from '@/lib/types';
import { Loader2, MessageSquare, ShoppingBag, X, Radio, VideoOff, Share2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { LiveChat } from '@/components/buyer/LiveChat';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { PinnedProduct } from '@/components/live/PinnedProduct';
import { Button } from '@/components/ui/button';
import { FloatingChatOverlay } from '@/components/live/FloatingChatOverlay';
import { LivePromoOverlay } from '@/components/live/LivePromoOverlay';
import { useToast } from '@/hooks/use-toast';

const VideoSDKViewer = dynamic(() => import('@/components/buyer/VideoSDKViewer'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-black text-center p-8">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      <p className="text-white font-black uppercase tracking-widest text-[10px]">Syncing 4K Data Pipe...</p>
    </div>
  ),
});

export default function BuyerLiveSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const sessionId = params.sessionId as string;
  const firestore = useFirestore();

  const [activePanel, setActivePanel] = useState<'chat' | 'products' | null>(null);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  // Subscribe to the live session document
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !sessionId) return null;
    return doc(firestore, 'liveSessions', sessionId);
  }, [firestore, sessionId]);

  const { data: session, isLoading: isSessionLoading } = useDoc<LiveSession>(sessionRef);

  // Unread chat notification logic
  useEffect(() => {
    if (!firestore || !sessionId || !session?.startTime || activePanel === 'chat') {
      if (activePanel === 'chat') setHasUnreadChat(false);
      return;
    }

    const q = query(
      collection(firestore, `liveSessions/${sessionId}/chat`),
      where('timestamp', '>', session.startTime),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty && activePanel !== 'chat') {
        setHasUnreadChat(true);
      }
    });

    return () => unsubscribe();
  }, [firestore, sessionId, session?.startTime, activePanel]);

  // Fetch Pinned Product details if it exists
  const pinnedProductRef = useMemoFirebase(() => {
    if (!firestore || !session?.pinnedProductId) return null;
    return doc(firestore, 'products', session.pinnedProductId);
  }, [firestore, session?.pinnedProductId]);

  const { data: pinnedProduct } = useDoc<Product>(pinnedProductRef);

  // FAST DISCONNECT: Watch for 'ended' status or null meeting ID
  useEffect(() => {
    if (!isSessionLoading && (session?.status === 'ended' || (session?.status === 'live' && !session.videosdkMeetingId))) {
      const timer = setTimeout(() => {
          router.replace('/buyer/live-now');
      }, 1000); // Conclude show faster
      return () => clearTimeout(timer);
    }
  }, [session, isSessionLoading, router]);

  const handleShare = () => {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
          toast({ title: 'Link Copied!', description: 'Invite friends to shop live together.' });
      });
  };

  if (isSessionLoading) {
    return (
      <BuyerLayout fullWidth>
        <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-black">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-neutral-500 font-black uppercase tracking-widest text-[10px] mt-4">Pinging Host Studio...</p>
        </div>
      </BuyerLayout>
    );
  }

  // Handle "Show Ended" state gracefully
  if (session?.status === 'ended') {
      return (
        <BuyerLayout fullWidth>
            <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-black text-center p-8">
                <div className="p-8 rounded-full bg-red-600/10 border border-red-600/20 mb-8 animate-in zoom-in-95 duration-500">
                    <VideoOff className="h-16 w-16 text-red-600" />
                </div>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Show Concluded</h1>
                <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs mt-4">The host has finished the broadcast. Redirecting...</p>
                <Button 
                    variant="outline"
                    className="mt-12 font-black uppercase tracking-widest text-[10px] border-white/10"
                    onClick={() => router.push('/buyer/live-now')}
                >
                    Return to lobby now
                </Button>
            </div>
        </BuyerLayout>
      )
  }

  if (!session || session.status !== 'live' || !session.videosdkMeetingId) {
    return (
      <BuyerLayout fullWidth>
        <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-black text-center p-8">
          <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-6">
            <Radio className="h-12 w-12 text-neutral-700" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-white">Waiting for Signal...</h1>
          <button 
            className="mt-8 px-6 py-2 bg-primary text-white font-bold rounded-xl uppercase text-[10px] tracking-widest"
            onClick={() => router.push('/buyer/live-now')}
          >
            Back to lobby
          </button>
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout fullWidth>
      <div className="relative h-[calc(100vh-4rem)] w-full bg-black overflow-hidden flex">
        {/* Main Stream Area */}
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
            <VideoSDKViewer meetingId={session.videosdkMeetingId} />
          </div>

          {/* Top Deal Overlay */}
          {session.activeOffer && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
                  <LivePromoOverlay offer={session.activeOffer} />
              </div>
          )}

          {/* Top Status & Title */}
          <div className="absolute top-6 left-6 right-6 z-10 flex items-start justify-between pointer-events-none">
            <div className="flex flex-col gap-2 pointer-events-auto">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-3 bg-red-600 px-4 py-1.5 rounded-full shadow-2xl animate-pulse">
                        <div className="h-2 w-2 rounded-full bg-white" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Now</span>
                    </div>
                    
                    <Button 
                        onClick={handleShare}
                        size="icon" 
                        variant="ghost" 
                        className="h-9 w-9 rounded-full backdrop-blur-xl border border-white/10 bg-black/40 text-white shadow-2xl hover:bg-black/60 active:scale-95 transition-all pointer-events-auto"
                        title="Share Stream"
                    >
                        <Share2 className="h-4 w-4" />
                    </Button>
                </div>

                {session.title && (
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl shadow-2xl max-w-xs md:max-w-md">
                        <h1 className="text-white font-black uppercase tracking-tight text-xs md:text-sm leading-tight drop-shadow-md">{session.title}</h1>
                    </div>
                )}
            </div>
          </div>

          {/* Floating Chat Overlay (Always visible over video) */}
          <FloatingChatOverlay 
            streamId={session.sellerId} 
            className={cn(
              "absolute bottom-24 left-0 z-30 transition-all duration-300",
              pinnedProduct ? "mb-20" : "mb-0"
            )}
          />

          {/* Floating Pinned Product (Footer) */}
          {pinnedProduct && (
              <div className="absolute bottom-24 left-6 z-40 max-w-[calc(100%-120px)] animate-in slide-in-from-bottom-4">
                  <PinnedProduct product={pinnedProduct} />
              </div>
          )}

          {/* Buyer Action Toggles (Right Side) */}
          <div className="absolute bottom-6 right-6 z-40 flex flex-col gap-3">
              <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setActivePanel(activePanel === 'chat' ? null : 'chat')}
                  className={cn(
                      "h-12 w-12 rounded-full backdrop-blur-xl border border-white/10 shadow-2xl transition-all relative",
                      activePanel === 'chat' ? "bg-primary text-white scale-110" : "bg-black/40 text-white/70"
                  )}
              >
                  <MessageSquare className="h-5 w-5" />
                  {hasUnreadChat && activePanel !== 'chat' && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-black"></span>
                    </span>
                  )}
              </Button>
              <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setActivePanel(activePanel === 'products' ? null : 'products')}
                  className={cn(
                      "h-12 w-12 rounded-full backdrop-blur-xl border border-white/10 shadow-2xl transition-all",
                      activePanel === 'products' ? "bg-primary text-white scale-110" : "bg-black/40 text-white/70"
                  )}
              >
                  <ShoppingBag className="h-5 w-5" />
              </Button>
          </div>
        </div>

        {/* Side Panels */}
        <div className={cn(
            "shrink-0 bg-neutral-950 border-l border-white/5 transition-all duration-300 ease-in-out flex flex-col h-full",
            activePanel ? "w-full md:w-80 lg:w-96" : "w-0 opacity-0 overflow-hidden border-none"
        )}>
            <div className="w-full md:w-80 lg:w-96 h-full flex flex-col relative">
                {/* Panel Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-white/40">
                        {activePanel === 'chat' ? 'Public Chat' : 'Seller Catalog'}
                    </h3>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setActivePanel(null)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Panel Content */}
                <div className="flex-1 overflow-hidden relative">
                    <div className={cn("absolute inset-0 transition-opacity duration-300", activePanel === 'chat' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
                        <LiveChat streamId={session.sellerId} />
                    </div>
                    <div className={cn("absolute inset-0 flex flex-col transition-opacity duration-300", activePanel === 'products' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
                        <LiveProductShelf 
                            sellerId={session.sellerId} 
                            pinnedProductId={session.pinnedProductId || null}
                            onPinProduct={() => {}} 
                            onUnpinProduct={() => {}} 
                        />
                    </div>
                </div>
            </div>
        </div>
      </div>
    </BuyerLayout>
  );
}