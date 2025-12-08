
'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Recorder() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const chunks = useRef<Blob[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Request camera permission as soon as the component mounts
    async function getCameraPermission() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        alert("Camera permission is required to record a video.");
        console.error("Camera access error:", err);
      }
    }
    getCameraPermission();
  }, []);

  async function startRecording() {
    if (!videoRef.current?.srcObject) {
      alert("Camera is not available. Please grant permission and try again.");
      return;
    }
    chunks.current = []; // Clear previous recording chunks
    const stream = videoRef.current.srcObject as MediaStream;
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = e => chunks.current.push(e.data);

    recorder.onstop = () => {
      const blob = new Blob(chunks.current, { type: "video/webm" });
      const videoUrl = URL.createObjectURL(blob);
      localStorage.setItem('videoUrl', videoUrl);
      router.push('/seller/studio/edit');
    };

    recorder.start();
    mediaRecorder.current = recorder;
    setRecording(true);
  }

  function stopRecording() {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      setRecording(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <video ref={videoRef} autoPlay muted className="w-full h-[80vh] object-cover" />
      {!recording ? (
        <button onClick={startRecording} className="bg-red-600 px-6 py-2 rounded-full mt-4">
          Start
        </button>
      ) : (
        <button onClick={stopRecording} className="bg-gray-700 px-6 py-2 rounded-full mt-4">
          Stop
        </button>
      )}
    </div>
  );
}
