'use client';

/**
 * TRUST BADGES — verification and rating.
 *
 * One component for both, used on shop headers, the seller profile, the buyer
 * profile and the product screen. The failure this avoids is the usual one: a
 * "Verified" tick on the website that means nothing and a different tick in
 * the app that means something, and a buyer who has learned to distrust the
 * first one distrusts the second.
 *
 * ## It never over-promises
 *
 * `submitted` is the honest danger state. Showing "Documents submitted" as if
 * it were a tick would be the single easiest way to destroy the value of
 * verification: buyers would learn that the badge appears before anyone has
 * checked anything, and then it would mean nothing forever.
 */

import * as React from 'react';
import { BadgeCheck, Clock, ShieldQuestion, ShieldX, Star } from 'lucide-react';

import { verificationMeta, type VerificationStatus } from '@/lib/verification';
import { cn } from '@/lib/utils';

const TONE_STYLES = {
  good: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  pending: 'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  bad: 'bg-red-500/10 text-red-600 ring-red-500/25 dark:text-red-300',
  neutral: 'bg-white/5 text-muted-foreground ring-white/10',
} as const;

const TONE_ICONS = {
  good: BadgeCheck,
  pending: Clock,
  bad: ShieldX,
  neutral: ShieldQuestion,
} as const;

export function VerificationBadge({
  status,
  className,
  size = 'sm',
}: {
  status: unknown;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const meta = verificationMeta(status);
  const Icon = TONE_ICONS[meta.tone];

  return (
    <span
      title={meta.detail}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-black uppercase tracking-widest ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]',
        TONE_STYLES[meta.tone],
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden />
      {meta.label}
    </span>
  );
}

/**
 * The star row.
 *
 * Half stars are shown rather than rounded to a whole number: a shop at 4.4
 * that displays "4 stars" is making a claim its average does not support, and
 * this is a trust component, so it should be the more accurate of the two.
 */
export function RatingSummary({
  average,
  count,
  className,
  showCount = true,
}: {
  average: number;
  count: number;
  className?: string;
  showCount?: boolean;
}) {
  if (!count) {
    return <span className={cn('text-[11px] text-muted-foreground', className)}>No reviews yet</span>;
  }

  const rounded = Math.round(average * 2) / 2;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="flex items-center gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = rounded >= i;
          const half = !filled && rounded >= i - 0.5;
          return (
            <Star
              key={i}
              className={cn(
                'h-3 w-3',
                filled
                  ? 'fill-amber-400 text-amber-400'
                  : half
                    ? 'fill-amber-400/50 text-amber-400'
                    : 'fill-transparent text-white/20',
              )}
            />
          );
        })}
      </span>
      <span className="text-[11px] font-bold text-foreground">{average.toFixed(1)}</span>
      {showCount && (
        <span className="text-[11px] text-muted-foreground">
          ({count} {count === 1 ? 'review' : 'reviews'})
        </span>
      )}
      {/* The number, for anyone not looking at the stars. */}
      <span className="sr-only">
        {average.toFixed(1)} out of 5 from {count} reviews
      </span>
    </span>
  );
}
