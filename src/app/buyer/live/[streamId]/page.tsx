
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, onSnapshot, collection, addDoc, setDoc, query, where } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { RadioTower, Loader2, ArrowLeft, VideoOff } from 'lucide-react';
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

    const liveSessionRef = useMemoFirebase(() => {
        if (!streamId) return null;
        return doc(firestore, 'liveSessions', streamId);
    }, [firestore, streamId]);
    
    const { data: liveSession, isLoading: isSessionLoading } = useDoc<LiveSession>(liveSessionRef);
    
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

        const offerDocRef = doc(sessionRef, 'offers', streamId);
        
        const unsubOffer = onSnapshot(offerDocRef, async (snapshot) => {
            if (snapshot.exists()) {
                const offerDescription = new RTCSessionDescription(snapshot.data().offer);
                if (pc.signalingState !== 'stable') {
                    await pc.setRemoteDescription(offerDescription);
                    const answerDescription = await pc.createAnswer();
                    await pc.setLocalDescription(answerDescription);

                    const answer = { answer: { type: answerDescription.type, sdp: answerDescription.sdp }, viewerId: user.uid };
                    const answerDocRef = doc(sessionRef, 'answers', user.uid);
                    await setDoc(answerDocRef, answer);
                }
            }
        });
        
        const unsubIce = onSnapshot(query(offerCandidates), (iceSnapshot) => {
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
        
        return () => { unsubOffer(); unsubIce(); }

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
            <div className="flex h-[calc(100vh-4rem)] bg-black">
                {/* Main Live View */}
                <div className="flex-1 h-full flex items-center justify-center relative bg-black">
                    <video ref={remoteVideoRef} className="w-full h-full object-contain" autoPlay playsInline />
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
                            <div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /><p className="mt-2">Connecting...</p></div>
                        </div>
                    )}
                </div>
            </div>
        </BuyerLayout>
    )
}
