'use client';

import React, { useMemo } from 'react';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link as LinkIcon, TrendingUp, Trophy, Share2, BadgeCent, Wallet, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { TopPerformingProducts } from '@/components/reseller/top-performing-products';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Order, UserProfile } from '@/lib/types';
import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { addDays, format } from 'date-fns';
import { cn } from '@/lib/utils';

const chartConfig = {
  earnings: {
    label: 'Earnings',
    color: 'hsl(var(--primary))',
  },
};

const StatCard = ({ title, value, icon: Icon, isLoading, isPrimary, children }: { title: string, value: string | number, icon: React.ElementType, isLoading: boolean, isPrimary?: boolean, children?: React.ReactNode }) => (
    <Card className={cn(isPrimary ? 'bg-primary/10 border-primary flex flex-col' : 'flex flex-col')}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <Skeleton className="h-8 w-3/4" />
        ) : (
            <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
       {children && <CardFooter className="mt-auto">{children}</CardFooter>}
    </Card>
);

export default function ResellerDashboardPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const firestore = useFirestore();

    const ordersQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'orders'), where('resellerId', '==', user.uid));
    }, [user, firestore]);
    
    const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);

    const referredUsersQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'userProfiles'), where('referredBy', '==', user.uid));
    }, [user, firestore]);
    
    const { data: referredUsers, isLoading: areReferredUsersLoading } = useCollection<UserProfile>(referredUsersQuery);

    const isLoading = isUserLoading || areOrdersLoading || isProfileLoading || areReferredUsersLoading;
    
    const totalReferralPoints = (referredUsers?.length || 0) * 5;
    
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

  return (
    <ResellerLayout>
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div>
                <h1 className="font-headline text-3xl font-bold tracking-tight uppercase">
                    Reseller Hub
                </h1>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Growth & Performance</p>
            </div>
            <div className="flex items-center space-x-2">
                 <StatCard 
                    title="Referral Points"
                    value={`${totalReferralPoints.toLocaleString()} PTS`}
                    icon={BadgeCent}
                    isLoading={isLoading}
                    isPrimary
                >
                     <Button size="sm" variant="outline" className="w-full font-black uppercase text-[10px]" asChild>
                        <Link href="/dashboard/reseller/wallet">
                            <Wallet className="mr-2 h-3 w-3" /> Withdraw
                        </Link>
                    </Button>
                </StatCard>
                <Button asChild className="h-12 px-6 font-black uppercase tracking-widest text-xs">
                    <Link href="/dashboard/reseller/products">
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        Find Products
                    </Link>
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="bg-card/50 border-white/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-headline text-lg uppercase tracking-tight">
                        <TrendingUp className="text-primary" />
                        Performance Trend
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Commission earnings (Last 7 Days)</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                        {isLoading ? (
                        <Skeleton className="h-full w-full rounded-xl" />
                        ) : (
                        <ChartContainer config={chartConfig} className="w-full h-full">
                            <BarChart accessibilityLayer data={chartData}>
                                <XAxis
                                    dataKey="date"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    fontSize={10}
                                />
                                    <YAxis
                                    stroke="#888888"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `\$${value}`}
                                />
                                    <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent indicator="dot" />}
                                />
                                <Bar dataKey="earnings" fill="var(--color-earnings)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ChartContainer>
                        )}
                </CardContent>
            </Card>

            <Card className="bg-card/50 border-white/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-headline text-lg uppercase tracking-tight">
                        <Trophy className="text-primary" />
                        Top Earners
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Highest commission products</CardDescription>
                </CardHeader>
                <CardContent>
                    <TopPerformingProducts />
                </CardContent>
            </Card>
        </div>
      </div>
    </ResellerLayout>
  );
}
