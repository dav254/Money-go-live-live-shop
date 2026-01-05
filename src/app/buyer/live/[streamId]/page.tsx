
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { LiveSession, Product, Seller, SellerShop, UserProfile } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { RadioTower, AlertCircle, ShoppingCart } from 'lucide-react';
import { LiveProductCard } from '@/components/buyer/LiveProductCard';
import { LiveChat } from '@/components/buyer/LiveChat';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { PinnedProduct } from '@/components/live/PinnedProduct';

export default function BuyerLiveViewPage() {
    const params = useParams();
    const streamId = params.streamId as string; // This will be the seller's UID
    const firestore = useFirestore();
    const [videoError, setVideoError] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);

    const liveSessionRef = useMemoFirebase(() => {
        if (!streamId) return null;
        return doc(firestore, 'liveSessions', streamId);
    }, [firestore, streamId]);

    const { data: liveSession, isLoading } = useDoc<LiveSession>(liveSessionRef);

    const productsQuery = useMemoFirebase(() => {
        if (!streamId) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', streamId));
    }, [firestore, streamId]);
    const { data: products } = useCollection<Product>(productsQuery);

    const sellerProfileRef = useMemoFirebase(() => doc(firestore, 'userProfiles', streamId), [firestore, streamId]);
    const { data: sellerProfile } = useDoc<UserProfile>(sellerProfileRef);

    // This forces the video to reload every few seconds to get the new chunk
    useEffect(() => {
        const interval = setInterval(() => {
            if (videoRef.current) {
                videoRef.current.load();
            }
        }, 2000); // Reload every 2 seconds

        return () => clearInterval(interval);
    }, []);

    if (isLoading) {
        return (
            <BuyerLayout>
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <p>Loading live stream...</p>
                </div>
            </BuyerLayout>
        );
    }
    
    if (!liveSession || liveSession.status !== 'live') {
        return (
             <BuyerLayout>
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <Alert variant="destructive">
                        <RadioTower className="h-4 w-4" />
                        <AlertTitle>Stream Offline</AlertTitle>
                        <AlertDescription>
                        This live stream has ended or is not currently active.
                        </AlertDescription>
                    </Alert>
                </div>
            </BuyerLayout>
        )
    }

    return (
        <BuyerLayout>
            <div className="grid grid-cols-1 lg:grid-cols-4 h-[calc(100vh-4rem)]">
                {/* Main Video Content */}
                <div className="lg:col-span-3 bg-black flex flex-col relative">
                     <div className="flex-1 w-full relative">
                        <video 
                            ref={videoRef}
                            src="/live/live.webm" 
                            autoPlay 
                            muted 
                            playsInline 
                            className="w-full h-full object-contain"
                            onError={() => setVideoError(true)}
                        />
                        {videoError && (
                             <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                                <Alert variant="destructive" className="max-w-md">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Stream Interrupted</AlertTitle>
                                    <AlertDescription>
                                        The connection to the live stream was lost. Please wait or try refreshing the page.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}
                        <div className="absolute bottom-4 left-4 z-10">
                            {pinnedProduct && <PinnedProduct product={pinnedProduct} />}
                        </div>
                    </div>

                    {/* Featured Products */}
                    <div className="bg-black/50 p-3 border-t border-neutral-700">
                        <div className="flex items-center gap-2 text-white font-semibold mb-2">
                           <ShoppingCart className="h-5 w-5 text-primary" />
                           Featured Products
                        </div>
                        <ScrollArea className="w-full">
                            <div className="flex gap-3 pb-2">
                               {products && products.map(p => <LiveProductCard key={p.id} product={p} />)}
                            </div>
                            <div className="w-full h-[1px]" />
                        </ScrollArea>
                    </div>
                </div>

                {/* Chat Section */}
                <div className="hidden lg:block">
                    <LiveChat streamId={streamId} />
                </div>
            </div>
        </BuyerLayout>
    )
}
