
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, RadioTower, Loader2, WifiOff, AlertTriangle, FlipHorizontal, Video, CameraOff } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Peer from 'peerjs';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const SellerLivePage = () => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [liveStatus, setLiveStatus] = useState<'OFFLINE' | 'CONNECTING' | 'READY' | 'LIVE' | 'ERROR'>('OFFLINE');
    const [peerId, setPeerId] = useState<string | null>(null);
    const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState('environment');
    const [isCameraReady, setIsCameraReady] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const initializePeer = (id: string) => {
        if (typeof window === 'undefined') return;

        if (peerRef.current) {
            peerRef.current.destroy();
        }

        const newPeer = new Peer(id);
        peerRef.current = newPeer;

        newPeer.on('open', (openedId) => {
            setPeerId(openedId);
            setLiveStatus('READY');
        });
        
        newPeer.on('call', (call) => {
            if (localStreamRef.current) {
                call.answer(localStreamRef.current);
            }
        });

        newPeer.on('error', (err) => {
            console.error('PeerJS Error:', err);
            if (err.type === 'unavailable-id') {
                const tempId = `${user!.uid}-${Math.random().toString(36).substring(2, 8)}`;
                toast({ variant: 'destructive', title: 'Live ID Taken', description: `Your primary ID is in use. Using a temporary ID: ${tempId}` });
                initializePeer(tempId);
            } else {
                 setLiveStatus('ERROR');
            }
        });
    };
    
    const getCameraStream = async (mode: 'user' | 'environment') => {
         try {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: mode,
                },
                audio: true,
            });
            
            localStreamRef.current = mediaStream;
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setIsCameraReady(true);
            return mediaStream;
        } catch (err) {
            console.error("Failed to get local stream", err);
            setLiveStatus('ERROR');
            setIsCameraReady(false);
            toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access your camera or microphone. Please check browser permissions.' });
            return null;
        }
    }

    const startCameraAndPeer = async () => {
        if (!user) return;
        setLiveStatus('CONNECTING');
        const stream = await getCameraStream(facingMode as 'user' | 'environment');
        if (stream) {
            initializePeer(user.uid);
        }
    };

    useEffect(() => {
        return () => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (liveSessionId) {
                const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
                updateDoc(sessionRef, { status: 'ended', endTime: serverTimestamp() });
            }
        };
    }, [liveSessionId, firestore]);

    const handleGoLive = async () => {
        if (!firestore || !user || !peerId) return;

        const newLiveSessionId = peerId;
        const sessionRef = doc(firestore, 'liveSessions', newLiveSessionId);

        try {
            await setDoc(sessionRef, {
                id: newLiveSessionId,
                sellerId: user.uid,
                status: 'live',
                startTime: serverTimestamp(),
                title: `${user.displayName || 'Seller'}'s Live Show`,
                viewerCount: 0,
            });
            setLiveSessionId(newLiveSessionId);
            setLiveStatus('LIVE');
            toast({ title: "You're Live!", description: "Your stream is now visible to buyers." });
        } catch (error) {
            console.error("Failed to go live:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not start the live session." });
        }
    };

    const handleEndLive = async () => {
        if (!firestore || !liveSessionId) return;
        const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
        try {
            await updateDoc(sessionRef, { status: 'ended', endTime: serverTimestamp() });
            setLiveStatus('READY');
            setLiveSessionId(null);
            toast({ title: 'Stream Ended' });
        } catch (error) {
            console.error("Failed to end live session:", error);
        }
    };

    const copyToClipboard = (text: string, fieldName: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: `${fieldName} Copied!` });
        });
    };

    const toggleFacingMode = () => {
      setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };
    
    const StatusCard = () => {
        let title, description, icon;
        switch (liveStatus) {
            case 'LIVE':
                title = "You are Live!";
                description = "Your stream is broadcasting. Share your Live ID with buyers.";
                icon = <RadioTower className="h-6 w-6 text-green-500 animate-pulse" />;
                break;
            case 'READY':
                title = "Ready to Go Live";
                description = "Your camera is on and you are connected. Click 'Go Live' to start.";
                icon = <RadioTower className="h-6 w-6 text-yellow-500" />;
                break;
            case 'CONNECTING':
                title = "Connecting...";
                description = "Starting camera and connecting to the live network.";
                icon = <Loader2 className="h-6 w-6 text-yellow-500 animate-spin" />;
                break;
            case 'ERROR':
            default:
                title = "Connection Failed";
                description = "Could not connect. Please check your network and camera permissions, then refresh the page.";
                icon = <WifiOff className="h-6 w-6 text-red-500" />;
                break;
        }

        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        {icon}
                        {title}
                    </CardTitle>
                    <CardDescription>
                        {description}
                    </CardDescription>
                </CardHeader>
                {(liveStatus === 'LIVE' || liveStatus === 'READY') && peerId && (
                     <CardContent className="space-y-2">
                        <Label>Your Live ID</Label>
                        <div className="flex items-center gap-2">
                            <Input value={peerId} readOnly className="font-mono bg-muted" />
                            <Button size="icon" variant="secondary" onClick={() => copyToClipboard(peerId, 'Live ID')}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                )}
            </Card>
        )
    }

    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Live Stream Studio</h1>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card className="overflow-hidden">
                           <div className="aspect-video w-full bg-black relative flex items-center justify-center">
                                <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover transition-opacity ${isCameraReady ? 'opacity-100' : 'opacity-0'}`} />
                                {!isCameraReady && liveStatus !== 'CONNECTING' && (
                                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                                        <CameraOff className="h-12 w-12 text-muted-foreground mb-4" />
                                        <p>Your camera is off</p>
                                        <Button onClick={startCameraAndPeer} className="mt-4">Start Camera</Button>
                                    </div>
                                )}
                                {liveStatus === 'CONNECTING' && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                        <p>Starting camera...</p>
                                    </div>
                                )}
                             {isCameraReady && (
                                <div className="absolute top-4 right-4">
                                    <Button onClick={toggleFacingMode} size="icon" variant="secondary" className="rounded-full bg-black/50 hover:bg-black/70">
                                        <FlipHorizontal size={20} />
                                    </Button>
                                </div>
                             )}
                           </div>
                        </Card>
                    </div>
                    <div className="space-y-4">
                        <StatusCard />
                        <div className="flex flex-col gap-2">
                            {liveStatus === 'READY' && (
                                <Button onClick={handleGoLive} size="lg" className="font-bold text-base">Go Live</Button>
                            )}
                            {liveStatus === 'LIVE' && (
                                <Button onClick={handleEndLive} size="lg" variant="destructive" className="font-bold text-base">End Live</Button>
                            )}
                        </div>
                         <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Important</AlertTitle>
                            <AlertDescription>
                                Your stream is public. Anyone with your Live ID can watch. Do not share private information.
                            </AlertDescription>
                        </Alert>
                    </div>
                </div>

            </div>
        </SellerLayout>
    );
};

export default SellerLivePage;
