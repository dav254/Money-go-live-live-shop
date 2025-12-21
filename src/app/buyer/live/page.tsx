
'use client';

import React from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { LiveSession, UserProfile } from '@/lib/types';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon } from 'lucide-react';

const LiveSellerCard = ({ session }: { session: LiveSession }) => {
    const firestore = useFirestore();

    const sellerProfileRef = useMemoFirebase(() => {
        if (!firestore || !session.sellerId) return null;
        return doc(firestore, 'userProfiles', session.sellerId);
    }, [firestore, session.sellerId]);
    
    const { data: seller, isLoading } = useDoc<UserProfile>(sellerProfileRef);
    
    if (isLoading) {
        return (
             <div className="block">
              <Card className="bg-neutral-900 border-neutral-800 p-4 rounded-lg flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-1">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
              </Card>
            </div>
        )
    }

    return (
        <Link href={`/buyer/live/${session.sellerId}`} className="block">
          <Card className="bg-neutral-900 border-neutral-800 hover:border-primary/50 text-white p-4 rounded-lg flex justify-between items-center transition-all">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <Avatar className="h-12 w-12 border-2 border-red-500">
                        <AvatarImage src={seller?.profilePictureUrl} />
                        <AvatarFallback>{seller?.fullName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                </div>
                <div>
                    <h2 className="font-bold">{seller?.shopName || seller?.fullName || 'Live Seller'}</h2>
                    <p className="text-sm text-neutral-400">{session.title}</p>
                </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-400">
                <UserIcon className="h-4 w-4" />
                <span>{session.viewerCount || 0}</span>
            </div>
          </Card>
        </Link>
    )
}


const JoinLivePage = () => {
    const firestore = useFirestore();

    const liveSessionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
    }, [firestore]);

    const { data: liveSessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);

    return (
        <BuyerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Live Studio</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>Currently Live</CardTitle>
                        <CardDescription>Sellers who are live right now.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                        {isLoading ? (
                            <p className="text-center text-muted-foreground py-8">Looking for live streams...</p>
                        ) : liveSessions && liveSessions.length > 0 ? (
                            liveSessions.map(session => (
                                <LiveSellerCard key={session.id} session={session} />
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-8">No sellers are live right now.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </BuyerLayout>
    );
};

export default JoinLivePage;
