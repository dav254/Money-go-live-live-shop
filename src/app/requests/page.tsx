'use client';

import { SellerLayout } from '@/components/layout/seller-layout';

export default function RemovedPage() {
  return (
    <SellerLayout>
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h1 className="text-2xl font-bold uppercase tracking-tighter">Feature Removed</h1>
        <p className="text-muted-foreground mt-2 font-medium">The marketplace leads section has been decommissioned.</p>
      </div>
    </SellerLayout>
  );
}
