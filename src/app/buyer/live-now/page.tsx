'use client';

import React from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { LiveSession, UserProfile } from '@/lib/types';
import { Radio, Users, Play, VideoOff, Signal } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const SellerInfo = ({ sellerId }: { sellerId: string }) => {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', sellerId), [firestore, sellerId]);
  const { data: user, isLoading } = useDoc<UserProfile>(userRef);

  if (isLoading) return <Skeleton className="h-4 w-24" />;
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarImage src={user?.profilePictureUrl} />
        <AvatarFallback>{user?.fullName?.charAt(0)}</AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{user?.shopName || user?.fullName || 'Seller'}</span>
    </div>
  );
};

const StreamCard = ({ session }: { session: LiveSession }) => {
  return (
    <Card className="overflow-hidden group hover:border-primary transition-all border-2 bg-neutral-900/50 border-white/5">
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
        <div className="absolute top-2 left-2 z-10">
          <Badge className="bg-red-600 hover:bg-red-700 flex items-center gap-1 animate-pulse border-none">
            <Radio className="h-3 w-3" /> LIVE
          </Badge>
        </div>
        <div className="absolute bottom-2 left-2 z-10">
          <Badge variant="secondary" className="bg-black/50 text-white border-none flex items-center gap-1 backdrop-blur-sm">
            <Users className="h-3 w-3 text-primary" /> {session.viewerCount || 0}
          </Badge>
        </div>
        <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity">
            <img src={`https://picsum.photos/seed/${session.id}/600/400`} alt="preview" className="w-full h-full object-cover" />
        </div>
        <Play className="h-12 w-12 text-white/50 group-hover:text-white group-hover:scale-110 transition-all relative z-10" />
      </div>
      <CardHeader className="p-4">
        <CardTitle className="text-lg line-clamp-1 text-white">{session.title}</CardTitle>
        <CardDescription>
          <SellerInfo sellerId={session.sellerId} />
        </CardDescription>
      </CardHeader>
      <CardFooter className="p-4 pt-0">
        <Button asChild className="w-full bg-primary hover:bg-primary/90 font-black uppercase tracking-widest text-xs h-11" size="sm">
          <Link href={`/buyer/live/${session.id}`}>Watch Now</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

export default function BuyerLiveNowPage() {
  const firestore = useFirestore();

  // STRICT FILTER: Only show sessions that are 'live' AND have a meeting ID
  const liveSessionsQuery = useMemoFirebase(() => {
    return query(
        collection(firestore, 'liveSessions'), 
        where('status', '==', 'live')
    );
  }, [firestore]);

  const { data: sessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);

  // Deep validation: Ensure we only show sessions that are ACTUALLY live right now
  const verifiedSessions = React.useMemo(() => {
    if (!sessions) return [];
    
    return sessions.filter(session => {
        // Must have a meeting ID and have started recently
        if (!session.videosdkMeetingId) return false;
        
        // Heartbeat check: If it was started more than 24 hours ago, it's stale
        const startTime = session.startTime?.toMillis?.() || 0;
        const now = Date.now();
        if (now - startTime > 24 * 60 * 60 * 1000) return false;

        return true;
    }).sort((a, b) => 
      (b.startTime?.toMillis?.() || 0) - (a.startTime?.toMillis?.() || 0)
    );
  }, [sessions]);

  return (
    <BuyerLayout>
      <div className="flex-1 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-headline text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
              <Radio className="h-8 w-8 text-red-600 animate-pulse" />
              Live Now
            </h1>
            <p className="text-muted-foreground font-medium text-sm">Authentic shopping experiences happening right now.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="overflow-hidden border-white/5 bg-neutral-900/50">
                <Skeleton className="aspect-video w-full rounded-none" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : verifiedSessions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {verifiedSessions.map(session => (
              <StreamCard key={session.id} session={session} />
            ))}
          </div>
        ) : (
          <Card className="bg-muted/10 border-dashed border-2 py-32 text-center border-white/10">
            <CardContent>
              <div className="mx-auto bg-neutral-900 p-6 rounded-full w-fit mb-6 border border-white/5">
                <VideoOff className="h-12 w-12 text-muted-foreground opacity-50" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white">No Active Shows</h2>
              <p className="text-muted-foreground max-w-xs mx-auto mt-2 font-medium">Check back soon or follow your favorite sellers to get notified when they start a broadcast.</p>
              <Button variant="outline" className="mt-8 font-black uppercase tracking-widest text-[10px]" asChild>
                <Link href="/buyer/dashboard">Discover Products</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </BuyerLayout>
  );
}
