
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { doc, setDoc, updateDoc, serverTimestamp, onSnapshot, deleteDoc } from 'firebase/firestore';

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
    const [peerId, setPeerId] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState('environment');
    const [isCameraReady, setIsCameraReady] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const cleanup = useCallback(async () => {
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (peerId && firestore) {
            const sessionRef = doc(firestore, 'liveSessions', peerId);
            try {
                // Attempt to set status to ended, or delete if it fails.
                await updateDoc(sessionRef, { status: 'ended', endTime: serverTimestamp() });
            } catch (e) {
                // If update fails (e.g. document doesn't exist), try to delete.
                await deleteDoc(sessionRef).catch(() => {});
            }
        }
        setLiveStatus('OFFLINE');
        setIsCameraReady(false);
        setPeerId(null);
    }, [peerId, firestore]);

    const initializePeer = useCallback((id: string, stream: MediaStream) => {
        if (typeof window === 'undefined') return;

        import('peerjs').then(({ default: Peer }) => {
            if (peerRef.current) {
                peerRef.current.destroy();
            }
            
            const newPeer = new Peer(id, PEER_CONFIG);
            peerRef.current = newPeer;

            newPeer.on('open', (openedId) => {
                setPeerId(openedId);
                setLiveStatus('READY');
                toast({ title: "Ready to Go Live", description: `Connected to live network.` });
            });
            
            newPeer.on('call', (call) => {
                call.answer(stream); 
            });

            newPeer.on('error', (err) => {
                console.error('PeerJS Error:', err);
                 setLiveStatus('ERROR');
                 toast({ variant: 'destructive', title: 'Connection Error', description: `Could not connect to live network: ${err.message}` });
            });
        });
    }, [toast]);
    
    const getCameraStream = useCallback(async (mode: 'user' | 'environment') => {
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
    }, [toast]);

    const startCameraAndPeer = useCallback(async () => {
        if (!user) return;
        setLiveStatus('CONNECTING');
        const stream = await getCameraStream(facingMode as 'user' | 'environment');
        if (stream) {
            initializePeer(user.uid, stream);
        }
    }, [user, facingMode, getCameraStream, initializePeer]);

    useEffect(() => {
        // This is the cleanup function that runs when the component unmounts.
        return () => {
            cleanup();
        };
    }, [cleanup]);

    const handleGoLive = async () => {
       if (!peerId || !firestore || !user || !localStreamRef.current) return;

       setLiveStatus('LIVE');
       const sessionRef = doc(firestore, 'liveSessions', peerId);

       await setDoc(sessionRef, {
           id: peerId,
           sellerId: user.uid,
           title: `${user.displayName || 'Seller'}'s Live Show`,
           status: 'live',
           startTime: serverTimestamp(),
           offer: null,
           answer: null,
       });

       const dummyCall = peerRef.current?.call(peerId, localStreamRef.current!);
       if (dummyCall) {
            const pc = dummyCall.peerConnection;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            await updateDoc(sessionRef, { offer: { type: offer.type, sdp: offer.sdp } });
            
            onSnapshot(sessionRef, (snapshot) => {
                const data = snapshot.data();
                if (data?.answer && pc.remoteDescription?.sdp !== data.answer.sdp) {
                    pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
            });
       }
    };

    const handleEndLive = async () => {
        await cleanup();
    };

    const copyToClipboard = (text: string, fieldName: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: `${fieldName} Copied!`, description: 'Ready to be shared.' });
        });
    };

    const toggleFacingMode = useCallback(async () => {
      const newMode = facingMode === 'user' ? 'environment' : 'user';
      setFacingMode(newMode);
      if (liveStatus !== 'OFFLINE') {
          const newStream = await getCameraStream(newMode as 'user' | 'environment');
          if (newStream && peerRef.current) {
              for (const conn of Object.values(peerRef.current.connections)) {
                  // @ts-ignore
                  const call = conn[0];
                  if (call) {
                     const sender = call.peerConnection.getSenders().find((s:any) => s.track.kind === 'video');
                     if(sender) sender.replaceTrack(newStream.getVideoTracks()[0]);
                  }
              }
          }
      }
    }, [facingMode, liveStatus, getCameraStream]);
    
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
