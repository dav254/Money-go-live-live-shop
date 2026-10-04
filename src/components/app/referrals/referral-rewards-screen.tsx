'use client';

/**
 * REFERRAL REWARDS — the screen both the buyer and the seller get.
 *
 * ## One component, two shells
 *
 * The rules are identical for a buyer and a seller: share a code, earn points
 * that escalate as your network grows, spend them on AI, live streaming,
 * delivery or cash. Only the surrounding chrome differs. So the logic lives
 * here once and each section passes its own `scope`, rather than two copies
 * that drift apart the first time a tier changes.
 *
 * ## Reading the user's referrals
 *
 * `referrals.list` is permitted only for a referrer's own rows (or admin), so
 * this issues exactly one filtered query on `referrerId == uid`. Never a bare
 * `list()` — that is denied, and the screen would sit empty forever.
 *
 * ## The points are not awarded here
 *
 * A signup creates a `pending` referral that earns nothing until an admin
 * approves it in the admin Referrals & Rewards screen. The progress bar
 * therefore counts APPROVED referrals, because that is what has actually paid
 * out. Counting signups here would show a full bar next to an empty balance.
 */

import * as React from 'react';
import { usePathname } from 'next/navigation';
import {
  Check, Copy, Gift, Loader2, Radio, Share2, Sparkles, Truck, Wallet,
} from 'lucide-react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';

import { useFirestore, useUser, useUserProfile } from '@/firebase';
import type { Referral } from '@/lib/types';
import {
  AI_TOPUP_COST, DELIVERY_CREDIT_COST_IN_POINTS, LIVE_STREAM_UNLOCK_COST,
  MIN_SIGNUPS_FOR_PAYOUT, currentBandBounds, formatPoints, nextSignupValue,
  nextTier, signupsToNextTier,
} from '@/lib/referrals/rewards';
import { inviteLinkFor, inviteShareText, normaliseReferralCode, referralCodeFor } from '@/lib/referrals/referral-code';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  BuyerCard, BuyerEmptyState, BuyerSectionTitle, BuyerStatusPill,
} from '@/components/app/buyer/buyer-app-shell';
import { cn } from '@/lib/utils';

/** Which shell is hosting this screen. */
type Scope = 'buyer' | 'seller';

