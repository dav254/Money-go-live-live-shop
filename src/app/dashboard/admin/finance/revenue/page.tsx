
'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
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
import {
  DollarSign,
  TrendingUp,
  Landmark,
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker } from '@/components/dashboard/date-range-picker';

const StatCard = ({
  title,
  value,
  icon: Icon,
  description,
  isLoading,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  description: string;
  isLoading: boolean;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="mt-1 h-3 w-full" />
        </>
      ) : (
        <>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </>
      )}
    </CardContent>
  </Card>
);

export default function AdminRevenuePage() {
  const firestore = useFirestore();
  const PLATFORM_COMMISSION_RATE = 0.10; // 10%

  // Simplified query to fetch all orders, sorted by date.
  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'orders'), orderBy('orderDate', 'desc'));
  }, [firestore]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  const revenueStats = React.useMemo(() => {
    if (!orders) {
      return { grossValue: 0, platformCommission: 0, netToSellers: 0 };
    }
    // Filter for completed orders on the client side
    const completedOrders = orders.filter(o => o.orderStatus === 'delivered');
    const grossValue = completedOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const platformCommission = grossValue * PLATFORM_COMMISSION_RATE;
    const netToSellers = grossValue - platformCommission;
    return { grossValue, platformCommission, netToSellers };
  }, [orders]);

  const recentTransactions = React.useMemo(() => {
     if (!orders) return [];
     // Also filter for completed orders here for the recent transactions list
    return orders.filter(o => o.orderStatus === 'delivered').slice(0, 10);
  }, [orders]);

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Platform Revenue
          </h1>
           <DateRangePicker />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Gross Transaction Value"
            value={`$${revenueStats.grossValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}`}
            icon={TrendingUp}
            description="Total value of all completed sales."
            isLoading={isLoading}
          />
          <StatCard
            title="Platform Commission (10%)"
            value={`$${revenueStats.platformCommission.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}`}
            icon={DollarSign}
            description="Total fees earned by the platform."
            isLoading={isLoading}
          />
           <StatCard
            title="Net Payout to Sellers"
            value={`$${revenueStats.netToSellers.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}`}
            icon={Landmark}
            description="Total amount due to sellers after fees."
            isLoading={isLoading}
          />
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Detailed Revenue Breakdown</CardTitle>
                <CardDescription>A list of recent transactions showing revenue splits.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Gross Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                             Array.from({length: 5}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-4 w-16" /></TableCell>
                                </TableRow>
                            ))
                        ) : recentTransactions.length > 0 ? (
                             recentTransactions.map(order => {
                                 return (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-mono text-xs text-muted-foreground">#{order.id}</TableCell>
                                        <TableCell>{order.productName}</TableCell>
                                        <TableCell className="text-right font-semibold">${order.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                    </TableRow>
                                 )
                             })
                        ) : (
                           <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                    No revenue data from completed orders yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
