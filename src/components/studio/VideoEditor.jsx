
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Scissors, Crop, MicOff, Tag, Music, MessageSquare } from 'lucide-react';

export default function VideoEditor() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState(null);

  useEffect(() => {
    const url = localStorage.getItem('videoUrl');
    if (url) {
      setVideoUrl(url);
    } else {
      // If no video is found, redirect back to the recording page
      router.push('/seller/studio/record');
    }
  }, [router]);

  function handleNext() {
    // In a real app, you would save the edit information.
    // For this frontend-only example, we just navigate to the next page.
    router.push('/seller/studio/product');
  }
  
  const editingTools = [
      { name: 'Hotspots', icon: Tag, action: () => alert('Feature coming soon: Add shoppable tags to your video!') },
      { name: 'Captions', icon: MessageSquare, action: () => alert('Feature coming soon: Auto-generate captions!') },
      { name: 'Music', icon: Music, action: () => alert('Feature coming soon: Add background music!') },
      { name: 'Trim', icon: Scissors, action: () => {} },
      { name: 'Crop', icon: Crop, action: () => {} },
      { name: 'Mute', icon: MicOff, action: () => {} },
  ]

  return (
    <div className="bg-black text-white h-screen flex flex-col p-4">
      <div className="flex-1 flex items-center justify-center">
        {videoUrl ? (
          <video src={videoUrl} controls className="w-full max-w-md rounded-lg" />
        ) : (
          <p>Loading video...</p>
        )}
      </div>

      <div className="py-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Editing Tools</h3>
        <div className="grid grid-cols-6 gap-2">
            {editingTools.map(tool => (
                 <button key={tool.name} onClick={tool.action} className="flex flex-col items-center gap-2 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
                    <tool.icon className="h-6 w-6" />
                    <span className="text-xs">{tool.name}</span>
                </button>
            ))}
        </div>
      </div>

      <button onClick={handleNext} className="bg-red-600 w-full py-3 rounded-lg text-white font-bold">
        Next
      </button>
    </div>
  );
}
