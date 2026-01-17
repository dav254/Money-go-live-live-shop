'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Video } from 'lucide-react';

export default function LiveStreamPage() {
  return (
    <BuyerLayout>
      <div className="p-8">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Live Streams
        </h1>
        <p className="text-muted-foreground mt-2">
          Discover sellers who are live right now.
        </p>
        <div className="mt-8 flex h-96 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
            <Video className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No sellers are currently live.</p>
        </div>
      </div>
    </BuyerLayout>
  );
}
