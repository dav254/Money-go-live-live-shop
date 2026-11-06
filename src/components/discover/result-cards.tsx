'use client';

/**
 * DISCOVER · RESULT CARDS.
 *
 * Every field rendered here comes from a genuine document. There is no rating
 * star, review count, "popular" badge or customer figure anywhere in this file,
 * because none of those are known at discovery time — inventing them is how a
 * marketplace teaches buyers to distrust it.
 *
 * Verification is shown as a badge and never implied: `verified` is true only
 * when the business document itself carries a verified status.
 */

import Link from 'next/link';
import { BadgeCheck, Clock, MapPin, Store, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DiscoverBusiness, DiscoverItem, DiscoverListing } from '@/lib/discover/search';
import { getPlaceholderImage } from '@/lib/placeholder-images';

function priceLabel(listing: DiscoverListing): string {
  if (listing.priceMode === 'quote') return 'Request a quote';
  const amount = listing.localPrice ?? listing.price;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return listing.kind === 'service' ? 'Price on request' : 'Price not listed';
  }
  const currency = listing.localCurrency?.trim();
  const formatted = currency
    ? `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return listing.priceMode === 'hourly' ? `${formatted} / hour` : formatted;
}

function SellerLine({ name, href }: { name?: string; href: string }) {
  if (!name) return null;
  return (
    <Link
      href={href}
      className="truncate text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      {name}
    </Link>
  );
}

export function BusinessCard({ business }: { business: DiscoverBusiness }) {
  const initial = business.name.trim().charAt(0).toUpperCase() || 'B';
  return (
    <Card className="group flex h-full flex-col overflow-hidden border-border/70 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          {business.logoUrl ? (
            // Seller-supplied logo; a plain <img> keeps us off Next's image
            // optimiser, which cannot fetch arbitrary external hosts.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logoUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
              {initial}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <h3 className="line-clamp-2 text-base font-semibold leading-tight">{business.name}</h3>
            {business.verified ? (
              <BadgeCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                aria-label="Verified business"
              />
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {business.category ? (
              <span className="inline-flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {business.category}
              </span>
            ) : null}
            {business.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {business.location}
              </span>
            ) : null}
            {typeof business.distanceKm === 'number' ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {business.distanceKm < 1
                  ? `${Math.round(business.distanceKm * 1000)} m away`
                  : `${business.distanceKm.toFixed(1)} km away`}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {business.description ? (
        <p className="line-clamp-2 px-4 text-sm text-muted-foreground">{business.description}</p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 p-4 pt-3">
        <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
          <Store className="h-3 w-3" />
          Business
        </Badge>
        <Button asChild size="sm" variant="outline">
          <Link href={business.shopHref}>Open shop</Link>
        </Button>
      </div>
    </Card>
  );
}

export function ListingCard({ listing }: { listing: DiscoverListing }) {
  const isService = listing.kind === 'service';
  return (
    <Card className="group flex h-full flex-col overflow-hidden border-border/70 transition-shadow hover:shadow-md">
      <Link href={listing.href} className="block">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={listing.imageUrl || getPlaceholderImage()}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {listing.sponsored ? (
              <Badge className="bg-amber-500/95 text-[10px] font-semibold text-white hover:bg-amber-500">
                Sponsored
              </Badge>
            ) : null}
            <Badge variant="secondary" className="text-[10px] font-medium">
              {isService ? 'Service' : 'Product'}
            </Badge>
          </div>
          {listing.availabilityLabel ? (
            <Badge
              variant={listing.availableNow ? 'default' : 'secondary'}
              className="absolute bottom-2 left-2 text-[10px]"
            >
              {listing.availabilityLabel}
            </Badge>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link href={listing.href} className="line-clamp-2 text-sm font-semibold leading-snug hover:underline">
          {listing.name}
        </Link>
        <div className="text-sm font-medium">{priceLabel(listing)}</div>
        {listing.location ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{listing.location}</span>
          </div>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <SellerLine name={listing.sellerName} href={listing.shopHref} />
          <Button asChild size="sm" variant="ghost" className="shrink-0">
            <Link href={listing.href}>{isService ? 'View service' : 'View product'}</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function DiscoverCard({ item }: { item: DiscoverItem }) {
  return item.kind === 'business' ? (
    <BusinessCard business={item} />
  ) : (
    <ListingCard listing={item} />
  );
}
