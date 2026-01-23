'use client';

// This page is deprecated and will be removed. 
// The main feed is now at /buyer/live-stream

import { BuyerLayout } from '@/components/layout/buyer-layout';

export default function DeprecatedLivePage() {
    return (
        <BuyerLayout>
            <div className="flex h-full items-center justify-center">
                <p>This page is no longer in use. Please visit the Live Streams tab.</p>
            </div>
        </BuyerLayout>
    )
}
