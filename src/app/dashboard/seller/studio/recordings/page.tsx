'use client';

import React, { useEffect, useState } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import api from '@/lib/api';

export default function Recordings() {
  const [videos, setVideos] = useState([]);
  useEffect(() => {
    // api.get('/api/videos?sellerId=ME').then(r => setVideos(r.data || [])).catch(console.error);
  }, []);

  return (
    <SellerLayout>
      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">My Recordings</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {videos.map(v => (
            <div key={v._id} className="bg-zinc-900 p-3 rounded">
              <video src={v.videoUrl} className="w-full h-48 object-cover rounded" controls />
              <div className="mt-2 flex items-center justify-between">
                <div>{v.title || 'Untitled'}</div>
                <div>
                  <a className="text-sm text-blue-400" href={`/seller/studio/edit?videoId=${v._id}`}>Edit</a>
                </div>
              </div>
            </div>
          ))}
           {videos.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground p-12 border border-dashed rounded-lg">
              You have no saved recordings.
            </div>
          )}
        </div>
      </main>
    </SellerLayout>
  );
}
