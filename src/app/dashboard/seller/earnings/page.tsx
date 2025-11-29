
'use client';

import React from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Banknote,
  CircleDollarSign,
  DollarSign,
  Package,
} from 'lucide-react';
import { DateRangePicker } from '@/components/dashboard/date-range-picker';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import type { Order, Payout } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string, icon: React.ElementType, description?: string }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">${value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
);

const StatCardSkeleton = () => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <Skeleton className="h-4 w-2/4" />
             <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-3 w-full" />
        </CardContent>
    </Card>
)


export default function SellerEarningsPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();

    const ordersQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'orders'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

    const payoutsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'payouts'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

    const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);
    const { data: payouts, isLoading: arePayoutsLoading } = useCollection<Payout>(payoutsQuery);

    const isLoading = isUserLoading || areOrdersLoading || arePayoutsLoading;

    const stats = React.useMemo(() => {
        if (!orders || !payouts) {
            return {
                totalRevenue: 0,
                salesToday: 0,
                platformFees: 0,
                totalPayouts: 0,
            };
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const totalRevenue = orders
            .filter(o => o.orderStatus === 'delivered' || o.orderStatus === 'shipped')
            .reduce((sum, o) => sum + o.totalAmount, 0);

        const salesToday = orders
             .filter(o => o.orderDate && o.orderDate.toDate() >= today)
             .reduce((sum, o) => sum + o.totalAmount, 0);
        
        const platformFees = totalRevenue * 0.10; // Assuming a 10% fee

        const totalPayouts = payouts
            .filter(p => p.status === 'completed')
            .reduce((sum, p) => sum + p.amount, 0);

        return {
            totalRevenue,
            salesToday,
            platformFees,
            totalPayouts,
        };

    }, [orders, payouts]);

    const recentTransactions = React.useMemo(() => {
        if (!orders) return [];
        // Sort by date descending before slicing
        return [...orders]
            .sort((a, b) => b.orderDate.toDate().getTime() - a.orderDate.toDate().getTime())
            .slice(0, 5);
    }, [orders]);


  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Sales &amp; Payouts
          </h1>
          <div className="flex items-center space-x-2">
            <DateRangePicker />
            <Button asChild variant="destructive" className="font-bold">
              <Link href="/dashboard/seller/wallet">
                Go to Wallet <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
            </>
          ) : (
            <>
                <StatCard 
                    title="Total Revenue"
                    value={stats.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    icon={DollarSign}
                    description="From completed sales"
                />
                 <StatCard 
                    title="Total Payouts"
                    value={stats.totalPayouts.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    icon={Banknote}
                    description="Successfully sent to your account"
                />
                 <StatCard 
                    title="Sales Today"
                    value={stats.salesToday.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    icon={Package}
                    description="Live sales from today"
                />
                 <StatCard 
                    title="Platform Fees"
                    value={stats.platformFees.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    icon={CircleDollarSign}
                    description="Total commission paid to Go Earn"
                />
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sales Ledger &amp; Invoice History</CardTitle>
            <CardDescription>A real-time breakdown of every sale you've made.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Platform Fee</TableHead>
                  <TableHead className="text-right">Reseller Fee</TableHead>
                  <TableHead className="text-right">Your Net</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                     [...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        </TableRow>
                    ))
                ) : recentTransactions.length > 0 ? (
                    recentTransactions.map((order) => {
                       const platformFee = order.platformFee || order.totalAmount * 0.10;
                       const resellerCommission = order.resellerCommission || 0;
                       const netEarning = order.totalAmount - platformFee - resellerCommission;

                       return (
                            <TableRow key={order.id}>
                                <TableCell>
                                    <div className="font-medium">{order.productName}</div>
                                    <div className="text-xs text-muted-foreground">#{order.id.substring(0,6)}...</div>
                                </TableCell>
                                <TableCell className="text-right font-semibold">${order.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                <TableCell className="text-right text-red-500">-${platformFee.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                <TableCell className="text-right text-orange-400">-${resellerCommission.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                <TableCell className="text-right font-bold text-green-500">${netEarning.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                <TableCell>
                                <Badge variant={order.orderStatus === 'delivered' ? 'default' : 'secondary'} className={order.orderStatus === 'delivered' ? 'bg-green-600/80' : ''}>
                                    {order.orderStatus}
                                </Badge>
                                </TableCell>
                            </TableRow>
                       );
                    })
                ) : (
                     <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            No transactions yet.
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
}
