
'use client';

import React from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    Tag, 
    Clock, 
    MapPin, 
    ArrowRight, 
    MessageSquare,
    Users,
    Megaphone,
    Video,
    Loader2,
    Sparkles,
    CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { BuyerRequest } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const RequestCard = ({ req }: { req: BuyerRequest }) => {
    const isSelected = req.status === 'selected';

    return (
        <Card className="bg-neutral-900/50 border-white/5 rounded-[2.5rem] overflow-hidden hover:border-primary/20 transition-all group relative shadow-2xl">
            <div className={cn(
                "absolute top-0 left-0 w-2 h-full transition-colors",
                req.status === 'open' ? "bg-primary" : "bg-green-500"
            )} />
            
            <CardHeader className="p-8 pb-4">
                <div className="flex justify-between items-start mb-6">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full">
                        {req.category}
                    </Badge>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                            "uppercase text-[8px] font-black border-none px-3 py-1 rounded-full",
                            req.status === 'open' ? "bg-green-500/10 text-green-500" : "bg-blue-500/10 text-blue-500"
                        )}>
                            {req.status === 'open' ? 'Live Broadcast' : 'Seller Selected'}
                        </Badge>
                    </div>
                </div>
                <CardTitle className="text-2xl font-black uppercase tracking-tighter line-clamp-1 group-hover:text-primary transition-colors leading-none mb-2">
                    {req.title}
                </CardTitle>
                <CardDescription className="text-neutral-400 text-sm font-medium line-clamp-2 leading-relaxed italic">
                    "{req.description}"
                </CardDescription>
            </CardHeader>

            <CardContent className="p-8 pt-0 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1 shadow-inner">
                        <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">Budget Window</p>
                        <p className="text-xs font-black text-primary">KES {req.minBudget?.toLocaleString()} - {req.maxBudget?.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1 shadow-inner">
                        <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">Broadcast Date</p>
                        <p className="text-xs font-black text-white uppercase">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : 'Today'}</p>
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
                            <p className="text-[10px] font-black text-white uppercase leading-none">{req.offersCount || 0} PITCHE{req.offersCount !== 1 ? 'S' : ''}</p>
                            <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest mt-1">Sellers Competing</p>
                        </div>
                    </div>

                    {isSelected ? (
                        <Button className="font-black uppercase tracking-widest text-[10px] h-12 rounded-2xl bg-green-600 hover:bg-green-700 shadow-xl shadow-green-600/20" asChild>
                            <Link href={`/messages`}>
                                GO TO CHAT <MessageSquare className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    ) : (
                        <Button className="font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-2xl bg-white text-black hover:bg-neutral-200 shadow-xl" asChild>
                            <Link href={`/buyer/requests/my-requests/${req.id}`}>
                                VIEW OFFERS <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    )}
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
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="font-headline text-3xl font-black uppercase tracking-tighter text-white leading-none">My Broadcasts</h1>
                        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2">Managing your active marketplace needs</p>
                    </div>
                    <Button className="h-14 px-10 rounded-[1.5rem] font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 border-none" asChild>
                        <Link href="/buyer/post-request">
                            <Megaphone className="mr-2 h-4 w-4" /> BROADCAST NEW NEED
                        </Link>
                    </Button>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-96 w-full rounded-[2.5rem]" />)}
                    </div>
                ) : requests && requests.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {requests.map(req => (
                            <RequestCard key={req.id} req={req} />
                        ))}
                    </div>
                ) : (
                    <div className="py-32 text-center bg-neutral-900/30 rounded-[3rem] border-2 border-dashed border-white/5 flex flex-col items-center">
                        <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                            <Megaphone className="h-10 w-10 text-neutral-700" />
                        </div>
                        <h3 className="text-white font-black uppercase tracking-tighter text-2xl">No Active Broadcasts</h3>
                        <p className="text-neutral-500 font-medium text-sm mt-3 max-w-xs leading-relaxed">
                            Start your first live broadcast to find verified sellers who have exactly what you need.
                        </p>
                        <Button className="mt-10 font-black uppercase tracking-widest text-[10px] h-14 px-12 rounded-[1.5rem]" asChild>
                            <Link href="/buyer/post-request">Post Your First Need</Link>
                        </Button>
                    </div>
                )}
            </div>
        </BuyerLayout>
    )
}
