'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioTower, Loader2, WifiOff, AlertTriangle, Video, CameraOff, Camera } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Peer } from 'peerjs';
import { doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';


const PEER_CONFIG = {
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'turn:numb.viagenie.ca', username: 'webrtc@live.com', credential: 'muazkh' }
        ]
    }
};

const SellerLivePage = () => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [liveStatus, setLiveStatus] = useState<'OFFLINE' | 'CONNECTING' | 'READY' | 'LIVE' | 'ERROR'>('OFFLINE');
    const [isCameraReady, setIsCameraReady] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
    const callRef = useRef<any>(null);


    const cleanup = useCallback(async () => {
        if (callRef.current) {
            callRef.current.close();
            callRef.current = null;
        }
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (liveSessionId && firestore) {
            const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
            await updateDoc(sessionRef, { status: 'ended' });
        }
        setLiveStatus('OFFLINE');
        setIsCameraReady(false);
        setLiveSessionId(null);
    }, [liveSessionId, firestore]);

    const initializePeer = useCallback((stream: MediaStream) => {
        if (!user || !firestore) return;
        
        import('peerjs').then(({ default: Peer }) => {
            const peer = new Peer(user.uid, PEER_CONFIG);
            peerRef.current = peer;

            peer.on('open', async (id) => {
                const sessionRef = doc(firestore, 'liveSessions', user.uid);
                const sessionData: Partial<LiveSession> = {
                    id: user.uid,
                    sellerId: user.uid,
                    title: `${user.displayName || 'Seller'}'s Live Show`,
                    status: 'live',
                    startTime: new Date(),
                };
                
                // Create the call object to get the offer
                const call = peer.call(id, stream); // Call self to generate offer
                callRef.current = call;

                if (call && call.peerConnection) {
                    const offer = await call.peerConnection.createOffer();
                    await call.peerConnection.setLocalDescription(offer);
                    sessionData.offer = { type: offer.type, sdp: offer.sdp };
                }

                await setDoc(sessionRef, sessionData, { merge: true });
                setLiveSessionId(user.uid);
                setLiveStatus('LIVE');
                toast({ title: "🎉 You are LIVE!", description: "Your stream has started." });

                 onSnapshot(sessionRef, (snapshot) => {
                    const data = snapshot.data() as LiveSession;
                    if (data && data.answer && callRef.current && callRef.current.peerConnection.signalingState !== 'stable') {
                        callRef.current.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
                            .catch((e: any) => console.error("Error setting remote description:", e));
                    }
                });
            });

            peer.on('error', (err) => {
                console.error('PeerJS error:', err);
                setLiveStatus('ERROR');
            });
        });
    }, [user, firestore, toast]);
    
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

    const handleGoLive = async () => {
        const stream = await getCameraStream();
        if (stream) {
            initializePeer(stream);
        }
    };
    
    const handleEndLive = async () => {
        await cleanup();
    };

    useEffect(() => {
        // Ensure cleanup runs when the component unmounts or the user leaves the page
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
