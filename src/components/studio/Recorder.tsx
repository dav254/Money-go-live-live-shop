
'use client';

import React, { useRef, useEffect } from 'react';
import { VideoOff } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Users } from 'lucide-react';

interface RecorderProps {
  stream: MediaStream | null;
  isLive: boolean;
}

export default function Recorder({ stream, isLive }: RecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    } else if (videoRef.current) {
      // Clear the srcObject when the stream is null (e.g., when the stream ends)
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
      {!stream && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center">
             <VideoOff className="h-16 w-16 text-muted-foreground mb-4" />
             <h3 className="text-xl font-bold">You are not live</h3>
             <p className="text-muted-foreground">Click the "Go Live" button to start your broadcast.</p>
          </div>
      )}
    </div>
  );
}

    