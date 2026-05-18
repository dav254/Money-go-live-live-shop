
'use client';

import React from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    ArrowRight, 
    Users,
    Megaphone,
    Clock
} from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { BuyerRequest } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

export default function MyRequestsPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const myRequestsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'requests'),
            where('buyerId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, user]);

    const { data: requests, isLoading } = useCollection<BuyerRequest>(myRequestsQuery);

    return (
        <BuyerLayout>
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="font-headline text-3xl font-black uppercase tracking-tighter text-white leading-none">My Broadcasts</h1>
                        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2">Active Requirements</p>
                    </div>
                    <Button className="h-14 px-10 rounded-[1.5rem] font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 text-white shadow-2xl border-none" asChild>
                        <Link href="/buyer/post-request">
                            <Megaphone className="mr-2 h-4 w-4" /> NEW BROADCAST
                        </Link>
                    </Button>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1,2,3].map(i => <Card key={i} className="h-48 bg-neutral-900/50 border-white/5 animate-pulse rounded-[2.5rem]" />)}
                    </div>
                ) : requests && requests.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {requests.map(req => (
                            <Card key={req.id} className="bg-neutral-900/50 border-white/5 rounded-[2.5rem] overflow-hidden hover:border-primary/20 transition-all group relative shadow-2xl flex flex-col">
                                <CardHeader className="p-8 pb-4">
                                    <div className="flex justify-between items-start mb-6">
                                        <Badge variant="outline" className="uppercase text-[8px] font-black border-none px-3 py-1 rounded-full bg-green-500/10 text-green-500">
                                            {req.status}
                                        </Badge>
                                        <div className="flex items-center gap-1 text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                                            <Clock className="h-3 w-3" />
                                            {req.createdAt?.toDate ? formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                                        </div>
                                    </div>
                                    <CardTitle className="text-2xl font-black uppercase tracking-tighter text-white leading-tight">
                                        {req.title}
                                    </CardTitle>
                                </CardHeader>

                                <CardFooter className="p-8 mt-auto">
                                    <div className="w-full flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                                <Users className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-white uppercase leading-none">{req.offersCount || 0} PITCHE{(req.offersCount || 0) !== 1 ? 'S' : ''}</p>
                                            </div>
                                        </div>

                                        <Button className="font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-2xl bg-white text-black hover:bg-neutral-200 shadow-xl" asChild>
                                            <Link href={`/buyer/requests/my-requests/${req.id}`}>
                                                OFFERS <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </div>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="py-32 text-center space-y-6 bg-neutral-950 border border-dashed border-white/5 rounded-[3rem]">
                        <div className="p-6 bg-white/5 rounded-full w-fit mx-auto">
                            <Megaphone className="h-12 w-12 text-neutral-800" />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-widest text-neutral-500">No broadcasts found</h3>
                        <Button className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 text-white" asChild>
                            <Link href="/buyer/post-request">BROADCAST NOW</Link>
                        </Button>
                    </div>
                )}
            </div>
        </BuyerLayout>
    )
}
