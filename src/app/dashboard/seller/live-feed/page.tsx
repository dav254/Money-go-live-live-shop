'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { LiveFeedContent } from '@/components/feed/live-feed-content';

export const dynamic = 'force-dynamic';

/**
 * SELLER · DISCOVERY FEED.
 *
 * The feed itself lives in `components/feed/live-feed-content` so the seller
 * and buyer surfaces render one implementation. This page is only the seller
 * chrome plus where "back" goes.
 */
export default function SellerLiveFeedPage() {
  return (
    <SellerLayout fullWidth>
      <Suspense
        fallback={
          <div className="flex h-screen w-full items-center justify-center bg-black">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <LiveFeedContent backHref="/dashboard/seller" />
      </Suspense>
    </SellerLayout>
  );
}