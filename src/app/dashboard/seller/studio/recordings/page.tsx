'use client';

import React, { useEffect, useState } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
// import api from '@/lib/api'; // This would be used in a real backend scenario

export default function Recordings() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    // In a real app, you'd fetch the seller's videos here
    // e.g., api.get('/api/videos?sellerId=ME').then(r => setVideos(r.data || [])).catch(console.error);
  }, []);

  return (
    <SellerLayout>
      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">My Recordings</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* This is where video cards would be mapped */}
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
