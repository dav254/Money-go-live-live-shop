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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
        
        mediaRecorderRef.current.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                const formData = new FormData();
                formData.append('video', event.data, 'live.webm');
                fetch('/api/live/upload', { method: 'POST', body: formData }).catch(console.error);
            }
        };

        mediaRecorderRef.current.start(2000);

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
        toast({ title: "Could not start stream", description: "Please ensure camera and microphone permissions are granted.", variant: 'destructive' });
    } finally {
        setIsStarting(false);
    }
  };

  const endStream = async () => {
    if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
    }
    if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }

    if (user && firestore && liveSession) {
        const sessionRef = doc(firestore, 'liveSessions', liveSession.id);
        await updateDoc(sessionRef, {
            status: 'ended',
            endTime: serverTimestamp()
        });
    }

    setIsLive(false);
    setLiveSession(null);
    toast({ title: "Stream Ended" });
  };
  
   // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isLive) {
        endStream();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
