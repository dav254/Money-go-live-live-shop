
'use client';

import React from 'react';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, DollarSign, ExternalLink, LinkIcon, TrendingUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Order, Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const StatCard = ({ title, value, isLoading }: { title: string; value: string; isLoading: boolean }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">{value}</div>}
      </CardContent>
    </Card>
);

const EarningsCard = ({ title, amount, icon: Icon, isPrimary, isLoading }: { title: string, amount: number, icon: React.ElementType, isPrimary?: boolean, isLoading: boolean }) => (
     <Card className={isPrimary ? 'bg-primary/10 border-primary' : ''}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            {isLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">${amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>}
        </CardContent>
    </Card>
);


export default function ResellerDashboardPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();

    const resellerOrdersQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'orders'), where('resellerId', '==', user.uid));
    }, [firestore, user]);

    const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(resellerOrdersQuery);

    const isLoading = isUserLoading || areOrdersLoading;

    const { earnings, stats, topProducts } = React.useMemo(() => {
        if (!orders) return { earnings: { today: 0, month: 0, withdrawable: 0 }, stats: { shared: 0, clicks: 0, conversions: 0 }, topProducts: [] };

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let todayEarnings = 0;
        let monthEarnings = 0;
        let withdrawable = 0;
        const productPerformance: Record<string, { name: string; clicks: number; orders: number; commission: number; imageUrl?: string; }> = {};

        orders.forEach(order => {
            const commission = order.resellerCommission || 0;
            const orderDate = order.orderDate.toDate();

            if (orderDate >= todayStart) {
                todayEarnings += commission;
            }
            if (orderDate >= monthStart) {
                monthEarnings += commission;
            }
            if (order.orderStatus === 'delivered') {
                withdrawable += commission;
            }

            if (!productPerformance[order.productId]) {
                productPerformance[order.productId] = {
                    name: order.productName || 'Unknown Product',
                    clicks: 0, // Click tracking not implemented yet
                    orders: 0,
                    commission: 0,
                    imageUrl: order.productImage,
                };
            }
            productPerformance[order.productId].orders += 1;
            productPerformance[order.productId].commission += commission;
        });
        
        const sortedProducts = Object.values(productPerformance).sort((a, b) => b.commission - a.commission).slice(0, 5);

        return {
            earnings: { today: todayEarnings, month: monthEarnings, withdrawable },
            stats: { shared: 0, clicks: 0, conversions: orders.length }, // Shared/Clicks are placeholders
            topProducts: sortedProducts,
        };
    }, [orders]);


  return (
    <ResellerLayout>
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
                Reseller Dashboard
            </h1>
            <div className="flex items-center space-x-2">
                <Button asChild>
                    <Link href="/dashboard/reseller/products">
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Share New Product
                    </Link>
                </Button>
            </div>
        </div>

        {/* Earnings Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <EarningsCard title="Today's Earnings" amount={earnings.today} icon={DollarSign} isLoading={isLoading} />
          <EarningsCard title="This Month" amount={earnings.month} icon={DollarSign} isLoading={isLoading} />
          <EarningsCard title="Withdrawable" amount={earnings.withdrawable} icon={DollarSign} isPrimary isLoading={isLoading} />
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Products Shared" value={stats.shared.toString()} isLoading={isLoading} />
          <StatCard title="Total Clicks" value={stats.clicks.toString()} isLoading={isLoading} />
          <StatCard title="Conversions" value={stats.conversions.toString()} isLoading={isLoading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                {/* Performance Graphs */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp />
                            Performance Overview
                        </CardTitle>
                        <CardDescription>Clicks vs. Conversions this month.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-72 flex items-center justify-center bg-muted/50 rounded-md">
                        <BarChart3 className="h-16 w-16 text-muted-foreground/50" />
                        <p className="text-muted-foreground ml-4">Earnings & Clicks chart will be here.</p>
                    </CardContent>
                </Card>
            </div>
            <div className="space-y-8">
                 {/* Reseller Toolkit */}
                <Card>
                    <CardHeader>
                        <CardTitle>Reseller Toolkit</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                         <Button variant="outline" className="justify-start">AI Poster & Video Maker</Button>
                        <Button variant="outline" className="justify-start">Link Shortener</Button>
                        <Link href="/dashboard/reseller/products">
                             <Button variant="secondary" className="w-full justify-start"><ExternalLink className="mr-2" /> Find More Products</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>

        {/* Top Performing Products */}
        <Card>
            <CardHeader>
                <CardTitle>Top Performing Products</CardTitle>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Clicks</TableHead>
                        <TableHead>Orders</TableHead>
                        <TableHead className="text-right">Commission Earned</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [...Array(3)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-5 w-24" /></TableCell>
                                </TableRow>
                            ))
                        ) : topProducts.length > 0 ? (
                            topProducts.map((p) => (
                            <TableRow key={p.name}>
                                <TableCell className="font-medium">{p.name}</TableCell>
                                <TableCell>{p.clicks}</TableCell>
                                <TableCell>{p.orders}</TableCell>
                                <TableCell className="text-right font-semibold text-green-500">${p.commission.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                            </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    No sales data found. Share some products to get started!
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        
      </div>
    </ResellerLayout>
  );
}
