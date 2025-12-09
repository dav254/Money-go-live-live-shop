
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';

export default function BuyerLiveSectionPage() {
    return (
        <BuyerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Live Section
                </h1>
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed p-12">
                    <p className="text-muted-foreground">This is the new Live Section page.</p>
                </div>
            </div>
        </BuyerLayout>
    );
}
