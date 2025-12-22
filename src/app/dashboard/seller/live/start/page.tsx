
'use client';

import { useRef, useState, useEffect, useCallback } from "react";
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Radio, Power, Camera, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useUser, useFirestore } from "@/firebase";
import { doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Peer } from 'peerjs';

export default function SellerLiveStudio() {
  const { user } = useUser();
  const firestore = useFirestore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const { toast } = useToast();

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  }, []);

  const stopLive = useCallback(async () => {
    if (isLive && user && firestore) {
      const sessionRef = doc(firestore, 'liveSessions', user.uid);
      await updateDoc(sessionRef, { status: 'ended', endTime: serverTimestamp() }).catch(console.error);
    }
    setIsLive(false);
  }, [isLive, user, firestore]);
  
  useEffect(() => {
    if (!user || !firestore) return;

    let peer: Peer | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const initializePeer = async () => {
        const { default: Peer } = await import('peerjs');
        
        // Disconnect any existing peer connection
        if (peerRef.current) {
            peerRef.current.destroy();
        }
        
        peer = new Peer(user.uid);
        peerRef.current = peer;

        peer.on('open', (id) => {
            console.log('Seller PeerJS ID:', id);
            setPeerId(id);
        });

        peer.on('call', (call) => {
            if (streamRef.current) {
                call.answer(streamRef.current);
            }
        });

        peer.on('error', (err: any) => {
            console.error('PeerJS error:', err);
            
            // Specifically handle the "ID is taken" error with a retry
            if (err.type === 'unavailable-id') {
                toast({
                    variant: 'destructive',
                    title: 'Connection Conflict',
                    description: `ID is already in use. Retrying in 5 seconds...`,
                });
                
                // Disconnect and schedule a reconnect attempt
                peer?.disconnect();
                reconnectTimeout = setTimeout(initializePeer, 5000);
            } else {
                 toast({ variant: 'destructive', title: 'Connection Error', description: `Live connection failed: ${err.message}` });
            }
        });
    }

    initializePeer();

    // Cleanup function
    return () => {
        clearTimeout(reconnectTimeout);
        stopLive();
        cleanupStream();
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
    };
  }, [user, firestore, cleanupStream, stopLive, toast]);

  async function startCamera() {
    if (isCameraOn) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCameraPermission(true);
      setIsCameraOn(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setHasCameraPermission(false);
    }
  }

  async function goLive() {
    if (!streamRef.current || !user || !firestore || !peerRef.current) {
      toast({ variant: 'destructive', title: 'Initialization Error', description: 'User, Peer connection or camera not ready.' });
      return;
    }
    
    setIsStarting(true);
    
    try {
        const sessionRef = doc(firestore, 'liveSessions', user.uid);
        await setDoc(sessionRef, {
            id: user.uid,
            sellerId: user.uid,
            title: `${user.displayName || 'Seller'}'s Live Show`,
            status: 'live',
            startTime: serverTimestamp(),
        }, { merge: true });
        
        setIsLive(true);
        toast({ title: 'You are LIVE!', description: 'Your stream is now being broadcasted.' });
    } catch (error) {
        console.error("Error setting live status:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update your live status.' });
    } finally {
        setIsStarting(false);
    }
  }

  const handleStopLive = () => {
    stopLive();
    cleanupStream();
    toast({ title: 'Stream Ended', description: 'You are no longer live.' });
  }

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Live Studio</CardTitle>
            <CardDescription>
                {peerId ? `Your stream is discoverable with ID: ${peerId}` : 'Initializing your stream...'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full bg-black rounded-lg mb-4 relative">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
              {isLive && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-md text-sm font-semibold animate-pulse">
                  <div className="h-2 w-2 rounded-full bg-white"></div>
                  LIVE
                </div>
              )}
            </div>
            {hasCameraPermission === false && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Camera Access Denied</AlertTitle>
                  <AlertDescription>
                    Go Earn needs permission to use your camera. Please enable it in your browser settings and refresh the page.
                  </AlertDescription>
                </Alert>
            )}
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              {!isCameraOn ? (
                <Button onClick={startCamera} className="w-full">
                  <Camera className="mr-2 h-4 w-4" /> Start Camera
                </Button>
              ) : !isLive ? (
                <Button onClick={goLive} className="w-full bg-red-600 hover:bg-red-700" disabled={isStarting || !peerId}>
                  {isStarting || !peerId ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Radio className="mr-2 h-4 w-4" />}
                  {isStarting ? 'Starting...' : !peerId ? 'Connecting...' : 'GO LIVE'}
                </Button>
              ) : (
                <Button onClick={handleStopLive} variant="secondary" className="w-full">
                  <Power className="mr-2 h-4 w-4" /> Stop Stream
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
}
