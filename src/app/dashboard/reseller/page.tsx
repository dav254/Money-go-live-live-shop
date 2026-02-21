'use client';

import React, { useMemo, useState, useEffect } from 'react';
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
import { Link as LinkIcon, TrendingUp, Trophy, Share2, BadgeCent, Loader2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { TopPerformingProducts } from '@/components/reseller/top-performing-products';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import type { Order, UserProfile, Product } from '@/lib/types';
import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { addDays, format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

const chartConfig = {
  earnings: {
    label: 'Earnings',
    color: 'hsl(var(--primary))',
  },
};

const StatCard = ({ title, value, icon: Icon, isLoading, isPrimary, children }: { title: string, value: string | number, icon: React.ElementType, isLoading: boolean, isPrimary?: boolean, children?: React.ReactNode }) => (
    <Card className={isPrimary ? 'bg-primary/10 border-primary flex flex-col' : 'flex flex-col'}>
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

function ResellerDashboardPageContent() {
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
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Reseller Dashboard
                </h1>
            </div>
            <div className="flex items-center space-x-2">
                 <StatCard 
                    title="Total Referral Earnings"
                    value={`${totalReferralPoints.toLocaleString()} Points`}
                    icon={BadgeCent}
                    isLoading={isLoading}
                    isPrimary
                >
                     <Button size="sm" variant="outline" className="w-full" asChild>
                        <Link href="/dashboard/reseller/wallet">
                            <Wallet className="mr-2 h-4 w-4" /> Withdraw
                        </Link>
                    </Button>
                </StatCard>
                <Button asChild>
                    <Link href="/dashboard/reseller/products">
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Share New Product
                    </Link>
                </Button>
            </div>
        </div>

        <div className="space-y-8 mt-6">
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
                                    tickFormatter={(value) => `\$${value}`}
                                />
                                    <RechartsTooltip
                                    cursor={{ fill: 'hsla(var(--muted))' }}
                                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                                />
                                <Bar dataKey="earnings" fill="var(--color-earnings)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ChartContainer>
                        )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><TrendingUp /> Top Performing Products</CardTitle>
                    <CardDescription>These are the products generating the most commission for you.</CardDescription>
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

export default function ResellerDashboardPage() {
    return <ResellerDashboardPageContent />
}
