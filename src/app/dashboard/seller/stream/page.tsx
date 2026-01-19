
'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { getFirestore, collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, serverTimestamp, setDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { SellerLayout } from '@/components/layout/seller-layout';
import { StreamControls } from '@/components/studio/StreamControls';
import Recorder from '@/components/studio/Recorder';
import { useToast } from '@/hooks/use-toast';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { LiveActivityFeed } from '@/components/studio/LiveActivityFeed';
import { PinnedProduct } from '@/components/live/PinnedProduct';
import type { Product } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { Share2, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);
    const [shareLink, setShareLink] = useState('');
    const [viewerCount, setViewerCount] = useState(0);

    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

    const handleNewViewer = useCallback(async (viewerId: string) => {
        if (!liveSessionId || !firestore || !localStream || !user) return;

        const pc = new RTCPeerConnection(servers);
        peerConnectionsRef.current.set(viewerId, pc);

        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
        
        const signalingCol = collection(firestore, 'liveSessions', liveSessionId, 'signaling');
        const offerCandidates = collection(signalingCol);

        pc.onicecandidate = event => {
            if (event.candidate) {
                addDoc(offerCandidates, { ...event.candidate.toJSON(), from: user.uid, to: viewerId });
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await setDoc(doc(signalingCol, `offer-${viewerId}`), { 
            offer: { type: offer.type, sdp: offer.sdp },
            from: user.uid
        });

    }, [liveSessionId, firestore, localStream, user]);

    useEffect(() => {
        if (!liveSessionId || !firestore || !user) return;
        
        // Listen for new buyers
        const viewersRef = collection(firestore, 'liveSessions', liveSessionId, 'viewers');
        const unsubscribeViewers = onSnapshot(viewersRef, (snapshot) => {
            setViewerCount(snapshot.size);
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    handleNewViewer(change.doc.id);
                }
            });
        });

        // Listen for answers from buyers
        const signalingCol = collection(firestore, 'liveSessions', liveSessionId, 'signaling');
        const answersQuery = query(signalingCol, where('type', '==', 'answer'), where('to', '==', user.uid));
        const unsubscribeAnswers = onSnapshot(answersQuery, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    const pc = peerConnectionsRef.current.get(data.from);
                    if (pc && !pc.currentRemoteDescription) {
                        const answerDescription = new RTCSessionDescription(data.answer);
                        await pc.setRemoteDescription(answerDescription);
                    }
                }
            });
        });

        // Listen for ICE candidates from buyers
        const iceCandidatesQuery = query(signalingCol, where('type', '==', 'buyerCandidate'), where('to', '==', user.uid));
        const unsubscribeCandidates = onSnapshot(iceCandidatesQuery, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    const pc = peerConnectionsRef.current.get(data.from);
                    if (pc) {
                        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                    }
                }
            });
        });

        return () => {
            unsubscribeViewers();
            unsubscribeAnswers();
            unsubscribeCandidates();
        };

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
                id: sessionId,
                sellerId: user.uid,
                status: 'live',
                startTime: serverTimestamp(),
            }, { merge: true });

            setLiveSessionId(sessionId);
            setShareLink(`${window.location.origin}/buyer/live/${sessionId}`);
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
            pinnedProduct: null,
        });
        
        const signalingCol = collection(sessionRef, 'signaling');
        const docsSnapshot = await getDocs(signalingCol);
        const batch = writeBatch(firestore);
        docsSnapshot.forEach(docToDelete => batch.delete(docToDelete.ref));
        await batch.commit();

        setIsLive(false);
        setLiveSessionId(null);
        setShareLink('');
        setViewerCount(0);
        setPinnedProduct(null);
        toast({ title: 'Stream Ended' });
    };

    const handlePinProduct = async (product: Product) => {
        if (!liveSessionId) return;
        setPinnedProduct(product);
        const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
        await updateDoc(sessionRef, { pinnedProduct: product });
    };

    const handleUnpinProduct = async () => {
        if (!liveSessionId) return;
        setPinnedProduct(null);
        const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
        await updateDoc(sessionRef, { pinnedProduct: null });
    };

    const copyShareLink = () => {
        navigator.clipboard.writeText(shareLink).then(() => {
            toast({ title: "Link Copied!", description: "Share this link with your audience." });
        });
    };

    return (
        <SellerLayout>
            <div className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-4rem)] overflow-hidden">
                <div className="lg:col-span-3 flex flex-col gap-4">
                    <div className="flex-1 relative">
                        <Recorder stream={localStream} isLive={isLive} />
                        {isLive && (
                             <div className="absolute top-4 left-4 flex gap-2">
                                <Badge className="bg-red-600 hover:bg-red-700">LIVE</Badge>
                                <Badge variant="secondary" className="flex items-center gap-1.5"><Users className="h-3 w-3" />{viewerCount}</Badge>
                            </div>
                        )}
                         <div className="absolute bottom-4 left-4 z-20">
                            {pinnedProduct && <PinnedProduct product={pinnedProduct} />}
                         </div>
                    </div>
                     <StreamControls isLive={isLive} isStarting={isStarting} onGoLive={goLive} onEndLive={endLive} />
                </div>
                 <div className="flex flex-col gap-4">
                    {shareLink && (
                        <div className="bg-card p-3 rounded-lg border">
                            <Label className="text-xs font-semibold text-muted-foreground">Share Link</Label>
                            <div className="flex gap-2 items-center mt-1">
                                <Input value={shareLink} readOnly className="h-9 text-xs" />
                                <Button size="icon" variant="outline" className="h-9 w-9" onClick={copyShareLink}>
                                    <LinkIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                    <Card className="flex-1 flex flex-col">
                        <CardHeader><CardTitle className="text-lg">Product Bag</CardTitle></CardHeader>
                        <CardContent className="flex-1">
                            <LiveProductShelf sellerId={user?.uid || ''} onPinProduct={handlePinProduct} onUnpinProduct={handleUnpinProduct} />
                        </CardContent>
                    </Card>
                    <Card className="flex-1 flex flex-col">
                         <CardHeader><CardTitle className="text-lg">Live Activity</CardTitle></CardHeader>
                        <CardContent className="flex-1">
                             <LiveActivityFeed liveSessionId={liveSessionId} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </SellerLayout>
    );
}

    