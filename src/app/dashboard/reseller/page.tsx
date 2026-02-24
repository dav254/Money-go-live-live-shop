'use client';

import React from 'react';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBag, ArrowRight, Share2, Users, Wallet, TrendingUp, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useUser, useUserProfile } from '@/firebase';

export default function ResellerDashboardPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

    const isLoading = isUserLoading || isProfileLoading;

  return (
    <ResellerLayout>
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div>
                <h1 className="font-headline text-3xl font-bold tracking-tight uppercase text-white">
                    Reseller Hub
                </h1>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Earn through sharing & referrals</p>
            </div>
            <div className="flex items-center space-x-2">
                <Button asChild className="h-12 px-6 font-black uppercase tracking-widest text-xs">
                    <Link href="/dashboard/reseller/products">
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        Browse Catalog
                    </Link>
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-white">
            <Card className="bg-neutral-900 border-white/5 hover:border-primary/20 transition-colors">
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                        <Share2 className="h-4 w-4 text-primary" /> Share & Earn
                    </CardTitle>
                    <CardDescription className="text-neutral-500">Pick high-commission products and share your unique links.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild variant="outline" className="w-full border-white/10 hover:bg-white/5 text-white">
                        <Link href="/dashboard/reseller/products">
                            Pick Products <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-white/5 hover:border-primary/20 transition-colors">
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" /> Referrals
                    </CardTitle>
                    <CardDescription className="text-neutral-500">Invite new sellers or buyers and earn AI points.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild variant="outline" className="w-full border-white/10 hover:bg-white/5 text-white">
                        <Link href="/dashboard/reseller/referrals">
                            My Network <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            <Card className="bg-primary/10 border-primary/20 hover:bg-primary/20 transition-colors">
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" /> Commission Wallet
                    </CardTitle>
                    <CardDescription className="text-primary/60">Withdraw your earned cash directly to your bank.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white">
                        <Link href="/dashboard/reseller/wallet">
                            View Wallet <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-neutral-900 border-white/5 text-white">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-headline text-lg uppercase tracking-tight">
                        <TrendingUp className="text-primary" />
                        Quick Start Steps
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <h4 className="font-bold text-xs uppercase mb-1 text-primary">1. Find Products</h4>
                            <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-tight">Visit the catalog and look for items with 15% or higher commission.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <h4 className="font-bold text-xs uppercase mb-1 text-primary">2. Share Link</h4>
                            <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-tight">Click 'Share' to copy your unique affiliate link. Post it on WhatsApp or TikTok.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <h4 className="font-bold text-xs uppercase mb-1 text-primary">3. Earn Cash</h4>
                            <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-tight">When a sale is completed, your commission clears in the wallet automatically.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-white/5 text-white">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-headline text-lg uppercase tracking-tight">
                        <Sparkles className="text-yellow-500" />
                        AI Power Tools
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-neutral-400">Use your AI points to boost your sales:</p>
                    <Button asChild variant="secondary" className="w-full justify-start h-12 rounded-xl">
                        <Link href="/dashboard/reseller/ai-tools/caption-generator">
                            <Sparkles className="mr-2 h-4 w-4" /> AI Caption Generator
                        </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full justify-start h-12 rounded-xl border-white/10">
                        <Link href="/dashboard/reseller/toolkit">
                            <ArrowRight className="mr-2 h-4 w-4" /> Explore AI Toolkit
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
      </div>
    </ResellerLayout>
  );
}
