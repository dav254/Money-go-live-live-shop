'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaSourceRef = useRef<MediaSource | null>(null);
    const sourceBufferRef = useRef<SourceBuffer | null>(null);
    const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const [videoStatus, setVideoStatus] = useState<'loading' | 'playing' | 'error'>('loading');

    const liveSessionRef = useMemoFirebase(() => {
        if (!streamId) return null;
        return doc(firestore, 'liveSessions', streamId);
    }, [firestore, streamId]);

    const { data: liveSession, isLoading } = useDoc<LiveSession>(liveSessionRef);

    const cleanupStream = useCallback(() => {
        if (fetchIntervalRef.current) {
            clearInterval(fetchIntervalRef.current);
            fetchIntervalRef.current = null;
        }
        if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
            try {
                mediaSourceRef.current.endOfStream();
            } catch(e) {
                console.error("Error ending stream:", e);
            }
        }
        if (videoRef.current && videoRef.current.src) {
            URL.revokeObjectURL(videoRef.current.src);
            videoRef.current.removeAttribute('src');
            try {
                videoRef.current.load();
            } catch (e) {
                console.error("Error resetting video element:", e);
            }
        }
        sourceBufferRef.current = null;
        mediaSourceRef.current = null;
    }, []);

    useEffect(() => {
        // This effect runs only once to set up the player
        const videoElement = videoRef.current;
        if (!videoElement) return;

        const mediaSource = new MediaSource();
        mediaSourceRef.current = mediaSource;
        videoElement.src = URL.createObjectURL(mediaSource);

        const onSourceOpen = () => {
            const mimeCodec = 'video/webm; codecs=vp9';
            if (!MediaSource.isTypeSupported(mimeCodec)) {
                console.error("Unsupported MIME type:", mimeCodec);
                setVideoStatus('error');
                return;
            }

            try {
                const buffer = mediaSource.addSourceBuffer(mimeCodec);
                sourceBufferRef.current = buffer;
                
                const fetchChunk = async () => {
                    // Check if source buffer is still valid before fetching
                    if (!sourceBufferRef.current || sourceBufferRef.current.updating || mediaSourceRef.current?.readyState !== 'open') {
                        return;
                    }
                    try {
                        const response = await fetch(`/live/live.webm?t=${Date.now()}`);
                        if (!response.ok) throw new Error('Network response was not ok');
                        
                        const data = await response.arrayBuffer();
                        if (data.byteLength > 0 && sourceBufferRef.current && !sourceBufferRef.current.updating) {
                           sourceBufferRef.current.appendBuffer(data);
                        }
                    } catch (error) {
                        console.error('Error fetching stream chunk:', error);
                        setVideoStatus('error');
                        if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
                    }
                };

                if (liveSession?.status === 'live') {
                    setVideoStatus('playing');
                    fetchIntervalRef.current = setInterval(fetchChunk, 2000);
                }

            } catch (e) {
                console.error("Error adding source buffer:", e);
                setVideoStatus('error');
            }
        };

        mediaSource.addEventListener('sourceopen', onSourceOpen);

        return () => {
            // This is the main cleanup when the component unmounts
            cleanupStream();
            if (mediaSource.removeEventListener) {
                mediaSource.removeEventListener('sourceopen', onSourceOpen);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array ensures this runs only ONCE

    useEffect(() => {
        // This effect manages the stream based on liveSession status
        if (liveSession?.status !== 'live') {
            cleanupStream();
             if (liveSession) { // If session exists but is not live
                setVideoStatus('error');
            }
        }
    }, [liveSession?.status, cleanupStream]);


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
                        autoPlay 
                        muted 
                        playsInline 
                        className="w-full h-full object-contain"
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
                                        The connection was lost. Please refresh the page to try again.
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
