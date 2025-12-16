'use client';

import { useRef, useState, useEffect } from "react";
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Radio, Power, Camera, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useUser, useFirestore, useUserProfile } from "@/firebase";
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function SellerLiveStudio() {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const { toast } = useToast();

  const cleanup = () => {
      if (videoRef.current && videoRef.current.srcObject) {
          (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
      }
      if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
          mediaRecorder.current.stop();
      }
  };

  async function startCamera() {
    cleanup(); // Clean up any existing streams first
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCameraPermission(false);
        toast({ variant: 'destructive', title: 'Media Devices not supported' });
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',
            },
            audio: true,
        });

        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
        
        setHasCameraPermission(true);
        setIsCameraOn(true);

        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
        
        recorder.ondataavailable = async (e) => {
            if (e.data.size > 0) {
                const formData = new FormData();
                formData.append("video", e.data, "live.webm");
                try {
                    await fetch("/api/live/upload", {
                        method: "POST",
                        body: formData,
                    });
                } catch (error) {
                    console.error("Failed to upload video chunk:", error);
                }
            }
        };

        recorder.onstart = () => {
            if(recorder.state === 'recording') recorder.requestData();
        };

        mediaRecorder.current = recorder;

    } catch (err) {
        console.error("Camera access error:", err);
        setHasCameraPermission(false);
    }
  }

  async function goLive() {
    if (!mediaRecorder.current || !user || !firestore || !userProfile) {
        toast({ variant: 'destructive', title: 'Initialization Error', description: 'User or camera not ready.' });
        return;
    }
    
    // Create live session document in Firestore
    const sessionRef = doc(firestore, 'liveSessions', user.uid);
    await setDoc(sessionRef, {
        id: user.uid,
        sellerId: user.uid,
        title: `${userProfile.fullName}'s Live Show`,
        status: 'live',
        startTime: serverTimestamp(),
    });

    mediaRecorder.current.start(5000); 
    setIsLive(true);
    toast({ title: 'You are LIVE!', description: 'Your stream is now being broadcasted.' });
  }

  async function stopLive() {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
        mediaRecorder.current.stop();
    }
    setIsLive(false);
    toast({ title: 'Stream Ended', description: 'You are no longer live.' });

    // Update session status in Firestore
    if (user && firestore) {
        const sessionRef = doc(firestore, 'liveSessions', user.uid);
        await setDoc(sessionRef, { status: 'ended', endTime: serverTimestamp() }, { merge: true });
    }
    cleanup();
  }

  // Cleanup stream on component unmount
  useEffect(() => {
    return () => {
        if(isLive) {
            stopLive();
        } else {
            cleanup();
        }
    }
  }, [isLive]);

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Live Studio</CardTitle>
            <CardDescription>Start your camera, then go live to broadcast short video clips to your audience.</CardDescription>
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
                <Button onClick={goLive} className="w-full bg-red-600 hover:bg-red-700">
                  <Radio className="mr-2 h-4 w-4" /> GO LIVE
                </Button>
              ) : (
                <Button onClick={stopLive} variant="secondary" className="w-full">
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
