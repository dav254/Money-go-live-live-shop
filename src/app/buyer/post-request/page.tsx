'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';

export default function RemovedPage() {
  return (
    <BuyerLayout>
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h1 className="text-2xl font-bold">Section Removed</h1>
        <p className="text-muted-foreground mt-2">This feature is no longer active.</p>
      </div>
    </BuyerLayout>
  );
}
