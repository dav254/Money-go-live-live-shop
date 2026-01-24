'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { LiveSellerCard } from '@/components/buyer/LiveSellerCard';
import { RadioTower } from 'lucide-react';

export default function LiveSessionsListPage() {
    const firestore = useFirestore();

    const liveSessionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
    }, [firestore]);

    const { data: liveSessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);

    return (
        <BuyerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <h1 className="font-headline text-3xl font-bold tracking-tight flex items-center gap-3">
                        <RadioTower className="h-8 w-8 text-primary" />
                        Live Now
                    </h1>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Active Live Streams</CardTitle>
                        <CardDescription>Sellers who are currently live. Click to join!</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoading && (
                            <>
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </>
                        )}
                        {!isLoading && liveSessions && liveSessions.length > 0 ? (
                            liveSessions.map(session => (
                                <LiveSellerCard key={session.id} sellerSession={session} />
                            ))
                        ) : !isLoading && (
                            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-center">
                                <p className="text-muted-foreground">No sellers are live at the moment. Check back soon!</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </BuyerLayout>
    );
}
