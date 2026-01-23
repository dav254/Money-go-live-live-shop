'use client';

import React from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { LiveSellerCard } from '@/components/buyer/LiveSellerCard';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioTower } from 'lucide-react';

export default function BuyerLiveStreamPage() {
    const firestore = useFirestore();

    const liveSessionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // Query for sessions that are currently live
        return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
    }, [firestore]);

    const { data: liveSessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);

    return (
        <BuyerLayout>
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
                 <div className="space-y-2">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Live Now
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Join live shopping sessions from your favorite sellers.
                    </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {isLoading ? (
                        <>
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </>
                    ) : liveSessions && liveSessions.length > 0 ? (
                        liveSessions.map(session => (
                            <LiveSellerCard key={session.id} sellerSession={session} />
                        ))
                    ) : (
                        <div className="col-span-full flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed p-12">
                             <RadioTower className="h-12 w-12 text-muted-foreground" />
                            <h2 className="text-xl font-semibold">The Airwaves Are Quiet</h2>
                            <p className="text-muted-foreground">No sellers are currently live. Check back soon!</p>
                        </div>
                    )}
                </div>
            </div>
        </BuyerLayout>
    );
}
