
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioTower, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const LiveSellerEntry = () => {
    return (
        <div className="block">
          <Card className="bg-neutral-900 border-neutral-800 hover:border-primary/50 text-white p-4 rounded-lg flex justify-between items-center transition-all">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="absolute -bottom-1 -right-1 bg-red-500 text-white text-xs px-1.5 rounded-md font-bold">LIVE</div>
                </div>
                <div>
                    <Skeleton className="h-5 w-24 mb-1" />
                    <Skeleton className="h-4 w-32" />
                </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-400">
                <User className="h-4 w-4" />
                <Skeleton className="h-4 w-8" />
            </div>
          </Card>
        </div>
    )
}


const JoinLivePage = () => {
    const router = useRouter();

    return (
        <BuyerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Live Studio</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>Currently Live</CardTitle>
                        <CardDescription>Sellers who are live right now.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                        <p className="text-center text-muted-foreground py-8">No sellers are live right now.</p>
                    </CardContent>
                </Card>
            </div>
        </BuyerLayout>
    );
};

export default JoinLivePage;
