'use client';

import React from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { BuyerRequest } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Tag, 
    Clock, 
    MapPin, 
    ArrowRight, 
    Video, 
    MessageSquare,
    AlertCircle,
    CheckCircle2,
    Users
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const RequestCard = ({ req }: { req: BuyerRequest }) => {
    return (
        <Card className="bg-neutral-900/50 border-white/5 rounded-3xl overflow-hidden hover:border-primary/20 transition-all group relative">
            <div className={cn(
                "absolute top-0 left-0 w-1.5 h-full",
                req.status === 'open' ? "bg-primary" : "bg-neutral-600"
            )} />
            <CardHeader className="p-6 pb-2">
                <div className="flex justify-between items-start mb-4">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase tracking-widest">
                        {req.category}
                    </Badge>
                    <Badge variant="outline" className={cn(
                        "uppercase text-[8px] font-black border-none px-2 py-0.5 rounded-full",
                        req.status === 'open' ? "bg-green-500/10 text-green-500" : "bg-neutral-800 text-neutral-400"
                    )}>
                        {req.status === 'open' ? 'Live Broadcast' : req.status}
                    </Badge>
                </div>
                <CardTitle className="text-xl font-black uppercase tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                    {req.title}
                </CardTitle>
                <CardDescription className="text-neutral-400 text-xs font-medium line-clamp-2 mt-1">
                    {req.description}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-tighter">
                        <Tag className="h-3.5 w-3.5" />
                        KES {req.minBudget.toLocaleString()} - {req.maxBudget.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-end gap-2 text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                        <Clock className="h-3 w-3" />
                        {req.deadline}
                    </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    <MapPin className="h-3 w-3 text-primary" />
                    {req.area}, {req.county}
                </div>
            </CardContent>
            <CardFooter className="p-6 pt-0 bg-neutral-950/30">
                <div className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-white/60">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        {req.offersCount || 0} Pitches
                    </div>
                    <Button className="font-black uppercase tracking-widest text-[10px] h-10 rounded-xl" asChild>
                        <Link href={`/buyer/requests/my-requests/${req.id}`}>
                            View Offers <ArrowRight className="ml-2 h-3.5 w-3.5" />
                        </Link>
                    </Button>
                </div>
            </CardFooter>
        </Card>
    )
}

export default function MyRequestsPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const myRequestsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'requests'),
            where('buyerId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
    }, [user, firestore]);

    const { data: requests, isLoading } = useCollection<BuyerRequest>(myRequestsQuery);

    return (
        <BuyerLayout>
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="font-headline text-3xl font-black uppercase tracking-tighter">My Active Needs</h1>
                        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em] mt-1">Manage your broadcasts and select sellers</p>
                    </div>
                    <Button className="font-black uppercase tracking-widest text-xs h-12 px-8 rounded-2xl shadow-xl shadow-primary/20" asChild>
                        <Link href="/buyer/post-request">
                            <Megaphone className="mr-2 h-4 w-4" /> Broadcast New Need
                        </Link>
                    </Button>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-64 w-full rounded-3xl" />
                        ))}
                    </div>
                ) : requests && requests.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {requests.map(req => (
                            <RequestCard key={req.id} req={req} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-neutral-900/30 rounded-[3rem] border-2 border-dashed border-white/5 text-center px-8">
                        <div className="p-6 bg-primary/10 rounded-full mb-6">
                            <Megaphone className="h-12 w-12 text-primary opacity-20" />
                        </div>
                        <h3 className="text-2xl font-black uppercase tracking-tighter">No Active Broadcasts</h3>
                        <p className="text-neutral-500 max-w-sm mt-4 font-medium leading-relaxed">You haven't told sellers what you need yet. Broadcast your first need to start receiving competitive offers.</p>
                        <Button className="mt-8 font-black uppercase tracking-widest h-14 px-10 rounded-2xl" asChild>
                            <Link href="/buyer/post-request">Start Broadcasting</Link>
                        </Button>
                    </div>
                )}
            </div>
        </BuyerLayout>
    )
}
