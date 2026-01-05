
'use client';

import React from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { RadioTower, AlertCircle } from 'lucide-react';

export default function BuyerLiveViewPage() {
    // Since the feature is coming soon, we always show the offline/unavailable state.
    return (
        <BuyerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Live Shopping Coming Soon!</AlertTitle>
                    <AlertDescription>
                    This feature is currently unavailable. We are working hard to bring you an amazing live shopping experience. Please check back later!
                    </AlertDescription>
                </Alert>
            </div>
        </BuyerLayout>
    )
}
