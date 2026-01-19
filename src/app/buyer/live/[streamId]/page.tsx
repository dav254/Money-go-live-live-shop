'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, onSnapshot, collection, addDoc, setDoc, deleteDoc, serverTimestamp, query, where, writeBatch } from 'firebase/firestore';
import type { LiveSession, Product } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { RadioTower, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

    const sessionRef = useMemoFirebase(() => doc(firestore, 'liveSessions', streamId), [firestore, streamId]);
    const { data: liveSession, isLoading: isSessionLoading } = useDoc<LiveSession>(sessionRef);

    // Correct WebRTC signaling flow
    const setupPeerConnection = useCallback(async () => {
        if (!firestore || !user || !streamId || peerConnectionRef.current) return;
        setIsLoading(true);
        setError(null);

        const pc = new RTCPeerConnection(servers);
        peerConnectionRef.current = pc;
        
        pc.ontrack = event => {
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        const signalingCol = collection(firestore, 'liveSessions', streamId, 'signaling');

        // Add user to viewers subcollection
        const viewerRef = doc(firestore, 'liveSessions', streamId, 'viewers', user.uid);
        await setDoc(viewerRef, { joinedAt: serverTimestamp() });
        
        // Listen for offers from seller
        const offerQuery = query(signalingCol, where('type', '==', 'offer'), where('to', '==', user.uid));
        const unsubscribeOffer = onSnapshot(offerQuery, async (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const { offer, from } = change.doc.data();
                    if (offer && pc.signalingState !== "stable") {
                        await pc.setRemoteDescription(new RTCSessionDescription(offer));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);

                        await addDoc(signalingCol, { 
                            type: 'answer', 
                            answer: { type: answer.type, sdp: answer.sdp },
                            from: user.uid,
                            to: from
                        });
                    }
                }
            });
        });

        // Listen for ICE candidates from seller
        const iceQuery = query(signalingCol, where('type', '==', 'sellerCandidate'), where('to', '==', user.uid));
        const unsubscribeIce = onSnapshot(iceQuery, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    await pc.addIceCandidate(new RTCIceCandidate(change.doc.data().candidate));
                }
            });
        });
        
        setIsLoading(false);

        return () => {
            unsubscribeOffer();
            unsubscribeIce();
        };

    }, [firestore, user, streamId]);
    
    useEffect(() => {
        let cleanup: (() => void) | undefined;
        if (!isSessionLoading && liveSession?.status === 'live' && user) {
            setupPeerConnection().then(c => { cleanup = c; });
        } else if (!isSessionLoading && (!liveSession || liveSession.status !== 'live')) {
            setError('This stream is not live or has ended.');
            setIsLoading(false);
        }

        return () => {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
            if (firestore && user) {
                const viewerRef = doc(firestore, 'liveSessions', streamId, 'viewers', user.uid);
                deleteDoc(viewerRef);
            }
            if (cleanup) cleanup();
        };
    }, [isSessionLoading, liveSession, setupPeerConnection, user, firestore, streamId]);


    if (isLoading || isSessionLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-black text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-3">Connecting to live stream...</p>
            </div>
        );
    }
    
    if (error) {
        return (
             <div className="flex h-screen flex-col items-center justify-center p-8 bg-background">
                <Alert variant="destructive" className="max-w-md">
                    <RadioTower className="h-4 w-4" />
                    <AlertTitle>Stream Offline</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button onClick={() => router.push('/buyer/live-stream')} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Live Streams
                </Button>
            </div>
        )
    }

    return (
        <div className="h-screen w-screen bg-black flex items-center justify-center">
            <video ref={remoteVideoRef} className="w-full h-full object-contain" autoPlay playsInline />
        </div>
    )
}
