
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collection, doc, addDoc, updateDoc, serverTimestamp, onSnapshot, setDoc, Unsubscribe, getDocs, query, writeBatch } from 'firebase/firestore';
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
      batch.update(sessionRef, { status: 'ended', endTime: serverTimestamp() });
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

    const peerConnection = new RTCPeerConnection(servers);
    pcRef.current = peerConnection;

    localStreamRef.current.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStreamRef.current!);
    });
    
    // **FIX**: Use seller's UID as the document ID for the session
    const sessionRef = doc(firestore, 'liveSessions', user.uid);
    const offerCandidatesRef = collection(sessionRef, 'offerCandidates');
    const answerCandidatesRef = collection(sessionRef, 'answerCandidates');

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        addDoc(offerCandidatesRef, { ...event.candidate.toJSON(), sellerId: user.uid });
      }
    };

    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);
    const offer = { sdp: offerDescription.sdp, type: offerDescription.type };
    await setDoc(sessionRef, { offer, sellerId: user.uid, status: 'live', startTime: serverTimestamp() });

    const unsubSession = onSnapshot(sessionRef, (snapshot) => {
      const data = snapshot.data();
      if (pcRef.current && !pcRef.current.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pcRef.current.setRemoteDescription(answerDescription);
      }
    });

    // **FIX**: Add listener for buyer's answer candidates
    const unsubAnswerCandidates = onSnapshot(answerCandidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && pcRef.current) {
          const candidate = new RTCIceCandidate(change.doc.data());
          pcRef.current.addIceCandidate(candidate);
        }
      });
    });
    
    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'connected') {
            setIsConnecting(false);
            setIsLive(true);
            toast({ title: "You are now LIVE!", description: "Your stream has started." });
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
  }, [cleanup, toast]);


  return (
    <SellerLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-black text-white p-4 gap-4">
        <div className="relative w-full aspect-video bg-neutral-900 rounded-lg overflow-hidden">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
           {isLive && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-md text-sm font-semibold animate-pulse">
                  <div className="h-2 w-2 rounded-full bg-white"></div>
                  LIVE
              </div>
          )}
        </div>

        <div className="flex items-center gap-2">
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
    </SellerLayout>
  );
}
