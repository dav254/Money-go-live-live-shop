
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
import { Link as LinkIcon, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { TopPerformingProducts } from '@/components/reseller/top-performing-products';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Order, UserProfile } from '@/lib/types';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { addDays, format } from 'date-fns';

const chartConfig = {
  earnings: {
    label: 'Earnings',
    color: 'hsl(var(--primary))',
  },
};


export default function ResellerDashboardPage({ user, userProfile, isLoading: layoutIsLoading }: { user: any, userProfile: UserProfile, isLoading: boolean }) {
    const firestore = useFirestore();

    const ordersQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'orders'), where('resellerId', '==', user.uid));
    }, [user, firestore]);
    
    const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);

    const isLoading = layoutIsLoading || areOrdersLoading;
    
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

        <div className="grid grid-cols-1 gap-8">
            <div>
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
  );
}
