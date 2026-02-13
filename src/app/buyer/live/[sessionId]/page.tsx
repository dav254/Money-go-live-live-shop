'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { LiveSession, UserProfile, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, VideoOff, ChevronLeft, Users, ShoppingBag, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LiveChat } from '@/components/buyer/LiveChat';
import { PinnedProduct } from '@/components/live/PinnedProduct';
import { LiveProductCard } from '@/components/buyer/LiveProductCard';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getPlaceholderImage } from '@/lib/placeholder-images';

const VideoSDKViewer = dynamic(() => import('@/components/buyer/VideoSDKViewer'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-black rounded-xl">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-white font-bold">Loading video player...</p>
    </div>
  ),
});

export default function BuyerLiveStreamViewPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const firestore = useFirestore();

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

  if (isSessionLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!session || session.status === 'ended') {
    return (
      <BuyerLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
          <VideoOff className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold">This stream has ended</h2>
          <p className="text-muted-foreground mb-6">Check out other live shows on the platform.</p>
          <Button onClick={() => router.push('/buyer/live-now')}>Browse Live Shows</Button>
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
                <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md p-1.5 rounded-full border border-white/10 pr-4">
                <Avatar className="h-9 w-9 border-2 border-primary">
                    <AvatarImage src={seller?.profilePictureUrl || getPlaceholderImage()} />
                    <AvatarFallback>{seller?.fullName?.charAt(0) || 'S'}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-xs font-bold text-white leading-none">{seller?.shopName || seller?.fullName || 'Seller'}</p>
                    <div className="flex items-center gap-2 mt-1">
                    <Badge className="h-3.5 bg-red-600 px-1 text-[9px] animate-pulse border-none">LIVE</Badge>
                    <span className="text-[10px] text-neutral-300 flex items-center gap-1">
                        <Users className="h-3 w-3" /> {session.viewerCount || 0}
                    </span>
                    </div>
                </div>
                </div>
            </div>

            {/* Product Bag Trigger */}
            <div className="pointer-events-auto">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button size="icon" className="bg-primary hover:bg-primary/90 rounded-full h-12 w-12 shadow-lg">
                            <ShoppingBag className="h-6 w-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-80 bg-neutral-950 border-white/10 text-white p-0">
                        <SheetHeader className="p-4 border-b border-white/10">
                            <SheetTitle className="text-white flex items-center gap-2">
                                <ShoppingBag className="text-primary" />
                                Product Bag
                            </SheetTitle>
                        </SheetHeader>
                        <ScrollArea className="h-[calc(100vh-5rem)]">
                            <div className="p-4 grid grid-cols-1 gap-4">
                                {allProducts?.map(p => (
                                    <div key={p.id} className="flex gap-3 bg-white/5 p-2 rounded-lg border border-white/5">
                                        <div className="relative h-16 w-16 rounded-md overflow-hidden shrink-0">
                                            <img src={p.imageUrl || getPlaceholderImage()} alt={p.name} className="object-cover h-full w-full" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold truncate">{p.name}</p>
                                            <p className="text-primary font-bold">${p.price}</p>
                                            <Button size="sm" className="h-7 w-full mt-1 text-xs" asChild>
                                                <a href={`/products/${p.id}`} target="_blank" rel="noopener noreferrer">View</a>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {(!allProducts || allProducts.length === 0) && (
                                    <p className="text-center text-muted-foreground pt-12">No products added yet.</p>
                                )}
                            </div>
                        </ScrollArea>
                    </SheetContent>
                </Sheet>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {session.videosdkMeetingId && (
              <VideoSDKViewer meetingId={session.videosdkMeetingId} />
            )}

            {/* Pinned Product Overlay */}
            {pinnedProduct && (
                <div className="absolute bottom-24 left-4 z-30 pointer-events-auto">
                    <PinnedProduct product={pinnedProduct} />
                </div>
            )}
          </div>
        </div>

        {/* Chat Area - Sidebar on desktop */}
        <div className="hidden lg:flex w-80 shrink-0 flex-col border-l border-white/10 bg-neutral-950">
          <LiveChat streamId={sessionId} />
        </div>
      </div>
    </BuyerLayout>
  );
}