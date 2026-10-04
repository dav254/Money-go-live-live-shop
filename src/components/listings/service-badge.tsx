'use client';

/**
 * SERVICE LISTING BADGE & PRICE.
 *
 * ## Why this file exists
 *
 * A service was posting and buying perfectly but reading as a product with a
 * number on it: the feed said "KES 4,500", the drawer said "In stock", and a
 * plumber whose price was deliberately unset showed "KES 0". Every surface
 * needs to know three things — is this a service, what is the trade, and is
 * there a price at all — and each of them re-deciding on its own is how they
 * end up disagreeing.
 *
 * So the three answers live here and every surface imports them.
 *
 * ## The rule that matters
 *
 * A quote-based service must NEVER render a price, not even "0". Showing a
 * number to a buyer who is about to ask for a quote is worse than showing
 * nothing: it anchors them on a price the plumber never agreed to. So the
 * quote branch returns before any currency is formatted.
 */

import * as React from 'react';
import { BadgeCheck, Hammer, Quote } from 'lucide-react';

import type { Product } from '@/lib/types';
import { serviceCategoryLabel } from '@/lib/listings/limits';
import { cn } from '@/lib/utils';

/**
 * A listing is a service when it says so.
 *
 * Anything without the field is a product. That default is what keeps every
 * listing created before services existed rendering exactly as it did, with no
 * migration and no risk of a half-migrated listing vanishing from the feed.
 */
export function isService(listing: Partial<Product> | null | undefined): boolean {
  return listing?.listingType === 'service';
}

/** How the price should read, resolved once for every surface. */
export type PriceDisplay =
  | { kind: 'quote'; label: string }
  | { kind: 'hourly'; label: string; amount: number; currency: string }
  | { kind: 'fixed'; amount: number; currency: string };

export function listingPriceDisplay(listing: Partial<Product> | null | undefined): PriceDisplay | null {
  if (!listing) return null;

  if (isService(listing) && listing.priceMode === 'quote') {
    return { kind: 'quote', label: 'Get a quote' };
  }

  const amount = Number(listing.localPrice || listing.price || 0);
  const currency = listing.localCurrency || 'USD';

  if (isService(listing) && listing.priceMode === 'hourly') {
    return { kind: 'hourly', amount, currency, label: 'per hour' };
  }

  return { kind: 'fixed', amount, currency };
}

/**
 * The SERVICE pill.
 *
 * Shows the trade alongside it ("SERVICE · Plumbing") because a badge that only
 * says "service" tells a buyer nothing about whether this plumber can do their
 * job, and the feed has room for exactly one line.
 */
export function ServiceBadge({
  listing,
  className,
  tone = 'dark',
}: {
  listing: Partial<Product> | null | undefined;
  className?: string;
  tone?: 'dark' | 'light';
}) {
  if (!isService(listing)) return null;
  const trade = serviceCategoryLabel(listing?.serviceCategory);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest',
        tone === 'dark'
          ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-inset ring-cyan-500/30'
          : 'bg-cyan-500/10 text-cyan-700 ring-1 ring-inset ring-cyan-500/25 dark:text-cyan-300 dark:ring-cyan-500/30',
        className,
      )}
    >
      <Hammer className="h-2.5 w-2.5" aria-hidden />
      Service · {trade}
    </span>
  );
}

/**
 * The price line.
 *
 * Returns `null` only when there is genuinely nothing to say, which for a
 * fixed-price listing with no number yet is a real state the seller has to fix
 * — so it says so rather than printing "0".
 */
export function ListingPrice({
  listing,
  className,
  tone = 'dark',
}: {
  listing: Partial<Product> | null | undefined;
  className?: string;
  tone?: 'dark' | 'light';
}) {
  const display = listingPriceDisplay(listing);
  if (!display) return null;

  if (display.kind === 'quote') {
    return (
      <p className={cn('flex items-center gap-1.5 font-black tracking-tighter leading-none', tone === 'dark' ? 'text-cyan-300' : 'text-cyan-600 dark:text-cyan-300', className)}>
        <Quote className="h-3 w-3" aria-hidden />
        {display.label}
      </p>
    );
  }

  if (display.kind === 'hourly') {
    return (
      <p className={cn('flex items-center gap-1 font-black tracking-tighter leading-none', tone === 'dark' ? 'text-primary' : 'text-primary', className)}>
        <BadgeCheck className="h-3 w-3" aria-hidden />
        <span className="text-[14px]">
          {display.currency} {display.amount.toLocaleString()}
        </span>
        <span className={cn('text-[9px] font-black uppercase tracking-widest', tone === 'dark' ? 'text-white/60' : 'text-muted-foreground')}>
          /hr
        </span>
      </p>
    );
  }

  return (
    <p className={cn('font-black tracking-tighter leading-none text-primary', className)}>
      {display.currency} {display.amount.toLocaleString()}
    </p>
  );
}

/**
 * "In stock 3" is meaningless for a plumber.
 *
 * Returns null for a service so callers can drop the element entirely rather
 * than render an empty gap where a stock count used to be.
 */
export function ListingStock({ listing }: { listing: Partial<Product> | null | undefined }) {
  if (isService(listing)) return null;
  const stock = Number(listing?.stock);
  if (!Number.isFinite(stock)) return null;
  return (
    <span className={cn('text-[8px] font-black uppercase tracking-widest', stock > 0 ? 'text-green-500/80' : 'text-red-400/80')}>
      {stock > 0 ? `Stock ${stock}` : 'Out of stock'}
    </span>
  );
}
