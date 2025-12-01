
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
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import type { Order, Payout, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

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
  const [salesChartData, setSalesChartData] = useState<{ date: string; revenue: number; orders: number }[]>([]);
  const [todaysRevenue, setTodaysRevenue] = useState(0);
  const [dailyOrders, setDailyOrders] = useState(0);
  const [isChartLoading, setIsChartLoading] = useState(true);

  // Queries for dashboard stats
  const buyersQuery = useMemoFirebase(() => query(collection(firestore, 'userProfiles'), where('userRole', '==', 'buyer')), [firestore]);
  const sellersQuery = useMemoFirebase(() => query(collection(firestore, 'userProfiles'), where('userRole', '==', 'seller')), [firestore]);
  const resellersQuery = useMemoFirebase(() => query(collection(firestore, 'userProfiles'), where('userRole', '==', 'reseller')), [firestore]);
  const productsQuery = useMemoFirebase(() => query(collection(firestore, 'products')), [firestore]);
  const completedPayoutsQuery = useMemoFirebase(() => query(collection(firestore, 'payouts'), where('status', '==', 'completed')), [firestore]);

  const { data: buyers, isLoading: isLoadingBuyers } = useCollection(buyersQuery);
  const { data: sellers, isLoading: isLoadingSellers } = useCollection(sellersQuery);
  const { data: resellers, isLoading: isLoadingResellers } = useCollection(resellersQuery);
  const { data: products, isLoading: isLoadingProducts } = useCollection(productsQuery);
  const { data: completedPayouts, isLoading: isLoadingPayouts } = useCollection<Payout>(completedPayoutsQuery);

  const [resellerProfiles, setResellerProfiles] = React.useState<Map<string, UserProfile>>(new Map());

  // Fetch profiles of users who have completed payouts to identify resellers
  React.useEffect(() => {
    if (completedPayouts && completedPayouts.length > 0) {
      const userIds = [...new Set(completedPayouts.map(p => p.sellerId))];
      if (userIds.length > 0) {
        const usersQuery = query(collection(firestore, 'userProfiles'), where('id', 'in', userIds));
        getDocs(usersQuery).then(snapshot => {
          const profiles = new Map<string, UserProfile>();
          snapshot.forEach(doc => profiles.set(doc.id, doc.data() as UserProfile));
          setResellerProfiles(profiles);
        });
      }
    }
  }, [completedPayouts, firestore]);

  const commissionPaid = useMemo(() => {
      if (!completedPayouts || resellerProfiles.size === 0) return 0;
      
      return completedPayouts.reduce((total, payout) => {
          const profile = resellerProfiles.get(payout.sellerId);
          if (profile && profile.userRole === 'reseller') {
              return total + payout.amount;
          }
          return total;
      }, 0);
  }, [completedPayouts, resellerProfiles]);


  const isLoading =
    isLoadingBuyers || isLoadingSellers || isLoadingResellers || isLoadingProducts || isLoadingPayouts;

  useEffect(() => {
    async function fetchSalesData() {
      if (!user) return; // Don't fetch if user is not logged in

      setIsChartLoading(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/sales-analytics', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || 'Failed to fetch sales data');
        }
        const data = await response.json();
        setSalesChartData(data);
        if (data && data.length > 0) {
            const todayData = data[data.length - 1];
            setTodaysRevenue(todayData.revenue);
            setDailyOrders(todayData.orders);
        }

      } catch (error: any) {
        console.error(error.message);
      } finally {
        setIsChartLoading(false);
      }
    }
    fetchSalesData();
  }, [user]);

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
      value: '$4,200',
      icon: Clock,
      isLoading: false,
    },
    {
      title: 'Commission Paid',
      value: `$${commissionPaid.toLocaleString(undefined, { minimumFractionDigits: 2})}`,
      icon: CircleDollarSign,
      isLoading: isLoading,
    },
     {
      title: 'Flagged Issues',
      value: '12',
      icon: ShieldAlert,
      isLoading: false,
      color: 'text-destructive',
    },
    {
      title: 'Total Buyers',
      value: (buyers?.length || 0).toLocaleString(),
      icon: Users,
      isLoading,
    },
    {
      title: 'Total Sellers',
      value: (sellers?.length || 0).toLocaleString(),
      icon: Users,
      isLoading,
    },
    {
      title: 'Total Resellers',
      value: (resellers?.length || 0).toLocaleString(),
      icon: Users,
      isLoading,
    },
    {
      title: 'Total Products',
      value: (products?.length || 0).toLocaleString(),
      icon: ShoppingBag,
      isLoading,
    },
    {
      title: 'Live Users Online',
      value: '1,890',
      icon: Video,
      color: 'text-red-500',
      isLoading: false,
    }, // Placeholder
  ];

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Admin Dashboard
        </h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                      tickFormatter={(value) => value.slice(5)} // Show MM-DD
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
