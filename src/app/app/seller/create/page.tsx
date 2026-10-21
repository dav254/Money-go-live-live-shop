'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { ProductUploadForm } from '@/components/seller/product-upload-form';
import { SellerSectionTitle } from '@/components/app/seller/seller-app-shell';

/** SELLER APP · CREATE.
 *
 * The app surface's own product-creation screen. Taps the "Create" tab in the
 * seller bottom tab bar, so listing is the seller's primary job on a phone.
 *
 * Media: photos (up to 8) and video (up to 8) are attached through the shared
 * `uploadMedia()` client and the same VPS media engine that powers the feed —
 * every file is confirmed stored on the seller's own server before it is
 * written to the listing document. The seller's total is read from
 * `/api/listings/quota` and re-checked at publish, so no file is ever lost
 * and no quota is silently exceeded.
 *
 * Studio handoff: arriving with `?studioImage=<url>` (from Classic Studio's
 * "Use in a product listing") pre-attaches that already-stored photo as the
 * first image, so editing a photo never has to create a duplicate listing —
 * the seller edits once and the finished image lands in this one flow.
 *
 * The website keeps its own sibling flow (a dialog on the dashboard +
 * `/dashboard/products` tab); the two share the exact same `ProductUploadForm`
 * component so behaviour and the optimized output are identical everywhere.
 */
export default function SellerSectionCreate() {
  return (
    <Suspense
      fallback={
        <p className="px-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
          Loading…
        </p>
      }
    >
      <SellerSectionCreateInner />
    </Suspense>
  );
}

function SellerSectionCreateInner() {
  const params = useSearchParams();
  const studioImage = params.get('studioImage');
  const initialImageUrls = React.useMemo(
    () => (studioImage ? [studioImage] : undefined),
    [studioImage],
  );

  return (
    <div className="vn-page-enter space-y-4 pb-4">
      <SellerSectionTitle
        eyebrow="New listing"
        title="Create a product"
        action={
          <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="h-3 w-3" />
            AI ready
          </span>
        }
      />

      <p className="-mt-2 px-4 text-xs leading-relaxed text-muted-foreground">
        Photos and a short video sell far better than text alone. Add media first, then the
        details — you can edit everything later from your stock.
      </p>

      {studioImage && (
        <p className="mx-4 rounded-lg bg-primary/10 px-3 py-2 text-[11px] text-primary">
          Your Classic Studio edit is attached as the first photo.
        </p>
      )}

      <div className="px-1">
        <ProductUploadForm initialImageUrls={initialImageUrls} />
      </div>
    </div>
  );
}
