

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
  ShoppingBag,
  CreditCard,
  BarChart,
  XCircle,
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart as RechartsBarChart, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/dashboard/date-range-picker';
import { Button } from '@/components/ui/button';

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
};

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

export default function AdminRevenueChartsPage() {
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'orders'), orderBy('orderDate', 'desc'));
  }, [firestore]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  const stats = React.useMemo(() => {
    if (!orders) {
      return { totalRevenue: 0, totalSales: 0, avgOrderValue: 0, cancellations: 0 };
    }
    const completedOrders = orders.filter(o => o.orderStatus === 'delivered' || o.orderStatus === 'shipped' || o.orderStatus === 'processing');
    const totalRevenue = completedOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const totalSales = completedOrders.length;
    const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
    const cancellations = orders.filter(o => o.orderStatus === 'cancelled').length;
    return { totalRevenue, totalSales, avgOrderValue, cancellations };
  }, [orders]);

  const chartData = React.useMemo(() => {
    if (!orders) return [];
    const salesByDay: { [key: string]: number } = {};
    const completedOrders = orders.filter(o => o.orderStatus === 'delivered' || o.orderStatus === 'shipped' || o.orderStatus === 'processing');
    
    // Initialize last 7 days with 0 revenue
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = d.toLocaleDateString();
        salesByDay[dateString] = 0;
    }

    completedOrders.forEach((order) => {
      if (order.orderDate) {
          const date = order.orderDate.toDate().toLocaleDateString();
           if (salesByDay.hasOwnProperty(date)) {
              salesByDay[date] += order.totalAmount;
           }
      }
    });
    return Object.entries(salesByDay)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [orders]);
  
  const recentOrders = React.useMemo(() => orders?.slice(0, 5) || [], [orders]);


  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Sales Analytics
          </h1>
          <DateRangePicker />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Revenue"
            value={`$${stats.totalRevenue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}`}
            icon={DollarSign}
            description="From all non-cancelled sales."
            isLoading={isLoading}
          />
          <StatCard
            title="Total Sales"
            value={stats.totalSales.toLocaleString()}
            icon={ShoppingBag}
            description="Total number of orders processed."
            isLoading={isLoading}
          />
          <StatCard
            title="Average Order Value"
            value={`$${stats.avgOrderValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}`}
            icon={CreditCard}
            description="The average amount spent per order."
            isLoading={isLoading}
          />
           <StatCard
            title="Cancellations"
            value={stats.cancellations.toString()}
            icon={XCircle}
            description="Number of cancelled orders."
            isLoading={isLoading}
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            <Card className="lg:col-span-4">
                <CardHeader>
                    <CardTitle>Sales Overview</CardTitle>
                     <CardDescription>
                        Revenue from the last 7 days of sales activity.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                    {isLoading ? <Skeleton className="h-80 w-full" /> : (
                        <ChartContainer config={chartConfig} className="h-80 w-full">
                            <RechartsBarChart data={chartData}>
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}/>
                                <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `$${value}`} />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                            </RechartsBarChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>
            <Card className="lg:col-span-3">
                <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
                    <CardDescription>
                        A list of the most recent orders.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : recentOrders.map(order => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-medium">{order.productName}</TableCell>
                                    <TableCell><Badge variant="outline">{order.orderStatus}</Badge></TableCell>
                                    <TableCell className="text-right">${order.totalAmount.toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
