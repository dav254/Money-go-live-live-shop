
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
  FileText,
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/dashboard/date-picker';
import { Button } from '@/components/ui/button';

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

export default function AdminFinanceAnalyticsPage() {
  const firestore = useFirestore();
  const [date, setDate] = React.useState<Date | undefined>();

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'orders'), orderBy('orderDate', 'desc'));
  }, [firestore]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  const filteredOrders = React.useMemo(() => {
    if (!orders) return [];
    if (!date) return orders;

    // Filter orders to match the selected date (day, month, year)
    return orders.filter(order => {
      if (!order.orderDate) return false;
      const orderDate = (order.orderDate as Timestamp).toDate();
      return (
        orderDate.getDate() === date.getDate() &&
        orderDate.getMonth() === date.getMonth() &&
        orderDate.getFullYear() === date.getFullYear()
      );
    });
  }, [orders, date]);


  const revenueStats = React.useMemo(() => {
    if (!filteredOrders) {
      return { grossValue: 0, platformCommission: 0, netToSellers: 0, taxCollected: 0 };
    }
    const completedOrders = filteredOrders.filter(o => o.orderStatus === 'delivered' || o.orderStatus === 'shipped' || o.orderStatus === 'processing');
    const grossValue = completedOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const platformCommission = completedOrders.reduce((acc, o) => acc + (o.platformFee || 0), 0);
    const taxCollected = completedOrders.reduce((acc, o) => acc + ((o.productPrice || 0) * 0.16), 0);
    const netToSellers = grossValue - platformCommission - taxCollected;
    return { grossValue, platformCommission, netToSellers, taxCollected };
  }, [filteredOrders]);

  const recentTransactions = React.useMemo(() => {
     if (!filteredOrders) return [];
    return filteredOrders.filter(o => o.orderStatus === 'delivered').slice(0, 10);
  }, [filteredOrders]);

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Financial Analytics
          </h1>
           <div className="flex items-center gap-2">
            <DatePicker date={date} setDate={setDate} />
            {date && <Button variant="ghost" onClick={() => setDate(undefined)}>Clear</Button>}
           </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Gross Transaction Value"
            value={`$${revenueStats.grossValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}`}
            icon={TrendingUp}
            description={date ? `For ${date.toLocaleDateString()}`: "Total value of all completed sales."}
            isLoading={isLoading}
          />
          <StatCard
            title="Platform Revenue"
            value={`$${revenueStats.platformCommission.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}`}
            icon={DollarSign}
            description="Total fees earned by the platform."
            isLoading={isLoading}
          />
           <StatCard
            title="Net to Sellers & Resellers"
            value={`$${revenueStats.netToSellers.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}`}
            icon={Landmark}
            description="Total amount due after platform fees."
            isLoading={isLoading}
          />
           <StatCard
            title="Total Tax Collected"
            value={`$${revenueStats.taxCollected.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}`}
            icon={FileText}
            description="VAT collected for remittance."
            isLoading={isLoading}
          />
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Detailed Revenue Breakdown</CardTitle>
                <CardDescription>
                  {date ? `Transactions for ${date.toLocaleDateString()}` : 'A list of recent transactions showing revenue splits.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Gross Amount</TableHead>
                            <TableHead className="text-right">Platform Fee</TableHead>
                            <TableHead className="text-right">Net for Seller</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                             Array.from({length: 5}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : recentTransactions.length > 0 ? (
                             recentTransactions.map(order => {
                                 const platformFee = order.platformFee || 0;
                                 const resellerCommission = order.resellerCommission || 0;
                                 const netAmount = order.totalAmount - platformFee - resellerCommission;
                                 return (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-mono text-xs text-muted-foreground">#{order.id}</TableCell>
                                        <TableCell>{order.productName}</TableCell>
                                        <TableCell className="text-right font-semibold">${(order.totalAmount ?? order.productPrice ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                        <TableCell className="text-right text-red-500">-${platformFee.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                        <TableCell className="text-right font-semibold text-green-500">${netAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                    </TableRow>
                                 )
                             })
                        ) : (
                           <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
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
