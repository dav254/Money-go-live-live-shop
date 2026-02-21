
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
import { TrendingUp, ShoppingBag, ArrowRight } from 'lucide-react';
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
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Manage Your Network</p>
            </div>
            <div className="flex items-center space-x-2">
                <Button asChild className="h-12 px-6 font-black uppercase tracking-widest text-xs">
                    <Link href="/dashboard/reseller/products">
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        Find Products
                    </Link>
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-white">
            <Card className="bg-neutral-900 border-white/5">
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-widest">Share Center</CardTitle>
                    <CardDescription className="text-neutral-500">Get links and start earning.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild variant="outline" className="w-full border-white/10 hover:bg-white/5 text-white">
                        <Link href="/dashboard/reseller/products">
                            Browse Catalog <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-white/5">
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-widest">Rewards</CardTitle>
                    <CardDescription className="text-neutral-500">Check your referral status.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild variant="outline" className="w-full border-white/10 hover:bg-white/5 text-white">
                        <Link href="/dashboard/reseller/referrals">
                            My Referrals <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            <Card className="bg-primary/10 border-primary/20">
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary">Earnings</CardTitle>
                    <CardDescription className="text-primary/60">View your cleared commissions.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white">
                        <Link href="/dashboard/reseller/wallet">
                            Withdraw Funds <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>

        <Card className="bg-neutral-900 border-white/5 text-white">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline text-lg uppercase tracking-tight">
                    <TrendingUp className="text-primary" />
                    Getting Started
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-neutral-400 leading-relaxed">
                    Welcome to your Reseller Dashboard! To start earning, navigate to the **Products to Resell** section, choose a product, and share your unique link.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <h4 className="font-bold text-xs uppercase mb-1 text-primary">Step 1</h4>
                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-tight">Pick a product with a high commission rate.</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <h4 className="font-bold text-xs uppercase mb-1 text-primary">Step 2</h4>
                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-tight">Share your link with your social circles.</p>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>
    </ResellerLayout>
  );
}
