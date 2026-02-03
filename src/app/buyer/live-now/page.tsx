
'use client';

import React from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { LiveSession, UserProfile } from '@/lib/types';
import { Radio, Users, Play, VideoOff } from 'lucide-react';
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
    <Card className="overflow-hidden group hover:border-primary/50 transition-all border-2">
      <div className="relative aspect-video bg-black flex items-center justify-center">
        <div className="absolute top-2 left-2 z-10">
          <Badge className="bg-red-600 hover:bg-red-700 flex items-center gap-1 animate-pulse">
            <Radio className="h-3 w-3" /> LIVE
          </Badge>
        </div>
        <div className="absolute bottom-2 left-2 z-10">
          <Badge variant="secondary" className="bg-black/50 text-white border-none flex items-center gap-1">
            <Users className="h-3 w-3" /> {session.viewerCount || 0}
          </Badge>
        </div>
        <Play className="h-12 w-12 text-white/50 group-hover:text-white group-hover:scale-110 transition-all" />
      </div>
      <CardHeader className="p-4">
        <CardTitle className="text-lg line-clamp-1">{session.title}</CardTitle>
        <CardDescription>
          <SellerInfo sellerId={session.sellerId} />
        </CardDescription>
      </CardHeader>
      <CardFooter className="p-4 pt-0">
        <Button asChild className="w-full bg-primary hover:bg-primary/90 font-bold" size="sm">
          <Link href={`/buyer/live/${session.id}`}>Watch Now</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

export default function BuyerLiveNowPage() {
  const firestore = useFirestore();

  const liveSessionsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
  }, [firestore]);

  const { data: sessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);

  return (
    <BuyerLayout>
      <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight flex items-center gap-3">
              <Radio className="h-8 w-8 text-red-600" />
              Live Now
            </h1>
            <p className="text-muted-foreground">Watch real sellers, ask questions, and shop live.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sessions.map(session => (
              <StreamCard key={session.id} session={session} />
            ))}
          </div>
        ) : (
          <Card className="bg-muted/30 border-dashed border-2 py-24 text-center">
            <CardContent>
              <div className="mx-auto bg-muted p-4 rounded-full w-fit mb-4">
                <VideoOff className="h-12 w-12 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold">No active shows right now</h2>
              <p className="text-muted-foreground">Check back later or follow your favorite sellers to get notified.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </BuyerLayout>
  );
}
