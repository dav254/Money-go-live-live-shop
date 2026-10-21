'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Clapperboard } from 'lucide-react';
import { LivingPictureFlow } from '@/components/studio/living-picture-flow';
import { SellerSectionTitle } from '@/components/app/seller/seller-app-shell';

/**
 * APP SELLER — NEW LIVING PICTURE (`/app/seller/living-pictures/new`).
 *
 * The destination of Classic Studio's "Publish as a Living Picture" and of the
 * seller drawer's own entry. It reads an optional `?image=` (a stored studio
 * URL) so the flow can start from an already-edited photo; without it the
 * seller picks one directly.
 */
export default function NewLivingPicturePage() {
  return (
    <Suspense
      fallback={
        <p className="px-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
          Loading…
        </p>
      }
    >
      <NewLivingPictureInner />
    </Suspense>
  );
}

function NewLivingPictureInner() {
  const params = useSearchParams();
  const image = params.get('image') ?? undefined;

  return (
    <div className="vn-page-enter space-y-4 pb-6">
      <SellerSectionTitle
        eyebrow="Living Pictures"
        title="Publish a Living Picture"
        action={
          <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider">
            <Clapperboard className="h-3 w-3" />
            Photo + music
          </span>
        }
      />
      <p className="-mt-2 px-4 text-xs leading-relaxed text-muted-foreground">
        A still photo with optional licensed music. Publish it with no music anytime — music is
        never required.
      </p>
      <div className="px-1">
        <LivingPictureFlow initialImage={image} />
      </div>
    </div>
  );
}
