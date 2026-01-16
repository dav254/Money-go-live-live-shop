
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    const [videoStatus, setVideoStatus] = useState<'loading' | 'playing' | 'error'>('loading');
    const [timestamp, setTimestamp] = useState(Date.now());
    const videoRef = useRef<HTMLVideoElement>(null);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const liveSessionRef = useMemoFirebase(() => {
        if (!streamId) return null;
        return doc(firestore, 'liveSessions', streamId);
    }, [firestore, streamId]);

    const { data: liveSession, isLoading } = useDoc<LiveSession>(liveSessionRef);
    
    const videoSrc = `/live/live.webm?t=${timestamp}`;

    // Effect to periodically update timestamp to refetch video
    useEffect(() => {
        const interval = setInterval(() => {
            setTimestamp(Date.now());
        }, 2500); // A bit longer to allow for upload

        return () => clearInterval(interval);
    }, []);

    const handleError = () => {
        setVideoStatus('error');
        // Clear any existing timeout before setting a new one
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
        }
        // Retry loading the video after a short delay
        retryTimeoutRef.current = setTimeout(() => {
            if (videoRef.current) {
                setVideoStatus('loading');
                videoRef.current.load(); // This will re-trigger the src fetch with a new timestamp
            }
        }, 3000);
    };

    const handleCanPlay = () => {
        setVideoStatus('playing');
        if (videoRef.current) {
            videoRef.current.play().catch(console.error);
        }
    };
    
    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, []);


    if (isLoading) {
        return (
            <BuyerLayout fullWidth>
                <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-black text-white">
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
        <BuyerLayout fullWidth>
            <div className="h-[calc(100vh-4rem)] bg-black flex items-center justify-center">
                <div className="w-full h-full relative">
                    <video 
                        ref={videoRef}
                        src={videoSrc}
                        autoPlay 
                        muted 
                        playsInline 
                        className="w-full h-full object-contain"
                        onError={handleError}
                        onCanPlay={handleCanPlay}
                        key={videoSrc} // Force re-mount on src change
                    />
                    {videoStatus !== 'playing' && (
                         <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                            {videoStatus === 'loading' ? (
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
