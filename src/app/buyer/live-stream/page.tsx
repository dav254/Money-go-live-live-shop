
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { LiveSession } from '@/lib/types';
import { collection, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { LiveSellerCard } from '@/components/buyer/LiveSellerCard';
import { Radio } from 'lucide-react';

export default function LiveStreamPage() {
    const firestore = useFirestore();

    const liveSessionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
    }, [firestore]);

    const { data: liveSessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);

    return (
        <BuyerLayout>
            <div className="flex h-full w-full flex-col">
                 <div className="p-4 md:p-8">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Live Now
                    </h1>
                    <p className="text-muted-foreground">Sellers who are currently live streaming.</p>
                </div>
                {isLoading ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 md:p-8">
                        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                    </div>
                ) : liveSessions && liveSessions.length > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 md:p-8">
                        {liveSessions.map(session => (
                            <LiveSellerCard key={session.id} sellerSession={session} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-1 items-center justify-center rounded-lg border-dashed p-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                            <Radio className="h-10 w-10 text-muted-foreground" />
                            <h3 className="text-lg font-semibold">No one is live right now</h3>
                            <p className="text-sm text-muted-foreground">Check back later to see live shows from your favorite sellers.</p>
                        </div>
                    </div>
                )}
            </div>
        </BuyerLayout>
    );
}
