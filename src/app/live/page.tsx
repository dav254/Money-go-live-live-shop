
'use client';

import { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { LiveSession, Seller, UserProfile } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Image from 'next/image';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CircleDotDashed, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const LiveStreamCard = ({ session }: { session: LiveSession }) => {
    const firestore = useFirestore();

    const sellerProfileRef = useMemoFirebase(() => {
        return doc(firestore, 'userProfiles', session.sellerId);
    }, [firestore, session.sellerId]);
    
    const { data: seller, isLoading } = useDoc<UserProfile>(sellerProfileRef);

    if (isLoading) {
        return <div className="w-full aspect-video bg-muted animate-pulse rounded-lg"></div>;
    }

    return (
        <Card className="overflow-hidden group">
            <Link href={`/live/${session.id}`} className="block">
                <CardHeader className="p-0 relative aspect-video">
                    <Image
                        src={`https://image.mux.com/${session.muxPlaybackId}/thumbnail.jpg`}
                        alt={session.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-2">
                         <Badge className="bg-red-500 hover:bg-red-600 border-none"><CircleDotDashed className="mr-2 h-4 w-4 animate-pulse" /> LIVE</Badge>
                         <Badge variant="secondary"><Users className="mr-2 h-4 w-4" /> {session.viewerCount}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-4 flex items-center gap-3">
                    <Image 
                        src={seller?.profilePictureUrl || getPlaceholderImage()} 
                        alt={seller?.fullName || 'seller'} 
                        width={40} height={40} 
                        className="rounded-full"
                    />
                    <div>
                        <CardTitle className="text-base leading-tight group-hover:text-primary">{session.title}</CardTitle>
                        <CardDescription>{seller?.shopName || seller?.fullName}</CardDescription>
                    </div>
                </CardContent>
            </Link>
        </Card>
    );
};


export default function LiveFeedPage() {
  const firestore = useFirestore();
  
  const liveSessionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
  }, [firestore]);

  const { data: liveSessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);
  
  return (
    <MainLayout>
        <div className="container mx-auto max-w-7xl py-8">
            <h1 className="font-headline text-3xl font-bold mb-8">Live Shows</h1>
            {isLoading ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-full aspect-video bg-muted animate-pulse rounded-lg"></div>
                    ))}
                 </div>
            ) : liveSessions && liveSessions.length > 0 ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {liveSessions.map(session => (
                        <LiveStreamCard key={session.id} session={session} />
                    ))}
                </div>
            ) : (
                <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
                    <p className="text-muted-foreground">No sellers are currently live. Check back soon!</p>
                </div>
            )}
        </div>
    </MainLayout>
  );
}
