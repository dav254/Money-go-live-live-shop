'use client';

import * as React from 'react';
import { Award, Check, Clock, Crown, Medal, Sparkles, Trophy } from 'lucide-react';
import {
  activeBenefits,
  tierMeta,
  upcomingBenefits,
  type AccountTier,
  type TierProgress,
} from '@/lib/tiers';
import { cn } from '@/lib/utils';

/**
 * THE TIER BADGE.
 *
 * ## Automatic, and it says so
 *
 * Nobody grants this. It follows from completed transactions, so it cannot be
 * bought, cannot be applied for, and cannot be taken away by a moderator's
 * mood. That is the entire reason it is worth showing a buyer — an admin
 * applying a badge by hand is a badge that means "someone on our side liked
 * them", which is not the same claim at all.
 *
 * The subtitle says "automatic" precisely so nobody mistakes it for the
 * verification tick, which IS a human decision. Two trust marks, two sources.
 */

const TONE_STYLES = {
  neutral: 'bg-white/5 text-muted-foreground ring-border',
  bronze: 'bg-amber-700/15 text-amber-700 ring-amber-700/30 dark:text-amber-400',
  silver: 'bg-slate-400/15 text-slate-600 ring-slate-400/30 dark:text-slate-300',
  gold: 'bg-amber-400/15 text-amber-600 ring-amber-400/40 dark:text-amber-300',
  premium: 'bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:text-violet-300',
} as const;

const TIER_ICONS = {
  none: Sparkles,
  bronze: Medal,
  silver: Medal,
  gold: Trophy,
  premium: Crown,
} as const;

export function TierBadge({
  tier,
  completed,
  showCount = false,
  size = 'sm',
  className,
}: {
  tier: AccountTier | null | undefined;
  /** Completed transactions, shown when asked for. Never rating. */
  completed?: number;
  showCount?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const meta = tierMeta(tier);

  if (meta.tone === 'neutral') {
    // No badge at all for an account with no history. Showing "New" as a tier
    // makes the ladder look like it starts at zero and rewards nobody; showing
    // nothing makes the first sale visibly worth something.
    //
    // The check is on `tone`, not on the tier: `tone` is what distinguishes
    // "no history" from a real tier. Comparing the tier to 'none' was a
    // type error AND a dead guard — it never fired.
    return null;
  }

  const Icon = TIER_ICONS[meta.tone as keyof typeof TIER_ICONS];

  return (
    <span
      title={`${meta.label} — ${meta.detail} Earned automatically from completed transactions.`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-black uppercase tracking-widest ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]',
        TONE_STYLES[meta.tone],
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden />
      {meta.label}
      {showCount && typeof completed === 'number' && (
        <span className="opacity-70">· {completed}</span>
      )}
      <span className="sr-only">
        {meta.label} tier, earned automatically from completed transactions.
      </span>
    </span>
  );
}

/**
 * THE PROGRESS METER — for the seller, not the buyer.
 *
 * Shows how many completed transactions stand between this account and the next
 * tier. Buyers never see this: telling a buyer "this seller needs 7 more sales
 * to improve" is pressure, and pressure is not trust.
 */
export function TierProgressMeter({
  progress,
  className,
}: {
  progress: TierProgress;
  className?: string;
}) {
  const meta = tierMeta(progress.tier);

  if (progress.tier === 'none') {
    // A seller with no completed transactions has no badge, so the meter has
    // nothing to measure. Show the first step instead: the ladder has to look
    // like it starts somewhere, or a new seller concludes it does not.
    return (
      <div className={cn('rounded-xl border border-border p-4', className)}>
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Award className="h-4 w-4 text-muted-foreground" />
          Start at Bronze
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Complete one transaction and the badge appears on its own. No approval, no
          application.
        </p>
      </div>
    );
  }

  const pct = Math.round(progress.progress * 100);

  return (
    <div className={cn('rounded-xl border border-border p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <TierBadge tier={progress.tier} size="md" showCount completed={progress.completed} />
        {progress.next ? (
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{progress.toNext}</span> more to{' '}
            {tierMeta(progress.next).label}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Top tier reached</span>
        )}
      </div>

      {progress.next && (
        <>
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress to ${tierMeta(progress.next).label}`}
          >
            <div
              className={cn('h-full rounded-full bg-primary transition-all', pct === 0 && 'opacity-0')}
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{meta.detail}</p>
        </>
      )}

      {!progress.next && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{meta.detail}</p>
      )}
    </div>
  );
}

/**
 * WHAT A TIER ACTUALLY GIVES YOU — split into what you have and what is coming.
 *
 * ## Why the split is the whole point
 *
 * The fee and credit perks are real promises in the ladder, but the platform has
 * no fee engine and no credits ledger yet, so they are DECLARED, not delivered
 * (`enforced: false` in `TIER_BENEFITS`). Listing them in the same bullet style
 * as the badge the seller really does have would be telling a seller they have a
 * lower commission while they are still paying the full one — discovered at
 * payout, which is the worst possible moment to be wrong.
 *
 * So: delivered perks get a tick, unbuilt ones are labelled "coming" and say why.
 * The upside is still visible — a ladder with a visible next rung is hope, and
 * hope is what this is selling. Hope that is also honest.
 */
export function TierBenefitsList({
  tier,
  className,
  showUpcoming = true,
}: {
  tier: AccountTier | null | undefined;
  className?: string;
  showUpcoming?: boolean;
}) {
  const resolved = tierMeta(tier).tone === 'neutral' ? ('none' as AccountTier) : (tier as AccountTier);
  const active = activeBenefits(resolved);
  const upcoming = showUpcoming ? upcomingBenefits(resolved) : [];

  if (active.length === 0 && upcoming.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {active.length > 0 && (
        <ul className="space-y-2">
          {active.map((b) => (
            <li key={b.key} className="flex items-start gap-2 text-xs leading-relaxed">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-semibold text-foreground">{b.label}</span>
                <span className="text-muted-foreground"> — {b.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {upcoming.length > 0 && (
        <ul className="space-y-2">
          {upcoming.map((b) => (
            <li key={b.key} className="flex items-start gap-2 text-xs leading-relaxed">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                <span className="font-semibold text-muted-foreground">
                  Coming · {b.label}
                </span>
                <span className="text-muted-foreground/80"> — {b.detail}</span>
              </span>
            </li>
          ))}
          <li className="text-[11px] leading-relaxed text-muted-foreground">
            Fee and credit perks switch on when the platform fee engine and credits
            ledger ship. Until then these are the roadmap, not a discount.
          </li>
        </ul>
      )}
    </div>
  );
}
