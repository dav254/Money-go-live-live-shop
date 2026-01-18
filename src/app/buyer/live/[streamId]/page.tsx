
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, onSnapshot, collection, addDoc, getDocs, deleteDoc, serverTimestamp, setDoc, query, where, DocumentReference } from 'firebase/firestore';
import type { LiveSession, Product } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { RadioTower, AlertCircle, Loader2, ArrowLeft, VideoOff } from 'lucide-react';
import { PinnedProduct } from '@/components/live/PinnedProduct';
import { LiveChat } from '@/components/buyer/LiveChat';
import { LiveProductCard } from '@/components/buyer/LiveProductCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

// WebRTC Configuration
const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function BuyerLiveViewPage() {
    const params = useParams();
    const router = useRouter();
    const streamId = params.streamId as string;
    const firestore = useFirestore();
    const { user } = useUser();
    
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);

    const liveSessionRef = useMemoFirebase(() => {
        if (!streamId) return null;
        return doc(firestore, 'liveSessions', streamId);
    }, [firestore, streamId]);
    
    const { data: liveSession, isLoading: isSessionLoading } = useDoc<LiveSession>(liveSessionRef);
    
    // Correctly derive pinnedProductId AFTER fetching liveSession
    const pinnedProductId = (liveSession as any)?.pinnedProductId;

    // Correctly create the ref for the pinned product
    const pinnedProductRef = useMemoFirebase(() => {
        if (!pinnedProductId) return null;
        return doc(firestore, 'products', pinnedProductId);
    }, [firestore, pinnedProductId]);

    // Now call useDoc at the top level
    const { data: pinnedProductData } = useDoc<Product>(pinnedProductRef);

     useEffect(() => {
        setPinnedProduct(pinnedProductData);
    }, [pinnedProductData]);

    const setupPeerConnection = useCallback(async () => {
        if (!firestore || !user || !streamId || peerConnectionRef.current) return;
        setIsLoading(true);

        const pc = new RTCPeerConnection(servers);
        peerConnectionRef.current = pc;
        
        pc.ontrack = event => {
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        const sessionRef = doc(firestore, 'liveSessions', streamId);
        const offerCandidates = collection(sessionRef, 'offerCandidates');
        const answerCandidates = collection(sessionRef, 'answerCandidates');
        
        pc.onicecandidate = async event => {
            if (event.candidate) {
                await addDoc(answerCandidates, { ...event.candidate.toJSON(), viewerId: user.uid });
            }
        };
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const offerRef = doc(sessionRef, 'offers', user.uid);
        await setDoc(offerRef, { offer });
        
        const answerRef = doc(sessionRef, 'answers', user.uid);
        const unsubAnswer = onSnapshot(answerRef, async (answerDoc) => {
            if (answerDoc.exists() && pc.signalingState !== 'stable') {
                const answerDescription = new RTCSessionDescription(answerDoc.data().answer);
                await pc.setRemoteDescription(answerDescription);
            }
        });
        
        const unsubIce = onSnapshot(query(offerCandidates, where('viewerId', '==', user.uid)), (iceSnapshot) => {
            iceSnapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    if (pc.remoteDescription) {
                        await pc.addIceCandidate(candidate);
                    }
                }
            });
        });
        
        setIsLoading(false);
        
        return () => { unsubAnswer(); unsubIce(); }

    }, [firestore, user, streamId]);

    useEffect(() => {
        if (!isSessionLoading && liveSession?.status === 'live') {
            setupPeerConnection();
        } else if (!isSessionLoading && liveSession?.status !== 'live') {
            setError('This stream is not live.');
            setIsLoading(false);
        }

        return () => {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
        };
    }, [isSessionLoading, liveSession, setupPeerConnection]);

    if (isSessionLoading) {
        return (
            <BuyerLayout fullWidth>
                <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-black text-white">
                    <p>Connecting to live stream...</p>
                </div>
            </BuyerLayout>
        );
    }
    
    if (error || liveSession?.status !== 'live') {
        return (
             <BuyerLayout>
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <Alert variant="destructive">
                        <RadioTower className="h-4 w-4" />
                        <AlertTitle>Stream Offline</AlertTitle>
                        <AlertDescription>
                          {error || 'This live stream has ended or is not currently active.'}
                        </AlertDescription>
                    </Alert>
                    <Button onClick={() => router.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Live Streams
                    </Button>
                </div>
            </BuyerLayout>
        )
    }

    return (
        <BuyerLayout fullWidth>
            <div className="grid grid-cols-1 lg:grid-cols-4 h-[calc(100vh-4rem)] bg-black">
                {/* Main Live View */}
                <div className="lg:col-span-3 h-full flex items-center justify-center relative bg-black">
                    <video ref={remoteVideoRef} className="w-full h-full object-contain" autoPlay playsInline />
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
                            <div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /><p className="mt-2">Connecting...</p></div>
                        </div>
                    )}
                    {pinnedProduct && (
                        <div className="absolute bottom-4 left-4 z-20">
                            <PinnedProduct product={pinnedProduct} />
                        </div>
                    )}
                </div>

                {/* Chat Section */}
                <div className="lg:col-span-1 h-full">
                    <LiveChat streamId={streamId} />
                </div>
            </div>
        </BuyerLayout>
    )
}
