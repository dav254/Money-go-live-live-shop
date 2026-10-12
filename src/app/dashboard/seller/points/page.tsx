'use client';

import * as React from 'react';
import Link from 'next/link';
import { Coins, Gift, Sparkles, TrendingUp } from 'lucide-react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { BuyPointsButton } from '@/components/ai/buy-points-dialog';
import { useUser, useUserProfile } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * SELLER WEBSITE · AI POINTS (`/dashboard/seller/points`).
 *
 * The website half of the points section the app carries at
 * `/app/seller/points`. One balance (`userProfiles/{uid}.aiPoints`), one
 * top-up dialog (the shared `BuyPointsDialog`), one set of prices — the two
 * surfaces are different shells over the same ledger, deliberately.
 *
 * Before this page existed the balance was a footnote on the overview and the
 * only way to buy points was to wander into the AI Toolkit. This is the
 * section a seller lands on from the sidebar when they want to know what they
 * own and top it up.
 */
export default function SellerPointsPage() {
  const { user } = useUser();
  const { userProfile, isLoading } = useUserProfile(user?.uid);
  const points = userProfile?.aiPoints ?? 0;

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight">AI Points</h1>
            <p className="text-muted-foreground">
              Your balance for every AI generation — video, captions, descriptions and boosts.
            </p>
          </div>
          <div className="mt-3 md:mt-0">
            <BuyPointsButton label="Buy AI Points" />
          </div>
        </div>

        {/* ── Balance ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              Available balance
            </CardTitle>
            <CardDescription>
              Deducted per generation, shown before every run — nothing is charged without a
              price you can see first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-40" />
            ) : (
              <p className="text-4xl font-bold tracking-tight">
                {points.toLocaleString()}
                <span className="ml-2 text-sm font-semibold uppercase tracking-widest text-primary">
                  pts
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Spend · Earn ────────────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Spend in AI Studio
              </CardTitle>
              <CardDescription>
                From 25 points for a caption up to 250 for a video. Open the studio or the
                toolkit and every tool shows its price beside the button.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Link
                href="/dashboard/seller/ai-studio"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Open AI Studio
              </Link>
              <Link
                href="/dashboard/seller/ai-tools"
                className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
              >
                AI Toolkit
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="h-4 w-4 text-primary" />
                Earn for free
              </CardTitle>
              <CardDescription>
                Referral milestones and welcome bonuses land as points in this balance — no
                purchase needed.{' '}
                <span className="flex items-center gap-1 text-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Track them from your overview.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/dashboard/seller"
                className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
              >
                Back to overview
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </SellerLayout>
  );
}
