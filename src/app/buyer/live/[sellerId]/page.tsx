
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc, Unsubscribe, collection, addDoc, updateDoc } from 'firebase/firestore';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';

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
    const [connecting, setConnecting] = React.useState(true);

    useEffect(() => {
        if (!firestore || !sellerId) return;

        const sessionRef = doc(firestore, 'liveSessions', sellerId);

        const connectToSeller = async (offer: any) => {
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
                if (pcRef.current?.connectionState === 'connected') {
                    setConnecting(false);
                }
                 if (pcRef.current?.connectionState === 'failed' || pcRef.current?.connectionState === 'disconnected') {
                    setConnecting(false);
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
        };

        const unsub = onSnapshot(doc(firestore, "liveSessions", sellerId), (snap) => {
            if (!snap.exists()) {
                setConnecting(false);
                return;
            }
            const data = snap.data();

            if (data.status === 'live' && data.offer) {
                connectToSeller(data.offer);
            } else {
                 setConnecting(false);
            }
        });

        return () => {
            unsub();
            if (pcRef.current) {
                pcRef.current.close();
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
