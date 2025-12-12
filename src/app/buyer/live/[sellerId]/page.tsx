
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { doc, onSnapshot, updateDoc, Unsubscribe, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { LiveChat } from '@/components/buyer/LiveChat';
import { LiveProductCard } from '@/components/buyer/LiveProductCard';
import { PinnedProduct } from '@/components/live/PinnedProduct';
import type { Product } from '@/lib/types';


// WebRTC STUN servers configuration
const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

export default function BuyerLivePage() {
    const params = useParams();
    const sellerId = params.sellerId as string;
    const videoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const firestore = useFirestore();
    const [connecting, setConnecting] = useState(true);
    const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);
    const [productsInStream, setProductsInStream] = useState<Product[]>([]);
    
    // Memoize the connectToSeller function to prevent it from being recreated on every render
    const connectToSeller = useCallback(async (offer: any) => {
        if (pcRef.current) {
            return;
        }
        pcRef.current = new RTCPeerConnection(servers);

        pcRef.current.ontrack = event => {
            if (videoRef.current) {
                videoRef.current.srcObject = event.streams[0];
                setConnecting(false);
            }
        };

        pcRef.current.onconnectionstatechange = () => {
            const state = pcRef.current?.connectionState;
            if (state === 'connected') {
                setConnecting(false);
            } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                setConnecting(false);
                pcRef.current = null; // Reset ref on failure
            }
        };

        const answerCandidatesRef = collection(firestore, 'liveSessions', sellerId, 'answerCandidates');
        pcRef.current.onicecandidate = event => {
            if (event.candidate) {
                addDoc(answerCandidatesRef, event.candidate.toJSON());
            }
        };

        await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);

        const sessionRef = doc(firestore, 'liveSessions', sellerId);
        await updateDoc(sessionRef, { answer });

        const offerCandidatesRef = collection(firestore, 'liveSessions', sellerId, 'offerCandidates');
        onSnapshot(offerCandidatesRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    pcRef.current?.addIceCandidate(candidate);
                }
            });
        });
    }, [firestore, sellerId]);


    useEffect(() => {
        if (!firestore || !sellerId) return;

        let unsub: Unsubscribe;
        
        try {
            const sessionRef = doc(firestore, "liveSessions", sellerId);
            unsub = onSnapshot(sessionRef, (snap) => {
                if (!snap.exists() || snap.data().status === 'ended') {
                    setConnecting(false);
                    return;
                }
                const data = snap.data();
                setPinnedProduct(data.pinnedProduct || null);
                if (data.status === 'live' && data.offer) {
                    connectToSeller(data.offer);
                } else {
                    setConnecting(false);
                }
            });
            
            // Fetch products for the product shelf
            const productsQuery = query(collection(firestore, 'products'), where('sellerId', '==', sellerId));
            getDocs(productsQuery).then(snapshot => {
                setProductsInStream(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Product));
            });

        } catch(e) {
            console.error(e)
        }

        return () => {
            if (unsub) unsub();
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
            }
        };
    }, [firestore, sellerId, connectToSeller]);

    return (
        <BuyerLayout>
            <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-black text-white">
                 <div className="flex-1 relative overflow-y-auto">
                    <div className="relative aspect-video w-full bg-neutral-900 flex items-center justify-center">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
                        {connecting && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="animate-spin h-8 w-8" />
                                <p>Connecting to live stream...</p>
                            </div>
                        )}
                        {!connecting && !videoRef.current?.srcObject && (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                <p>Stream has ended or is not available.</p>
                            </div>
                        )}
                        {pinnedProduct && (
                            <div className="absolute bottom-4 left-4 z-20">
                                <PinnedProduct product={pinnedProduct} />
                            </div>
                        )}
                    </div>
                     <div className="p-4 space-y-2">
                        <h3 className="font-semibold text-sm">Products in this stream</h3>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {productsInStream.map(p => <LiveProductCard key={p.id} product={p} />)}
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-80 h-1/3 lg:h-full">
                    <LiveChat liveSessionId={sellerId} />
                </div>
            </div>
        </BuyerLayout>
    );
}
