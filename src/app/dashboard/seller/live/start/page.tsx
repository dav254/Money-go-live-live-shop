
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, RadioTower, Loader2, WifiOff, AlertTriangle, FlipHorizontal, Video, CameraOff, Camera } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Peer } from 'peerjs';
import { doc, setDoc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';

// Define the PeerJS configuration with STUN and TURN servers
const PEER_CONFIG = {
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            {
                urls: 'turn:numb.viagenie.ca',
                username: 'webrtc@live.com',
                credential: 'muazkh'
            }
        ]
    }
};

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

    const initializePeer = (id: string, stream: MediaStream) => {
        if (typeof window === 'undefined') return;

        import('peerjs').then(({ default: Peer }) => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }
            
            // Use the PEER_CONFIG when initializing the Peer object
            const newPeer = new Peer(id, PEER_CONFIG);
            peerRef.current = newPeer;

            newPeer.on('open', (openedId) => {
                setPeerId(openedId);
                setLiveStatus('READY');
                toast({ title: "Ready to Go Live", description: `Connected to live network with ID: ${openedId}` });
            });
            
            newPeer.on('call', (call) => {
                call.answer(stream);
            });

            newPeer.on('error', (err) => {
                console.error('PeerJS Error:', err);
                if (err.type === 'unavailable-id') {
                    const tempId = `${user!.uid}-${Math.random().toString(36).substring(2, 8)}`;
                    toast({ variant: 'destructive', title: 'Live ID Taken', description: `Using temporary ID: ${tempId}` });
                    initializePeer(tempId, stream);
                } else {
                     setLiveStatus('ERROR');
                     toast({ variant: 'destructive', title: 'Connection Error', description: `Could not connect to live network: ${err.message}` });
                }
            });
        });
    };
    
    const getCameraStream = async (mode: 'user' | 'environment') => {
        try {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: true });
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
    }

    const startCameraAndPeer = async () => {
        if (!user) return;
        setLiveStatus('CONNECTING');
        const stream = await getCameraStream(facingMode as 'user' | 'environment');
        if (stream) {
            initializePeer(user.uid, stream);
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
       if (!peerId || !firestore) return;

       const sessionRef = doc(firestore, 'liveSessions', peerId);
       setLiveSessionId(peerId);

       await setDoc(sessionRef, {
           id: peerId,
           sellerId: user!.uid,
           title: `${user!.displayName || 'Seller'}'s Live Show`,
           status: 'live',
           startTime: serverTimestamp(),
           productIds: [],
           viewerCount: 0,
       });

       setLiveStatus('LIVE');
    };

    const handleEndLive = async () => {
        if (!liveSessionId) return;

        const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
        await updateDoc(sessionRef, { status: 'ended', endTime: serverTimestamp() });

        setLiveStatus('OFFLINE');
        setLiveSessionId(null);
        setPeerId(null);
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        setIsCameraReady(false);
    };

    const copyToClipboard = (text: string, fieldName: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: `${fieldName} Copied!`, description: 'Ready to be shared.' });
        });
    };

    const toggleFacingMode = async () => {
      const newMode = facingMode === 'user' ? 'environment' : 'user';
      setFacingMode(newMode);
      if (liveStatus !== 'OFFLINE') {
          await getCameraStream(newMode as 'user' | 'environment');
      }
    };
    
    const StatusCard = () => {
        switch (liveStatus) {
            case 'OFFLINE': return <CardDescription>Start your camera to get ready.</CardDescription>;
            case 'CONNECTING': return <div className="flex items-center gap-2 text-yellow-500"><Loader2 className="animate-spin h-4 w-4" />Connecting to live network...</div>;
            case 'READY': return <div className="flex items-center gap-2 text-green-500"><RadioTower className="h-4 w-4" />Ready to Go Live</div>;
            case 'LIVE': return <div className="flex items-center gap-2 text-red-500 animate-pulse"><RadioTower className="h-4 w-4" />LIVE</div>;
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
                            <CardDescription><StatusCard /></CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="aspect-video w-full bg-black rounded-lg relative overflow-hidden">
                                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                                 {!isCameraReady && liveStatus !== 'OFFLINE' && (
                                     <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                         <Loader2 className="h-8 w-8 animate-spin" />
                                     </div>
                                 )}
                                 <div className="absolute top-3 right-3">
                                     <Button size="icon" variant="secondary" onClick={toggleFacingMode}><FlipHorizontal size={18} /></Button>
                                 </div>
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
                                    <Button onClick={startCameraAndPeer} className="w-full"><Camera className="mr-2 h-4 w-4" />Start Camera & Connect</Button>
                                )}
                                {liveStatus === 'READY' && (
                                    <Button onClick={handleGoLive} variant="destructive" className="w-full"><RadioTower className="mr-2 h-4 w-4" />Go Live Now</Button>
                                )}
                                {liveStatus === 'LIVE' && (
                                    <Button onClick={handleEndLive} className="w-full"><CameraOff className="mr-2 h-4 w-4" />End Live Stream</Button>
                                )}
                                 {liveStatus === 'ERROR' && (
                                    <Button onClick={startCameraAndPeer} variant="secondary" className="w-full">Retry Connection</Button>
                                )}
                                
                                {peerId && (
                                     <div className="space-y-2">
                                        <Label htmlFor="stream-id">Your Live ID</Label>
                                        <div className="flex gap-2">
                                            <Input id="stream-id" value={peerId} readOnly />
                                            <Button variant="outline" size="icon" onClick={() => copyToClipboard(peerId, 'Live ID')}><Copy className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                )}
                             </CardContent>
                        </Card>

                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Heads up!</AlertTitle>
                          <AlertDescription>
                            This is a direct peer-to-peer stream. It works best for a small number of viewers. For large audiences, a dedicated streaming service is recommended.
                          </AlertDescription>
                        </Alert>
                    </div>
                </div>
            </div>
        </SellerLayout>
    );
};

export default SellerLivePage;
