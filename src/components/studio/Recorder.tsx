
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FlipHorizontal } from 'lucide-react';
import { LiveActivityFeed } from './LiveActivityFeed';

export default function Recorder() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [script, setScript] = useState('Your teleprompter script goes here...');
  const chunksRef = useRef<Blob[]>([]);
  const router = useRouter();

  async function getCameraStream(mode: string) {
    try {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      return stream;
    } catch (err) {
      console.error("Camera access error:", err);
      alert('Camera permission is required. Please check your browser settings.');
      return null;
    }
  }

  useEffect(() => {
    getCameraStream(facingMode);
    return () => {
       if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    }
  }, [facingMode]);

  function toggleFacingMode() {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }

  async function start() {
    const stream = await getCameraStream(facingMode);
    if (!stream) return;

    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = mr;
    
    mr.ondataavailable = e => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      localStorage.setItem('videoUrl', videoUrl);
      router.push('/seller/studio/edit');
    };
    
    mr.start(1000); // Send data every second
    setRecording(true);
  }

  function stop() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      setRecording(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
        <div className="flex-1 flex flex-col items-center gap-4 relative">
            <video ref={videoRef} className="w-full h-full object-cover rounded-lg bg-black" autoPlay muted playsInline />
            
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
                    <button onClick={start} className="px-8 py-3 bg-red-600 rounded-full text-white font-bold">Start Recording</button>
                ) : (
                    <button onClick={stop} className="px-8 py-3 bg-gray-700 rounded-full text-white font-bold">Stop & Continue</button>
                )}
            </div>
        </div>
        
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
            <div className="bg-neutral-800/50 p-4 rounded-lg flex-1 flex flex-col">
                <h3 className="text-lg font-bold mb-3">Teleprompter</h3>
                <textarea
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    className="w-full h-full p-2 bg-neutral-900 rounded-md text-white text-sm resize-none"
                    placeholder="Enter your script here..."
                />
            </div>
             <div className="bg-neutral-800/50 p-4 rounded-lg flex-1 flex flex-col">
                <LiveActivityFeed liveSessionId={null} />
            </div>
        </div>
    </div>
  );
}
