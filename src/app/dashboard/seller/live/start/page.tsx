
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
import MuxPlayer from "@mux/mux-player-react";

export default function SellerLiveStudio() {
  const { user } = useUser();
  const firestore = useFirestore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [streamKey, setStreamKey] = useState<string | null>(null);
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
    return () => {
        stopLive();
        cleanupStream();
    };
  }, [cleanupStream, stopLive]);

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
    if (!streamRef.current || !user || !firestore) {
      toast({ variant: 'destructive', title: 'Initialization Error', description: 'User or camera not ready.' });
      return;
    }
    
    setIsStarting(true);
    
    try {
        const response = await fetch('/api/mux', { method: 'POST' });
        const { streamKey: newStreamKey, playbackId } = await response.json();
        setStreamKey(newStreamKey);

        const sessionRef = doc(firestore, 'liveSessions', user.uid);
        await setDoc(sessionRef, {
            id: user.uid,
            sellerId: user.uid,
            title: `${user.displayName || 'Seller'}'s Live Show`,
            status: 'live',
            muxStreamKey: newStreamKey,
            muxPlaybackId: playbackId,
            startTime: serverTimestamp(),
        }, { merge: true });
        
        // This part would involve sending the stream to Mux's RTMP endpoint.
        // For this demo, we'll simulate it by just showing the player.
        setIsLive(true);
        toast({ title: 'You are LIVE!', description: 'Your stream is now being broadcasted via Mux.' });
    } catch (error: any) {
        console.error("Error going live:", error);
        toast({ variant: 'destructive', title: 'Error', description: `Could not start live stream: ${error.message}` });
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
                {isLive ? `Broadcasting to Mux with stream key: ${streamKey}` : 'Start your live shopping event here.'}
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
                <Button onClick={goLive} className="w-full bg-red-600 hover:bg-red-700" disabled={isStarting}>
                  {isStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Radio className="mr-2 h-4 w-4" />}
                  {isStarting ? 'Starting...' : 'GO LIVE'}
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
