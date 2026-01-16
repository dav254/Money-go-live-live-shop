
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { RadioTower, AlertCircle, Loader2 } from 'lucide-react';

export default function BuyerLiveViewPage() {
    const params = useParams();
    const streamId = params.streamId as string;
    const firestore = useFirestore();
    
    const [imageUrl, setImageUrl] = useState('/live/live.jpg');
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');

    const liveSessionRef = useMemoFirebase(() => {
        if (!streamId) return null;
        return doc(firestore, 'liveSessions', streamId);
    }, [firestore, streamId]);

    const { data: liveSession, isLoading } = useDoc<LiveSession>(liveSessionRef);

    useEffect(() => {
        const interval = setInterval(() => {
            // Force browser to refetch by adding a unique query param
            setImageUrl(`/live/live.jpg?t=${Date.now()}`);
        }, 200); // ~5fps

        return () => clearInterval(interval);
    }, []);

    const handleImageError = () => {
        setStatus('error');
        setError('Stream interrupted. Trying to reconnect...');
    };
    
    const handleImageLoad = () => {
        setStatus('playing');
        setError(null); // Clear error on successful load
    };

    if (isLoading) {
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
            <div className="h-[calc(100vh-4rem)] bg-black flex items-center justify-center">
                <div className="w-full h-full relative">
                    <Image
                        src={imageUrl}
                        alt="Live stream from seller"
                        fill
                        unoptimized // Crucial for preventing caching and enabling the stream effect
                        className="object-contain"
                        onError={handleImageError}
                        onLoad={handleImageLoad}
                        priority
                    />
                     {status !== 'playing' && (
                         <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                            {status === 'loading' ? (
                                <div className="text-center text-white">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                                    <p className="mt-2">Connecting to live stream...</p>
                                </div>
                            ) : (
                                <Alert variant="destructive" className="max-w-md">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Stream Interrupted</AlertTitle>
                                    <AlertDescription>
                                        The connection was lost. Trying to reconnect...
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </BuyerLayout>
    )
}
