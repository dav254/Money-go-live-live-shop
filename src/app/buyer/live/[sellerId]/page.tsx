
'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, collection, addDoc, Unsubscribe, query, where, limit, getDocs } from 'firebase/firestore';
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

export default function BuyerLivePage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const firestore = useFirestore();
    const params = useParams();
    const sellerId = params.sellerId as string;
    const [connecting, setConnecting] = React.useState(true);
    const unsubscribeCallbacksRef = useRef<Unsubscribe[]>([]);

    const cleanup = useCallback(() => {
        unsubscribeCallbacksRef.current.forEach(cb => cb());
        unsubscribeCallbacksRef.current = [];
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!sellerId || !firestore) return;

        const connectToSeller = async (sessionDoc: any) => {
            const liveSession = { id: sessionDoc.id, ...sessionDoc.data() };
            
            pcRef.current = new RTCPeerConnection(servers);
            
            // Set up track event to display remote video
            pcRef.current.ontrack = event => {
                if (videoRef.current) {
                    videoRef.current.srcObject = event.streams[0];
                    setConnecting(false);
                }
            };
            
            // Save buyer's ICE candidates to Firestore
            pcRef.current.onicecandidate = async event => {
                if (event.candidate) {
                    const answerCandidatesRef = collection(db, 'liveSessions', liveSession.id, 'answerCandidates');
                    await addDoc(answerCandidatesRef, event.candidate.toJSON());
                }
            };
            
            // Set seller's offer and create an answer
            if (liveSession.offer) {
                await pcRef.current.setRemoteDescription(new RTCSessionDescription(liveSession.offer));
                
                const answer = await pcRef.current.createAnswer();
                await pcRef.current.setLocalDescription(answer);
                
                const sessionRef = doc(db, 'liveSessions', liveSession.id);
                await updateDoc(sessionRef, { answer: { type: answer.type, sdp: answer.sdp } });
            }

            // Listen for seller's ICE candidates
            const offerCandidatesRef = collection(db, 'liveSessions', liveSession.id, 'offerCandidates');
            const unsubCandidates = onSnapshot(offerCandidatesRef, (snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        pcRef.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                    }
                });
            });
            unsubscribeCallbacksRef.current.push(unsubCandidates);
        };
        
        const q = query(
            collection(firestore, "liveSessions"),
            where("sellerId", "==", sellerId),
            where("status", "==", "live"),
            limit(1)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const sessionDoc = snapshot.docs[0];
                connectToSeller(sessionDoc);
            } else {
                setConnecting(false); // No live session found
            }
        });
        
        unsubscribeCallbacksRef.current.push(unsub);

        return () => cleanup();

    }, [sellerId, firestore, cleanup]);

    return (
        <BuyerLayout>
            <div className="p-4 bg-black min-h-screen text-white">
                <h1 className="text-xl font-bold mb-4">Watching {sellerId}</h1>
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

// Minimal db import for use in this specific component logic based on user's sample
const db = getFirestore();
const { updateDoc } = require("firebase/firestore");