export function ReferralRewardsScreen({ scope }: { scope: Scope }) {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const { toast } = useToast();
  const pathname = usePathname();

  const [referrals, setReferrals] = React.useState<Referral[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  // One filtered query — the only shape the rules allow a non-admin here.
  React.useEffect(() => {
    if (!firestore || !user?.uid) return;
    const q = query(
      collection(firestore, 'referrals'),
      where('referrerId', '==', user.uid),
    );
    return onSnapshot(
      q,
      (snap) => {
        setReferrals(snap.docs.map((d) => ({ ...(d.data() as Referral), id: d.id }) as Referral));
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );
  }, [firestore, user?.uid]);

  /*
   * The code that goes in the link.
   *
   * `referralSlug` is the person's name — `david-chege` — minted on the server
   * and written back to the profile. Until a profile has one (an account made
   * before this change, or one whose display name is only symbols), fall back
   * to the legacy six-character token so nobody is left with an empty box to
   * copy. Both resolve, so the fallback costs nothing but a less pretty link.
   */
  const code = normaliseReferralCode(userProfile?.referralSlug || '') ||
    referralCodeFor(user?.uid || '');
  const balance = Number(userProfile?.referralPoints) || 0;
  const credits = Number(userProfile?.deliveryCredits) || 0;

  const approved = referrals.filter((r) => r.status === 'approved').length;
  const pending = referrals.filter((r) => r.status === 'pending').length;
  const next = nextSignupValue(approved);
  const upcoming = nextTier(approved);
  const toNext = signupsToNextTier(approved);

  // Progress through the CURRENT band, so the bar means something at 0.
  // Bounds come from the ladder itself, not a duplicated floor list.
  const band = currentBandBounds(approved);
  const bandSpan = band.ceiling === null ? 1 : Math.max(1, band.ceiling - band.floor);
  const bandProgress = Math.min(100, Math.max(0, ((approved - band.floor) / bandSpan) * 100));

  const [redeeming, setRedeeming] = React.useState<string | null>(null);
  const [canRedeem, setCanRedeem] = React.useState(false);

  // Balance arrives on the profile, so re-read it after a redemption or the
  // button would keep offering something the user can no longer afford.
  React.useEffect(() => {
    if (!user || !firestore) {
      setCanRedeem(false);
      return;
    }
    return onSnapshot(
      doc(firestore, 'userProfiles', user.uid),
      (snap) => setCanRedeem(Boolean(snap.exists())),
      () => setCanRedeem(false),
    );
  }, [user, firestore]);

  /**
   * Spends points.
   *
   * Goes through the server route rather than decrementing locally: the
   * balance is money, and two taps racing each other must not both succeed.
   * The server transaction is the thing that decides.
   */
  const redeem = async (kind: 'ai' | 'live' | 'cash', amount?: number) => {
    if (!user) return;
    setRedeeming(kind);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/referrals/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ redeem: kind, amount }),
      });
      const data = (await res.json()) as { error?: string; message?: string };

      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Could not redeem',
          description: data.error || 'Try again in a moment.',
        });
        return;
      }

      toast({
        title: kind === 'cash' ? 'Payout requested' : 'Redeemed',
        description: data.message || 'Your balance has been updated.',
      });
    } catch {
      toast({ variant: 'destructive', title: 'Could not reach the server.' });
    } finally {
      setRedeeming(null);
    }
  };

  const copyInvite = async () => {
    const link = inviteLinkFor(code);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Invite link copied' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy. Your code is ' + code });
    }
  };

  const shareInvite = async () => {
    const link = inviteLinkFor(code);
    const text = inviteShareText(code, next.points);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on Vidnov', text, url: link });
      } catch {
        /* user dismissed the sheet — nothing to report */
      }
      return;
    }
    await copyInvite();
  };

  const redemptions = [
    {
      key: 'ai',
      icon: Sparkles,
      label: 'AI tools',
      detail: `Top up ${formatPoints(AI_TOPUP_COST)} points toward AI runs`,
      affordable: balance >= AI_TOPUP_COST,
    },
    {
      key: 'live',
      icon: Radio,
      label: 'Live stream unlock',
      detail: `${formatPoints(LIVE_STREAM_UNLOCK_COST)} points for one live session`,
      affordable: balance >= LIVE_STREAM_UNLOCK_COST,
    },
    {
      key: 'delivery',
      icon: Truck,
      label: 'Free delivery',
      detail: credits > 0
        ? `${credits} credit${credits === 1 ? '' : 's'} ready — applied automatically`
        : `${DELIVERY_CREDIT_COST_IN_POINTS} points buys one free delivery`,
      affordable: credits > 0 || balance >= DELIVERY_CREDIT_COST_IN_POINTS,
    },
    {
      key: 'cash',
      icon: Wallet,
      label: 'Cash or voucher',
      detail: approved >= MIN_SIGNUPS_FOR_PAYOUT
        ? 'Request a payout — paid out by our team'
        : `Unlocks at ${MIN_SIGNUPS_FOR_PAYOUT} confirmed signups`,
      affordable: approved >= MIN_SIGNUPS_FOR_PAYOUT && balance > 0,
    },
  ];

  return (
    <div className={cn('vn-page-enter pb-6', scope === 'seller' && 'vn-seller-scope')}>
      <BuyerSectionTitle
        eyebrow={scope === 'seller' ? 'Grow' : 'Rewards'}
        title="Invite & earn"
        action={
          balance > 0 ? (
            <span className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-3 py-1.5 text-xs font-bold text-white">
              {formatPoints(balance)} pts
            </span>
          ) : undefined
        }
      />

      {/* ------------------------------------------------------- invite card */}
      <div className="px-4">
        <BuyerCard className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-cyan-400/20 to-violet-500/20 blur-2xl" />
          <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-500 dark:text-cyan-400">
            Your invite code
          </p>
          <p className="mt-3 font-mono text-4xl font-black tracking-[0.2em] text-foreground">
            {code || '——'}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {next.remainingAtThisRate > 0
              ? `Your next ${next.remainingAtThisRate} invite${next.remainingAtThisRate === 1 ? '' : 's'} earn ${next.points} points each.`
              : `Every invite from now earns ${next.points} points.`}
          </p>

          <div className="mt-4 flex gap-2">
            <Button
              onClick={copyInvite}
              className="h-11 flex-1 rounded-2xl border-white/10 bg-white/5 font-semibold text-foreground hover:bg-white/10"
            >
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button
              onClick={shareInvite}
              className="h-11 flex-1 rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 font-semibold text-white"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </BuyerCard>
      </div>

      {/* ------------------------------------------------------ tier ladder */}
      <div className="mt-4 px-4">
        <BuyerCard>
          <div className="flex items-center justify-between">
            <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-500 dark:text-cyan-400">
              {band.name} tier
            </p>
            <p className="text-xs text-muted-foreground">
              {approved} confirmed {approved === 1 ? 'referral' : 'referrals'}
              {pending > 0 && ` · ${pending} awaiting approval`}
            </p>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all"
              style={{ width: `${bandProgress}%` }}
            />
          </div>

          {upcoming ? (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Invite <span className="font-semibold text-foreground">{toNext} more</span> and
              each signup pays {upcoming.points} points instead of {next.points}.
            </p>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              You are on the top rate. Every signup pays {next.points} points.
            </p>
          )}
        </BuyerCard>
      </div>

      {/* ------------------------------------------------------- what it buys */}
      <div className="mt-4 px-4">
        <BuyerCard>
          <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-500 dark:text-cyan-400">
            What your points do
          </p>
          <ul className="mt-3 space-y-3">
            {redemptions.map((r) => {
              const Icon = r.icon;
              return (
                <li key={r.key} className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                      r.affordable
                        ? 'bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-cyan-500'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.detail}</p>
                  </div>

                  {/* Free delivery needs no button — it applies itself at
                      checkout, which is the whole point of making it automatic.
                      The rest are spendable here. */}
                  {r.key === 'delivery' ? (
                    credits > 0 ? (
                      <BuyerStatusPill status="ready" />
                    ) : null
                  ) : r.affordable && canRedeem ? (
                    <Button
                      size="sm"
                      disabled={redeeming === r.key}
                      onClick={() => redeem(r.key as 'ai' | 'live' | 'cash', balance)}
                      className="shrink-0 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-4 text-[11px] font-bold uppercase tracking-wider text-white"
                    >
                      {redeeming === r.key ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : null}
                      Redeem
                    </Button>
                  ) : (
                    <BuyerStatusPill status="locked" />
                  )}
                </li>
              );
            })}
          </ul>
        </BuyerCard>
      </div>

      {/* ---------------------------------------------------------- history */}
      <div className="mt-4 px-4">
        <BuyerCard>
          <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-500 dark:text-cyan-400">
            Your signups
          </p>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
            </div>
          ) : referrals.length === 0 ? (
            <BuyerEmptyState
              icon={Gift}
              title="No invites sent yet"
              body="Share your code. When someone signs up with it, their first purchase unlocks the points for you."
            />
          ) : (
            <ul className="mt-3 space-y-2">
              {referrals.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {r.refereeName || 'New member'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.createdAt
                        ? (r.createdAt as { toDate?: () => Date }).toDate?.().toLocaleDateString() ?? ''
                        : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.pointsAwarded ? (
                      <span className="text-sm font-bold text-cyan-500">
                        +{formatPoints(r.pointsAwarded)}
                      </span>
                    ) : null}
                    <BuyerStatusPill status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </BuyerCard>
      </div>

      <p className="mt-4 px-4 text-center text-[11px] leading-relaxed text-muted-foreground">
        Points are confirmed after our team reviews each signup, so a balance can take a
        moment to appear. Spending and history live in{' '}
        {pathname?.startsWith('/app/seller') ? 'your seller wallet' : 'your account'}.
      </p>
    </div>
  );
}
