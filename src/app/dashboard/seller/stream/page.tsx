'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestore, collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, serverTimestamp, setDoc, getDocs, query, where } from 'firebase/firestore';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Radio, StopCircle, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Recorder from '@/components/studio/Recorder';
import { StreamControls } from '@/components/studio/StreamControls';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { PinnedProduct } from '@/components/live/PinnedProduct';
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
    const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);

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
        if (!liveSessionId || !firestore || !localStream || !user) return;
        console.log(`[Seller] Received offer from new viewer: ${viewerId}`);

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

            // Listen for buyer ICE candidates for this specific peer connection
            const buyerCandidatesQuery = query(signalingCol, where('type', '==', 'buyerCandidate'), where('from', '==', viewerId));
            const unsubIce = onSnapshot(buyerCandidatesQuery, (snapshot) => {
                snapshot.docChanges().forEach(async (change) => {
                    if (change.type === 'added') {
                        const candidate = new RTCIceCandidate(change.doc.data().candidate);
                        await pc.addIceCandidate(candidate);
                    }
                });
            });
            // You might want to manage unsubscribe functions for each peer connection
        } catch (error) {
            console.error("Error handling offer:", error);
        }

    }, [liveSessionId, firestore, localStream, user]);

    // --- Signaling Listener (for new buyers joining) ---
    useEffect(() => {
        if (!liveSessionId || !firestore || !user) return;
        
        const signalingCol = collection(firestore, 'liveSessions', liveSessionId, 'signaling');
        // This query needs to be specific to offers meant for this seller.
        // Assuming offers from buyers are directly added with a predictable format or a 'to' field.
        const offersQuery = query(signalingCol, where('type', '==', 'offer'), where('to', '==', user.uid));

        const unsubscribe = onSnapshot(offersQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    // Ensure we don't re-process an offer. A 'processed' flag could be useful.
                    handleNewViewer(data.from, data.offer);
                }
            });
        });
        return () => unsubscribe();
    }, [liveSessionId, firestore, handleNewViewer, user]);


    // --- Go Live ---
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

            const sessionId = user.uid; // Use user ID for a predictable session ID
            const sessionRef = doc(firestore, 'liveSessions', sessionId);

            await setDoc(sessionRef, {
                sellerId: user.uid,
                title: `${user.displayName || 'Seller'}'s Live Show`,
                status: 'live',
                startTime: serverTimestamp(),
                pinnedProductId: null,
            }, { merge: true });

            setLiveSessionId(sessionId);
            setIsLive(true);
            toast({ title: 'You are now LIVE!', variant: 'default' });

        } catch (error) {
            console.error('Error starting live stream:', error);
            toast({ variant: 'destructive', title: 'Could not start stream', description: 'Please check camera/mic permissions and try again.' });
            setLocalStream(null);
        } finally {
            setIsStarting(false);
        }
    };

    // --- End Live ---
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
        
        // Clean up subcollections
        const subcollections = ['signaling', 'viewers'];
        for (const sub of subcollections) {
            const subcollectionRef = collection(sessionRef, sub);
            const docsSnapshot = await getDocs(subcollectionRef);
            docsSnapshot.forEach(docToDelete => deleteDoc(docToDelete.ref));
        }

        setIsLive(false);
        setLiveSessionId(null);
        setViewerCount(0);
        setPinnedProduct(null);
        toast({ title: 'Stream Ended' });
    };
    
     const handlePinProduct = (product: Product) => {
        setPinnedProduct(product);
        if (firestore && liveSessionId) {
            updateDoc(doc(firestore, 'liveSessions', liveSessionId), {
                pinnedProductId: product.id,
            });
        }
    };

    const handleUnpinProduct = () => {
        setPinnedProduct(null);
         if (firestore && liveSessionId) {
            updateDoc(doc(firestore, 'liveSessions', liveSessionId), {
                pinnedProductId: null,
            });
        }
    };

    return (
        <SellerLayout>
            <div className="flex-1 p-4 lg:p-6 flex flex-col lg:grid lg:grid-cols-4 gap-4 h-[calc(100vh-4rem)] overflow-hidden">
                {/* Main Content: Video and controls */}
                <div className="lg:col-span-3 flex flex-col gap-4 h-full">
                    <div className="relative flex-1">
                        <Recorder stream={localStream} isLive={isLive} />
                        {isLive && (
                            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm p-2 rounded-lg flex items-center gap-2 text-white font-semibold">
                                <Users className="h-5 w-5 text-primary" />
                                <span>{viewerCount}</span>
                            </div>
                        )}
                         {pinnedProduct && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                                <PinnedProduct product={pinnedProduct} />
                            </div>
                        )}
                    </div>
                     <div className="hidden lg:block">
                        <StreamControls isLive={isLive} isStarting={isStarting} onGoLive={goLive} onEndLive={endLive} />
                    </div>
                </div>

                {/* Right Sidebar: Products and Chat */}
                 <div className="flex flex-col gap-4 overflow-hidden h-full">
                    {user && (
                        <div className="bg-card p-4 rounded-lg flex-1 flex flex-col min-h-0">
                            <h3 className="text-lg font-bold mb-3">Product Bag</h3>
                            <LiveProductShelf sellerId={user.uid} onPinProduct={handlePinProduct} onUnpinProduct={handleUnpinProduct} />
                        </div>
                    )}
                     {/* Mobile Stream Controls */}
                    <div className="lg:hidden">
                        <StreamControls isLive={isLive} isStarting={isStarting} onGoLive={goLive} onEndLive={endLive} />
                    </div>
                </div>
            </div>
        </SellerLayout>
    );
}
