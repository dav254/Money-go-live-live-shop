'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Scissors, Music, Wand2, MessageSquare, UploadCloud, Sparkles, X, Play, Pause, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';
import { get as idbGet, set as idbSet } from '@/lib/idb';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

export default function VideoEditor() {
  const router = useRouter();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isApplyingTrim, setIsApplyingTrim] = useState(false);

  // Load video from IndexedDB on mount
  useEffect(() => {
    let objectUrl: string;
    async function loadVideo() {
      try {
        const blob = await idbGet<Blob>('videoStudioDB', 'videoClips', 'latestVideo');
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setVideoUrl(objectUrl);
        } else {
          router.push('/seller/studio/record');
        }
      } catch (error) {
        console.error("Failed to load video from IndexedDB:", error);
        router.push('/seller/studio/record');
      }
    }
    loadVideo();
    
    return () => {
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
        }
    }
  }, [router]);
  
  const handleNext = () => {
    router.push('/seller/studio/product');
  };

  const handleTogglePlay = () => {
    if (videoRef.current) {
        if (videoRef.current.paused) {
            videoRef.current.play();
        } else {
            videoRef.current.pause();
        }
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    }
  }, [videoUrl]);

  // Trim functionality
  const handleSetStart = () => {
    if (videoRef.current) {
        setStartTime(videoRef.current.currentTime);
    }
  };

  const handleSetEnd = () => {
    if (videoRef.current) {
        setEndTime(videoRef.current.currentTime);
    }
  };
  
  const handleClearTrim = () => {
      setStartTime(null);
      setEndTime(null);
  };

  const handleApplyTrim = async () => {
    if (startTime === null || endTime === null || startTime >= endTime) {
        toast({ variant: 'destructive', title: 'Invalid Trim', description: 'Please set a valid start and end time.' });
        return;
    }
    
    setIsApplyingTrim(true);
    toast({ title: 'Applying Trim...', description: 'Please wait while your video is being trimmed.' });

    try {
        const originalBlob = await idbGet<Blob>('videoStudioDB', 'videoClips', 'latestVideo');
        if (!originalBlob) throw new Error('Original video not found.');

        const stream = new MediaStream();
        const videoElement = document.createElement('video');
        videoElement.src = URL.createObjectURL(originalBlob);

        videoElement.onloadedmetadata = async () => {
            const videoTrack = (videoElement.captureStream() as MediaStream).getVideoTracks()[0];
            const audioTrack = (videoElement.captureStream() as MediaStream).getAudioTracks()[0];
            
            stream.addTrack(videoTrack);
            if (audioTrack) stream.addTrack(audioTrack);
            
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
            const chunks: Blob[] = [];

            recorder.ondataavailable = e => chunks.push(e.data);
            recorder.onstop = async () => {
                const trimmedBlob = new Blob(chunks, { type: 'video/webm' });
                await idbSet('videoStudioDB', 'videoClips', 'latestVideo', trimmedBlob);

                // Update the player with the new blob
                const newVideoUrl = URL.createObjectURL(trimmedBlob);
                if (videoUrl) URL.revokeObjectURL(videoUrl);
                setVideoUrl(newVideoUrl);

                toast({ title: 'Trim Applied!', description: 'Your video has been successfully trimmed.' });
                setIsTrimming(false);
                setStartTime(null);
                setEndTime(null);
                setIsApplyingTrim(false);
            };

            videoElement.currentTime = startTime;
            await videoElement.play();
            recorder.start();

            const duration = (endTime - startTime) * 1000;
            setTimeout(() => {
                videoElement.pause();
                recorder.stop();
            }, duration);
        };
    } catch(error: any) {
        console.error("Trim failed:", error);
        toast({ variant: 'destructive', title: 'Trim Failed', description: error.message });
        setIsApplyingTrim(false);
    }
  };

  // Loop within trim range
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isTrimming) return;

    const handleTimeUpdate = () => {
        if (endTime !== null && video.currentTime >= endTime) {
            video.currentTime = startTime !== null ? startTime : 0;
            video.play();
        }
    };
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);

  }, [isTrimming, startTime, endTime]);


  const editingTools = [
      { name: 'Trim', icon: Scissors, action: () => setIsTrimming(true) },
      { name: 'Music', icon: Music, action: () => alert('Feature coming soon: Add background music!') },
  ];
  
  const progress = videoRef.current && videoRef.current.duration ? (videoRef.current.currentTime / videoRef.current.duration) * 100 : 0;
  const startProgress = startTime !== null && videoRef.current ? (startTime / videoRef.current.duration) * 100 : 0;
  const endProgress = endTime !== null && videoRef.current ? (endTime / videoRef.current.duration) * 100 : 100;

  return (
    <div className="bg-black text-white h-screen flex flex-col p-2 md:p-4">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
        
        {/* Main Video Preview */}
        <div className="lg:col-span-2 h-full flex flex-col items-center justify-center bg-neutral-900 rounded-lg">
          <div className="w-full max-h-full flex-1 relative">
            {videoUrl ? (
                <video ref={videoRef} src={videoUrl} className="w-full h-full object-contain" />
            ) : (
                <p>Loading video...</p>
            )}
            {isTrimming && (
                <div className="absolute bottom-12 left-2 right-2 h-2">
                    <div className="relative h-full bg-white/20 rounded-full">
                        <Progress value={progress} className="absolute h-full bg-transparent" />
                        <div className="absolute top-0 h-full bg-red-500/50 rounded-full" style={{ left: `${startProgress}%`, width: `${endProgress - startProgress}%`}} />
                        {startTime !== null && (
                            <div className="absolute h-4 w-1 bg-white" style={{ left: `calc(${startProgress}% - 2px)`, top: '-4px' }} />
                        )}
                        {endTime !== null && (
                            <div className="absolute h-4 w-1 bg-white" style={{ left: `calc(${endProgress}% - 2px)`, top: '-4px' }} />
                        )}
                    </div>
                </div>
            )}
          </div>
          <div className="w-full p-2 flex items-center justify-center">
             <Button onClick={handleTogglePlay} variant="ghost" size="icon">
                  {isPlaying ? <Pause /> : <Play />}
            </Button>
          </div>
        </div>

        {/* Editing Tools Panel */}
        <div className="flex flex-col gap-4 overflow-y-auto pb-16">
            {isTrimming ? (
                 <div className="bg-neutral-800/50 p-4 rounded-lg">
                    <h3 className="text-lg font-bold mb-3">Trim Video</h3>
                    <div className="space-y-3">
                         <div className="flex items-center justify-between text-sm">
                            <span>Start: {startTime?.toFixed(2) || 'Not set'}s</span>
                             <Button size="sm" onClick={handleSetStart}>Set Start</Button>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span>End: {endTime?.toFixed(2) || 'Not set'}s</span>
                            <Button size="sm" onClick={handleSetEnd}>Set End</Button>
                        </div>
                        <Button variant="secondary" size="sm" className="w-full" onClick={handleClearTrim}>Clear Trim</Button>
                        <Separator className="my-2 bg-neutral-700" />
                        <div className="flex gap-2">
                            <Button variant="ghost" className="w-full" onClick={() => setIsTrimming(false)}>Cancel</Button>
                            <Button className="w-full" onClick={handleApplyTrim} disabled={isApplyingTrim}>
                                {isApplyingTrim && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Apply Trim
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                <div className="bg-neutral-800/50 p-4 rounded-lg border border-primary/30">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-3"><Sparkles className="text-primary"/> AI Enhancements</h3>
                    <button onClick={() => alert('Coming soon!')} className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-primary/10 transition-colors">
                        <Wand2 className="h-5 w-5 text-primary"/>
                        <div>
                            <p className="font-semibold">Auto-Improve</p>
                            <p className="text-xs text-neutral-400">Let AI fix lighting, color, and stability.</p>
                        </div>
                    </button>
                </div>
                
                <div className="bg-neutral-800/50 p-4 rounded-lg">
                    <h3 className="text-lg font-bold mb-3">Editing Tools</h3>
                    <div className="grid grid-cols-3 gap-2">
                        {editingTools.map(tool => (
                            <button key={tool.name} onClick={tool.action} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-neutral-700/60 hover:bg-neutral-700 transition-colors">
                                <tool.icon className="h-6 w-6" />
                                <span className="text-xs">{tool.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
                </>
            )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="py-2 flex justify-end">
        <button onClick={handleNext} className="bg-red-600 w-full md:w-auto px-8 py-3 rounded-lg text-white font-bold">
          Next
        </button>
      </div>
    </div>
  );
}
