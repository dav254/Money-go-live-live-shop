'use client';

import * as React from 'react';
import { Loader2, MapPin, Star } from 'lucide-react';
import { VerificationBadge, RatingSummary } from '@/components/trust/verification-badge';
import { TierBadge } from '@/components/trust/tier-badge';
import type { AccountTier } from '@/lib/tiers';
import { cn } from '@/lib/utils';

/**
 * THE TRUST BLOCK — one component, both surfaces.
 *
 * ## Why this file exists
 *
 * The website's shop page hardcoded `rating: 0, reviewsCount: 0` while the app
 * had real verification, real reviews and a real location model. Same platform,
 * two different businesses on screen: strangers saw everyone as brand new, and
 * sellers who trusted the app's numbers could not point to anywhere on the open
 * web that showed them.
 *
 * That is the whole argument for this file. Trust signals that live in two
 * places are not trust signals — they are two claims, and they drift.
 *
 * ## It fetches its own data
 *
 * `/api/public/business/{sellerId}` needs no auth, so the same component works
 * for a signed-in buyer on the app and for a logged-out visitor on a shared
 * link. One fetch, one payload, both surfaces.
 *
 * ## The distance is computed HERE, in the browser
 *
 * The server deliberately receives no visitor location. The browser already
 * holds it, so "Westlands · 2.1 km away" is a number this file can make
 * without putting a coordinate into a request.
 */

export interface PublicBusinessPayload {
  business: {
    id: string;
    name: string;
    slug?: string;
    kind?: string;
    category?: string;
    verificationStatus: string | null;
    reputationScore?: number | null;
    areaName: string | null;
    cityName: string | null;
    serviceRadiusKm?: number | null;
    serves?: string[];
    memberCount?: number;
    /** Automatic, earned from delivered orders. Absent on older payloads. */
    tier?: AccountTier | null;
    completedTransactions?: number;
  } | null;
  reviews: {
    average: number;
    count: number;
    distribution: Record<string, number>;
  };
  reviewsList: {
    id: string;
    rating: number;
    text: string;
    createdAt: any;
    authorName: string;
    businessReply?: string;
  }[];
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Distance between the viewer and a business, computed in the browser.
 *
 * The viewer's location is passed in rather than read from storage: on the app
 * the caller already holds it, and on the website a logged-out visitor has
 * none — and inventing a source that is never written would make this silently
 * return null forever. No viewer location means no distance shown, which is the
 * honest outcome, not a missing feature.
 */
function distanceFromViewer(
  viewer: { lat?: number; lng?: number } | null | undefined,
  origin: { lat?: number; lng?: number } | null | undefined,
): number | null {
  if (!viewer || !origin) return null;
  if (typeof viewer.lat !== 'number' || typeof viewer.lng !== 'number') return null;
  if (typeof origin.lat !== 'number' || typeof origin.lng !== 'number') return null;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(origin.lat - viewer.lat);
  const dLng = toRad(origin.lng - viewer.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(viewer.lat)) * Math.cos(toRad(origin.lat));
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * 100) / 100;
}

export function BusinessTrustPanel({
  sellerId,
  origin,
  viewerLocation,
  className,
  onLoaded,
}: {
  sellerId: string;
  /** Published point, used only to compute a distance the visitor can see. */
  origin?: { lat?: number; lng?: number } | null;
  /** The VIEWER's own coarse location. Omit when unknown; no distance is shown. */
  viewerLocation?: { lat?: number; lng?: number } | null;
  className?: string;
  onLoaded?: (data: PublicBusinessPayload) => void;
}) {
  const [data, setData] = React.useState<PublicBusinessPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/business/${encodeURIComponent(sellerId)}`);
        if (!res.ok) throw new Error('failed');
        const json = (await res.json()) as PublicBusinessPayload;
        if (cancelled) return;
        setData(json);
        onLoaded?.(json);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 py-3 text-sm text-muted-foreground', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading business…
      </div>
    );
  }

  if (failed || !data) {
    return null;
  }

  const { business, reviews } = data;
  const km = distanceFromViewer(viewerLocation, origin);
  const where = business
    ? [business.areaName, business.cityName].filter(Boolean).join(', ') || null
    : null;

  return (
    <div className={cn('space-y-4', className)}>
      {business ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <VerificationBadge status={business.verificationStatus} size="md" />

          {/* Two trust marks, two sources, side by side on purpose. The tick is
              a person who looked at documents; the tier is arithmetic over
              delivered orders. Putting them together, with different words,
              stops either one being mistaken for the other. */}
          <TierBadge tier={business.tier} completed={business.completedTransactions} />

          {/* `RatingSummary` rather than a local star row: it renders half stars
              (a 4.4 average shown as "4 stars" is a claim the number does not
              support), it carries screen-reader text, and it says "No reviews
              yet" instead of "0.0 from 0 reviews" — which is what made the old
              page read as brand new. One star row, one meaning. */}
          <RatingSummary average={reviews.average} count={reviews.count} />

          {where && (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {where}
              {km !== null && <span className="font-medium text-foreground"> · {formatDistance(km)} away</span>}
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          This shop has not completed business verification yet.
        </p>
      )}

      {business && business.serves && business.serves.length > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Serves: </span>
          {business.serves.join(', ')}
          {business.serviceRadiusKm ? ` · within ${business.serviceRadiusKm} km` : ''}
        </p>
      )}
    </div>
  );
}

/**
 * The reviews list itself.
 *
 * Kept separate from the panel because the shop page has tabs and a tab body
 * should not re-fetch the payload it already has.
 */
export function BusinessReviewsList({
  data,
  emptyText = 'No reviews yet. Be the first to say how this business went.',
}: {
  /** `undefined` is valid and means "not loaded yet" — same as `null` here. */
  data: PublicBusinessPayload | null | undefined;
  emptyText?: string;
}) {
  if (!data || data.reviewsList.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="space-y-4">
      {data.reviewsList.map((r) => (
        <li key={r.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">{r.authorName}</span>
            <span className="inline-flex items-center gap-0.5" aria-label={`${r.rating} out of 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={cn(
                    'h-3.5 w-3.5',
                    n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-border',
                  )}
                />
              ))}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{r.text}</p>
          {r.businessReply && (
            <p className="mt-3 border-l-2 border-primary pl-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Business replied: </span>
              {r.businessReply}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
