'use client';

import React from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    MapPin, 
    ArrowRight, 
    Users,
    Megaphone,
    Loader2,
    Search
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
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
                        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2">Managing your active marketplace needs</p>
                    </div>
                    <Button className="h-14 px-10 rounded-[1.5rem] font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 text-white shadow-2xl border-none" asChild>
                        <Link href="/buyer/post-request">
                            <Megaphone className="mr-2 h-4 w-4" /> BROADCAST NEW NEED
                        </Link>
                    </Button>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {[1,2].map(i => <Card key={i} className="h-80 bg-neutral-900/50 border-white/5 animate-pulse rounded-[2.5rem]" />)}
                    </div>
                ) : requests && requests.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {requests.map(req => (
                            <Card key={req.id} className="bg-neutral-900/50 border-white/5 rounded-[2.5rem] overflow-hidden hover:border-primary/20 transition-all group relative shadow-2xl">
                                <div className={cn(
                                    "absolute top-0 left-0 w-2 h-full",
                                    req.status === 'open' ? "bg-primary" : "bg-green-500"
                                )} />
                                
                                <CardHeader className="p-8 pb-4">
                                    <div className="flex justify-between items-start mb-6">
                                        <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full">
                                            {req.category}
                                        </Badge>
                                        <Badge variant="outline" className={cn(
                                            "uppercase text-[8px] font-black border-none px-3 py-1 rounded-full",
                                            req.status === 'open' ? "bg-green-500/10 text-green-500" : "bg-blue-500/10 text-blue-500"
                                        )}>
                                            {req.status === 'open' ? 'Live Broadcast' : 'Seller Selected'}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-2xl font-black uppercase tracking-tighter text-white leading-none mb-2">
                                        {req.title}
                                    </CardTitle>
                                    <CardDescription className="text-neutral-400 text-sm font-medium line-clamp-2 italic">
                                        "{req.description}"
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="p-8 pt-0 space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                                            <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">Budget</p>
                                            <p className="text-xs font-black text-primary">${req.minBudget?.toLocaleString()} - ${req.maxBudget?.toLocaleString()}</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                                            <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">Time</p>
                                            <p className="text-xs font-black text-white uppercase">
                                                {req.createdAt?.toDate ? formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-black/20 p-2 rounded-xl border border-white/5 w-fit">
                                        <MapPin className="h-3.5 w-3.5 text-primary" />
                                        {req.area}, {req.county}
                                    </div>
                                </CardContent>

                                <CardFooter className="p-8 pt-0">
                                    <div className="w-full flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                                <Users className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-white uppercase leading-none">{req.offersCount || 0} PITCHE{(req.offersCount || 0) !== 1 ? 'S' : ''}</p>
                                                <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest mt-1">Sellers Interested</p>
                                            </div>
                                        </div>

                                        <Button className="font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-2xl bg-white text-black hover:bg-neutral-200 shadow-xl" asChild>
                                            <Link href={`/buyer/requests/my-requests/${req.id}`}>
                                                VIEW OFFERS <ArrowRight className="ml-2 h-4 w-4" />
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
                        <h3 className="text-xl font-black uppercase tracking-widest text-neutral-500">Your Leads Pipe is Empty</h3>
                        <p className="text-xs text-neutral-600 font-bold uppercase max-w-xs mx-auto">Broadcast your first requirement to start receiving pitches from verified sellers.</p>
                        <Button className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 text-white" asChild>
                            <Link href="/buyer/post-request">BROADCAST NOW</Link>
                        </Button>
                    </div>
                )}
            </div>
        </BuyerLayout>
    )
}