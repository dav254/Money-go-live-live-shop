
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent } from "@/components/ui/card";
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { StreamControls } from '@/components/studio/StreamControls';

export default function SellerLiveStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);

  const startStream = async () => {
    if (!videoRef.current || !user || !firestore) return;
    setIsStarting(true);
    toast({ title: "Going Live...", description: "Setting up your stream." });

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        captureIntervalRef.current = setInterval(() => {
            if (!videoRef.current || !context || videoRef.current.paused || videoRef.current.ended) return;

            // Match canvas to video dimensions
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(async (blob) => {
                if (blob) {
                    const formData = new FormData();
                    formData.append('frame', blob, 'live.jpg');
                    fetch('/api/live/upload', { method: 'POST', body: formData }).catch(console.error);
                }
            }, 'image/jpeg', 0.75); // 75% quality JPEG
        }, 41); // ~24 frames per second

        const sessionRef = doc(firestore, 'liveSessions', user.uid);
        const sessionData: LiveSession = {
            id: user.uid,
            sellerId: user.uid,
            title: `${user.displayName || 'Seller'}'s Live Show`,
            status: 'live',
            startTime: serverTimestamp(),
        };
        await setDoc(sessionRef, sessionData, { merge: true });
        setLiveSession(sessionData);

        setIsLive(true);
        toast({ title: "You are live!", variant: 'default' });
    } catch (error) {
        console.error("Error starting stream:", error);
        toast({ title: "Could not start stream", description: "Please ensure camera permissions are granted.", variant: 'destructive' });
    } finally {
        setIsStarting(false);
    }
  };

  const endStream = async () => {
    if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
    }
    if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }

    if (user && firestore && liveSession) {
        const sessionRef = doc(firestore, 'liveSessions', user.uid);
        await updateDoc(sessionRef, {
            status: 'ended',
            endTime: serverTimestamp()
        });
    }

    setIsLive(false);
    setLiveSession(null);
    toast({ title: "Stream Ended" });
  };
  
  useEffect(() => {
    return () => {
      if (isLive) {
        endStream();
      }
    };
  }, [isLive]);

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl space-y-4">
            <Card>
                <CardContent className="p-2">
                    <div className="aspect-video w-full bg-black rounded-lg relative overflow-hidden">
                        <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                        {isLive && (
                            <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-md text-sm font-semibold animate-pulse z-10">
                                <div className="h-2 w-2 rounded-full bg-white"></div>
                                LIVE
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
            <StreamControls 
                isLive={isLive} 
                isStarting={isStarting} 
                onGoLive={startStream} 
                onEndLive={endStream} 
            />
        </div>
      </div>
    </SellerLayout>
  );
}
