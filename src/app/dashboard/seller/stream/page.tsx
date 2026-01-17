'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, onSnapshot, collection, addDoc, getDocs, deleteDoc, serverTimestamp, updateDoc, query, where } from 'firebase/firestore';
import { Radio, StopCircle, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StreamControls } from '@/components/studio/StreamControls';
import Recorder from '@/components/studio/Recorder';

export default function SellerStreamPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isLive, setIsLive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  const handleGoLive = useCallback(async () => {
    if (!user || !firestore) return;
    setIsStarting(true);
    toast({ title: 'Starting your live stream...' });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await setDoc(sessionRef, {
        sellerId: user.uid,
        status: 'live',
        startTime: serverTimestamp(),
        viewerCount: 0
      }, { merge: true });

      const viewersCollection = collection(firestore, 'liveSessions', user.uid, 'viewers');
      onSnapshot(viewersCollection, (snapshot) => {
        setViewerCount(snapshot.size);

        for (const change of snapshot.docChanges()) {
            if (change.type === 'added') {
                const viewerId = change.doc.id;
                const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]});
                peerConnectionsRef.current[viewerId] = pc;

                stream.getTracks().forEach(track => pc.addTrack(track, stream));

                pc.createOffer().then(offer => {
                    pc.setLocalDescription(offer);
                    setDoc(doc(sessionRef, 'offers', viewerId), { offer, viewerId });
                });

                pc.onicecandidate = e => {
                  if (e.candidate) addDoc(collection(sessionRef, 'offerCandidates'), { ...e.candidate.toJSON(), viewerId });
                };

                onSnapshot(doc(sessionRef, 'answers', viewerId), answerDoc => {
                    if (answerDoc.exists()) {
                        pc.setRemoteDescription(new RTCSessionDescription(answerDoc.data().answer));
                    }
                });

                onSnapshot(query(collection(sessionRef, 'answerCandidates'), where('viewerId', '==', viewerId)), iceSnapshot => {
                  iceSnapshot.docChanges().forEach(iceChange => {
                    if (iceChange.type === 'added') pc.addIceCandidate(new RTCIceCandidate(iceChange.doc.data()));
                  });
                });
            }
             if (change.type === 'removed') {
                const viewerId = change.doc.id;
                if (peerConnectionsRef.current[viewerId]) {
                    peerConnectionsRef.current[viewerId].close();
                    delete peerConnectionsRef.current[viewerId];
                }
            }
        }
      });

      setIsLive(true);
      toast({ title: 'You are now live!', description: 'Buyers can see your stream.' });
    } catch (error) {
      console.error("Failed to start live stream:", error);
      toast({ variant: 'destructive', title: 'Could not start stream', description: 'Please check camera/mic permissions and try again.' });
    } finally {
      setIsStarting(false);
    }
  }, [user, firestore, toast]);

  const handleEndLive = useCallback(async () => {
    if (!user || !firestore) return;

    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;

    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};

    const sessionRef = doc(firestore, 'liveSessions', user.uid);
    await updateDoc(sessionRef, { status: 'ended', endTime: serverTimestamp() });
    
    const collectionsToDelete = ['viewers', 'offers', 'answers', 'offerCandidates', 'answerCandidates'];
    for (const coll of collectionsToDelete) {
        const snapshot = await getDocs(collection(sessionRef, coll));
        snapshot.forEach(async (docToDelete) => {
            await deleteDoc(docToDelete.ref);
        });
    }

    setIsLive(false);
    setViewerCount(0);
    toast({ title: 'Live stream ended.' });
  }, [user, firestore, toast]);

  return (
    <SellerLayout>
        <div className="flex-1 p-4 lg:p-6 flex flex-col gap-4 h-[calc(100vh-4rem)] overflow-hidden">
            <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
                <Recorder isLive={isLive} />
                <div className="absolute top-4 left-4 flex items-center gap-4 z-10">
                    {isLive && (
                        <div className="bg-red-600 text-white px-3 py-1 rounded-md text-sm font-semibold animate-pulse flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-white"></div>
                            LIVE
                        </div>
                    )}
                     <div className="bg-black/50 text-white px-3 py-1 rounded-md text-sm font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {viewerCount}
                    </div>
                </div>
            </div>
            <StreamControls 
                isLive={isLive} 
                isStarting={isStarting}
                onGoLive={handleGoLive}
                onEndLive={handleEndLive}
            />
        </div>
    </SellerLayout>
  );
}