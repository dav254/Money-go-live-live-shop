'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Bell } from 'lucide-react';

export default function BuyerNotificationsPage() {
    return (
        <BuyerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Notifications
                </h1>
                <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
                    <Bell className="h-12 w-12 text-muted-foreground" />
                    <h3 className="font-semibold text-xl">Coming Soon</h3>
                    <p className="text-muted-foreground">A dedicated notification center is on its way!</p>
                </div>
            </div>
        </BuyerLayout>
    );
}
