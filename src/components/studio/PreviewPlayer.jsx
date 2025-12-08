'use client';

import { useEffect, useState } from 'react';

export default function PreviewPlayer() {
  const [videoUrl, setVideoUrl] = useState(null);

  useEffect(() => {
    const url = localStorage.getItem('videoUrl');
    if (url) {
      setVideoUrl(url);
    }
  }, []);

  return (
    <div className="h-full w-full">
      {videoUrl && <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover" />}
    </div>
  );
}
