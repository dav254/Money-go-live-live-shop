
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
import { TopSharedProductsTable } from '@/components/reseller/top-shared-products-table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

const chartConfig = {
  earnings: {
    label: 'Earnings',
    color: 'hsl(var(--primary))',
  },
};

const mockTopResellers = [
    { id: 'reseller-1', name: 'John Doe', avatar: 'https://picsum.photos/seed/john/40', sales: 152, commission: 450.75 },
    { id: 'reseller-2', name: 'Jane Smith', avatar: 'https://picsum.photos/seed/jane/40', sales: 121, commission: 380.50 },
    { id: 'reseller-3', name: 'Mike Williams', avatar: 'https://picsum.photos/seed/mike/40', sales: 98, commission: 290.00 },
    { id: 'reseller-4', name: 'Sarah B.', avatar: 'https://picsum.photos/seed/sarah/40', sales: 85, commission: 250.00 },
    { id: 'reseller-5', name: 'Chris G.', avatar: 'https://picsum.photos/seed/chris/40', sales: 72, commission: 210.20 },
];


const TopResellersTable = () => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Reseller</TableHead>
                    <TableHead className="text-center">Sales Made</TableHead>
                    <TableHead className="text-right">Commission Earned (USD)</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                 {mockTopResellers.length > 0 ? (
                    mockTopResellers.map((reseller, index) => (
                        <TableRow key={reseller.id}>
                            <TableCell className="font-bold text-lg">{index + 1}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={reseller.avatar} />
                                        <AvatarFallback>{reseller.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{reseller.name}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-center font-medium">{reseller.sales}</TableCell>
                            <TableCell className="text-right font-semibold text-primary">${reseller.commission.toFixed(2)}</TableCell>
                        </TableRow>
                    ))
                 ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                            No sales from resellers yet. Be the first!
                        </TableCell>
                    </TableRow>
                 )}
            </TableBody>
        </Table>
    );
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

         <Tabs defaultValue="analytics">
            <TabsList>
                <TabsTrigger value="analytics">My Performance</TabsTrigger>
                <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            </TabsList>
            <TabsContent value="analytics" className="space-y-8 mt-6">
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
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Share2 /> Top Shared Products</CardTitle>
                        <CardDescription>Your products being shared most frequently by the reseller network.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TopSharedProductsTable />
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="leaderboard" className="mt-6">
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy />
                            Top Resellers
                        </CardTitle>
                        <CardDescription>See how you rank against other resellers on the platform.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TopResellersTable />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
        
      </div>
    </ResellerLayout>
  );
}

export default function ResellerDashboardPage() {
    return <ResellerDashboardPageContent />
}
