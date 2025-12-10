
'use client';

import { BuyerLayout } from "@/components/layout/buyer-layout";
import { LiveProductCard } from "@/components/buyer/LiveProductCard";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect, useRef } from "react";
import type { Product, ChatMessage, LiveSession, Order } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from "next/image";
import { Video } from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase, useUser, errorEmitter } from '@/firebase';
import { doc, collection, query, where, onSnapshot, setDoc, serverTimestamp, updateDoc, addDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { FirestorePermissionError } from "@/firebase/errors";
import { PrivateChat } from "@/components/messages/private-chat";

interface Heart {
  id: number;
  x: number;
  y: number;
}

interface Banner {
  id: number;
  text: string;
  type: 'deal' | 'giveaway';
}

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};


export default function SellerRoom() {
  const params = useParams();
  const sellerId = params.sellerId as string;
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);

  const [hearts, setHearts] = useState<Heart[]>([]);
  const heartsRef = useRef<Heart[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);

  const liveSessionQuery = useMemoFirebase(() => {
    if (!firestore || !sellerId) return null;
    return query(collection(firestore, 'liveSessions'), where('sellerId', '==', sellerId), where('status', '==', 'live'));
  }, [firestore, sellerId]);

  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Set up the WebRTC connection
  useEffect(() => {
    if (!liveSession?.offer || pc) return;

    const peerConnection = new RTCPeerConnection(servers);
    setPc(peerConnection);

    peerConnection.ontrack = event => {
        if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
        }
    };

    const answerCandidatesRef = collection(firestore, 'liveSessions', liveSession.id, 'answerCandidates');
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            addDoc(answerCandidatesRef, event.candidate.toJSON());
        }
    };

    const offerDescription = new RTCSessionDescription(liveSession.offer);
    peerConnection.setRemoteDescription(offerDescription)
        .then(async () => {
            const answerDescription = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answerDescription);

            const answer = {
                type: answerDescription.type,
                sdp: answerDescription.sdp,
            };

            const sessionRef = doc(firestore, 'liveSessions', liveSession.id);
            await updateDoc(sessionRef, { answer });
        });
    
    // Listen for seller's ICE candidates
    const offerCandidatesRef = collection(firestore, 'liveSessions', liveSession.id, 'offerCandidates');
    onSnapshot(offerCandidatesRef, snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                peerConnection.addIceCandidate(candidate);
            }
        });
    });

  }, [liveSession, firestore, pc]);


  useEffect(() => {
    if (!liveSessionQuery) return;
    const unsub = onSnapshot(liveSessionQuery, (snapshot) => {
      if (!snapshot.empty) {
        const sessionData = snapshot.docs[0].data() as LiveSession;
        setLiveSession({ id: snapshot.docs[0].id, ...sessionData });
      } else {
        setLiveSession(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching live session:", error);
      setIsLoading(false);
    });
    return () => unsub();
  }, [liveSessionQuery]);
  

  const pinnedProductRef = useMemoFirebase(() => {
    if (!firestore || !liveSession?.pinnedProductId) return null;
    return doc(firestore, 'products', liveSession.pinnedProductId);
  }, [firestore, liveSession?.pinnedProductId]);

  const { data: pinnedProduct } = useDoc<Product>(pinnedProductRef);

  const spawnHeart = () => {
    const x = Math.random() * window.innerWidth * 0.8 + window.innerWidth * 0.1;
    const y = window.innerHeight * 0.8;
    const id = Date.now();
    const heart = { id, x, y };
    heartsRef.current = [...heartsRef.current, heart];
    setHearts(heartsRef.current);

    setTimeout(() => {
      heartsRef.current = heartsRef.current.filter(h => h.id !== id);
      setHearts(heartsRef.current);
    }, 2000);
  };
  
  const showBanner = (text: string, type: 'deal' | 'giveaway') => {
      const id = Date.now();
      setBanner({ id, text, type });
      setTimeout(() => {
          setBanner(prev => (prev?.id === id ? null : prev));
      }, 5000);
  };

  const sellerName = liveSession?.title?.replace("'s Live Show", "") || 'Seller';

  if (isLoading) {
      return (
          <BuyerLayout>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-8rem)]">
                    <div className="md:col-span-2 h-full"><Skeleton className="h-full w-full" /></div>
                    <div className="h-full"><Skeleton className="h-full w-full" /></div>
               </div>
          </BuyerLayout>
      )
  }
  
  if (!liveSession) {
      return (
        <BuyerLayout>
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
                <p className="text-muted-foreground">This seller is not currently live.</p>
            </div>
        </BuyerLayout>
      )
  }

  return (
    <BuyerLayout>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-8rem)]">
        
            <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
                {hearts.map(h => (
                <span key={h.id} style={{ left: h.x - 16, top: h.y - 40 }} className="absolute animate-pop text-2xl">❤️</span>
                ))}
            </div>
            {banner && (
            <div
                key={banner.id}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 animate-in fade-in zoom-in-95"
            >
                <div className={`text-2xl md:text-4xl font-extrabold p-4 rounded-lg text-center shadow-2xl ${banner.type === 'deal' ? 'bg-yellow-400 text-black' : 'bg-pink-500 text-white'}`}>
                {banner.text}
                </div>
            </div>
            )}

            <div className="md:col-span-2 relative h-full bg-neutral-900 flex items-center justify-center border-b border-neutral-800 rounded-lg overflow-hidden">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20" />
                {pinnedProduct && (
                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm p-2 rounded-lg border border-primary/50">
                        <LiveProductCard product={pinnedProduct} onAddToCart={() => {}} />
                    </div>
                )}
            </div>

            <div className="h-full flex flex-col">
                <PrivateChat sellerName={sellerName} />
            </div>
        </div>
    </BuyerLayout>
  );
}
