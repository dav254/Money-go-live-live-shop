
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Scissors, Music, Wand2, X, Play, Pause, Loader2, ChevronsRight, ChevronsLeft, Trash2, Pilcrow, UploadCloud } from 'lucide-react';
import { get as idbGet, set as idbSet } from '@/lib/idb';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

const musicLibrary = [
  { id: 'music1', title: 'Uplifting Corporate', src: 'https://cdn.pixabay.com/download/audio/2022/08/03/audio_34b7f52af9.mp3', mood: 'Uplifting' },
  { id: 'music2', title: 'Chill Abstract', src: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_e79c2980a3.mp3', mood: 'Relaxing' },
  { id: 'music3', title: 'Inspiring Dreams', src: 'https://cdn.pixabay.com/download/audio/2022/11/21/audio_13a969f654.mp3', mood: 'Inspirational' },
  { id: 'music4', title: 'Lofi Study', src: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_18aad7b4e6.mp3', mood: 'Chill' },
];

type MusicTrack = typeof musicLibrary[0] & { isUploaded?: boolean };

// New overlay type
interface Overlay {
  id: number;
  text: string;
  style: React.CSSProperties;
}

export default function VideoEditor() {
  const router = useRouter();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicFileInputRef = useRef<HTMLInputElement>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'trim' | 'music' | 'overlays' | null>(null);
  
  // Trim state
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [isApplyingTrim, setIsApplyingTrim] = useState(false);

  // General state
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);

  // Overlay state
  const [overlays, setOverlays] = useState<Overlay[]>([]);

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
  const handleApplyTrim = async () => { /* ... (implementation needed for trimming video blob) ... */ };

  // Loop within trim range
  useEffect(() => {
    const video = videoRef.current;
    if (!video || activeTool !== 'trim') return;

    const handleTimeUpdate = () => {
      if (endTime !== null && video.currentTime >= endTime) {
        video.currentTime = startTime !== null ? startTime : 0;
        if(audioRef.current) audioRef.current.currentTime = startTime !== null ? startTime : 0;
        video.play();
      }
    };
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [activeTool, startTime, endTime]);

  const handleMusicUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('audio/')) {
        toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please select an audio file.' });
        return;
    }

    try {
        const objectUrl = URL.createObjectURL(file);
        const uploadedTrack: MusicTrack = {
            id: `uploaded-${Date.now()}`,
            title: file.name,
            src: objectUrl,
            mood: 'Custom',
            isUploaded: true
        };
        setSelectedMusic(uploadedTrack);
        await idbSet('videoStudioDB', 'videoClips', 'uploadedMusic', file);
    } catch (error) {
        console.error("Error handling music upload:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load your music file.' });
    }
  };

  const handleAddOverlay = (text: string) => {
    const newOverlay: Overlay = {
        id: Date.now(),
        text,
        style: {
            position: 'absolute',
            top: '80%',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '8px',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.2rem',
            whiteSpace: 'nowrap'
        }
    };
    setOverlays(prev => [...prev, newOverlay]);
  };

  const handleRemoveOverlay = (id: number) => {
    setOverlays(prev => prev.filter(o => o.id !== id));
  };
  
  const handleNext = async () => {
    await idbSet('videoStudioDB', 'videoClips', 'selectedMusic', selectedMusic);
    await idbSet('videoStudioDB', 'videoClips', 'overlays', overlays);
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
            
            {/* Render Overlays */}
            <div className="absolute inset-0 pointer-events-none">
                {overlays.map(overlay => (
                    <div key={overlay.id} style={overlay.style}>
                        {overlay.text}
                    </div>
                ))}
            </div>

            {selectedMusic && (
                <div className="absolute bottom-16 left-4 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                    <Music className="h-4 w-4" /> <span>{selectedMusic.title}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedMusic(null)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                </div>
            )}
            {activeTool === 'trim' && (
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
            {!activeTool ? (
                <Card className="bg-neutral-800/50 p-4 rounded-lg">
                    <h3 className="text-lg font-bold mb-3">Editing Tools</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => setActiveTool('trim')} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-neutral-700/60 hover:bg-neutral-700"><Scissors className="h-6 w-6" /><span className="text-xs">Trim</span></button>
                        <button onClick={() => setActiveTool('music')} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-neutral-700/60 hover:bg-neutral-700"><Music className="h-6 w-6" /><span className="text-xs">Music</span></button>
                         <button onClick={() => setActiveTool('overlays')} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-neutral-700/60 hover:bg-neutral-700"><Pilcrow className="h-6 w-6" /><span className="text-xs">Overlays</span></button>
                    </div>
                </Card>
            ) : (
                <Button variant="ghost" onClick={() => setActiveTool(null)} className="w-full justify-start"><ChevronsLeft className="h-4 w-4 mr-2"/>Back to Tools</Button>
            )}

            {activeTool === 'trim' && (
                 <Card className="bg-neutral-800/50">
                    <CardHeader><CardTitle className="text-lg">Trim Video</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm"><p>Start: <span className="font-mono">{startTime?.toFixed(2) || '0.00'}s</span></p><Button size="sm" onClick={handleSetStart}><ChevronsLeft className="h-4 w-4 mr-1"/>Set Start</Button></div>
                        <div className="flex items-center justify-between text-sm"><p>End: <span className="font-mono">{endTime?.toFixed(2) || 'Not set'}</span></p><Button size="sm" onClick={handleSetEnd}><ChevronsRight className="h-4 w-4 mr-1"/>Set End</Button></div>
                        <Button variant="secondary" size="sm" className="w-full" onClick={handleClearTrim}>Clear Trim</Button>
                        <Separator className="my-2 bg-neutral-700" />
                        <div className="flex gap-2">
                            <Button className="w-full" onClick={handleApplyTrim} disabled={isApplyingTrim}>{isApplyingTrim && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Apply Trim</Button>
                        </div>
                    </CardContent>
                </Card>
            )}
             {activeTool === 'music' && (
                 <Card className="bg-neutral-800/50">
                    <CardHeader><CardTitle className="text-lg">Select Music</CardTitle></CardHeader>
                    <CardContent>
                         <input type="file" ref={musicFileInputRef} accept="audio/*" onChange={handleMusicUpload} className="hidden" />
                        <Button variant="outline" className="w-full mb-4" onClick={() => musicFileInputRef.current?.click()}><UploadCloud className="h-4 w-4 mr-2" />Upload Your Music</Button>
                        <ScrollArea className="h-80">
                            <div className="space-y-2 pr-4">
                                {musicLibrary.map(track => (
                                    <button key={track.id} onClick={() => setSelectedMusic(track)} className={cn("w-full text-left p-3 rounded-md hover:bg-neutral-700 transition-colors", selectedMusic?.id === track.id && 'bg-primary/20')}>
                                        <p className="font-semibold">{track.title}</p>
                                        <p className="text-xs text-muted-foreground">{track.mood}</p>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                 </Card>
            )}
            {activeTool === 'overlays' && (
                 <Card className="bg-neutral-800/50">
                    <CardHeader><CardTitle className="text-lg">Add Text Overlays</CardTitle></CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {["50% OFF", "SALE", "New Arrival", "Shop Now", "Free Shipping", "Best Seller"].map(text => (
                                <Button key={text} variant="secondary" onClick={() => handleAddOverlay(text)}>{text}</Button>
                            ))}
                        </div>
                        <Separator className="bg-neutral-700" />
                        <div className="mt-4 space-y-2">
                            <h4 className="text-sm font-semibold">Active Overlays</h4>
                            {overlays.length > 0 ? overlays.map(overlay => (
                                <div key={overlay.id} className="flex items-center justify-between bg-neutral-700 p-2 rounded-md">
                                    <span className="text-sm">{overlay.text}</span>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRemoveOverlay(overlay.id)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )) : <p className="text-xs text-muted-foreground text-center">No overlays added.</p>}
                        </div>
                    </CardContent>
                 </Card>
            )}
        </div>
      </div>

      <div className="py-2 flex justify-end">
        <button onClick={handleNext} className="bg-red-600 w-full md:w-auto px-8 py-3 rounded-lg text-white font-bold">Next</button>
      </div>
    </div>
  );
}

