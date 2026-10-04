'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import SellerLiveStudio from '@/components/live/seller-live-studio';

/**
 * VIDNOV LIVE — seller studio.
 *
 * A single section: your own camera preview, a title, and GO LIVE. Buyers
 * watch on their side; everything else was removed.
 */
export default function SellerGoLivePage() {
  return (
    <SellerLayout fullWidth>
      <SellerLiveStudio />
    </SellerLayout>
  );
}