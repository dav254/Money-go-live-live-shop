'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, RadioTower, Loader2, WifiOff, AlertTriangle, FlipHorizontal, Video, CameraOff, Camera } from 'lucide-react';
import { useUser } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const SellerLivePage = () => {
    const { user } = useUser();
    const { toast } = useToast();
    const [liveStatus, setLiveStatus] = useState<'OFFLINE' | 'CONNECTING' | 'READY' | 'LIVE' | 'ERROR'>('OFFLINE');
    const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);

    const cleanup = useCallback(async () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        setLiveStatus('OFFLINE');
        setIsCameraReady(false);
        setLiveSessionId(null);
    }, []);

    const localStreamRef = useRef<MediaStream | null>(null);

    const getCameraStream = useCallback(async () => {
        try {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
            localStreamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setIsCameraReady(true);
            return stream;
        } catch (err) {
            console.error("Camera access error:", err);
            toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access camera/microphone. Please check permissions.' });
            setIsCameraReady(false);
            setLiveStatus('ERROR');
            return null;
        }
    }, [toast]);
    
    const startCamera = useCallback(async () => {
        if (!user) return;
        setLiveStatus('CONNECTING');
        await getCameraStream();
        setLiveStatus('READY');
        toast({ title: "Ready to Go Live", description: `Camera is on.` });
    }, [user, getCameraStream, toast]);


    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    const handleGoLive = async () => {
        if (!user) return;
        
        setLiveStatus('LIVE');

        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/live-session', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to start live session.');
            }

            const data = await response.json();
            setLiveSessionId(data.liveSessionId);
            toast({
                title: '🎉 You are LIVE!',
                description: 'Your stream has started and is now visible to buyers.',
            });
        } catch (error: any) {
            console.error("Error starting live session:", error);
            toast({ variant: 'destructive', title: 'Error', description: error.message });
            setLiveStatus('ERROR');
        }
    };


    const handleEndLive = async () => {
         if (!liveSessionId || !user) return;

         try {
             const token = await user.getIdToken();
             await fetch('/api/live-session', {
                 method: 'PUT',
                 headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                 body: JSON.stringify({ liveSessionId }),
             });
         } catch (error) {
             console.error("Error ending live session:", error);
         } finally {
             await cleanup();
         }
    };


    const StatusCard = () => {
        switch (liveStatus) {
            case 'OFFLINE': return <CardDescription>Start your camera to get ready.</CardDescription>;
            case 'CONNECTING': return <div className="flex items-center gap-2 text-yellow-500"><Loader2 className="animate-spin h-4 w-4" />Connecting...</div>;
            case 'READY': return <div className="flex items-center gap-2 text-green-500"><RadioTower className="h-4 w-4" />Ready to Go Live</div>;
            case 'LIVE': return (
                <div className="flex items-center gap-2 text-red-500 animate-pulse font-bold">
                    <div className="h-2 w-2 rounded-full bg-red-500"></div>
                    LIVE
                </div>
            );
            case 'ERROR': return <div className="flex items-center gap-2 text-red-500"><WifiOff className="h-4 w-4" />Connection Failed</div>;
            default: return null;
        }
    }

    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Live Stream Studio</h1>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Live Preview</CardTitle>
                            <StatusCard />
                        </CardHeader>
                        <CardContent>
                             <div className="aspect-video w-full bg-black rounded-lg relative overflow-hidden">
                                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                                 {!isCameraReady && liveStatus !== 'OFFLINE' && (
                                     <div className="absolute inset-0 flex items-center justify-center bg-black/50 flex-col gap-2">
                                         <Loader2 className="h-8 w-8 animate-spin" />
                                         <p className="text-sm">Starting camera...</p>
                                     </div>
                                 )}
                             </div>
                        </CardContent>
                    </Card>
                    <div className="space-y-6">
                        <Card>
                             <CardHeader>
                                <CardTitle>Controls</CardTitle>
                             </CardHeader>
                             <CardContent className="space-y-4">
                                {liveStatus === 'OFFLINE' && (
                                    <Button onClick={startCamera} className="w-full"><Camera className="mr-2 h-4 w-4" />Start Camera</Button>
                                )}
                                {liveStatus === 'READY' && (
                                    <Button onClick={handleGoLive} variant="destructive" className="w-full"><RadioTower className="mr-2 h-4 w-4" />Go Live Now</Button>
                                )}
                                {liveStatus === 'LIVE' && (
                                    <Button onClick={handleEndLive} className="w-full"><CameraOff className="mr-2 h-4 w-4" />End Live Stream</Button>
                                )}
                                 {liveStatus === 'ERROR' && (
                                    <Button onClick={startCamera} variant="secondary" className="w-full">Retry Connection</Button>
                                )}
                             </CardContent>
                        </Card>

                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Heads up!</AlertTitle>
                          <AlertDescription>
                            This feature uses your device's camera and microphone. Ensure you have given the necessary browser permissions.
                          </AlertDescription>
                        </Alert>
                    </div>
                </div>
            </div>
        </SellerLayout>
    );
};

export default SellerLivePage;
