
'use client';

import React, { Suspense, useMemo, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  DollarSign,
  Users,
  ShoppingBag,
  Video,
  CircleDollarSign,
  Clock,
  Package,
  ShieldAlert,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { collection, query, where } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';


// --- Static Placeholder Data ---
const mockRecentSales = [
  {
    id: 'ORD-001',
    productName: 'Classic Handbag',
    buyerName: 'Alice',
    buyerAvatar: 'A',
    amount: 850,
  },
  {
    id: 'ORD-002',
    productName: 'NextGen Smartphone',
    buyerName: 'Bob',
    buyerAvatar: 'B',
    amount: 1200,
  },
  {
    id: 'ORD-003',
    productName: 'Gourmet Pasta Kit',
    buyerName: 'Charlie',
    buyerAvatar: 'C',
    amount: 45,
  },
];

const mockSalesChartData = [
    { date: '2025-12-08', revenue: 150, orders: 5 },
    { date: '2025-12-09', revenue: 220, orders: 8 },
    { date: '2025-12-10', revenue: 180, orders: 6 },
    { date: '2025-12-11', revenue: 300, orders: 12 },
    { date: '2025-12-12', revenue: 250, orders: 10 },
    { date: '2025-12-13', revenue: 450, orders: 15 },
    { date: '2025-12-14', revenue: 560, orders: 20 },
];

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
};

// --- Component Definitions ---

const StatCard = ({
  title,
  value,
  icon: Icon,
  color,
  isLoading,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color?: string;
  isLoading: boolean;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className={cn('h-4 w-4 text-muted-foreground', color)} />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <Skeleton className="h-8 w-1/2" />
      ) : (
        <div className="text-2xl font-bold">{value}</div>
      )}
    </CardContent>
  </Card>
);

export default function AdminDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(true);

  // Use mock data for all sections to keep them frontend-only as requested
  const salesChartData = mockSalesChartData;
  const todaysRevenue = 560;
  const dailyOrders = 20;
  const pendingPayoutsTotal = 2340.50;
  const liveVisitors = 0;
  const totalUsers = 1254;
  const totalProducts = 5678;

  const isChartLoading = false; 

  // Simulate overall loading state
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500); // Reduced delay
    return () => clearTimeout(timer);
  }, []);


  const stats = [
     {
      title: "Today's Revenue",
      value: `$${todaysRevenue.toLocaleString()}`,
      icon: DollarSign,
      isLoading: isChartLoading,
    },
     {
      title: 'Daily Orders',
      value: dailyOrders.toLocaleString(),
      icon: Package,
      isLoading: isChartLoading,
    },
    {
      title: 'Pending Payouts',
      value: `$${pendingPayoutsTotal.toLocaleString(undefined, { minimumFractionDigits: 2})}`,
      icon: Clock,
      isLoading: isLoading,
    },
    {
      title: 'Live Visitors',
      value: liveVisitors.toLocaleString(),
      icon: Eye,
      isLoading: false, 
      color: liveVisitors > 0 ? 'text-green-500' : 'text-muted-foreground',
    },
    {
      title: 'Total Users',
      value: totalUsers.toLocaleString(), 
      icon: Users,
      isLoading,
    },
    {
      title: 'Total Products',
      value: totalProducts.toLocaleString(), 
      icon: ShoppingBag,
      isLoading,
    },
  ];

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Admin Dashboard
        </h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sales</CardTitle>
              <CardDescription>
                New orders that have been paid and are ready for processing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRecentSales.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.productName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback>{order.buyerAvatar}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{order.buyerName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        ${order.amount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="/dashboard/admin/orders/all">
                  View All Orders
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sales Graph</CardTitle>
              <CardDescription>Revenue from the last 7 days.</CardDescription>
            </CardHeader>
            <CardContent className="h-96">
              {isChartLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ChartContainer config={chartConfig} className="w-full h-full">
                  <BarChart accessibilityLayer data={salesChartData}>
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${"$"}{value}`}
                    />
                     <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" />}
                    />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
