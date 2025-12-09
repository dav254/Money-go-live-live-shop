
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { LiveSellerCard } from '@/components/buyer/LiveSellerCard';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { LiveSession, SellerShop, UserProfile } from '@/lib/types';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioTower } from 'lucide-react';
import React from 'react';

const LiveSessionCard = ({ session }: { session: LiveSession }) => {
    const firestore = useFirestore();

    const sellerShopRef = useMemoFirebase(() => {
        if (!session.sellerId) return null;
        return doc(firestore, 'sellerShops', session.sellerId);
    }, [firestore, session.sellerId]);

    const userProfileRef = useMemoFirebase(() => {
        if (!session.sellerId) return null;
        return doc(firestore, 'userProfiles', session.sellerId);
    }, [firestore, session.sellerId]);

    const { data: sellerShop, isLoading: isShopLoading } = useDoc<SellerShop>(sellerShopRef);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    if (isShopLoading || isProfileLoading) {
        return (
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-16" />
                </div>
            </div>
        )
    }

    const seller = {
        id: session.sellerId,
        name: sellerShop?.shopName || userProfile?.fullName || 'Live Seller',
        viewers: session.viewerCount || 0,
        avatar: sellerShop?.logoUrl || userProfile?.profilePictureUrl || 'https://picsum.photos/seed/avatar/80'
    };

    return <LiveSellerCard seller={seller} />;
}

export default function LiveSellersPage() {
  const firestore = useFirestore();

  const liveSessionsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
  }, [firestore]);

  const { data: liveSessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);

  return (
    <BuyerLayout>
        <div className="p-4 space-y-4">
            <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
                <RadioTower className="text-primary"/>
                Live Now
            </h1>
            {isLoading ? (
                 <div className="grid gap-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            ) : liveSessions && liveSessions.length > 0 ? (
                <div className="grid gap-4">
                    {liveSessions.map((session) => (
                        <LiveSessionCard key={session.id} session={session} />
                    ))}
                </div>
            ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
                    <p className="text-muted-foreground">No sellers are live at the moment. <br/> Check back soon!</p>
                </div>
            )}
        </div>
    </BuyerLayout>
  );
}
