'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, onSnapshot, collection, addDoc, setDoc, deleteDoc, serverTimestamp, query, where, getDocs, updateDoc } from 'firebase/firestore';
import type { LiveSession, Product } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { RadioTower, Loader2, ArrowLeft, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PinnedProduct } from '@/components/live/PinnedProduct';

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

    const liveSessionRef = useMemoFirebase(() => doc(firestore, 'liveSessions', streamId), [firestore, streamId]);
    const { data: liveSession, isLoading: isSessionLoading } = useDoc<LiveSession>(liveSessionRef);
    
    const pinnedProductId = liveSession?.pinnedProductId;
    const pinnedProductRef = useMemoFirebase(() => pinnedProductId ? doc(firestore, 'products', pinnedProductId) : null, [firestore, pinnedProductId]);
    const { data: pinnedProduct } = useDoc<Product>(pinnedProductRef);


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

        const signalingCol = collection(firestore, 'liveSessions', streamId, 'signaling');

        pc.onicecandidate = event => {
            event.candidate && addDoc(signalingCol, { type: 'buyerCandidate', from: user.uid, candidate: event.candidate.toJSON() });
        };
        
        // Add viewer document
        await setDoc(doc(firestore, 'liveSessions', streamId, 'viewers', user.uid), { joinedAt: serverTimestamp() });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        // Send offer TO the seller
        await addDoc(signalingCol, { type: 'offer', from: user.uid, to: streamId, offer: { type: offer.type, sdp: offer.sdp } });
        
        // Listen for answer from seller
        const answerDocRef = doc(signalingCol, `answer-${user.uid}`);
        const unsubAnswer = onSnapshot(answerDocRef, async (snapshot) => {
            const data = snapshot.data();
            if (data && !pc.currentRemoteDescription) {
                const answerDescription = new RTCSessionDescription(data.answer);
                await pc.setRemoteDescription(answerDescription);
            }
        });
        
        // Listen for seller ICE candidates
        const sellerCandidatesQuery = query(signalingCol, where('type', '==', 'sellerCandidate'), where('to', '==', user.uid));
        const unsubIce = onSnapshot(sellerCandidatesQuery, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data().candidate);
                    await pc.addIceCandidate(candidate);
                }
            });
        });

        setIsLoading(false);
        return () => { unsubAnswer(); unsubIce(); }

    }, [firestore, user, streamId]);

    useEffect(() => {
        let cleanup: (() => void) | undefined;
        if (!isSessionLoading && liveSession?.status === 'live' && user) {
            setupPeerConnection().then(c => { cleanup = c; });
        } else if (!isSessionLoading && liveSession?.status !== 'live') {
            setError('This stream is not live.');
            setIsLoading(false);
        }

        return () => {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
            if(user && firestore && streamId){
                 deleteDoc(doc(firestore, 'liveSessions', streamId, 'viewers', user.uid));
            }
            if (cleanup) cleanup();
        };
    }, [isSessionLoading, liveSession, setupPeerConnection, user, firestore, streamId]);

    if (isSessionLoading) {
        return (
            <BuyerLayout>
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
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                </div>
            </BuyerLayout>
        )
    }

    return (
        <BuyerLayout>
            <div className="flex h-full w-full bg-black">
                {/* Main Live View */}
                <div className="flex-1 h-full flex items-center justify-center relative bg-black">
                    <video ref={remoteVideoRef} className="w-full h-full object-contain" autoPlay playsInline />
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
                            <div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /><p className="mt-2">Connecting...</p></div>
                        </div>
                    )}
                     {pinnedProduct && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                            <PinnedProduct product={pinnedProduct} />
                        </div>
                    )}
                </div>
            </div>
        </BuyerLayout>
    )
}
