'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FlipHorizontal, Video, VideoOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LiveActivityFeed } from './LiveActivityFeed';

interface RecorderProps {
  isLive: boolean;
}

export default function Recorder({ isLive }: RecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const getCameraPermission = useCallback(async () => {
    if (!isClient || !navigator.mediaDevices) {
        setHasCameraPermission(false);
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings.',
        });
    }
  }, [isClient, toast]);

  useEffect(() => {
    getCameraPermission();
  }, [getCameraPermission]);


  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
      {!isLive && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center">
             <VideoOff className="h-16 w-16 text-muted-foreground mb-4" />
             <h3 className="text-xl font-bold">You are not live</h3>
             <p className="text-muted-foreground">Click the "Go Live" button to start your broadcast.</p>
          </div>
      )}
      {hasCameraPermission === false && isClient && (
         <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-4">
             <VideoOff className="h-16 w-16 text-destructive mb-4" />
             <h3 className="text-xl font-bold text-destructive">Camera Access Required</h3>
             <p className="text-destructive-foreground/80">Please allow camera access in your browser settings and refresh the page to use the live studio.</p>
         </div>
      )}
    </div>
  );
}