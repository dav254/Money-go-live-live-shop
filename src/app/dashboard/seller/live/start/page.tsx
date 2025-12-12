'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collection, doc, addDoc, updateDoc, serverTimestamp, onSnapshot, setDoc, Unsubscribe, getDocs, query, writeBatch, deleteDoc } from 'firebase/firestore';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Loader2, Video, XCircle } from 'lucide-react';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { LiveActivityFeed, emitLocalEvent } from '@/components/studio/LiveActivityFeed';
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

export default function SellerLiveStudioPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const unsubscribeCallbacksRef = useRef<Unsubscribe[]>([]);
  const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);


  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Start the camera preview
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      toast({
          variant: 'destructive',
          title: 'Camera Error',
          description: 'Could not access your camera. Please check your browser permissions.'
      });
    }
  }, [toast]);

  // Cleanup function
  const cleanup = useCallback(async () => {
    unsubscribeCallbacksRef.current.forEach(cb => cb());
    unsubscribeCallbacksRef.current = [];
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    if (user && firestore) {
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      const offerCandidatesQuery = query(collection(sessionRef, 'offerCandidates'));
      const answerCandidatesQuery = query(collection(sessionRef, 'answerCandidates'));
      
      const [offerSnaps, answerSnaps] = await Promise.all([getDocs(offerCandidatesQuery), getDocs(answerCandidatesQuery)]);
      
      const batch = writeBatch(firestore);
      offerSnaps.forEach(doc => batch.delete(doc.ref));
      answerSnaps.forEach(doc => batch.delete(doc.ref));
      batch.update(sessionRef, { status: 'ended', endTime: serverTimestamp(), pinnedProduct: null });
      await batch.commit();
    }
    
    setIsLive(false);
    setIsConnecting(false);
  }, [firestore, user]);

  // Start the camera when the component mounts
  useEffect(() => {
    startCamera();
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      cleanup();
    };
  }, [startCamera, cleanup]);

  // Go Live function
  const handleGoLive = useCallback(async () => {
    if (!localStreamRef.current || !user || !firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Camera is not ready or user is not logged in.' });
      return;
    }
    setIsConnecting(true);
    emitLocalEvent({ type: 'deal', text: 'Stream is starting... Get ready!' });

    const peerConnection = new RTCPeerConnection(servers);
    pcRef.current = peerConnection;

    localStreamRef.current.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStreamRef.current!);
    });
    
    const sessionRef = doc(firestore, 'liveSessions', user.uid);
    const offerCandidatesRef = collection(sessionRef, 'offerCandidates');
    const answerCandidatesRef = collection(sessionRef, 'answerCandidates');

    // Collect and save ICE candidates
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        addDoc(offerCandidatesRef, { ...event.candidate.toJSON(), sellerId: user.uid });
      }
    };

    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);
    const offer = { sdp: offerDescription.sdp, type: offerDescription.type };
    
    // Set the initial session document with the offer
    await setDoc(sessionRef, { 
        offer, 
        sellerId: user.uid, 
        status: 'live', 
        startTime: serverTimestamp(),
        pinnedProduct: null,
    });

    // Listen for the buyer's answer
    const unsubSession = onSnapshot(sessionRef, (snapshot) => {
      const data = snapshot.data();
      if (pcRef.current && !pcRef.current.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pcRef.current.setRemoteDescription(answerDescription);
      }
    });

    // Listen for the buyer's ICE candidates
    const unsubAnswerCandidates = onSnapshot(answerCandidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && pcRef.current) {
          pcRef.current.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });
    
    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'connected') {
            setIsConnecting(false);
            setIsLive(true);
            toast({ title: "You are now LIVE!", description: "Your stream has started." });
            emitLocalEvent({ type: 'follow', text: 'A new viewer just joined!' });
        } else if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
            cleanup();
            toast({ variant: 'destructive', title: 'Connection Lost', description: 'The live stream connection was lost.' });
        }
    }

    unsubscribeCallbacksRef.current.push(unsubSession, unsubAnswerCandidates);
  }, [user, firestore, toast, cleanup]);

  // Stop Live function
  const handleEndLive = useCallback(() => {
    cleanup();
    toast({ title: "Stream Ended", description: "You are no longer live." });
    emitLocalEvent({ type: 'deal', text: 'Stream has ended. Thanks for watching!' });
  }, [cleanup, toast]);

  const handlePinProduct = async (product: Product) => {
    setPinnedProduct(product);
     if (user && firestore && isLive) {
        const sessionRef = doc(firestore, 'liveSessions', user.uid);
        await updateDoc(sessionRef, { pinnedProduct: product });
     }
     emitLocalEvent({type: 'purchase', text: `Featured product: ${product.name}`});
  };

  const handleUnpinProduct = async () => {
    setPinnedProduct(null);
    if (user && firestore && isLive) {
        const sessionRef = doc(firestore, 'liveSessions', user.uid);
        await updateDoc(sessionRef, { pinnedProduct: null });
     }
  };

  return (
    <SellerLayout>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-black text-white p-2 lg:p-4 gap-4">
        {/* Main Video Section */}
        <div className="flex-1 flex flex-col items-center gap-4 relative">
          <div className="relative w-full aspect-video lg:h-full bg-neutral-900 rounded-lg overflow-hidden">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {isLive && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-md text-sm font-semibold animate-pulse">
                      <div className="h-2 w-2 rounded-full bg-white"></div>
                      LIVE
                  </div>
              )}
               {pinnedProduct && (
                  <div className="absolute bottom-4 left-4 z-20">
                      <PinnedProduct product={pinnedProduct} />
                  </div>
              )}
          </div>
          <div className="w-full">
            {!isLive ? (
              <Button onClick={handleGoLive} disabled={isConnecting} className="w-full bg-red-600 hover:bg-red-700 h-12 text-lg font-bold">
                {isConnecting ? <Loader2 className="animate-spin mr-2"/> : <Video className="mr-2"/>}
                {isConnecting ? 'Connecting...' : 'Go Live'}
              </Button>
            ) : (
              <Button onClick={handleEndLive} className="w-full bg-gray-700 hover:bg-gray-600 h-12 text-lg font-bold">
                <XCircle className="mr-2"/>
                End Live
              </Button>
            )}
          </div>
        </div>

        {/* Side Panels */}
        <div className="w-full lg:w-[350px] flex flex-col gap-4">
            <div className="bg-neutral-800/50 p-4 rounded-lg flex-1 flex flex-col h-1/2">
                <h3 className="text-lg font-bold mb-3">Live Activity Feed</h3>
                <LiveActivityFeed liveSessionId={user?.uid || null} />
            </div>
             <div className="bg-neutral-800/50 p-4 rounded-lg flex-1 flex flex-col h-1/2">
                <h3 className="text-lg font-bold mb-3">Product Shelf</h3>
                <LiveProductShelf sellerId={user?.uid || ''} onPinProduct={handlePinProduct} onUnpinProduct={handleUnpinProduct} />
            </div>
        </div>
      </div>
    </SellerLayout>
  );
}
