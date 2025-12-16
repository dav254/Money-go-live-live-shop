'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BuyerLiveStreamPage = () => {
    const params = useParams();
    const router = useRouter();
    const sellerId = params.streamId as string;

    return (
        <BuyerLayout>
            <div className="h-[calc(100vh-4rem)] bg-black text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center p-4 rounded-lg bg-black/50 text-white">
                    <WifiOff className="h-8 w-8 text-red-500" />
                    <p className="font-semibold">The live stream feature is currently being updated.</p>
                    <p className="text-sm text-muted-foreground">Please check back soon.</p>
                    <Button onClick={() => router.push('/buyer/live')}>Back to Live List</Button>
                </div>
            </div>
        </BuyerLayout>
    );
};

export default BuyerLiveStreamPage;
