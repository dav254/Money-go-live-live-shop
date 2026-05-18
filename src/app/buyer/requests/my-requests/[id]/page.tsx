
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';

export default function RemovedPage() {
  return (
    <BuyerLayout>
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h1 className="text-2xl font-bold uppercase tracking-tighter">Feature Removed</h1>
        <p className="text-muted-foreground mt-2 font-medium">Requirement details are no longer available.</p>
      </div>
    </BuyerLayout>
  );
}
