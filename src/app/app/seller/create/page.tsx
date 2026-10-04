'use client';

import { Sparkles } from 'lucide-react';
import { ProductUploadForm } from '@/components/seller/product-upload-form';
import { SellerSectionTitle } from '@/components/app/seller/seller-app-shell';

/**
 * SELLER APP · CREATE.
 *
 * The website reaches product creation through a dialog on the dashboard and
 * the `/dashboard/products` tab. In the app it earns its own tab, because
 * listing is the seller's primary job on a phone — but the form itself is the
 * exact same `ProductUploadForm`, so validation, media upload and the write to
 * `products` are identical to the website.
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
