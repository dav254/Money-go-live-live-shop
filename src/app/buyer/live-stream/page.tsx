
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';
import { LiveSellerCard } from '@/components/buyer/LiveSellerCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Video } from 'lucide-react';

export default function LiveStreamPage() {
    const firestore = useFirestore();

    const liveSessionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
    }, [firestore]);

    const { data: liveSessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);
    
  return (
    <BuyerLayout>
      <div className="p-8">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Live Streams
        </h1>
        <p className="text-muted-foreground mt-2">
          Discover sellers who are live right now.
        </p>
        <div className="mt-8 space-y-4">
             {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
             ) : liveSessions && liveSessions.length > 0 ? (
                liveSessions.map(session => (
                    <LiveSellerCard key={session.id} sellerSession={session} />
                ))
             ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
                    <Video className="h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">No sellers are currently live.</p>
                </div>
             )}
        </div>
      </div>
    </BuyerLayout>
  );
}
