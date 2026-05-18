'use client';

import { SellerLayout } from '@/components/layout/seller-layout';

export default function RemovedPage() {
  return (
    <SellerLayout>
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h1 className="text-2xl font-bold">Section Removed</h1>
        <p className="text-muted-foreground mt-2">Marketplace leads are currently unavailable.</p>
      </div>
    </SellerLayout>
  );
}
