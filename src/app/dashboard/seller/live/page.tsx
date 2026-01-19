
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Video, Loader2, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function SellerGoLivePage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const [isStarting, setIsStarting] = useState(false);
    const [mediaError, setMediaError] = useState<string | null>(null);

    useEffect(() => {
        const enableStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error accessing media devices.", err);
                setMediaError("Could not access your camera or microphone. Please check your browser permissions and try again.");
            }
        };

        enableStream();

        // Cleanup function to stop the stream
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleGoLive = async () => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to start a stream.' });
            return;
        }

        setIsStarting(true);
        const sessionId = user.uid; // Use user's UID as the session ID for simplicity

        try {
            const liveSessionRef = doc(firestore, 'liveSessions', sessionId);
            await setDoc(liveSessionRef, {
                sellerId: user.uid,
                status: 'live',
                startedAt: serverTimestamp(),
                viewers: 0,
            });
            
            // Navigate to the actual streaming page
            router.push(`/dashboard/seller/stream`);

        } catch (error) {
            console.error("Failed to create live session:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not start the live session. Please try again.' });
            setIsStarting(false);
        }
    };

    return (
        <SellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Go Live
                </h1>
                <Card className="mx-auto max-w-4xl">
                    <CardHeader>
                        <CardTitle>Live Stream Preview</CardTitle>
                        <CardDescription>Check your camera and audio before starting your show.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
                            {mediaError ? (
                                <div className="flex h-full flex-col items-center justify-center text-center p-4">
                                    <AlertTriangle className="h-12 w-12 text-destructive" />
                                    <p className="mt-4 font-semibold text-lg">Media Error</p>
                                    <p className="text-muted-foreground">{mediaError}</p>
                                </div>
                            ) : (
                                <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover"></video>
                            )}
                        </div>
                        <Button 
                            size="lg" 
                            className="w-full font-bold text-lg"
                            onClick={handleGoLive}
                            disabled={isStarting || !!mediaError}
                        >
                            {isStarting ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <Video className="mr-2 h-5 w-5" />
                            )}
                            Start Live Show
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}
