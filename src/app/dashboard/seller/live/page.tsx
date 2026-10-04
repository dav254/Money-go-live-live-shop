'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import SellerLiveStudio from '@/components/live/seller-live-studio';

/**
 * VIDNOV LIVE — seller live surface.
 *
 * The setup form, pre-live check, stream list, chat rail and stats sections
 * were removed: this page is now just the preview studio (same component as
 * /dashboard/seller/go-live), so the seller only ever sees their own camera
 * while live.
 */
export default function SellerLivePage() {
  return (
    <SellerLayout fullWidth>
      <SellerLiveStudio />
    </SellerLayout>
  );
}