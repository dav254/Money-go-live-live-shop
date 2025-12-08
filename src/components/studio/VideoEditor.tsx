
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VideoEditor() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = localStorage.getItem('videoUrl');
    if (url) {
      setVideoUrl(url);
    } else {
      router.push('/seller/studio/record');
    }
  }, [router]);

  function handleSave() {
    // In a real app, you would save the edit information.
    // For this frontend-only example, we just navigate to the next page.
    router.push('/seller/studio/product');
  }

  return (
    <div className="p-4 space-y-4">
      {videoUrl && <video src={videoUrl} controls className="w-full rounded-lg" />}

      <div className="flex gap-2">
        <button className="bg-gray-800 px-4 py-2 rounded-lg text-white">Trim</button>
        <button className="bg-gray-800 px-4 py-2 rounded-lg text-white">Crop</button>
        <button className="bg-gray-800 px-4 py-2 rounded-lg text-white">Mute</button>
      </div>

      <button onClick={handleSave} className="bg-blue-600 w-full py-3 rounded-lg text-white">
        Save Edit
      </button>
    </div>
  );
}
