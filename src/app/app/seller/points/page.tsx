'use client';

import * as React from 'react';
import Link from 'next/link';
import { Coins, Gift, Sparkles, TrendingUp } from 'lucide-react';
import { useUser, useUserProfile } from '@/firebase';
import { BuyPointsButton } from '@/components/ai/buy-points-dialog';
import {
  EmptyState,
  SellerCard,
  SellerSectionTitle,
} from '@/components/app/seller/seller-app-shell';

/**
 * SELLER APP · AI POINTS (`/app/seller/points`).
 *
 * ## Why this screen exists
 *
 * Points were visible only as a number tucked inside AI Studio, so a seller
 * had to open a creation tool to learn what they owned — and nowhere in the
 * section could they buy more. This is the section's single home for the
 * balance: what it is, where it goes, how to earn it, and how to pay for it.
 *
 * The balance is read from `userProfiles/{uid}.aiPoints`, the same document
 * the AI gateway decrements, so the number here and the number in the studio
 * can never disagree.
 *
 * The top-up control is the shared `BuyPointsDialog` — the exact packages and
 * Paystack/PayPal hand-off the website's AI Toolkit sells. Points are platform
 * currency; they must cost the same everywhere or the ledger stops making
 * sense.
 */
export default function AppSellerPointsPage() {
  const { user } = useUser();
  const { userProfile, isLoading } = useUserProfile(user?.uid);
  const points = userProfile?.aiPoints ?? 0;

  if (!isLoading && !userProfile) {
    return (
      <div className="space-y-6 pb-2">
        <SellerSectionTitle eyebrow="AI points" title="Your balance" />
        <EmptyState
          icon={Coins}
          title="No profile yet"
          body="Your points balance appears once your seller profile is ready."
        />
      </div>
    );
  }

  return (
    <div className="vn-page-enter space-y-6 pb-2">
      <SellerSectionTitle
        eyebrow="AI points"
        title="Your balance"
      />

      {/* ── Balance hero ─────────────────────────────────────────────── */}
      <section className="px-4">
        <SellerCard className="relative overflow-hidden p-5">
        <div
          aria-hidden
          className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-amber-500/15 blur-3xl"
        />
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">
              Available
            </p>
            {isLoading ? (
              <p className="vn-display mt-2 text-3xl text-white animate-pulse">—</p>
            ) : (
              <p className="vn-display mt-2 text-4xl text-white">
                {points.toLocaleString()}
                <span className="ml-2 text-sm font-semibold uppercase tracking-widest text-amber-500">
                  pts
                </span>
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-white/60">
              Points power every AI generation — video, captions, descriptions and boosts.
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-red-500 text-white shadow-lg shadow-red-500/25">
            <Coins className="h-5 w-5" />
          </span>
        </div>

        {/* Top-up is the section's "where to pay" — same packages as the web. */}
        <div className="relative mt-5 flex flex-wrap gap-2.5">
          <BuyPointsButton label="Top up points" className="h-11 px-5 text-xs font-bold uppercase tracking-widest" />
          <Link
            href="/app/seller/ai-studio"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Spend in AI Studio
          </Link>
        </div>
        </SellerCard>
      </section>

      {/* ── Earn · Spend · Track ─────────────────────────────────────── */}
      <div className="grid gap-3 px-4 sm:grid-cols-2">
        <SellerCard className="p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-emerald-400">
            <TrendingUp className="h-4 w-4" />
          </span>
          <h3 className="mt-3 text-sm font-bold text-white">Where points go</h3>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Each tool shows its cost before you run it — from{' '}
            <span className="text-white">25 points</span> for a caption up to{' '}
            <span className="text-white">250 points</span> for a video. Nothing is charged
            without a price you can see first.
          </p>
          <Link
            href="/app/seller/ai-studio"
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-500 hover:text-amber-400"
          >
            Open AI Studio →
          </Link>
        </SellerCard>

        <SellerCard className="p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-amber-400">
            <Gift className="h-4 w-4" />
          </span>
          <h3 className="mt-3 text-sm font-bold text-white">Earn for free</h3>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Invite other sellers and complete referral milestones — bonuses land as points
            straight in this balance, no purchase needed.
          </p>
          <Link
            href="/app/seller/rewards"
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-500 hover:text-amber-400"
          >
            Invite &amp; earn →
          </Link>
        </SellerCard>
      </div>
    </div>
  );
}
