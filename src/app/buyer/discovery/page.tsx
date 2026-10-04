'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { BuyerLayout } from '@/components/buyer/buyer-layout';
import { LiveFeedContent } from '@/components/feed/live-feed-content';

export const dynamic = 'force-dynamic';

/**
 * BUYER · DISCOVERY FEED.
 *
 * The same feed sellers get, in the buyer's own chrome.
 *
 * ## Why this is its own route and not a link to the seller's
 *
 * `/dashboard/seller/live-feed` is not a shared page — it wraps itself in
 * `SellerLayout`, so it arrives wearing the seller workspace: seller sidebar,
 * seller top bar, seller navigation. Pointing the buyer sidebar at it would
 * have dropped buyers into another role's workspace with a chevron that returns
 * them to a seller dashboard they have no route to.
 *
 * So the feed was extracted into `components/feed/live-feed-content` and both
 * surfaces render it. One implementation, two chromes — the same reasoning that
 * already put `RealtimeVideoCard` in `components/feed`.
 *
 * `BuyerLayout` needs no `fullWidth` flag here (the seller's layout has one):
 * its `<main>` already applies no padding and no max-width, so a full-bleed
 * vertical player fills it as-is. The seller layout constrains to `p-4 md:p-8`
 * and `max-w-7xl` by default, which is why it needs the flag.
 */
export default function BuyerDiscoveryPage() {
  return (
    <BuyerLayout>
      <Suspense
        fallback={
          <div className="flex h-screen w-full items-center justify-center bg-black">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <LiveFeedContent backHref="/buyer/dashboard" />
      </Suspense>
    </BuyerLayout>
  );
}