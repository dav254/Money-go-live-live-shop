
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import type { LiveSession, Product } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { RadioTower, AlertCircle, Loader2 } from 'lucide-react';
import { PinnedProduct } from '@/components/live/PinnedProduct';
import { LiveChat } from '@/components/buyer/LiveChat';
import { LiveProductCard } from '@/components/buyer/LiveProductCard';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function BuyerLiveViewPage() {
    const params = useParams();
    const streamId = params.streamId as string;
    const firestore = useFirestore();
    
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const liveSessionRef = useMemoFirebase(() => {
        if (!streamId) return null;
        return doc(firestore, 'liveSessions', streamId);
    }, [firestore, streamId]);

    const { data: liveSession, isLoading: isSessionLoading } = useDoc<LiveSession>(liveSessionRef);
    
    // For now, we will mock the products. A real implementation would fetch these based on the live session.
    const mockProducts: Product[] = [
        { id: 'prod-1', name: 'Classic Leather Handbag', price: 850, imageUrl: 'https://picsum.photos/seed/product-handbag/200' },
        { id: 'prod-4', name: 'Urban Explorer Sneakers', price: 120, imageUrl: 'https://picsum.photos/seed/product-sneakers/200' },
    ];


    useEffect(() => {
        const fetchFrame = () => {
            const preloader = new window.Image();
            const newUrl = `/live/live.jpg?t=${Date.now()}`;
            
            preloader.src = newUrl;

            preloader.onload = () => {
                setImageUrl(newUrl);
                setStatus('playing');
            };

            preloader.onerror = () => {
                if (status === 'playing') {
                     setStatus('error');
                }
            };
        };

        fetchFrame();
        intervalRef.current = setInterval(fetchFrame, 41); // ~24 FPS

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [status]);

    if (isSessionLoading) {
        return (
            <BuyerLayout>
                <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-black text-white">
                    <p>Connecting to live stream...</p>
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
            <div className="grid grid-cols-1 lg:grid-cols-4 h-[calc(100vh-4rem)] bg-black">
                {/* Main Live View */}
                <div className="lg:col-span-3 h-full flex items-center justify-center relative">
                    <div className="w-full h-full relative">
                        {imageUrl && (
                            <Image
                                src={imageUrl}
                                alt="Live stream from seller"
                                fill
                                unoptimized
                                className="object-contain"
                                priority
                            />
                        )}
                        {status !== 'playing' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
                                {status === 'loading' ? (
                                    <div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /><p className="mt-2">Connecting...</p></div>
                                ) : (
                                    <Alert variant="destructive" className="max-w-md"><AlertCircle className="h-4 w-4" /><AlertTitle>Stream Interrupted</AlertTitle><AlertDescription>Reconnecting...</AlertDescription></Alert>
                                )}
                            </div>
                        )}
                    </div>
                     <div className="absolute bottom-4 left-4 z-20">
                        {liveSession.pinnedProductId && <PinnedProduct product={mockProducts.find(p => p.id === liveSession.pinnedProductId) as Product} />}
                    </div>
                    <div className="absolute bottom-4 right-4 z-20">
                         <ScrollArea className="w-40 h-48">
                            <div className="flex flex-col gap-2">
                               {mockProducts.map(p => <LiveProductCard key={p.id} product={p} />)}
                            </div>
                         </ScrollArea>
                    </div>
                </div>

                {/* Chat Section */}
                <div className="lg:col-span-1 h-full">
                    <LiveChat streamId={streamId} />
                </div>
            </div>
        </BuyerLayout>
    )
}
