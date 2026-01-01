
'use client';

// This file is being repurposed to be the main entry for Commission Rules.
// The analytics table is being moved to its own page.

import { SellerLayout } from '@/components/layout/seller-layout';
import { CommissionSettingsTable } from '@/components/seller/commission-settings-table';


export default function ResellerCenterRulesPage() {
    return (
        <SellerLayout>
        <div className="flex-1 space-y-4 p-8 pt-6">
             <div className="flex items-center justify-between space-y-2">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Reseller Center: Commission Rules
                </h1>
            </div>
            <CommissionSettingsTable />
        </div>
        </SellerLayout>
    );
}
