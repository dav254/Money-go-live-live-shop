
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { getFirestore, collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, serverTimestamp, setDoc, getDocs, query, where } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';
import { SellerLayout } from '@/components/layout/seller-layout';
import { StreamControls } from '@/components/studio/StreamControls';
import Recorder from '@/components/studio/Recorder';
import { useToast } from '@/hooks/use-toast';

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
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);

    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

    const handleNewViewer = useCallback(async (viewerId: string, offer: RTCSessionDescriptionInit) => {
        if (!liveSessionId || !firestore || !localStream || !user) return;

        const pc = new RTCPeerConnection(servers);
        peerConnectionsRef.current.set(viewerId, pc);

        localStream.getTracks().forEach(track => {
            if (localStream) {
                 pc.addTrack(track, localStream);
            }
        });

        const signalingCol = collection(firestore, 'liveSessions', liveSessionId, 'signaling');
        
        pc.onicecandidate = event => {
            event.candidate && addDoc(signalingCol, { type: 'sellerCandidate', to: viewerId, candidate: event.candidate.toJSON() });
        };

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answerDescription = await pc.createAnswer();
            await pc.setLocalDescription(answerDescription);

            const answer = {
                type: answerDescription.type,
                sdp: answerDescription.sdp,
            };

            await setDoc(doc(signalingCol, `answer-${viewerId}`), { answer });

        } catch (error) {
            console.error("Error handling offer:", error);
        }

    }, [liveSessionId, firestore, localStream, user]);

    useEffect(() => {
        if (!liveSessionId || !firestore || !user) return;
        
        const signalingCol = collection(firestore, 'liveSessions', liveSessionId, 'signaling');
        const offersQuery = query(signalingCol, where('type', '==', 'offer'), where('to', '==', user.uid));

        const unsubscribe = onSnapshot(offersQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    handleNewViewer(data.from, data.offer);
                }
            });
        });
        return () => unsubscribe();
    }, [liveSessionId, firestore, handleNewViewer, user]);

    const goLive = async () => {
        if (!user || !firestore) return;
        setIsStarting(true);
        toast({ title: 'Requesting camera access...' });

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: true,
            });
            setLocalStream(stream);
            
            toast({ title: 'Starting your live stream...' });

            const sessionId = user.uid;
            const sessionRef = doc(firestore, 'liveSessions', sessionId);

            await setDoc(sessionRef, {
                sellerId: user.uid,
                status: 'live',
                startTime: serverTimestamp(),
            }, { merge: true });

            setLiveSessionId(sessionId);
            setIsLive(true);

            toast({ title: 'You are now LIVE!' });

        } catch (error) {
            console.error('Error starting live stream:', error);
            toast({ variant: 'destructive', title: 'Could not start stream', description: 'Please check camera/mic permissions and try again.' });
            setLocalStream(null);
        } finally {
            setIsStarting(false);
        }
    };

    const endLive = async () => {
        if (!liveSessionId || !firestore) return;

        localStream?.getTracks().forEach(track => track.stop());
        setLocalStream(null);

        peerConnectionsRef.current.forEach(pc => pc.close());
        peerConnectionsRef.current.clear();
        
        const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
        await updateDoc(sessionRef, {
            status: 'ended',
            endTime: serverTimestamp(),
        });
        
        const signalingCol = collection(sessionRef, 'signaling');
        const docsSnapshot = await getDocs(signalingCol);
        docsSnapshot.forEach(docToDelete => deleteDoc(docToDelete.ref));

        setIsLive(false);
        setLiveSessionId(null);
        toast({ title: 'Stream Ended' });
    };

    return (
        <SellerLayout>
            <div className="flex-1 p-4 lg:p-6 flex flex-col gap-4 h-[calc(100vh-4rem)] overflow-hidden">
                <div className="flex-1 relative">
                    <Recorder stream={localStream} isLive={isLive} />
                </div>
                <StreamControls isLive={isLive} isStarting={isStarting} onGoLive={goLive} onEndLive={endLive} />
            </div>
        </SellerLayout>
    );
}
