'use client';

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
 * The website keeps its own sibling flow (a dialog on the dashboard +
 * `/dashboard/products` tab); the two share the exact same `ProductUploadForm`
 * component so behaviour and the optimized output are identical everywhere.
 */
export default function SellerSectionCreate() {
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

      <div className="px-1">
        <ProductUploadForm />
      </div>
    </div>
  );
}
