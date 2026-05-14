'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';
import { Loader2, Radio } from 'lucide-react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const VideoSDKViewer = dynamic(() => import('@/components/buyer/VideoSDKViewer'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-black text-center p-8">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      <p className="text-white font-black uppercase tracking-widest text-[10px]">Initializing Signal Sync...</p>
    </div>
  ),
});

export default function BuyerLiveSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const firestore = useFirestore();

  // Subscribe to the live session document
  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !sessionId) return null;
    return doc(firestore, 'liveSessions', sessionId);
  }, [firestore, sessionId]);

  const { data: session, isLoading: isSessionLoading } = useDoc<LiveSession>(sessionRef);

  // Auto-redirect if session ended
  React.useEffect(() => {
    if (!isSessionLoading && session?.status === 'ended') {
      router.push('/buyer/live-now');
    }
  }, [session, isSessionLoading, router]);

  if (isSessionLoading) {
    return (
      <BuyerLayout fullWidth>
        <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-black">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs mt-4">Syncing Studio Signal...</p>
        </div>
      </BuyerLayout>
    );
  }

  // Handle case where session doesn't exist or isn't live yet
  if (!session || session.status !== 'live' || !session.videosdkMeetingId) {
    return (
      <BuyerLayout fullWidth>
        <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-black text-center p-8">
          <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-6">
            <Radio className="h-12 w-12 text-neutral-700" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-white">Connecting to Host...</h1>
          <p className="text-neutral-500 mt-2 max-w-xs mx-auto text-sm font-medium">Waiting for the seller to begin the broadcast. Hang tight!</p>
          <button 
            className="mt-8 px-6 py-2 bg-primary text-white font-bold rounded-xl uppercase text-[10px] tracking-widest"
            onClick={() => router.push('/buyer/live-now')}
          >
            Back to lobby
          </button>
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout fullWidth>
      <div className="relative h-[calc(100vh-4rem)] w-full bg-black overflow-hidden">
        {/* Full-screen Video Section */}
        <div className="absolute inset-0 z-0">
          <VideoSDKViewer meetingId={session.videosdkMeetingId} />
        </div>

        {/* Status Overlay */}
        <div className="absolute top-6 left-6 z-10 pointer-events-none">
          <div className="flex items-center gap-3 bg-red-600 px-4 py-1.5 rounded-full shadow-2xl shadow-red-600/20 animate-pulse">
            <div className="h-2 w-2 rounded-full bg-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Now</span>
          </div>
        </div>
      </div>
    </BuyerLayout>
  );
}