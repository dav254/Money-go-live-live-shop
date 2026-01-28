'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FlipHorizontal, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LiveActivityFeed } from './LiveActivityFeed';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, VideoOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { set as idbSet } from '@/lib/idb';

export default function Recorder() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [script, setScript] = useState('Your teleprompter script goes here...');
  const router = useRouter();
  const { toast } = useToast();
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const getCameraStream = useCallback(async (mode: 'environment' | 'user') => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        setHasCameraPermission(false);
        return null;
    }
    try {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
       setHasCameraPermission(true);
      return stream;
    } catch (err) {
      console.error("Camera access error:", err);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions in your browser settings to use the studio.',
      });
      return null;
    }
  }, [toast]);

  useEffect(() => {
    if (isClient) {
      getCameraStream(facingMode);
    }
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [facingMode, isClient, getCameraStream]);

  function toggleFacingMode() {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }

  async function startRecording() {
    const stream = await getCameraStream(facingMode);
    if (!stream) return;

    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    recorderRef.current = mr;
    mr.ondataavailable = e => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      try {
        await idbSet('videoStudioDB', 'videoClips', 'latestVideo', blob);
        router.push('/seller/studio/edit');
      } catch (error) {
        console.error("Failed to save video to IndexedDB:", error);
        toast({
          variant: 'destructive',
          title: 'Storage Error',
          description: 'Could not save the recorded video. Please try again.',
        });
      }
    };
    mr.start(300);
    setRecording(true);
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      setRecording(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
        <div className="flex-1 flex flex-col items-center gap-4 relative">
            <div className="w-full h-full object-cover rounded-lg bg-black relative">
                <video ref={videoRef} className="w-full h-full object-cover rounded-lg" autoPlay muted playsInline />
                {!hasCameraPermission && isClient && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center">
                        <VideoOff className="h-12 w-12 text-destructive" />
                        <h3 className="mt-4 text-lg font-semibold">Camera Access Denied</h3>
                        <p className="text-sm text-muted-foreground">Please grant camera and microphone permissions in your browser settings to record.</p>
                    </div>
                )}
            </div>
            
            {recording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-md text-sm font-semibold animate-pulse">
                    <div className="h-2 w-2 rounded-full bg-white"></div>
                    REC
                </div>
            )}
            
            <div className="absolute top-4 right-4">
                 <button onClick={toggleFacingMode} className="p-2 bg-black/50 rounded-full text-white hover:bg-black/80">
                    <FlipHorizontal size={20} />
                </button>
            </div>

            <div className="absolute bottom-4 flex gap-3">
                {!recording ? (
                    <button onClick={startRecording} disabled={!hasCameraPermission} className="px-8 py-3 bg-red-600 rounded-full text-white font-bold disabled:bg-red-900 disabled:cursor-not-allowed">Start Recording</button>
                ) : (
                    <button onClick={stopRecording} className="px-8 py-3 bg-gray-700 rounded-full text-white font-bold">Stop & Continue</button>
                )}
            </div>
        </div>
        
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
            <div className="bg-neutral-800/50 p-4 rounded-lg flex-1 flex flex-col">
                <h3 className="text-lg font-bold mb-3">Teleprompter / Script</h3>
                <textarea
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    className="w-full h-full p-2 bg-neutral-900 rounded-md text-white text-sm resize-none"
                    placeholder="Enter your script here..."
                />
            </div>
             <div className="bg-neutral-800/50 p-4 rounded-lg flex-1 flex flex-col">
                <h3 className="text-lg font-bold mb-3">Live Activity (Simulation)</h3>
                <LiveActivityFeed liveSessionId={null} />
            </div>
        </div>
    </div>
  );
}
