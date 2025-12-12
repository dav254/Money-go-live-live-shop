
'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { FlipHorizontal, Loader2, Camera, Video, Settings, Mic, MicOff, CameraOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collection, doc, addDoc, updateDoc, serverTimestamp, query, where, onSnapshot, getDocs, writeBatch, setDoc, Unsubscribe } from 'firebase/firestore';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

export default function SellerLiveStudioPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const unsubscribeCallbacksRef = useRef<(() => void)[]>([]);

  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  
  const cleanup = useCallback(() => {
      console.log("Cleaning up WebRTC connections...");
      unsubscribeCallbacksRef.current.forEach(cb => cb());
      unsubscribeCallbacksRef.current = [];
      if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
      }
  }, []);

  const startCamera = useCallback(async (facingMode: 'user' | 'environment' = 'user') => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
        localStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(console.error);
        }
        setHasCameraPermission(true);
        setIsCameraOn(true);
        return stream;
    } catch(err) {
        console.error("Camera error", err);
        setHasCameraPermission(false);
        setIsCameraOn(false);
        return null;
    }
  }, []);

  const handleStartCamera = async () => {
    await startCamera();
  };

  const handleStopCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  };

  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    const currentTrack = localStreamRef.current.getVideoTracks()[0];
    if (!currentTrack) return;
    const currentFacingMode = currentTrack.getSettings().facingMode;
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    await startCamera(newFacingMode);
  }, [startCamera]);

  const toggleMute = () => {
      if(localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(track => {
              track.enabled = !track.enabled;
              setIsMuted(!track.enabled);
          });
      }
  }

  useEffect(() => {
    return () => {
      cleanup();
      if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [cleanup]);

  return (
    <SellerLayout>
        <div className="p-4 max-w-full mx-auto h-[calc(100vh-4rem)] flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex flex-col items-center gap-4">
                <div className="relative bg-black rounded-lg border border-border overflow-hidden aspect-video w-full flex items-center justify-center">
                    {!isCameraOn ? (
                        <div className="flex flex-col items-center gap-4">
                            {!hasCameraPermission && (
                                <Alert variant="destructive" className="max-w-sm"><AlertTitle>Camera Access Denied</AlertTitle><AlertDescription>Please allow camera access in your browser settings to continue.</AlertDescription></Alert>
                            )}
                            <Button onClick={handleStartCamera} size="lg"><Camera className="mr-2 h-5 w-5"/>Start Camera</Button>
                        </div>
                    ) : (
                        <>
                           <video id="studio-preview" ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                           {isLive && (
                                <div className="absolute top-3 left-3 px-2 py-1 rounded text-xs font-semibold bg-red-600 animate-pulse flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-white"></div>LIVE
                                </div>
                            )}
                            <div className="absolute top-3 right-3 flex gap-2">
                                <Button variant="ghost" size="icon" className="bg-black/50" onClick={switchCamera}><FlipHorizontal size={18}/></Button>
                                <Button variant="ghost" size="icon" className="bg-black/50" onClick={toggleMute}>
                                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                                </Button>
                                <Button variant="ghost" size="icon" className="bg-black/50" onClick={handleStopCamera}><CameraOff size={18} /></Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    </SellerLayout>
  );
}
