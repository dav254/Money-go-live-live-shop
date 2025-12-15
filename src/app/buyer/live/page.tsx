
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioTower, User } from 'lucide-react';
import { LiveSellerCard } from '@/components/buyer/LiveSellerCard';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit, doc } from 'firebase/firestore';
import type { LiveSession, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc } from '@/firebase/firestore/use-doc';
import Link from 'next/link';

const LiveSellerEntry = ({ session }: { session: LiveSession }) => {
    const firestore = useFirestore();

    const sellerProfileRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'userProfiles', session.sellerId);
    }, [firestore, session.sellerId]);
    
    const { data: seller, isLoading } = useDoc<UserProfile>(sellerProfileRef);

    if (isLoading || !seller) {
        return <Skeleton className="h-20 w-full" />;
    }
    
    return (
        <Link href={`/buyer/live/${session.sellerId}`} className="block">
          <Card className="bg-neutral-900 border-neutral-800 hover:border-primary/50 text-white p-4 rounded-lg flex justify-between items-center transition-all">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <img src={seller.profilePictureUrl || `https://picsum.photos/seed/${seller.id}/48`} className="h-12 w-12 rounded-full border-2 border-red-500" />
                    <div className="absolute -bottom-1 -right-1 bg-red-500 text-white text-xs px-1.5 rounded-md font-bold">LIVE</div>
                </div>
                <div>
                    <h2 className="font-bold">{seller.shopName || seller.fullName}</h2>
                    <p className="text-sm text-neutral-400">{session.title}</p>
                </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-400">
                <User className="h-4 w-4" />
                <span>{session.viewerCount || 0}</span>
            </div>
          </Card>
        </Link>
    )
}


const JoinLivePage = () => {
    const router = useRouter();
    const firestore = useFirestore();
    const [sellerIdInput, setSellerIdInput] = useState('');

    const liveSessionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'liveSessions'), 
            where('status', '==', 'live'),
            limit(20)
        );
    }, [firestore]);

    const { data: liveSessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);

    const connectToSeller = () => {
        if (sellerIdInput.trim()) {
            router.push(`/buyer/live/${sellerIdInput.trim()}`);
        }
    };

    return (
        <BuyerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Live Studio</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                            <RadioTower className="text-primary"/>
                            Join a Live Stream
                            </CardTitle>
                            <CardDescription>Enter the Seller's Live Stream ID to start watching.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex w-full max-w-sm items-center space-x-2">
                                <Input 
                                    type="text" 
                                    placeholder="Enter Seller ID" 
                                    value={sellerIdInput} 
                                    onChange={(e) => setSellerIdInput(e.target.value)} 
                                />
                                <Button type="button" onClick={connectToSeller} disabled={!sellerIdInput.trim()}>
                                    Watch Live
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Currently Live</CardTitle>
                            <CardDescription>Sellers who are live right now.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                            {isLoading && Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                            {!isLoading && liveSessions && liveSessions.length > 0 ? (
                                liveSessions.map(session => (
                                    <LiveSellerEntry key={session.id} session={session} />
                                ))
                            ) : (
                                !isLoading && <p className="text-center text-muted-foreground py-8">No sellers are live right now.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </BuyerLayout>
    );
};

export default JoinLivePage;
