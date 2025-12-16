
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioTower, AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function BuyerLiveViewPage() {
    const params = useParams();
    const sellerId = params.streamId as string;
    const videoRef = useRef<HTMLVideoElement>(null);
    const [lastUpdated, setLastUpdated] = useState(Date.now());
    const [errorCount, setErrorCount] = useState(0);

    const videoSrc = `/live/live.webm?t=${lastUpdated}`;

    useEffect(() => {
        const interval = setInterval(() => {
            // By changing the state, we force React to re-render the component
            // with a new cache-busting query parameter in the video URL.
            setLastUpdated(Date.now());
        }, 5000); // Reload every 5 seconds to fetch the new chunk

        return () => clearInterval(interval);
    }, []);

    // Attempt to play the video whenever the source changes
    useEffect(() => {
        videoRef.current?.load();
        videoRef.current?.play().catch(error => {
            // This warning is expected in some browsers that require user interaction to play video.
            if (error.name !== 'NotAllowedError') {
                 console.warn("Autoplay was prevented. User interaction might be needed.", error);
            }
        });
    }, [videoSrc]);

    const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        const videoElement = e.currentTarget;
        // Ignore "abort" errors, which can happen during normal reloads.
        if (videoElement.error && videoElement.error.code !== videoElement.error.MEDIA_ERR_ABORTED) {
            setErrorCount(prev => prev + 1);
             // After a few genuine errors, we can assume the stream ended
            if (errorCount > 3) {
                console.log("Stream appears to have ended.");
            }
        }
    };

    return (
        <BuyerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                 <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl flex items-center gap-2">
                           <RadioTower className="text-red-500 animate-pulse" />
                           Watching Live Stream
                        </CardTitle>
                        <CardDescription>You are viewing a live broadcast. The video will update automatically.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {errorCount > 3 ? (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Stream Ended</AlertTitle>
                                <AlertDescription>
                                This live stream has concluded or is experiencing technical difficulties.
                                </AlertDescription>
                            </Alert>
                        ) : (
                             <video
                                key={videoSrc} // Key is crucial for forcing reload
                                ref={videoRef}
                                src={videoSrc}
                                autoPlay
                                muted
                                playsInline
                                controls={false}
                                loop={false} // We don't want to loop a chunk
                                onError={handleError}
                                className="w-full aspect-video rounded-lg bg-black"
                            />
                        )}
                    </CardContent>
                </Card>
            </div>
        </BuyerLayout>
    );
}
