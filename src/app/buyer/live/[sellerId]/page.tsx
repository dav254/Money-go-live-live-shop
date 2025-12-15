
'use client';

import React, { useEffect, useState } from 'react';
import MuxPlayer from '@mux/mux-player-react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Loader2, WifiOff } from 'lucide-react';
import { useParams } from 'next/navigation';
import { LiveChat } from '@/components/buyer/LiveChat';
import { PinnedProduct } from '@/components/live/PinnedProduct';
import type { Product, LiveSession } from '@/lib/types';
import { LiveProductCard } from '@/components/buyer/LiveProductCard';

export default function BuyerLivePage() {
    const params = useParams();
    const sellerId = params.sellerId as string;
    const firestore = useFirestore();
    
    const [playbackId, setPlaybackId] = useState<string | null>(null);
    const [streamStatus, setStreamStatus] = useState<'loading' | 'active' | 'ended'>('loading');
    const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);

    const sessionRef = useMemoFirebase(() => {
        if (!firestore || !sellerId) return null;
        return doc(firestore, 'liveSessions', sellerId);
    }, [firestore, sellerId]);

    const { data: liveSession, isLoading } = useDoc<LiveSession>(sessionRef);
    
    useEffect(() => {
        if (liveSession) {
            setPlaybackId(liveSession.muxPlaybackId || null);
            setStreamStatus(liveSession.status === 'live' ? 'active' : 'ended');
            setPinnedProduct(liveSession.pinnedProduct || null);
        } else if (!isLoading) {
            // If the doc doesn't exist and we're not loading, the stream is unavailable
            setStreamStatus('ended');
        }
    }, [liveSession, isLoading]);


    return (
        <BuyerLayout>
            <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-black text-white">
                 <div className="flex-1 relative overflow-y-auto">
                    <div className="relative aspect-video w-full bg-neutral-900 flex items-center justify-center">
                        {streamStatus === 'loading' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="animate-spin h-8 w-8" />
                                <p>Connecting to live stream...</p>
                            </div>
                        )}
                        {streamStatus === 'active' && playbackId && (
                            <MuxPlayer playbackId={playbackId} streamType="live" autoPlay muted className="w-full h-full" />
                        )}
                        {streamStatus === 'ended' && (
                             <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                <WifiOff className="h-8 w-8" />
                                <p>This stream has ended.</p>
                            </div>
                        )}
                        {pinnedProduct && (
                            <div className="absolute bottom-4 left-4 z-20">
                                <PinnedProduct product={pinnedProduct} />
                            </div>
                        )}
                    </div>
                     <div className="p-4 space-y-2">
                        <h3 className="font-semibold text-sm">Products in this stream</h3>
                        {/* Placeholder for product shelf */}
                        <div className="text-muted-foreground text-xs">Product shelf coming soon.</div>
                    </div>
                </div>

                <div className="w-full lg:w-80 h-1/3 lg:h-full">
                    <LiveChat liveSessionId={sellerId} />
                </div>
            </div>
        </BuyerLayout>
    );
}
