
'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { FlipHorizontal, Loader2, Camera, Video, Settings, Mic, MicOff, CameraOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collection, doc, addDoc, updateDoc, serverTimestamp, query, where, onSnapshot, getDocs, writeBatch, setDoc, Unsubscribe } from 'firebase/firestore';
import { SellerLayout } from '@/components/layout/seller-layout';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { emitLocalEvent } from '@/components/studio/LiveActivityFeed';
import { Product } from '@/lib/types';
import { LiveShoppingEventFeed } from '@/components/live/live-shopping-event-feed';

// WebRTC STUN servers configuration
const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

export default function SellerLiveStudioPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const unsubscribeCallbacksRef = useRef<(() => void)[]>([]);

  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  
  const cleanup = useCallback(() => {
      console.log("Cleaning up WebRTC connections...");
      unsubscribeCallbacksRef.current.forEach(cb => cb());
      unsubscribeCallbacksRef.current = [];
      if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
      }
  }, []);

  const startCamera = useCallback(async (facingMode: 'user' | 'environment' = 'user') => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
        localStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(console.error);
        }
        setHasCameraPermission(true);
        setIsCameraOn(true);
        return stream;
    } catch(err) {
        console.error("Camera error", err);
        setHasCameraPermission(false);
        setIsCameraOn(false);
        return null;
    }
  }, []);

  const handleStartCamera = async () => {
    await startCamera();
  };

  const handleStopCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  };

  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    const currentTrack = localStreamRef.current.getVideoTracks()[0];
    if (!currentTrack) return;
    const currentFacingMode = currentTrack.getSettings().facingMode;
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    await startCamera(newFacingMode);
  }, [startCamera]);

  const toggleMute = () => {
      if(localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(track => {
              track.enabled = !track.enabled;
              setIsMuted(!track.enabled);
          });
      }
  }

  const handleGoLive = async () => {
    if (!firestore || !user || !localStreamRef.current) {
        toast({ variant: 'destructive', title: 'Error', description: 'Camera is not active. Please start your camera first.' });
        return;
    }

    setIsConnecting(true);
    cleanup();

    // End any previous stale live sessions for this user
    try {
        const q = query(collection(firestore, 'liveSessions'), where('sellerId', '==', user.uid), where('status', '==', 'live'));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const batch = writeBatch(firestore);
          snapshot.forEach(doc => {
              batch.update(doc.ref, { status: 'ended', endTime: serverTimestamp() });
          });
          await batch.commit();
          console.log("Ended stale live sessions.");
        }
    } catch (error) {
        console.error("Error ending stale live sessions:", error);
    }

    const peerConnection = new RTCPeerConnection(servers);
    pcRef.current = peerConnection;

    localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
    });

    const sessionRef = doc(collection(firestore, 'liveSessions'));
    const offerCandidatesRef = collection(sessionRef, 'offerCandidates');
    const answerCandidatesRef = collection(sessionRef, 'answerCandidates');

    peerConnection.onicecandidate = event => {
        if (event.candidate) addDoc(offerCandidatesRef, event.candidate.toJSON());
    };

    try {
        const offerDescription = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offerDescription);

        const offer = { sdp: offerDescription.sdp, type: offerDescription.type };

        await setDoc(sessionRef, {
            id: sessionRef.id,
            sellerId: user.uid,
            title: `${user.displayName || 'Seller'}'s Live Show`,
            status: 'live',
            startTime: serverTimestamp(),
            offer,
        });
        
        const sessionUnsubscribe = onSnapshot(sessionRef, (snapshot) => {
            const data = snapshot.data();
            if (pcRef.current && !pcRef.current.currentRemoteDescription && data?.answer) {
                console.log("Received answer from buyer.");
                const answerDescription = new RTCSessionDescription(data.answer);
                pcRef.current.setRemoteDescription(answerDescription).catch(e => console.error('Error setting remote desc:', e));
            }
        });

        const answerCandidatesUnsubscribe = onSnapshot(answerCandidatesRef, snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added' && pcRef.current?.signalingState !== 'closed') {
                    console.log("Received ICE candidate from buyer.");
                    pcRef.current.addIceCandidate(new RTCIceCandidate(change.doc.data()))
                        .catch(e => console.error('Error adding received ice candidate', e));
                }
            });
        });
        
        unsubscribeCallbacksRef.current.push(sessionUnsubscribe, answerCandidatesUnsubscribe);
        
        setLiveSessionId(sessionRef.id);
        setIsLive(true);
        toast({ title: "You are now live!", description: "Buyers can join your stream." });

    } catch (error) {
        console.error("Error starting live stream:", error);
        toast({ variant: 'destructive', title: 'Stream Start Failed', description: 'Could not establish connection. Please try again.' });
        cleanup();
    } finally {
        setIsConnecting(false);
    }
  };
  
  const handleEndLive = async () => {
    if (liveSessionId && firestore) {
        try {
            await updateDoc(doc(firestore, 'liveSessions', liveSessionId), { status: 'ended', endTime: serverTimestamp() });
        } catch(e) { console.error("Error ending live session doc:", e) }
    }
    cleanup();
    setIsLive(false);
    setLiveSessionId(null);
    toast({ title: "Stream Ended" });
  };

  useEffect(() => {
    return () => {
      cleanup();
      if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [cleanup]);

  const handlePinProduct = async (product: Product) => {
      if (!liveSessionId || !firestore) return;
      const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
      await updateDoc(sessionRef, { pinnedProductId: product.id });
      emitLocalEvent({ type: 'deal', text: `Seller pinned ${product.name}!` });
  };
  
  const handleUnpinProduct = async () => {
      if (!liveSessionId || !firestore) return;
      const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
      await updateDoc(sessionRef, { pinnedProductId: null });
  }
  
  return (
    <SellerLayout>
        <div className="p-4 max-w-full mx-auto h-[calc(100vh-4rem)] flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex flex-col items-center gap-4">
                <div className="relative bg-black rounded-lg border border-border overflow-hidden aspect-video w-full flex items-center justify-center">
                    {!isCameraOn ? (
                        <div className="flex flex-col items-center gap-4">
                            {!hasCameraPermission && (
                                <Alert variant="destructive" className="max-w-sm"><AlertTitle>Camera Access Denied</AlertTitle><AlertDescription>Please allow camera access in your browser settings to continue.</AlertDescription></Alert>
                            )}
                            <Button onClick={handleStartCamera} size="lg"><Camera className="mr-2 h-5 w-5"/>Start Camera</Button>
                        </div>
                    ) : (
                        <>
                           <video id="studio-preview" ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                           {isLive && (
                                <div className="absolute top-3 left-3 px-2 py-1 rounded text-xs font-semibold bg-red-600 animate-pulse flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-white"></div>LIVE
                                </div>
                            )}
                            <div className="absolute top-3 right-3 flex gap-2">
                                <Button variant="ghost" size="icon" className="bg-black/50" onClick={switchCamera}><FlipHorizontal size={18}/></Button>
                                <Button variant="ghost" size="icon" className="bg-black/50" onClick={toggleMute}>
                                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                                </Button>
                                <Button variant="ghost" size="icon" className="bg-black/50" onClick={handleStopCamera}><CameraOff size={18} /></Button>
                            </div>
                        </>
                    )}
                </div>

                <Card className="bg-card/50 w-full">
                    <CardContent className="p-3 flex flex-wrap items-center justify-center gap-4">
                        {!isLive ? (
                        <Button onClick={handleGoLive} className="bg-red-600 hover:bg-red-700 font-bold px-8 py-6 text-lg" disabled={!isCameraOn || isConnecting}>
                            {isConnecting && <Loader2 className="mr-2 h-6 w-6 animate-spin" />}Go Live
                        </Button>
                        ) : (
                        <Button onClick={handleEndLive} variant="destructive" className="px-8 py-6 text-lg">End Live</Button>
                        )}
                        <Button variant="outline"><Settings className="mr-2"/>Stream Settings</Button>
                    </CardContent>
                </Card>
            </div>
             <div className="w-full lg:w-1/3 flex flex-col gap-4 h-full">
                <Card className="flex-1 flex flex-col">
                    <CardHeader><CardTitle>Live Activity Feed</CardTitle></CardHeader>
                    <CardContent className="flex-1 overflow-hidden"><LiveShoppingEventFeed liveSessionId={liveSessionId} /></CardContent>
                </Card>
                <Card className="flex-1 flex flex-col">
                    <CardHeader><CardTitle>Product Shelf</CardTitle></CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                        {user && <LiveProductShelf sellerId={user.uid} onPinProduct={handlePinProduct} onUnpinProduct={handleUnpinProduct} />}
                    </CardContent>
                </Card>
            </div>
        </div>
    </SellerLayout>
  );
}
