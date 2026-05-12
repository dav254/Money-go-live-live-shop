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
    Video
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// --- FRONTEND ONLY MOCK DATA ---
const mockRequests = [
    {
        id: '1',
        title: 'Need a professional plumber for Nairobi West',
        description: 'I have a leaking sink in my kitchen that needs urgent fixing. Preferably someone available this afternoon.',
        category: 'Home Services',
        minBudget: 1000,
        maxBudget: 2500,
        currency: 'KES',
        county: 'Nairobi',
        area: 'Nairobi West',
        requestType: 'text',
        deadline: 'Urgent',
        status: 'open',
        offersCount: 3,
        selectedSellerId: null,
    },
    {
        id: '2',
        title: 'Looking for iPhone 15 Pro Max',
        description: 'Want a brand new iPhone 15 Pro Max, 256GB. Must be sealed with warranty.',
        category: 'Electronics',
        minBudget: 150000,
        maxBudget: 180000,
        currency: 'KES',
        county: 'Nairobi',
        area: 'Westlands',
        requestType: 'video',
        deadline: 'Within 3 Days',
        status: 'selected',
        offersCount: 5,
        selectedSellerId: 'seller123',
    },
    {
        id: '3',
        title: 'Delivery of Fresh Groceries',
        description: 'Need a steady supplier for fresh organic vegetables delivered to Kilimani twice a week.',
        category: 'Food & Groceries',
        minBudget: 2000,
        maxBudget: 5000,
        currency: 'KES',
        county: 'Nairobi',
        area: 'Kilimani',
        requestType: 'text',
        deadline: 'Flexible',
        status: 'closed',
        offersCount: 12,
        selectedSellerId: 'seller456',
    }
];

const RequestCard = ({ req }: any) => {
    const isSelected = req.status === 'selected';
    const isClosed = req.status === 'closed';

    return (
        <Card className="bg-neutral-900/50 border-white/5 rounded-3xl overflow-hidden hover:border-primary/20 transition-all group relative">
            <div className={cn(
                "absolute top-0 left-0 w-1.5 h-full transition-colors",
                req.status === 'open' ? "bg-primary" : isSelected ? "bg-green-500" : "bg-neutral-600"
            )} />
            <CardHeader className="p-6 pb-2">
                <div className="flex justify-between items-start mb-4">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase tracking-widest">
                        {req.category}
                    </Badge>
                    <Badge variant="outline" className={cn(
                        "uppercase text-[8px] font-black border-none px-2 py-0.5 rounded-full",
                        req.status === 'open' ? "bg-green-500/10 text-green-500" : isSelected ? "bg-blue-500/10 text-blue-500" : "bg-neutral-800 text-neutral-400"
                    )}>
                        {req.status === 'open' ? 'Live Broadcast' : isSelected ? 'Offer Accepted' : 'Completed'}
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
                        {req.currency} {req.minBudget.toLocaleString()} - {req.maxBudget.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-end gap-2 text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                        <Clock className="h-3.5 w-3.5" />
                        {req.deadline}
                    </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {req.area}, {req.county}
                </div>
            </CardContent>
            <CardFooter className="p-6 pt-0 bg-neutral-950/30">
                <div className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-white/60">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        {req.offersCount} Pitches
                    </div>
                    {isSelected ? (
                        <Button className="font-black uppercase tracking-widest text-[10px] h-10 rounded-xl bg-blue-600 hover:bg-blue-700" asChild>
                            <Link href={`/chat/mock_${req.id}`}>
                                Go to Chat <MessageSquare className="ml-2 h-3.5 w-3.5" />
                            </Link>
                        </Button>
                    ) : isClosed ? (
                         <Button variant="ghost" disabled className="font-black uppercase tracking-widest text-[10px] h-10 rounded-xl">
                            Request Closed
                        </Button>
                    ) : (
                        <Button className="font-black uppercase tracking-widest text-[10px] h-10 rounded-xl" asChild>
                            <Link href={`/buyer/requests/${req.id}/offers`}>
                                View Pitches <ArrowRight className="ml-2 h-3.5 w-3.5" />
                            </Link>
                        </Button>
                    )}
                </div>
            </CardFooter>
        </Card>
    )
}

export default function MyRequestsPage() {
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {mockRequests.map(req => (
                        <RequestCard key={req.id} req={req} />
                    ))}
                </div>
            </div>
        </BuyerLayout>
    )
}
