'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Palette } from 'lucide-react';
import { ClassicStudio, type ClassicStudioResult } from '@/components/studio/classic-studio';
import { SellerSectionTitle } from '@/components/app/seller/seller-app-shell';
import { Button } from '@/components/ui/button';

/**
 * APP SELLER — CLASSIC STUDIO (`/app/seller/studio`).
 *
 * A real photo editor + promotional design tool. On save, the edited image is
 * stored through the same VPS media pipeline the product form uses, and the
 * seller is handed two honest next steps:
 *
 *   • attach the finished photo to a product listing (opens the create flow),
 *   • or publish it as a Living Picture (optional music).
 *
 * The studio returns the stored URL here rather than creating a listing
 * itself — that is what keeps "edit a photo" from silently producing a
 * duplicate product (spec A1/B4: no duplicate listings).
 */
export default function AppSellerStudioPage() {
  const router = useRouter();
  const [result, setResult] = React.useState<ClassicStudioResult | null>(null);

  const onSaved = React.useCallback((r: ClassicStudioResult) => {
    setResult(r);
  }, []);

  return (
    <div className="vn-page-enter space-y-4 pb-6">
      <SellerSectionTitle
        eyebrow="Classic Studio"
        title="Edit & design"
        action={
          <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider">
            <Palette className="h-3 w-3" />
            Photo editor
          </span>
        }
      />

      <p className="-mt-2 px-4 text-xs leading-relaxed text-muted-foreground">
        Crop, tune and add price tags or headlines to a product photo. Your original is always kept —
        the studio saves a separate edited copy.
      </p>

      <div className="px-1">
        <ClassicStudio onSaved={onSaved} />
      </div>

      {result && (
        <div className="mx-1 rounded-2xl border border-border p-4">
          <p className="text-sm font-semibold">Photo saved to your studio</p>
          <p className="mt-1 text-xs text-muted-foreground">
            What would you like to do with it?
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Button
              onClick={() =>
                router.push(`/app/seller/create?studioImage=${encodeURIComponent(result.url)}`)
              }
            >
              Use in a product listing
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                router.push(`/app/seller/living-pictures/new?image=${encodeURIComponent(result.url)}`)
              }
            >
              Publish as a Living Picture
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
