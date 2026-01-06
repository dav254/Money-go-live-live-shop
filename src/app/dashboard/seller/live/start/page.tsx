
'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Radio, StopCircle, Video, Loader2, Link as LinkIcon, Users, MessageSquare } from "lucide-react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { LiveSession, Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { PinnedProduct } from '@/components/live/PinnedProduct';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { LiveActivityFeed } from '@/components/studio/LiveActivityFeed';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { LiveChat } from '@/components/buyer/LiveChat';
import { StreamControls } from '@/components/studio/StreamControls';

export default function SellerLiveStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);
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
                await fetch('/api/live/upload', { method: 'POST', body: formData });
            }
        };
        mediaRecorderRef.current.start(1000); // Send data every 1 second

        const sessionRef = doc(firestore, 'liveSessions', user.uid);
        const sessionData: LiveSession = {
            id: user.uid,
            sellerId: user.uid,
            title: "My Live Show",
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
    setPinnedProduct(null);
    toast({ title: "Stream Ended" });
  };

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Main Content: Video and Controls */}
            <div className="lg:col-span-2 space-y-4">
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
                             <div className="absolute bottom-4 left-4 z-10">
                                {pinnedProduct && <PinnedProduct product={pinnedProduct} />}
                            </div>
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
            
            {/* Sidebar: Products and Activity */}
            <div className="space-y-4 lg:sticky lg:top-24">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MessageSquare />Live Chat</CardTitle>
                    </CardHeader>
                    <CardContent className="h-60">
                        <LiveChat streamId={liveSession?.id || null} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users />Product Shelf</CardTitle>
                        <CardDescription>Pin a product to feature it on your stream.</CardDescription>
                    </CardHeader>
                    <CardContent className="max-h-[60vh] overflow-y-auto">
                        {user && <LiveProductShelf sellerId={user.uid} onPinProduct={setPinnedProduct} onUnpinProduct={() => setPinnedProduct(null)} />}
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </SellerLayout>
  );
}
