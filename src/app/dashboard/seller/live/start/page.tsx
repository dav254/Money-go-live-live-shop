'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { collection, doc, addDoc, updateDoc, serverTimestamp, onSnapshot, setDoc, Unsubscribe, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Loader2, Video, XCircle, Settings, Mic, MicOff } from 'lucide-react';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { LiveShoppingEventFeed } from '@/components/live/live-shopping-event-feed';
import { Product } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// WebRTC STUN servers configuration
const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

const StreamSettingsDialog = ({ sessionId, currentTitle, isOpen, onOpenChange }: { sessionId: string | null; currentTitle: string; isOpen: boolean; onOpenChange: (open: boolean) => void }) => {
    const { toast } = useToast();
    const [title, setTitle] = useState(currentTitle);

    useEffect(() => {
        setTitle(currentTitle);
    }, [currentTitle]);
    
    const handleSave = async () => {
        if (!sessionId) return;
        // In a real app, this would be an API call to a backend function that has permission to update the title
        console.log("Saving new title (simulation):", title);
        toast({ title: "Settings Saved (Simulated)", description: `Title updated to: ${title}` });
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Stream Settings</DialogTitle>
                    <DialogDescription>Update the title of your live stream.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <Label htmlFor="stream-title">Stream Title</Label>
                    <Input id="stream-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function SellerLiveStudioPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const unsubscribeCallbacksRef = useRef<Unsubscribe[]>([]);

  const { user } = useUser();
  const firestore = useFirestore(); // Correctly use the hook
  const { toast } = useToast();
  
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [streamTitle, setStreamTitle] = useState("My Awesome Live Show");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
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
    
    if (liveSessionId && firestore) {
      const sessionRef = doc(firestore, 'liveSessions', liveSessionId);
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
    setLiveSessionId(null);
  }, [firestore, liveSessionId]);

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

  const handlePinProduct = (product: Product) => {
    setPinnedProduct(product);
  };

  const handleUnpinProduct = () => {
    setPinnedProduct(null);
  };
  
  const toggleMute = () => {
      if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
              audioTrack.enabled = !audioTrack.enabled;
              setIsMuted(!audioTrack.enabled);
          }
      }
  };

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

    const sessionRef = doc(collection(firestore, 'liveSessions'));
    const offerCandidatesRef = collection(sessionRef, 'offerCandidates');
    const answerCandidatesRef = collection(sessionRef, 'answerCandidates');
    setLiveSessionId(sessionRef.id);

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
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-black text-white">
        
        {/* Main Content: Video and Controls */}
        <div className="flex-1 flex flex-col p-4 gap-4">
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
              <Button onClick={toggleMute} variant="secondary" size="icon" className="h-12 w-12">
                  {isMuted ? <MicOff /> : <Mic />}
              </Button>
              <Button onClick={() => setIsSettingsOpen(true)} variant="secondary" size="icon" className="h-12 w-12">
                  <Settings />
              </Button>
            </div>
            
            {pinnedProduct && (
              <Card className="bg-neutral-900/80 border-primary">
                <CardHeader>
                  <CardTitle className="text-base text-primary">Pinned Product</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                   <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
                        <Image src={pinnedProduct.imageUrl || '/placeholder.svg'} alt={pinnedProduct.name || 'product'} fill className="object-cover" />
                    </div>
                    <div>
                        <p className="font-semibold">{pinnedProduct.name}</p>
                        <p className="font-bold text-lg">${pinnedProduct.price.toLocaleString()}</p>
                    </div>
                </CardContent>
              </Card>
            )}
        </div>
        
        {/* Sidebar */}
        <div className="w-full lg:w-[400px] border-l border-neutral-800 flex flex-col h-full">
             <div className="w-full p-4 border-b border-neutral-800">
                <h2 className="font-bold text-lg">Live Studio</h2>
             </div>
             <div className="flex-1 p-4 overflow-y-auto space-y-6">
                <Card className="bg-transparent border-neutral-800">
                    <CardHeader><CardTitle>Live Activity Feed</CardTitle></CardHeader>
                    <CardContent className="h-48 overflow-hidden"><LiveShoppingEventFeed liveSessionId={liveSessionId} /></CardContent>
                </Card>
                 <Card className="bg-transparent border-neutral-800">
                    <CardHeader><CardTitle>Product Shelf</CardTitle></CardHeader>
                    <CardContent className="h-64 overflow-hidden">
                        {user && <LiveProductShelf sellerId={user.uid} onPinProduct={handlePinProduct} onUnpinProduct={handleUnpinProduct} />}
                    </CardContent>
                </Card>
             </div>
        </div>
        <StreamSettingsDialog sessionId={liveSessionId} currentTitle={streamTitle} isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      </div>
    </SellerLayout>
  );
}
