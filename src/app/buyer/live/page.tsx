
'use client';

import React, { useMemo } from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioTower } from 'lucide-react';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { LiveSession, UserProfile } from '@/lib/types';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

const LiveSellerCard = ({ session }: { session: LiveSession }) => {
    const firestore = useFirestore();
    const sellerProfileRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'userProfiles', session.sellerId);
    }, [firestore, session.sellerId]);
    
    const { data: seller, isLoading } = useDoc<UserProfile>(sellerProfileRef);

    if (isLoading) {
        return (
             <div className="flex items-center gap-4 rounded-lg border p-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                </div>
            </div>
        )
    }
    
    if (!seller) return null;

    return (
        <Link href={`/buyer/live/${session.sellerId}`} className="block">
          <div className="border hover:border-primary/50 text-white p-4 rounded-lg flex justify-between items-center transition-all bg-card">
            <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border-2 border-red-500">
                    <AvatarImage src={seller.profilePictureUrl} />
                    <AvatarFallback>{seller.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <h2 className="font-bold">{seller.shopName || seller.fullName}</h2>
                    <p className="text-red-500 text-sm font-semibold flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        LIVE
                    </p>
                </div>
            </div>
            <span className="text-sm text-muted-foreground">{session.viewerCount || 0} watching</span>
          </div>
        </Link>
    )
}

const LiveSessionsList = () => {
    const firestore = useFirestore();

    const liveSessionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
    }, [firestore]);

    const { data: liveSessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);
    
    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        )
    }

    if (!liveSessions || liveSessions.length === 0) {
        return (
            <div className="flex h-48 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
                <RadioTower className="h-12 w-12 text-muted-foreground" />
                <h3 className="text-xl font-semibold">No Sellers Are Live</h3>
                <p className="text-muted-foreground">Check back soon for live shopping events!</p>
            </div>
        )
    }

    return (
        <div className="space-y-3 max-h-96 overflow-y-auto">
            {liveSessions.map(session => (
                <LiveSellerCard key={session.id} session={session} />
            ))}
        </div>
    )
}


const JoinLivePage = () => {
    return (
        <BuyerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Live Studio</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>Currently Live</CardTitle>
                        <CardDescription>Sellers who are live right now.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <LiveSessionsList />
                    </CardContent>
                </Card>
            </div>
        </BuyerLayout>
    );
};

export default JoinLivePage;
