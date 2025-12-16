'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioTower, Loader2, WifiOff, AlertTriangle, Video, CameraOff, Camera } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Peer } from 'peerjs';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

export default function SellerLivePage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [liveStatus, setLiveStatus] = useState<'OFFLINE' | 'CONNECTING' | 'READY' | 'LIVE' | 'ERROR'>('OFFLINE');
    const [isCameraReady, setIsCameraReady] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peerRef = useRef<Peer | null>(null);

    const cleanup = useCallback(async () => {
        // Stop all media tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        // Destroy the peer connection
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }

        // Update Firestore status
        if (user && firestore) {
            try {
                const sessionRef = doc(firestore, 'liveSessions', user.uid);
                await updateDoc(sessionRef, { status: 'ended', endTime: new Date().toISOString() });
            } catch (error) {
                console.log("Cleanup: No active session to end or already ended.");
            }
        }
        
        setLiveStatus('OFFLINE');
        setIsCameraReady(false);
    }, [user, firestore]);

    const initializePeer = useCallback(async (stream: MediaStream) => {
        if (!user || !firestore) return;
        
        const { default: Peer } = await import('peerjs');
        
        // Ensure any old peer instance is destroyed before creating a new one
        if (peerRef.current) {
            peerRef.current.destroy();
        }
        
        const newPeer = new Peer(user.uid, {
             config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun.services.mozilla.com' },
                ]
            }
        });
        peerRef.current = newPeer;

        newPeer.on('open', async (id) => {
             const sessionRef = doc(firestore, 'liveSessions', user.uid);
             // Use setDoc with merge to ensure the document is created or updated
             await setDoc(sessionRef, {
                id: user.uid,
                sellerId: user.uid,
                title: `${user.displayName || 'Seller'}'s Live Show`,
                status: 'live',
                startTime: new Date().toISOString(),
             }, { merge: true });

            setLiveStatus('LIVE');
            toast({ title: "🎉 You are LIVE!", description: "Waiting for viewers to connect." });

            // Listen for incoming calls from buyers
            newPeer.on('call', (call) => {
                call.answer(stream); // Answer the call with the seller's stream
                // We don't need to do anything with the buyer's stream here
            });
        });

        newPeer.on('error', (err) => {
            console.error('PeerJS error:', err);
            toast({ variant: 'destructive', title: 'Connection Error', description: `Could not maintain live connection: ${err.type}` });
            cleanup(); // Clean up on error
            setLiveStatus('ERROR');
        });
        
        newPeer.on('disconnected', () => {
             toast({ variant: 'destructive', title: 'Disconnected', description: 'Reconnecting to the PeerJS server...' });
             newPeer.reconnect();
        });
        
        newPeer.on('close', () => {
             console.log('Peer connection closed.');
             cleanup();
        })

    }, [user, firestore, toast, cleanup]);

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
    }, [user, getCameraStream]);

    const handleGoLive = async () => {
        if (liveStatus !== 'READY') return;
        const stream = localStreamRef.current || await getCameraStream();
        if (stream) {
            initializePeer(stream);
        }
    };
    
    const handleEndLive = async () => {
        await cleanup();
        toast({ title: 'Stream Ended', description: 'You are no longer live.' });
    };

    useEffect(() => {
        window.addEventListener('beforeunload', cleanup);
        return () => {
            window.removeEventListener('beforeunload', cleanup);
            cleanup();
        };
    }, [cleanup]);

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
                                 {!isCameraReady && liveStatus === 'OFFLINE' && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 flex-col gap-2">
                                          <CameraOff className="h-8 w-8 text-muted-foreground" />
                                         <p className="text-sm text-muted-foreground">Camera is off</p>
                                     </div>
                                 )}
                                 {!isCameraReady && liveStatus === 'CONNECTING' && (
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
