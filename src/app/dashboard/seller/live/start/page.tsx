
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collection, doc, addDoc, updateDoc, serverTimestamp, onSnapshot, setDoc, Unsubscribe } from 'firebase/firestore';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Loader2, Video, XCircle } from 'lucide-react';

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

  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);

  // Function to start the camera preview
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
  const cleanup = useCallback(() => {
    unsubscribeCallbacksRef.current.forEach(cb => cb());
    unsubscribeCallbacksRef.current = [];
    if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
    }
    if (liveSessionId && firestore) {
        const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
        updateDoc(sessionRef, { status: 'ended', endTime: serverTimestamp() }).catch(console.error);
    }
    setIsLive(false);
    setIsConnecting(false);
    setLiveSessionId(null);
  }, [firestore, liveSessionId]);

  // Start the camera when the component mounts
  useEffect(() => {
    startCamera();
    // Cleanup on unmount
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

    const peerConnection = new RTCPeerConnection(servers);
    pcRef.current = peerConnection;

    // Attach stream tracks
    localStreamRef.current.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStreamRef.current!);
    });

    const sessionRef = doc(collection(firestore, 'liveSessions'));
    const offerCandidatesRef = collection(sessionRef, 'offerCandidates');
    const answerCandidatesRef = collection(sessionRef, 'answerCandidates');
    setLiveSessionId(sessionRef.id);

    // Save ICE candidates
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        addDoc(offerCandidatesRef, event.candidate.toJSON());
      }
    };

    // Create and save offer
    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);
    const offer = { sdp: offerDescription.sdp, type: offerDescription.type };
    await setDoc(sessionRef, { offer, sellerId: user.uid, status: 'live', startTime: serverTimestamp() });

    // Listen for the buyer's answer
    const unsubSession = onSnapshot(sessionRef, (snapshot) => {
      const data = snapshot.data();
      if (!peerConnection.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        peerConnection.setRemoteDescription(answerDescription);
        setIsConnecting(false);
        setIsLive(true);
        toast({ title: "You are now LIVE!", description: "Your stream has started." });
      }
    });

    // Listen for buyer's ICE candidates
    const unsubAnswerCandidates = onSnapshot(answerCandidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.addIceCandidate(candidate);
        }
      });
    });

    unsubscribeCallbacksRef.current.push(unsubSession, unsubAnswerCandidates);
  }, [user, firestore, toast]);

  // Stop Live function
  const handleEndLive = useCallback(() => {
    cleanup();
    toast({ title: "Stream Ended", description: "You are no longer live." });
  }, [cleanup, toast]);

  return (
    <SellerLayout>
      <div className="p-6 space-y-4 text-white bg-black min-h-screen">
        <h1 className="text-2xl font-bold">Seller Live Studio</h1>
        <video ref={videoRef} autoPlay muted playsInline className="rounded-lg w-full bg-neutral-900 aspect-video" />
        {!isLive ? (
          <Button onClick={handleGoLive} disabled={isConnecting} className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-xl text-center text-lg font-bold">
            {isConnecting ? <Loader2 className="animate-spin mr-2"/> : <Video className="mr-2"/>}
            {isConnecting ? 'Connecting...' : 'Go Live'}
          </Button>
        ) : (
          <Button onClick={handleEndLive} className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-xl text-center text-lg font-bold">
            <XCircle className="mr-2"/>
            Stop Live
          </Button>
        )}
      </div>
    </SellerLayout>
  );
}
