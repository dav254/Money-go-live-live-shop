
'use client';

import React, { useMemo } from 'react';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, DollarSign, Link as LinkIcon, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { TopPerformingProducts } from '@/components/reseller/top-performing-products'; 
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { addDays, format } from 'date-fns';


// --- Component Definitions ---

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

const chartConfig = {
  earnings: {
    label: 'Earnings',
    color: 'hsl(var(--primary))',
  },
};


export default function ResellerDashboardPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();

    const ordersQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'orders'), where('resellerId', '==', user.uid));
    }, [user, firestore]);
    
    const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);

    const isLoading = isUserLoading || areOrdersLoading;

    const earnings = useMemo(() => {
        if (!orders) {
            return { today: 0, month: 0, withdrawable: 0 };
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let todayEarnings = 0;
        let monthEarnings = 0;
        let withdrawableBalance = 0;

        orders.forEach(order => {
            const orderDate = order.orderDate.toDate();
            const commission = order.resellerCommission || 0;

            if (orderDate >= todayStart) {
                todayEarnings += commission;
            }
            if (orderDate >= monthStart) {
                monthEarnings += commission;
            }
            if (order.orderStatus === 'delivered') {
                withdrawableBalance += commission;
            }
        });

        // This is a simplified calculation for withdrawable. A real app would subtract completed payouts.
        return { today: todayEarnings, month: monthEarnings, withdrawable: withdrawableBalance };
    }, [orders]);
    
    const chartData = useMemo(() => {
        const data: { date: string; earnings: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const date = addDays(new Date(), -i);
            data.push({ date: format(date, 'MMM d'), earnings: 0 });
        }

        if (orders) {
            orders.forEach(order => {
                const commission = order.resellerCommission || 0;
                if (commission > 0) {
                    const orderDate = format(order.orderDate.toDate(), 'MMM d');
                    const dayData = data.find(d => d.date === orderDate);
                    if (dayData) {
                        dayData.earnings += commission;
                    }
                }
            });
        }
        return data;
    }, [orders]);

    const stats = {
        shared: 0, // Placeholder
        clicks: "N/A", // Not implemented
        conversions: orders?.length || 0,
    };

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
                        <CardDescription>Your commission earnings for the last 7 days.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-72">
                         {isLoading ? (
                            <Skeleton className="h-full w-full" />
                         ) : (
                            <ChartContainer config={chartConfig} className="w-full h-full">
                                <BarChart accessibilityLayer data={chartData}>
                                    <XAxis
                                        dataKey="date"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        fontSize={12}
                                    />
                                     <YAxis
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `$${value}`}
                                    />
                                     <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent indicator="dot" />}
                                    />
                                    <Bar dataKey="earnings" fill="var(--color-earnings)" radius={4} />
                                </BarChart>
                            </ChartContainer>
                         )}
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
                <TopPerformingProducts />
            </CardContent>
        </Card>
        
      </div>
    </ResellerLayout>
  );
}
