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

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection & { unsubscribe?: () => void }>>(new Map());

  const handleNewViewer = useCallback(async (viewerId: string) => {
    if (!liveSessionId || !firestore || !localStream || !user) return;

    const pc = new RTCPeerConnection(servers) as RTCPeerConnection & { unsubscribe?: () => void };
    peerConnectionsRef.current.set(viewerId, pc);

    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    const signalingCol = collection(firestore, 'liveSessions', liveSessionId, 'signaling');

    pc.onicecandidate = event => {
        if (event.candidate) {
            addDoc(collection(signalingCol), { type: 'sellerCandidate', candidate: event.candidate.toJSON(), to: viewerId, from: user.uid });
        }
    };
    
    const offerQuery = query(signalingCol, where('type', '==', 'offer'), where('to', '==', user.uid), where('from', '==', viewerId));
    const unsubscribeOffer = onSnapshot(offerQuery, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            if (change.type === 'added') {
                const { offer } = change.doc.data();
                if (pc.signalingState !== 'stable') {
                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    await addDoc(signalingCol, { type: 'answer', answer: { type: answer.type, sdp: answer.sdp }, from: user.uid, to: viewerId });
                }
            }
        }
    });

    const iceQuery = query(signalingCol, where('type', '==', 'buyerCandidate'), where('to', '==', user.uid), where('from', '==', viewerId));
    const unsubscribeIce = onSnapshot(iceQuery, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                pc.addIceCandidate(new RTCIceCandidate(change.doc.data().candidate));
            }
        });
    });
    
     pc.unsubscribe = () => {
      unsubscribeOffer();
      unsubscribeIce();
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

      const sessionId = user.uid;
      const sessionRef = doc(firestore, 'liveSessions', sessionId);

      await setDoc(
        sessionRef,
        {
          id: sessionId,
          sellerId: user.uid,
          status: 'live',
          startTime: serverTimestamp(),
        },
        { merge: true }
      );

      setLiveSessionId(sessionId);
      setIsLive(true);
      toast({ title: 'You are now LIVE!' });
    } catch (error) {
      console.error('Error starting live stream:', error);
      toast({
        variant: 'destructive',
        title: 'Could not start stream',
        description:
          'Please check camera/mic permissions and try again.',
      });
      setLocalStream(null);
    } finally {
      setIsStarting(false);
    }
  };

  const endLive = async () => {
    if (!liveSessionId || !firestore) return;

    localStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);

    peerConnectionsRef.current.forEach((pc) => {
      pc.unsubscribe?.();
      pc.close();
    });
    peerConnectionsRef.current.clear();

    const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
    await updateDoc(sessionRef, {
      status: 'ended',
      endTime: serverTimestamp(),
      pinnedProduct: null,
    });
    
    const signalingCol = collection(sessionRef, 'signaling');
    const docsSnapshot = await getDocs(signalingCol);
    const batch = writeBatch(firestore);
    docsSnapshot.forEach(docToDelete => batch.delete(docToDelete.ref));
    await batch.commit();

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
              {isLive && (
                  <div className="absolute top-4 left-4 flex gap-2">
                    <Badge className="bg-red-600 hover:bg-red-700">LIVE</Badge>
                    <Badge variant="secondary" className="flex items-center gap-1.5"><Users className="h-3 w-3" />{viewerCount}</Badge>
                </div>
            )}
        </div>
          <StreamControls isLive={isLive} isStarting={isStarting} onGoLive={goLive} onEndLive={endLive} />
      </div>
    </SellerLayout>
  );
}
