'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { LiveSession, UserProfile, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, VideoOff, ChevronLeft, Users, ShoppingBag, X, AlertCircle, Zap, Tag } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LiveChat } from '@/components/buyer/LiveChat';
import { PinnedProduct } from '@/components/live/PinnedProduct';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

const VideoSDKViewer = dynamic(() => import('@/components/buyer/VideoSDKViewer'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-black rounded-xl">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-white font-bold uppercase tracking-widest text-[10px]">Opening Media Bridge...</p>
    </div>
  ),
});

export default function BuyerLiveStreamViewPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const firestore = useFirestore();
  const { toast } = useToast();

  const sessionRef = useMemoFirebase(() => doc(firestore, 'liveSessions', sessionId), [firestore, sessionId]);
  const { data: session, isLoading: isSessionLoading } = useDoc<LiveSession>(sessionRef);

  const sellerRef = useMemoFirebase(() => {
    if (!session?.sellerId) return null;
    return doc(firestore, 'userProfiles', session.sellerId);
  }, [firestore, session]);
  const { data: seller } = useDoc<UserProfile>(sellerRef);

  const productsQuery = useMemoFirebase(() => {
      if (!session?.sellerId) return null;
      return query(collection(firestore, 'products'), where('sellerId', '==', session.sellerId));
  }, [firestore, session?.sellerId]);
  const { data: allProducts } = useCollection<Product>(productsQuery);

  const pinnedProductRef = useMemoFirebase(() => {
      if (!session?.pinnedProductId) return null;
      return doc(firestore, 'products', session.pinnedProductId);
  }, [firestore, session?.pinnedProductId]);
  const { data: pinnedProduct } = useDoc<Product>(pinnedProductRef);

  const copyOfferCode = (code: string) => {
      navigator.clipboard.writeText(code);
      toast({ title: "Code Copied!", description: "Paste it at checkout for your discount." });
  };

  if (isSessionLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // ALLOW PRE-JOINING: We render the viewer as soon as we have a meetingId, even if status is 'upcoming'
  // this makes the "Live" transition instantaneous when the seller hits broadcast.
  if (!session || !session.videosdkMeetingId || session.status === 'ended') {
    return (
      <BuyerLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
          <div className="bg-neutral-900 p-6 rounded-full mb-6 border border-white/5 shadow-2xl">
            <VideoOff className="h-16 w-16 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-extrabold text-white mb-2 font-headline uppercase tracking-tight">Show is Currently Offline</h2>
          <p className="text-neutral-500 mb-8 max-w-sm text-sm">This live show has either ended or hasn't started yet. Browse the shop while you wait!</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="font-bold min-w-[200px]" onClick={() => router.push('/buyer/live-now')}>Discover Live Shows</Button>
            <Button size="lg" variant="outline" className="font-bold border-white/10 text-white min-w-[200px]" onClick={() => router.push(`/sellers/${sessionId}`)}>Visit Shop Profile</Button>
          </div>
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout fullWidth>
      <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row overflow-hidden bg-black">
        {/* Main Stream Area */}
        <div className="flex-1 relative flex flex-col">
          {/* Header Overlay */}
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-3 pointer-events-auto">
                <Button variant="ghost" size="icon" className="bg-black/50 hover:bg-black/70 rounded-full text-white" onClick={() => router.back()}>
                <ChevronLeft className="h-6 w-6" />
                </Button>
                <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md p-1.5 rounded-full border border-white/10 pr-4 shadow-xl">
                <Avatar className="h-9 w-9 border-2 border-primary">
                    <AvatarImage src={seller?.profilePictureUrl || getPlaceholderImage()} />
                    <AvatarFallback>{seller?.fullName?.charAt(0) || 'S'}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-[10px] font-black text-white leading-none uppercase tracking-tighter">{seller?.shopName || seller?.fullName || 'Seller'}</p>
                    <div className="flex items-center gap-2 mt-1">
                    <Badge className={cn("h-3.5 px-1 text-[9px] border-none font-black", session.status === 'live' ? "bg-red-600 animate-pulse" : "bg-neutral-700")}>
                        {session.status === 'live' ? 'LIVE' : 'UPCOMING'}
                    </Badge>
                    <span className="text-[10px] text-neutral-300 flex items-center gap-1 font-bold">
                        <Users className="h-3 w-3 text-primary" /> {session.viewerCount || 0}
                    </span>
                    </div>
                </div>
                </div>
            </div>

            {/* Product Bag Trigger */}
            <div className="pointer-events-auto">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button size="icon" className="bg-primary hover:bg-primary/90 rounded-full h-12 w-12 shadow-2xl border-2 border-white/20">
                            <ShoppingBag className="h-6 w-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-80 bg-neutral-950 border-white/10 text-white p-0">
                        <SheetHeader className="p-4 border-b border-white/10">
                            <SheetTitle className="text-white flex items-center gap-2 text-sm uppercase font-black tracking-widest">
                                <ShoppingBag className="text-primary h-4 w-4" />
                                Product Bag
                            </SheetTitle>
                        </SheetHeader>
                        <ScrollArea className="h-[calc(100vh-5rem)]">
                            <div className="p-4 grid grid-cols-1 gap-4">
                                {allProducts?.map(p => (
                                    <div key={p.id} className="flex gap-3 bg-white/5 p-2 rounded-xl border border-white/5 hover:border-primary/30 transition-colors">
                                        <div className="relative h-16 w-16 rounded-lg overflow-hidden shrink-0 border border-white/5">
                                            <img src={p.imageUrl || getPlaceholderImage()} alt={p.name} className="object-cover h-full w-full" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold truncate uppercase tracking-tight">{p.name}</p>
                                            <p className="text-primary font-black text-sm">${p.price.toLocaleString()}</p>
                                            <Button size="sm" className="h-7 w-full mt-2 text-[10px] font-black uppercase tracking-widest" asChild>
                                                <a href={`/products/${p.id}`} target="_blank" rel="noopener noreferrer">View Item</a>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {(!allProducts || allProducts.length === 0) && (
                                    <p className="text-center text-neutral-500 pt-12 uppercase text-[10px] font-black tracking-widest">No items in catalog</p>
                                )}
                            </div>
                        </ScrollArea>
                    </SheetContent>
                </Sheet>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <VideoSDKViewer meetingId={session.videosdkMeetingId} />

            {/* LIVE OFFER OVERLAY */}
            <AnimatePresence>
                {session.activeOffer && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.8, y: -50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -50 }}
                        className="absolute top-24 left-1/2 -translate-x-1/2 z-30 w-full max-w-xs px-4"
                    >
                        <div className="bg-yellow-500/90 backdrop-blur-xl border-2 border-yellow-400 p-4 rounded-3xl shadow-2xl flex flex-col items-center gap-3 text-center">
                            <div className="bg-black/20 p-2 rounded-full">
                                <Zap className="h-6 w-6 text-black fill-black" />
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-black/60 mb-1">Live Shopping Offer</h4>
                                <p className="text-lg font-black text-black leading-tight uppercase tracking-tighter">
                                    {session.activeOffer.title}
                                </p>
                            </div>
                            <button 
                                onClick={() => copyOfferCode(session.activeOffer!.code)}
                                className="w-full bg-black text-white rounded-2xl py-3 flex items-center justify-center gap-2 group transition-transform hover:scale-105"
                            >
                                <span className="text-xs font-black uppercase tracking-widest">{session.activeOffer.code}</span>
                                <Tag className="h-3.5 w-3.5 text-yellow-500" />
                            </button>
                            <p className="text-[8px] font-bold text-black/40 uppercase">Tap code to copy & apply at checkout</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Pinned Product Overlay */}
            {pinnedProduct && (
                <div className="absolute bottom-24 left-4 z-30 pointer-events-auto">
                    <PinnedProduct product={pinnedProduct} />
                </div>
            )}
          </div>
        </div>

        {/* Chat Area - Sidebar on desktop */}
        <div className="hidden lg:flex w-80 shrink-0 flex-col border-l border-white/10 bg-neutral-950 shadow-2xl">
          <LiveChat streamId={sessionId} />
        </div>
      </div>
    </BuyerLayout>
  );
}