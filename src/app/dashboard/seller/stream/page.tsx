
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestore, collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, serverTimestamp, setDoc, getDocs, query, where } from 'firebase/firestore';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Radio, StopCircle, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Recorder } from '@/components/studio/Recorder';
import { StreamControls } from '@/components/studio/StreamControls';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import type { Product } from '@/lib/types';


const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export default function SellerStreamPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isLive, setIsLive] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
    const [viewerCount, setViewerCount] = useState(0);

    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

    // --- Viewer Count Listener ---
    useEffect(() => {
        if (!liveSessionId || !firestore) return;
        const viewersColRef = collection(firestore, 'liveSessions', liveSessionId, 'viewers');
        const unsubscribe = onSnapshot(viewersColRef, (snapshot) => {
            setViewerCount(snapshot.size);
        });
        return () => unsubscribe();
    }, [liveSessionId, firestore]);

    // --- WebRTC Handler for new viewers ---
    const handleNewViewer = useCallback(async (viewerId: string, offer: RTCSessionDescriptionInit) => {
        if (!liveSessionId || !firestore || !localStreamRef.current) return;
        console.log(`[Seller] Received offer from new viewer: ${viewerId}`);

        const pc = new RTCPeerConnection(servers);
        peerConnectionsRef.current.set(viewerId, pc);

        localStreamRef.current.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current!);
        });

        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                const candidatesCol = collection(firestore, 'liveSessions', liveSessionId, 'offerCandidates');
                await addDoc(candidatesCol, { ...event.candidate.toJSON(), viewerId });
            }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const answerRef = doc(firestore, 'liveSessions', liveSessionId, 'answers', viewerId);
        await setDoc(answerRef, { answer });

        const answerCandidatesQuery = query(collection(firestore, 'liveSessions', liveSessionId, 'answerCandidates'), where('viewerId', '==', viewerId));
        onSnapshot(answerCandidatesQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                }
            });
        });

    }, [liveSessionId, firestore]);

    // --- Signaling Listener (for new offers from viewers) ---
    useEffect(() => {
        if (!liveSessionId || !firestore) return;
        const offersColRef = collection(firestore, 'liveSessions', liveSessionId, 'offers');
        const unsubscribe = onSnapshot(query(offersColRef), (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const offerData = change.doc.data();
                    const viewerId = change.doc.id;
                    handleNewViewer(viewerId, offerData.offer);
                }
            });
        });
        return () => unsubscribe();
    }, [liveSessionId, firestore, handleNewViewer]);


    // --- Go Live ---
    const goLive = async () => {
        if (!user || !firestore) return;
        setIsStarting(true);
        toast({ title: 'Starting your live stream...' });

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: true,
            });
            localStreamRef.current = stream;

            const videoEl = document.querySelector('video');
            if(videoEl) videoEl.srcObject = stream;
            
            const sessionRef = doc(firestore, 'liveSessions', user.uid);
            await setDoc(sessionRef, {
                sellerId: user.uid,
                title: `${user.displayName || 'Seller'}'s Live Show`,
                status: 'live',
                startTime: serverTimestamp(),
                viewerCount: 0,
            });

            setLiveSessionId(user.uid);
            setIsLive(true);
            toast({ title: 'You are now LIVE!', variant: 'default' });

        } catch (error) {
            console.error('Error starting live stream:', error);
            toast({ variant: 'destructive', title: 'Could not start stream', description: 'Please check camera/mic permissions.' });
        } finally {
            setIsStarting(false);
        }
    };

    // --- End Live ---
    const endLive = async () => {
        if (!liveSessionId || !firestore) return;

        localStreamRef.current?.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;

        peerConnectionsRef.current.forEach(pc => pc.close());
        peerConnectionsRef.current.clear();
        
        const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
        await updateDoc(sessionRef, {
            status: 'ended',
            endTime: serverTimestamp(),
        });
        
        const subcollections = ['offers', 'answers', 'offerCandidates', 'answerCandidates', 'viewers', 'chat', 'events'];
        for (const sub of subcollections) {
            const subcollectionRef = collection(sessionRef, sub);
            const docsSnapshot = await getDocs(subcollectionRef);
            docsSnapshot.forEach(doc => deleteDoc(doc.ref));
        }

        setIsLive(false);
        setLiveSessionId(null);
        setViewerCount(0);
        toast({ title: 'Stream Ended' });
    };


    return (
        <SellerLayout>
            <div className="flex-1 p-4 lg:p-6 flex flex-col lg:grid lg:grid-cols-4 lg:grid-rows-1 gap-4 h-[calc(100vh-4rem)] overflow-hidden">
                {/* Main Content: Video */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                    <div className="relative flex-1">
                        <Recorder isLive={isLive} />
                    </div>
                    <div className="hidden lg:block">
                        <StreamControls isLive={isLive} isStarting={isStarting} onGoLive={goLive} onEndLive={endLive} />
                    </div>
                </div>

                {/* Right Sidebar: Controls, Chat, Products */}
                <div className="flex flex-col gap-4 h-full">
                    {/* Viewer Count */}
                    <Card>
                        <CardHeader className="p-4 flex-row items-center justify-between">
                            <CardTitle className="text-base">Live Viewers</CardTitle>
                            <div className="flex items-center gap-2 font-bold text-lg">
                                <Users className="h-5 w-5 text-primary" />
                                {viewerCount}
                            </div>
                        </CardHeader>
                    </Card>

                    {/* Product Bag */}
                    <Card className="flex-1 flex flex-col">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base">Product Bag</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 flex-1">
                             <LiveProductShelf sellerId={user?.uid || ''} onPinProduct={() => {}} onUnpinProduct={() => {}} />
                        </CardContent>
                    </Card>

                    {/* Mobile Controls */}
                    <div className="lg:hidden">
                        <StreamControls isLive={isLive} isStarting={isStarting} onGoLive={goLive} onEndLive={endLive} />
                    </div>
                </div>
            </div>
        </SellerLayout>
    );
}
