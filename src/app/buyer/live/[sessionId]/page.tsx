'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { LiveSession, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, VideoOff, ChevronLeft, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LiveChat } from '@/components/buyer/LiveChat';

const VideoSDKViewer = dynamic(() => import('@/components/buyer/VideoSDKViewer'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-black rounded-xl">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-white font-bold">Loading video player...</p>
    </div>
  ),
});

export default function BuyerLiveStreamViewPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const firestore = useFirestore();

  const sessionRef = useMemoFirebase(() => doc(firestore, 'liveSessions', sessionId), [firestore, sessionId]);
  const { data: session, isLoading: isSessionLoading } = useDoc<LiveSession>(sessionRef);

  const sellerRef = useMemoFirebase(() => {
    if (!session?.sellerId) return null;
    return doc(firestore, 'userProfiles', session.sellerId);
  }, [firestore, session]);
  const { data: seller } = useDoc<UserProfile>(sellerRef);

  if (isSessionLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!session || session.status === 'ended') {
    return (
      <BuyerLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
          <VideoOff className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold">This stream has ended</h2>
          <p className="text-muted-foreground mb-6">Check out other live shows on the platform.</p>
          <Button onClick={() => router.push('/buyer/live')}>Browse Live Shows</Button>
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout fullWidth>
      <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row overflow-hidden bg-black">
        {/* Main Stream Area */}
        <div className="flex-1 relative flex flex-col p-4 lg:p-6">
          <div className="absolute top-8 left-8 z-20 flex items-center gap-4">
            <Button variant="ghost" size="icon" className="bg-black/50 hover:bg-black/70 rounded-full text-white" onClick={() => router.back()}>
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md p-2 rounded-full border border-white/10 pr-6">
              <Avatar className="h-10 w-10 border-2 border-primary">
                <AvatarImage src={seller?.profilePictureUrl} />
                <AvatarFallback>{seller?.fullName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-bold text-white leading-none">{seller?.shopName || seller?.fullName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="h-4 bg-red-600 px-1 text-[10px] animate-pulse">LIVE</Badge>
                  <span className="text-[10px] text-neutral-300 flex items-center gap-1">
                    <Users className="h-3 w-3" /> {session.viewerCount || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {session.videosdkMeetingId && (
              <VideoSDKViewer meetingId={session.videosdkMeetingId} />
            )}
          </div>
        </div>

        {/* Chat Area - Sidebar on desktop, Hidden on mobile for now to focus on video */}
        <div className="hidden lg:flex w-80 shrink-0 flex-col border-l border-white/10 bg-neutral-950">
          <LiveChat streamId={sessionId} />
        </div>
      </div>
    </BuyerLayout>
  );
}
