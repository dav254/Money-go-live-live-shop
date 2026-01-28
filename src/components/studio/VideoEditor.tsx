'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Scissors, Crop, Mic, Tag, Music, MessageSquare, UploadCloud, Sparkles, Wand2 } from 'lucide-react';
import { get as idbGet } from '@/lib/idb';

export default function VideoEditor() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string;
    async function loadVideo() {
      try {
        const blob = await idbGet<Blob>('videoStudioDB', 'videoClips', 'latestVideo');
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setVideoUrl(objectUrl);
        } else {
          // If no video is found, go back to recording
          router.push('/seller/studio/record');
        }
      } catch (error) {
        console.error("Failed to load video from IndexedDB:", error);
        router.push('/seller/studio/record');
      }
    }
    loadVideo();
    
    // Cleanup the object URL when component unmounts
    return () => {
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
        }
    }
  }, [router]);

  function handleNext() {
    // The video blob is already in IndexedDB, so we can just proceed
    router.push('/seller/studio/product');
  }

  const editingTools = [
      { name: 'Hotspots', icon: Tag, action: () => alert('Feature coming soon: Add shoppable tags to your video!') },
      { name: 'Captions', icon: MessageSquare, action: () => alert('Feature coming soon: Auto-generate captions with AI!') },
      { name: 'Music', icon: Music, action: () => alert('Feature coming soon: Add background music!') },
      { name: 'Voiceover', icon: Mic, action: () => alert('Feature coming soon: Record a voiceover!') },
      { name: 'Trim', icon: Scissors, action: () => alert('Trimming functionality coming soon!') },
      { name: 'Crop', icon: Crop, action: () => alert('Cropping functionality coming soon!') },
  ];
  
  const textOverlays = ["50% OFF", "New Arrival", "Limited Stock", "Sale"];

  return (
    <div className="bg-black text-white h-screen flex flex-col p-2 md:p-4">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
        
        <div className="lg:col-span-2 h-full flex items-center justify-center bg-neutral-900 rounded-lg">
          {videoUrl ? (
            <video src={videoUrl} controls className="w-full max-h-full rounded-lg" />
          ) : (
            <p>Loading video...</p>
          )}
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto pb-16">
            <div className="bg-neutral-800/50 p-4 rounded-lg border border-primary/30">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-3"><Sparkles className="text-primary"/> AI Enhancements</h3>
                <button onClick={() => alert('Coming soon!')} className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-primary/10 transition-colors">
                    <Wand2 className="h-5 w-5 text-primary"/>
                    <div>
                        <p className="font-semibold">Auto-Improve</p>
                        <p className="text-xs text-neutral-400">Let AI fix lighting, color, and stability.</p>
                    </div>
                </button>
                 <button onClick={() => alert('Coming soon!')} className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-primary/10 transition-colors mt-2">
                    <MessageSquare className="h-5 w-5 text-primary"/>
                    <div>
                        <p className="font-semibold">Generate Captions</p>
                        <p className="text-xs text-neutral-400">Automatically create subtitles from audio.</p>
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

            <div className="bg-neutral-800/50 p-4 rounded-lg">
                <h3 className="text-lg font-bold mb-3">Overlays</h3>
                 <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-700 transition-colors border border-dashed border-neutral-600">
                    <UploadCloud className="h-5 w-5 text-neutral-400"/>
                    <span className="text-sm">Upload Your Logo</span>
                </button>
                <div className="grid grid-cols-2 gap-2 mt-3">
                    {textOverlays.map(text => (
                        <button key={text} className="p-2 text-xs text-center rounded-md bg-neutral-700/60 hover:bg-neutral-700 transition-colors">
                            {text}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      <div className="py-2 flex justify-end">
        <button onClick={handleNext} className="bg-red-600 w-full md:w-auto px-8 py-3 rounded-lg text-white font-bold">
          Next
        </button>
      </div>
    </div>
  );
}
