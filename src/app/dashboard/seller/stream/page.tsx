'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useUser, useFirestore } from '@/firebase';
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  query,
  where,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import Recorder from '@/components/studio/Recorder';
import { StreamControls } from '@/components/studio/StreamControls';
import { useToast } from '@/hooks/use-toast';

const servers = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
    },
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

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const handleSignaling = useCallback(async (viewerId: string) => {
      if (!liveSessionId || !firestore || !localStream || !user) return;

      const pc = new RTCPeerConnection(servers);
      peerConnectionsRef.current.set(viewerId, pc);

      localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
      });

      const signalingCol = collection(firestore, 'liveSessions', liveSessionId, 'signaling');

      pc.onicecandidate = event => {
          if (event.candidate) {
              addDoc(signalingCol, { 
                  type: 'sellerCandidate', 
                  candidate: event.candidate.toJSON(),
                  to: viewerId,
                  from: user.uid,
              });
          }
      };
      
      const answerQuery = query(signalingCol, where('type', '==', 'answer'), where('from', '==', viewerId));
      const unsubscribeAnswer = onSnapshot(answerQuery, async (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
              if (change.type === 'added') {
                  const data = change.doc.data();
                  if (data.answer && pc.signalingState !== "stable") {
                      const answerDescription = new RTCSessionDescription(data.answer);
                      await pc.setRemoteDescription(answerDescription);
                  }
              }
          });
      });

      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const offer = {
          type: 'offer',
          offer: {
              type: offerDescription.type,
              sdp: offerDescription.sdp,
          },
          to: viewerId,
          from: user.uid,
      };

      await addDoc(signalingCol, offer);
      
      // Store the unsubscribe function to be called on cleanup
      (pc as any).unsubscribeSignaling = () => {
          unsubscribeAnswer();
      };

  }, [liveSessionId, firestore, localStream, user]);

  useEffect(() => {
    if (!liveSessionId || !firestore) return;

    const viewersRef = collection(firestore, 'liveSessions', liveSessionId, 'viewers');
    const unsubscribeViewers = onSnapshot(viewersRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const viewerId = change.doc.id;
            if (change.type === 'added') {
                handleSignaling(viewerId);
            } else if (change.type === 'removed') {
                const pc = peerConnectionsRef.current.get(viewerId);
                if (pc) {
                    (pc as any).unsubscribeSignaling?.(); // Call cleanup for this specific peer connection
                    pc.close();
                    peerConnectionsRef.current.delete(viewerId);
                }
            }
        });
    });
    
    return () => unsubscribeViewers();

  }, [liveSessionId, firestore, handleSignaling]);

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
      
      const token = await user.getIdToken();
      const response = await fetch('/api/live-session', {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${token}`
          }
      });
      
      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to start live session.');
      }
      
      const { liveSessionId: sessionId } = await response.json();

      setLiveSessionId(sessionId);
      setIsLive(true);
      toast({ title: 'You are now LIVE!' });
    } catch (error: any) {
      console.error('Error starting live stream:', error);
      toast({
        variant: 'destructive',
        title: 'Could not start stream',
        description: error.message || 'Please check permissions and try again.',
      });
      setLocalStream(null);
    } finally {
      setIsStarting(false);
    }
  };

  const endLive = async () => {
    if (!liveSessionId || !firestore || !user) return;

    localStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);

    peerConnectionsRef.current.forEach((pc) => {
        (pc as any).unsubscribeSignaling?.();
        pc.close();
    });
    peerConnectionsRef.current.clear();
    
    try {
        const token = await user.getIdToken();
        await fetch('/api/live-session', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ liveSessionId })
        });
        
        // Cleanup signaling collection
        const signalingRef = collection(firestore, 'liveSessions', liveSessionId, 'signaling');
        const signalingSnapshot = await getDocs(signalingRef);
        signalingSnapshot.forEach(async (doc) => {
            await deleteDoc(doc.ref);
        });


    } catch (error) {
        console.error("Error ending live session via API:", error);
    }

    setIsLive(false);
    setLiveSessionId(null);
    toast({ title: 'Stream Ended' });
  };

  return (
    <SellerLayout>
      <div className="flex-1 p-4 lg:p-6 flex flex-col gap-4 h-[calc(100vh-4rem)] overflow-hidden">
        <div className="relative flex-1">
              <Recorder stream={localStream} isLive={isLive} />
        </div>
          <StreamControls isLive={isLive} isStarting={isStarting} onGoLive={goLive} onEndLive={endLive} />
      </div>
    </SellerLayout>
  );
}
