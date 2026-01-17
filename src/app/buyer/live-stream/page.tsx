
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Video } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';
import { LiveSellerCard } from '@/components/buyer/LiveSellerCard';
import { Skeleton } from '@/components/ui/skeleton';

const mockLiveSellers = [
    {
        id: 'CKmHD5jv0dOevUJhJ8tM7akpSlF2',
        name: "Aisha's Handbags",
        avatar: 'https://picsum.photos/seed/seller-avatar-1/100',
        viewers: 1300
    }
]

export default function LiveStreamPage() {
    const firestore = useFirestore();

    const liveSessionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
    }, [firestore]);

    const { data: liveSessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);
    
    // For now, we will use mock data since the full backend isn't in place.
    const sellers = liveSessions && liveSessions.length > 0 ? liveSessions : mockLiveSellers;

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
                <Skeleton className="h-24 w-full" />
             ) : sellers.length > 0 ? (
                sellers.map(seller => (
                    <LiveSellerCard key={seller.id} seller={seller} />
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
