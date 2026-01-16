'use client';

import React, { useState, useEffect, useRef } from 'react';
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

    useEffect(() => {
        const videoElement = videoRef.current;
        if (!videoElement || !liveSession || liveSession.status !== 'live') {
            return;
        }

        // 1. Initialize MediaSource
        mediaSourceRef.current = new MediaSource();
        videoElement.src = URL.createObjectURL(mediaSourceRef.current);

        const onSourceOpen = () => {
            if (!mediaSourceRef.current) return;
            // 2. Create SourceBuffer
            const mimeCodec = 'video/webm; codecs=vp9';
            if (MediaSource.isTypeSupported(mimeCodec)) {
                try {
                    const sourceBuffer = mediaSourceRef.current.addSourceBuffer(mimeCodec);
                    sourceBufferRef.current = sourceBuffer;
                    setVideoStatus('playing');
                    // 3. Start fetching chunks
                    fetchAndAppendChunks();
                } catch (e) {
                    console.error("Error adding source buffer:", e);
                    setVideoStatus('error');
                }
            } else {
                console.error("Unsupported MIME type:", mimeCodec);
                setVideoStatus('error');
            }
        };

        mediaSourceRef.current.addEventListener('sourceopen', onSourceOpen);

        const currentMediaSource = mediaSourceRef.current;

        return () => {
            // Cleanup
            currentMediaSource?.removeEventListener('sourceopen', onSourceOpen);
            if (fetchIntervalRef.current) {
                clearInterval(fetchIntervalRef.current);
            }
        };

    }, [liveSession]);


    const fetchAndAppendChunks = () => {
        let lastFetchedData: ArrayBuffer | null = null;

        const fetchChunk = async () => {
            try {
                const response = await fetch(`/live/live.webm?t=${Date.now()}`); // Cache-bust
                if (!response.ok) throw new Error('Network response was not ok');

                const data = await response.arrayBuffer();

                // Very basic check to avoid appending identical chunks
                if (lastFetchedData && buffersAreEqual(lastFetchedData, data)) {
                    return;
                }
                lastFetchedData = data;

                const sourceBuffer = sourceBufferRef.current;
                if (sourceBuffer && !sourceBuffer.updating) {
                    sourceBuffer.appendBuffer(data);
                }

            } catch (error) {
                console.error('Error fetching stream chunk:', error);
                setVideoStatus('error'); 
                 if (fetchIntervalRef.current) {
                    clearInterval(fetchIntervalRef.current);
                }
            }
        };
        
        fetchChunk(); // Fetch immediately
        fetchIntervalRef.current = setInterval(fetchChunk, 2000);
    };
    
    function buffersAreEqual(buf1: ArrayBuffer, buf2: ArrayBuffer) {
        if (buf1.byteLength !== buf2.byteLength) return false;
        const dv1 = new Int8Array(buf1);
        const dv2 = new Int8Array(buf2);
        for (let i = 0; i !== buf1.byteLength; i++) {
            if (dv1[i] !== dv2[i]) return false;
        }
        return true;
    }


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
