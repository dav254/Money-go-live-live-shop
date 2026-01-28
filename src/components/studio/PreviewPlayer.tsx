'use client';

import { useEffect, useState } from 'react';
import { get as idbGet } from '@/lib/idb';
import { useRouter } from 'next/navigation';

export default function PreviewPlayer() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let objectUrl: string;
    async function loadVideo() {
        try {
            const blob = await idbGet<Blob>('videoStudioDB', 'videoClips', 'latestVideo');
            if (blob) {
                objectUrl = URL.createObjectURL(blob);
                setVideoUrl(objectUrl);
            } else {
                console.warn('No video found in IndexedDB, returning to start.');
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

  return (
    <div className="h-full w-full">
      {videoUrl ? (
          <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover" />
      ) : (
          <div className="w-full h-full flex items-center justify-center bg-black">
              <p className="text-muted-foreground">Loading preview...</p>
          </div>
      )}
    </div>
  );
}
