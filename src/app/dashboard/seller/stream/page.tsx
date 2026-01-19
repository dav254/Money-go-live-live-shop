
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useUser, useFirestore } from '@/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { SellerLayout } from '@/components/layout/seller-layout';
import Recorder from '@/components/studio/Recorder';
import { StreamControls } from '@/components/studio/StreamControls';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Users, VideoOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { LiveShoppingEventFeed } from '@/components/studio/live-shopping-event-feed';
import { PinnedProduct } from '@/components/live/PinnedProduct';
import type { Product } from '@/lib/types';

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
  const [viewerCount, setViewerCount] = useState(0);
  const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection & { unsubscribe?: () => void }>>(new Map());

  const handleNewViewer = useCallback(async (viewerId: string) => {
    if (!liveSessionId || !firestore || !localStream || !user) return;

    const pc = new RTCPeerConnection(servers) as RTCPeerConnection & { unsubscribe?: () => void };
    peerConnectionsRef.current.set(viewerId, pc);

    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
    const offerCandidates = collection(sessionRef, 'offerCandidates');
    const answerCandidates = collection(sessionRef, 'answerCandidates');

    pc.onicecandidate = event => {
        if (event.candidate) {
            addDoc(offerCandidates, { ...event.candidate.toJSON(), viewerId: user.uid });
        }
    };
    
    const answerQuery = query(collection(sessionRef, 'answers'), where('viewerId', '==', viewerId));
    const unsubAnswer = onSnapshot(answerQuery, async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const answerDescription = new RTCSessionDescription(change.doc.data().answer);
                if (pc.signalingState !== 'stable') {
                    await pc.setRemoteDescription(answerDescription);
                }
            }
        });
    });
    
    const iceQuery = query(answerCandidates, where('viewerId', '==', viewerId));
    const unsubIce = onSnapshot(iceQuery, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            }
        });
    });

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
    const offer = { offer: { type: offerDescription.type, sdp: offerDescription.sdp }, viewerId: viewerId };
    await setDoc(doc(sessionRef, 'offers', viewerId), offer);
    
    pc.unsubscribe = () => {
      unsubAnswer();
      unsubIce();
    };

  }, [liveSessionId, firestore, localStream, user]);

  useEffect(() => {
    if (!liveSessionId || !firestore) return;

    const viewersRef = collection(firestore, 'liveSessions', liveSessionId, 'viewers');
    const unsubscribeViewers = onSnapshot(viewersRef, (snapshot) => {
        setViewerCount(snapshot.size);
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                handleNewViewer(change.doc.id);
            } else if (change.type === 'removed') {
                const pc = peerConnectionsRef.current.get(change.doc.id);
                if (pc) {
                    pc.close();
                    pc.unsubscribe?.();
                    peerConnectionsRef.current.delete(change.doc.id);
                }
            }
        });
    });
    
    return () => unsubscribeViewers();

  }, [liveSessionId, firestore, handleNewViewer]);

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
      pc.unsubscribe?.();
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
    } catch (error) {
        console.error("Error ending live session via API:", error);
    }

    setIsLive(false);
    setLiveSessionId(null);
    setViewerCount(0);
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
