'use client';

import * as React from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { useAuth } from '@/firebase';
import { TierBadge, TierBenefitsList, TierProgressMeter } from '@/components/trust/tier-badge';
import { tierMeta, type AccountTier, type TierProgress } from '@/lib/tiers';
import { cn } from '@/lib/utils';

/**
 * THE ACCOUNT TIER, FOR THE PERSON WHO OWNS IT.
 *
 * ## Read-only from the point of view of the person looking at it
 *
 * There is no button here. Opening this panel re-runs the same arithmetic the
 * server runs for everybody, so the number can never be one the seller argued
 * their way into — and there is no "claim your tier" path to add later without
 * breaking the only thing that makes the badge worth showing.
 *
 * ## Why it is mounted on the business screen
 *
 * The badge is earned from transactions, and transactions happen because a
 * business exists. Putting the ladder where the business is set up means the
 * seller sees the first rung while they are still filling in the form that
 * produces their first sale, rather than discovering the tier system after they
 * have stopped looking for it.
 *
 * ## Both directions count
 *
 * `sold` and `bought` are added together before the tier is chosen. A seller is
 * usually also a buyer, and punishing someone for the buying half of their life
 * on the platform would be a strange reward function.
 */

interface Bonus {
  bonus?: string;
  bonusLabel?: string;
  kind?: string;
  amount?: number;
  reason?: string;
  grantedAt?: string;
}

interface SyncPayload {
  tier: AccountTier;
  completed: number;
  progress: TierProgress;
  bonuses: Bonus[];
}

function bonusTitle(b: Bonus): string {
  if (b.bonusLabel) return b.bonusLabel;
  if (b.bonus) return b.bonus;
  return 'Bonus';
}

export function SellerTierPanel({ className }: { className?: string }) {
  const auth = useAuth();
  const [data, setData] = React.useState<SyncPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = auth?.currentUser;
      if (!current) {
        setLoading(false);
        return;
      }
      try {
        const token = await current.getIdToken();
        // POST, not GET: this both reads the tier and awards it if the counts
        // have moved. The seller does not choose anything.
        const res = await fetch('/api/tiers/sync', {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error('failed');
        const json = (await res.json()) as SyncPayload;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth]);

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Working out your tier…
      </div>
    );
  }

  // No account, or the request failed. Showing an empty progress bar would be
  // worse than showing nothing: it implies a count of zero that was never read.
  if (failed || !data) return null;

  const meta = tierMeta(data.tier);
  const bonuses = Array.isArray(data.bonuses) ? data.bonuses : [];

  return (
    <section className={cn('space-y-3', className)} aria-label="Your account tier">
      <div>
        <h2 className="font-grotesk text-sm font-semibold text-foreground">Your tier</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Worked out from your completed transactions, on its own. There is nothing to
          apply for and nobody approves it — at {data.completed} completed{' '}
          {data.completed === 1 ? 'transaction' : 'transactions'} you are{' '}
          <span className="font-semibold text-foreground">{meta.label}</span>
          {data.progress.next ? (
            <>
              , and {data.progress.toNext} more{' '}
              {data.progress.toNext === 1 ? 'transaction' : 'transactions'} reach{' '}
              {tierMeta(data.progress.next).label}.
            </>
          ) : (
            ', which is the top of the ladder.'
          )}
        </p>
      </div>

      <TierProgressMeter progress={data.progress} />

      {data.tier !== 'none' && <TierBenefitsList tier={data.tier} />}

      {bonuses.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Gift className="h-4 w-4 text-primary" />
            Given to you by the team
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            These sit on top of your tier. They do not change it, and they never will —
            your tier is only ever what your completed transactions say it is.
          </p>
          <ul className="mt-3 space-y-2">
            {bonuses.map((b, i) => (
              <li key={`${b.grantedAt ?? 'bonus'}-${i}`} className="rounded-lg bg-muted/40 px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-semibold text-foreground">{bonusTitle(b)}</span>
                  {typeof b.amount === 'number' && (
                    <span className="text-xs text-muted-foreground">{b.amount}</span>
                  )}
                </div>
                {b.reason && (
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{b.reason}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}