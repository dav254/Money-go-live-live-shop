'use client';

import React from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, limit } from 'firebase/firestore';
import type { LiveSession, UserProfile } from '@/lib/types';
import { Radio, Users, Play, VideoOff } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

// Extracted for re-use and performance
const SellerInfo = ({ sellerId }: { sellerId: string }) => {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', sellerId), [firestore, sellerId]);
  const { data: user, isLoading } = useDoc<UserProfile>(userRef);

  if (isLoading) return <Skeleton className="h-4 w-24" />;
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-5 w-5 border border-white/10 shadow-sm">
        <AvatarImage src={user?.profilePictureUrl} />
        <AvatarFallback className="text-[10px] font-black">{user?.fullName?.charAt(0) || 'S'}</AvatarFallback>
      </Avatar>
      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{user?.shopName || user?.fullName || 'Verified Seller'}</span>
    </div>
  );
};

const StreamCard = ({ session }: { session: LiveSession }) => {
  return (
    <Link href={`/buyer/live/${session.id}`} className="block group">
        <Card className="overflow-hidden bg-neutral-900/50 border-white/5 hover:border-primary/50 transition-all duration-300 rounded-[2rem] shadow-2xl relative">
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                {/* Visual "Live" indicator layer */}
                <div className="absolute top-4 left-4 z-10">
                    <Badge className="bg-red-600 hover:bg-red-700 flex items-center gap-1.5 animate-pulse border-none px-3 py-1 font-black uppercase tracking-widest text-[9px]">
                        <div className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE
                    </Badge>
                </div>
                <div className="absolute bottom-4 left-4 z-10">
                    <Badge variant="secondary" className="bg-black/60 text-white border-none flex items-center gap-1.5 backdrop-blur-md px-3 py-1 font-black text-[9px]">
                        <Users className="h-3 w-3 text-primary" /> {(session.viewerCount || 0).toLocaleString()}
                    </Badge>
                </div>

                <div className="absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity duration-500 group-hover:scale-110">
                    <img 
                        src={`https://picsum.photos/seed/${session.id}/600/400`} 
                        alt="preview" 
                        className="w-full h-full object-cover" 
                        loading="lazy" 
                    />
                </div>
                
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                
                <div className="relative z-10 p-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100 shadow-2xl">
                    <Play className="h-8 w-8 text-white fill-white" />
                </div>
            </div>

            <CardHeader className="p-6 space-y-3">
                <CardTitle className="text-lg font-black uppercase tracking-tighter line-clamp-1 text-white leading-none group-hover:text-primary transition-colors">
                    {session.title}
                </CardTitle>
                <SellerInfo sellerId={session.sellerId} />
            </CardHeader>
        </Card>
    </Link>
  );
};

export default function BuyerLiveNowPage() {
  const firestore = useFirestore();

  // High-performance query: Limited to 24 results for fast first paint
  const liveSessionsQuery = useMemoFirebase(() => {
    return query(
        collection(firestore, 'liveSessions'), 
        where('status', '==', 'live'),
        limit(24)
    );
  }, [firestore]);

  const { data: sessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);

  const verifiedSessions = React.useMemo(() => {
    if (!sessions) return [];
    
    return sessions.filter(session => {
        if (!session.videosdkMeetingId) return false;
        
        // Anti-stale logic: Only show shows started in the last 12 hours
        const startTime = session.startTime?.toMillis?.() || 0;
        const now = Date.now();
        if (now - startTime > 12 * 60 * 60 * 1000) return false;

        return true;
    }).sort((a, b) => 
      (b.startTime?.toMillis?.() || 0) - (a.startTime?.toMillis?.() || 0)
    );
  }, [sessions]);

  return (
    <BuyerLayout>
      <div className="flex-1 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl font-black uppercase tracking-tighter text-white leading-none flex items-center gap-4">
              <div className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600"></span>
              </div>
              Live Experience
            </h1>
            <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mt-2">Authentic, real-time shopping from verified local sellers.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="overflow-hidden border-white/5 bg-neutral-900/50 rounded-[2rem]">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="p-6 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
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
          <Card className="bg-neutral-950 border-white/5 border-2 border-dashed py-32 text-center rounded-[3rem] shadow-2xl">
            <CardContent className="flex flex-col items-center">
              <div className="p-8 rounded-full bg-white/5 border border-white/5 mb-8 shadow-inner">
                <VideoOff className="h-14 w-14 text-neutral-800" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-white">The Stage is Empty</h2>
              <p className="text-neutral-500 font-medium text-sm mt-3 max-w-xs leading-relaxed">No sellers are broadcasting right now. Follow your favorite shops to get an alert when they go live.</p>
              <Button variant="outline" className="mt-10 font-black uppercase tracking-widest text-[10px] h-14 px-12 rounded-2xl border-white/10 hover:bg-white/5" asChild>
                <Link href="/buyer/dashboard">DISCOVER PRODUCTS</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </BuyerLayout>
  );
}
