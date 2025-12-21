
'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioTower, AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { LiveSession } from '@/lib/types';
import MuxPlayer from '@mux/mux-player-react';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { LiveActivityFeed } from '@/components/studio/LiveActivityFeed';
import { PinnedProduct } from '@/components/live/PinnedProduct';

export default function BuyerLiveViewPage() {
    const params = useParams();
    const sellerId = params.streamId as string;
    const firestore = useFirestore();

    const [pinnedProduct, setPinnedProduct] = React.useState<any>(null);

    const liveSessionRef = useMemoFirebase(() => {
        if (!sellerId) return null;
        return doc(firestore, 'liveSessions', sellerId);
    }, [firestore, sellerId]);

    const { data: liveSession, isLoading, error } = useDoc<LiveSession>(liveSessionRef);

    const handlePinProduct = (product: any) => {
        setPinnedProduct(product);
    };
    
    const handleUnpinProduct = () => {
        setPinnedProduct(null);
    };


    if (isLoading) {
        return (
            <BuyerLayout>
                <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                    <p>Connecting to live stream...</p>
                </div>
            </BuyerLayout>
        )
    }
    
    if (error || !liveSession || liveSession.status !== 'live' || !liveSession.muxPlaybackId) {
        return (
             <BuyerLayout>
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Stream Offline</AlertTitle>
                        <AlertDescription>
                        This live stream has ended or is not currently available.
                        </AlertDescription>
                    </Alert>
                </div>
            </BuyerLayout>
        )
    }

    return (
        <BuyerLayout>
            <div className="grid grid-cols-1 lg:grid-cols-4 h-[calc(100vh-4rem)]">
                <div className="lg:col-span-3 h-full w-full bg-black relative">
                    <MuxPlayer
                        playbackId={liveSession.muxPlaybackId}
                        streamType="live"
                        autoPlay
                        muted
                        className="w-full h-full"
                    />
                     {pinnedProduct && (
                        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20">
                            <PinnedProduct product={pinnedProduct} />
                        </div>
                    )}
                </div>
                <div className="hidden lg:flex lg:flex-col lg:gap-4 p-4 bg-card border-l overflow-y-hidden">
                    <div className="flex-1 flex flex-col min-h-0">
                         <CardTitle className="mb-2">Activity Feed</CardTitle>
                         <LiveActivityFeed liveSessionId={liveSession.id} />
                    </div>
                     <div className="flex-1 flex flex-col min-h-0">
                        <CardTitle className="mb-2">Featured Products</CardTitle>
                        <LiveProductShelf
                            sellerId={sellerId}
                            onPinProduct={handlePinProduct}
                            onUnpinProduct={handleUnpinProduct}
                        />
                    </div>
                </div>
            </div>
        </BuyerLayout>
    );
}

