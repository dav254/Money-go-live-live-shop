
'use client';

import React, { useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc, Unsubscribe, collection, addDoc, updateDoc } from 'firebase/firestore';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Loader2 } from 'lucide-react';

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

export default function BuyerLivePage({ params }: { params: { sellerId: string }}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const pc = useRef<RTCPeerConnection | null>(null);
    const firestore = useFirestore();
    const sellerId = params.sellerId;
    const [connecting, setConnecting] = React.useState(true);

    useEffect(() => {
        if (!firestore) return;

        const sessionRef = doc(firestore, 'liveSessions', sellerId);

        const connectToSeller = async (offer: any) => {
            // Check if peer connection is already established or connecting
            if (pc.current && pc.current.connectionState !== 'closed' && pc.current.connectionState !== 'failed') {
                return;
            }

            pc.current = new RTCPeerConnection(servers);

            pc.current.ontrack = event => {
                if (videoRef.current) {
                    videoRef.current.srcObject = event.streams[0];
                    setConnecting(false);
                }
            };
            
            pc.current.onconnectionstatechange = () => {
                if (pc.current?.connectionState === 'connected') {
                    setConnecting(false);
                }
                 if (pc.current?.connectionState === 'failed' || pc.current?.connectionState === 'disconnected') {
                    setConnecting(false);
                }
            };

            const answerCandidatesRef = collection(firestore, 'liveSessions', sellerId, 'answers');
            pc.current.onicecandidate = event => {
                if (event.candidate) {
                    addDoc(answerCandidatesRef, event.candidate.toJSON());
                }
            };

            await pc.current.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);

            await updateDoc(sessionRef, { answer });
            
            // Listen for seller's ICE candidates after setting up the connection
            const offerCandidatesRef = collection(firestore, 'liveSessions', sellerId, 'offers');
            onSnapshot(offerCandidatesRef, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        pc.current?.addIceCandidate(candidate);
                    }
                });
            });
        };

        const unsub = onSnapshot(doc(firestore, "liveSessions", sellerId), (snap) => {
            if (!snap.exists()) {
                setConnecting(false);
                return;
            }
            const data = snap.data();

            if (data.isLive && data.offer) {
                connectToSeller(data.offer);
            } else {
                 setConnecting(false);
            }
        });

        return () => {
            unsub();
            if (pc.current) {
                pc.current.close();
            }
        };
    }, [firestore, sellerId]);

    return (
        <BuyerLayout>
            <div className="p-4 bg-black min-h-screen text-white">
                <h1 className="text-xl font-bold mb-4">Watching Live</h1>
                 <div className="relative aspect-video w-full bg-neutral-900 rounded-lg flex items-center justify-center">
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
                </div>
            </div>
        </BuyerLayout>
    );
}
