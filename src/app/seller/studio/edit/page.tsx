'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Scissors, Music, Wand2, X, Play, Pause, Loader2, ChevronsRight, ChevronsLeft, Trash2 } from 'lucide-react';
import { get as idbGet, set as idbSet } from '@/lib/idb';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

// Mock music library
const musicLibrary = [
  { id: 'music1', title: 'Uplifting Corporate', src: 'https://cdn.pixabay.com/download/audio/2022/08/03/audio_34b7f52af9.mp3' },
  { id: 'music2', title: 'Chill Abstract', src: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_e79c2980a3.mp3' },
  { id: 'music3', title: 'Inspiring Dreams', src: 'https://cdn.pixabay.com/download/audio/2022/11/21/audio_13a969f654.mp3' },
  { id: 'music4', title: 'Lofi Study', src: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_18aad7b4e6.mp3' },
];

type MusicTrack = typeof musicLibrary[0];

export default function VideoEditor() {
  const router = useRouter();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isApplyingTrim, setIsApplyingTrim] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [isMusicPanelOpen, setIsMusicPanelOpen] = useState(false);

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
  
  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video) {
        if (video.paused) {
            video.play().catch(console.error);
            if (audio && selectedMusic) audio.play().catch(console.error);
        } else {
            video.pause();
            if (audio) audio.pause();
        }
    }
  }, [selectedMusic]);

  // Video and Audio player state sync
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;

    const handlePlay = () => { setIsPlaying(true); if (selectedMusic) audio.play(); };
    const handlePause = () => { setIsPlaying(false); audio.pause(); };
    const handleSeek = () => { if (selectedMusic) audio.currentTime = video.currentTime; };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeek);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeek);
    }
  }, [selectedMusic]);
  
  // Update audio src when music changes
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
        audio.src = selectedMusic?.src || '';
        if(selectedMusic) audio.play();
    }
  }, [selectedMusic]);


  const handleSetStart = () => { if (videoRef.current) setStartTime(videoRef.current.currentTime); };
  const handleSetEnd = () => { if (videoRef.current) setEndTime(videoRef.current.currentTime); };
  const handleClearTrim = () => { setStartTime(null); setEndTime(null); };

  const handleApplyTrim = async () => { /* ... (previous implementation) ... */ };

  // Loop within trim range
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isTrimming) return;

    const handleTimeUpdate = () => {
      if (endTime !== null && video.currentTime >= endTime) {
        video.currentTime = startTime !== null ? startTime : 0;
        if(audioRef.current) audioRef.current.currentTime = startTime !== null ? startTime : 0;
        video.play();
      }
    };
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isTrimming, startTime, endTime]);
  
  const handleNext = async () => {
    if (selectedMusic) {
        await idbSet('videoStudioDB', 'videoClips', 'selectedMusic', selectedMusic);
    } else {
        await idbSet('videoStudioDB', 'videoClips', 'selectedMusic', null);
    }
    router.push('/seller/studio/product');
  };

  const progress = videoRef.current && videoRef.current.duration ? (videoRef.current.currentTime / videoRef.current.duration) * 100 : 0;
  const startProgress = startTime !== null && videoRef.current ? (startTime / videoRef.current.duration) * 100 : 0;
  const endProgress = endTime !== null && videoRef.current ? (endTime / videoRef.current.duration) * 100 : 100;
  
  return (
    <div className="bg-black text-white h-screen flex flex-col p-2 md:p-4">
      <audio ref={audioRef} loop />
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
        
        {/* Main Video Preview */}
        <div className="lg:col-span-2 h-full flex flex-col items-center justify-center bg-neutral-900 rounded-lg">
          <div className="w-full max-h-full flex-1 relative">
            {videoUrl ? (
                <video ref={videoRef} src={videoUrl} className="w-full h-full object-contain" />
            ) : (
                <div className="w-full h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
            )}
             {selectedMusic && (
                <div className="absolute bottom-16 left-4 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                    <Music className="h-4 w-4" /> <span>{selectedMusic.title}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedMusic(null)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                </div>
            )}
            {isTrimming && (
                <div className="absolute bottom-12 left-2 right-2 h-2">
                    <div className="relative h-full bg-white/20 rounded-full">
                        <Progress value={progress} className="absolute h-full bg-transparent" />
                        <div className="absolute top-0 h-full bg-primary/50 rounded-full" style={{ left: `${startProgress}%`, width: `${endProgress - startProgress}%`}} />
                        {startTime !== null && <div className="absolute h-4 w-1 bg-white" style={{ left: `calc(${startProgress}% - 2px)`, top: '-4px' }} />}
                        {endTime !== null && <div className="absolute h-4 w-1 bg-white" style={{ left: `calc(${endProgress}% - 2px)`, top: '-4px' }} />}
                    </div>
                </div>
            )}
          </div>
          <div className="w-full p-2 flex items-center justify-center">
             <Button onClick={handleTogglePlay} variant="ghost" size="icon">{isPlaying ? <Pause /> : <Play />}</Button>
          </div>
        </div>

        {/* Editing Tools Panel */}
        <div className="flex flex-col gap-4 overflow-y-auto pb-16">
            {isMusicPanelOpen ? (
                 <Card className="bg-neutral-800/50">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Select Music</CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => setIsMusicPanelOpen(false)}><X className="h-4 w-4" /></Button>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-96">
                            <div className="space-y-2 pr-4">
                                {musicLibrary.map(track => (
                                    <button key={track.id} onClick={() => setSelectedMusic(track)} className={cn("w-full text-left p-3 rounded-md hover:bg-neutral-700 transition-colors", selectedMusic?.id === track.id && 'bg-primary/20')}>
                                        <p className="font-semibold">{track.title}</p>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                 </Card>
            ) : isTrimming ? (
                 <Card className="bg-neutral-800/50">
                    <CardHeader><CardTitle className="text-lg">Trim Video</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm"><p>Start: <span className="font-mono">{startTime?.toFixed(2) || '0.00'}s</span></p><Button size="sm" onClick={handleSetStart}><ChevronsLeft className="h-4 w-4 mr-1"/>Set Start</Button></div>
                        <div className="flex items-center justify-between text-sm"><p>End: <span className="font-mono">{endTime?.toFixed(2) || 'Not set'}</span></p><Button size="sm" onClick={handleSetEnd}><ChevronsRight className="h-4 w-4 mr-1"/>Set End</Button></div>
                        <Button variant="secondary" size="sm" className="w-full" onClick={handleClearTrim}>Clear Trim</Button>
                        <Separator className="my-2 bg-neutral-700" />
                        <div className="flex gap-2">
                            <Button variant="ghost" className="w-full" onClick={() => setIsTrimming(false)}>Cancel</Button>
                            <Button className="w-full" onClick={handleApplyTrim} disabled={isApplyingTrim}>{isApplyingTrim && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Apply Trim</Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="bg-neutral-800/50 p-4 rounded-lg">
                    <h3 className="text-lg font-bold mb-3">Editing Tools</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => setIsTrimming(true)} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-neutral-700/60 hover:bg-neutral-700"><Scissors className="h-6 w-6" /><span className="text-xs">Trim</span></button>
                        <button onClick={() => setIsMusicPanelOpen(true)} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-neutral-700/60 hover:bg-neutral-700"><Music className="h-6 w-6" /><span className="text-xs">Music</span></button>
                    </div>
                </Card>
            )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="py-2 flex justify-end">
        <button onClick={handleNext} className="bg-red-600 w-full md:w-auto px-8 py-3 rounded-lg text-white font-bold">Next</button>
      </div>
    </div>
  );
}
