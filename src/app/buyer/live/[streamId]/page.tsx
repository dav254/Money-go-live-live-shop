
'use client';

import React, { useState, useEffect, useRef } from 'react';
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
    
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const liveSessionRef = useMemoFirebase(() => {
        if (!streamId) return null;
        return doc(firestore, 'liveSessions', streamId);
    }, [firestore, streamId]);

    const { data: liveSession, isLoading: isSessionLoading } = useDoc<LiveSession>(liveSessionRef);

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
                // If we were successfully playing before, show an error.
                // This prevents the error from showing on initial load if the first frame isn't ready.
                if (status === 'playing') {
                     setStatus('error');
                }
            };
        };

        // Start fetching immediately, then set interval for a smooth ~24 FPS
        fetchFrame();
        intervalRef.current = setInterval(fetchFrame, 41);

        // Cleanup on component unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [status]); // Rerun effect if status changes from 'error' to try reconnecting

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
            <div className="h-[calc(100vh-4rem)] bg-black flex items-center justify-center">
                <div className="w-full h-full relative">
                    {imageUrl && (
                        <Image
                            src={imageUrl}
                            alt="Live stream from seller"
                            fill
                            unoptimized // Important: prevents Next.js from caching the image
                            className="object-contain"
                            priority
                        />
                    )}
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
                                        The connection was lost. Reconnecting...
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
