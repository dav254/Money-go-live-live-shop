'use client';

import * as React from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * SELLER SECTION · LISTING THUMBNAIL.
 *
 * ## Why this exists
 *
 * Both seller screens that show product photos were falling back to an external
 * `placehold.co` rectangle filled with `#111111` — near-black. On a dark
 * storefront a black square does not read as "this listing has no photo yet",
 * it reads as a broken image, which is exactly how it looked: every listing
 * without a photo became a black slab, and the external fallback itself 404'd
 * behind some networks, producing the torn-image icon instead.
 *
 * Drawing the placeholder here fixes both problems at once — no third-party
 * request, no black slab — and lets the tile follow the section's own surface
 * colour in light and dark.
 *
 * It also handles the other half of the problem: a listing whose `imageUrl` is
 * a dead link must not leave a torn icon on screen. `onError` falls back to
 * the same calm tile, so every tile looks deliberate.
 */
export function ListingThumb({
  src,
  alt = '',
  className,
  icon: Icon = ImageOff,
}: {
  src?: string;
  alt?: string;
  className?: string;
  icon?: React.ElementType;
}) {
  const [failed, setFailed] = React.useState(false);

  // A new src deserves a fresh attempt: reusing a listing slot after an edit
  // must not leave the previous image's failure state latched on.
  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  const show = !!src && !failed;

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden bg-secondary/70',
        className,
      )}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Icon className="h-6 w-6 text-muted-foreground/45" aria-hidden />
      )}
    </div>
  );
}