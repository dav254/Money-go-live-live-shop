
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, onSnapshot, collection, addDoc, getDocs, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Radio, StopCircle, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LiveActivityFeed } from '@/components/studio/LiveActivityFeed';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';

// WebRTC Configuration
const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function SellerStreamPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [isLive, setIsLive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});

  const handleGoLive = useCallback(async () => {
    if (!user || !firestore) return;
    setIsStarting(true);
    toast({ title: 'Starting your live stream...' });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await setDoc(sessionRef, {
        sellerId: user.uid,
        status: 'live',
        startTime: serverTimestamp(),
      });

      // Listen for new viewers
      const viewersCollection = collection(firestore, 'liveSessions', user.uid, 'viewers');
      onSnapshot(viewersCollection, async (snapshot) => {
        setViewerCount(snapshot.size);

        for (const change of snapshot.docChanges()) {
            if (change.type === 'added') {
                const viewerId = change.doc.id;
                console.log(`New viewer detected: ${viewerId}`);
                
                const pc = new RTCPeerConnection(servers);
                peerConnectionsRef.current[viewerId] = pc;

                stream.getTracks().forEach(track => pc.addTrack(track, stream));

                const offerCandidates = collection(sessionRef, 'offerCandidates');
                const answerCandidates = collection(sessionRef, 'answerCandidates');

                pc.onicecandidate = async event => {
                    if (event.candidate) {
                        await addDoc(offerCandidates, { ...event.candidate.toJSON(), viewerId });
                    }
                };
                
                const offerDescription = await pc.createOffer();
                await pc.setLocalDescription(offerDescription);
                
                const offer = { offer: { type: offerDescription.type, sdp: offerDescription.sdp }, viewerId };
                await setDoc(doc(sessionRef, 'offers', viewerId), offer);
                
                onSnapshot(doc(sessionRef, 'answers', viewerId), async (answerDoc) => {
                    if (answerDoc.exists()) {
                        const answerDescription = new RTCSessionDescription(answerDoc.data().answer);
                        await pc.setRemoteDescription(answerDescription);
                    }
                });
                
                onSnapshot(query(answerCandidates, where('viewerId', '==', viewerId)), (iceSnapshot) => {
                  iceSnapshot.docChanges().forEach(async (iceChange) => {
                    if (iceChange.type === 'added') {
                      const candidate = new RTCIceCandidate(iceChange.doc.data());
                      await pc.addIceCandidate(candidate);
                    }
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

    // Stop all media tracks
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
    }

    // Close all peer connections
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};

    // Update Firestore session
    const sessionRef = doc(firestore, 'liveSessions', user.uid);
    await updateDoc(sessionRef, { status: 'ended', endTime: serverTimestamp() });
    
    // Clean up subcollections
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
        <div className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-4rem)] overflow-hidden">
            {/* Main Content: Video Feed and Controls */}
            <div className="lg:col-span-3 flex flex-col gap-4">
                <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
                    <video ref={localVideoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                    <div className="absolute top-4 left-4 flex items-center gap-4">
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
                <Card>
                    <CardContent className="p-4 flex items-center justify-center gap-4">
                        {!isLive ? (
                        <Button size="lg" className="font-bold text-lg bg-red-600 hover:bg-red-700" onClick={handleGoLive} disabled={isStarting}>
                            {isStarting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Radio className="mr-2 h-5 w-5" />}
                            {isStarting ? 'Starting...' : 'Go Live'}
                        </Button>
                        ) : (
                        <Button size="lg" variant="destructive" className="font-bold text-lg" onClick={handleEndLive}>
                            <StopCircle className="mr-2 h-5 w-5" />
                            End Live Stream
                        </Button>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Right Sidebar: Products and Activity */}
            <div className="flex flex-col gap-4 overflow-hidden">
                <Card className="flex-1 flex flex-col">
                    <CardHeader><CardTitle>My Products</CardTitle></CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                        {user && <LiveProductShelf sellerId={user.uid} onPinProduct={() => {}} onUnpinProduct={() => {}} />}
                    </CardContent>
                </Card>
                <Card className="flex-1 flex flex-col">
                    <CardHeader><CardTitle>Live Activity</CardTitle></CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                        <LiveActivityFeed liveSessionId={user?.uid || null} />
                    </CardContent>
                </Card>
            </div>
        </div>
    </SellerLayout>
  );
}

