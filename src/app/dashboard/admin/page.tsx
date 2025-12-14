
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
  ScreenShare,
  Megaphone,
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
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { collection, query, where, orderBy, limit, doc } from 'firebase/firestore';
import type { LiveSession, UserProfile, Product, Order } from '@/lib/types';


// --- Static Placeholder Data ---
const mockSalesChartData = [
    { date: '2025-12-08', revenue: 0, orders: 0 },
    { date: '2025-12-09', revenue: 0, orders: 0 },
    { date: '2025-12-10', revenue: 0, orders: 0 },
    { date: '2025-12-11', revenue: 0, orders: 0 },
    { date: '2025-12-12', revenue: 0, orders: 0 },
    { date: '2025-12-13', revenue: 0, orders: 0 },
    { date: '2025-12-14', revenue: 0, orders: 0 },
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


const RecentSaleRow = ({ order }: { order: Order }) => {
    const firestore = useFirestore();
    const buyerProfileRef = useMemoFirebase(() => {
        if (!firestore || !order.buyerId) return null;
        return doc(firestore, 'userProfiles', order.buyerId);
    }, [firestore, order.buyerId]);
    const { data: buyer, isLoading } = useDoc<UserProfile>(buyerProfileRef);

    if (isLoading) {
        return (
            <TableRow>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                </TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
            </TableRow>
        )
    }

    return (
        <TableRow key={order.id}>
            <TableCell className="font-medium">{order.productName}</TableCell>
            <TableCell>
            <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                    <AvatarImage src={buyer?.profilePictureUrl} />
                    <AvatarFallback>{buyer?.fullName?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium">{buyer?.fullName || 'Unknown Buyer'}</span>
            </div>
            </TableCell>
            <TableCell className="text-right">
            ${order.totalAmount.toLocaleString()}
            </TableCell>
        </TableRow>
    )
}

export default function AdminDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [salesChartData, setSalesChartData] = useState(mockSalesChartData);
  const [pendingPayoutsTotal, setPendingPayoutsTotal] = useState(0);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [isPayoutsLoading, setIsPayoutsLoading] = useState(true);

  // --- Data Fetching Hooks ---
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'userProfiles'));
  }, [firestore]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'products'));
  }, [firestore]);
  const { data: allProducts, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  const liveSessionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
  }, [firestore]);
  const { data: liveSessions, isLoading: areLiveSessionsLoading } = useCollection<LiveSession>(liveSessionsQuery);
  
  const recentOrdersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'orders'), orderBy('orderDate', 'desc'), limit(5));
  }, [firestore]);
  const { data: recentOrders, isLoading: areRecentOrdersLoading } = useCollection<Order>(recentOrdersQuery);
  

  // Fetch Sales Analytics
  useEffect(() => {
    const fetchSalesData = async () => {
      if (!user) return;
      setIsChartLoading(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/sales-analytics', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch sales data');
        }
        const data = await response.json();
        setSalesChartData(data);
      } catch (error) {
        console.error("Error fetching sales data:", error);
        setSalesChartData(mockSalesChartData); // Fallback to mock data on error
      } finally {
        setIsChartLoading(false);
      }
    };
    fetchSalesData();
  }, [user]);

  // Fetch Payout Analytics
  useEffect(() => {
    const fetchPayoutData = async () => {
        if (!user) return;
        setIsPayoutsLoading(true);
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/admin/payout-analytics', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
             if (!response.ok) {
                throw new Error('Failed to fetch payout data');
            }
            const data = await response.json();
            setPendingPayoutsTotal(data.totalPending);
        } catch (error) {
            console.error("Error fetching payout data:", error);
            setPendingPayoutsTotal(0); // Fallback to 0 on error
        } finally {
            setIsPayoutsLoading(false);
        }
    };
    fetchPayoutData();
  }, [user]);


  const todaysStats = useMemo(() => {
    if (!salesChartData || salesChartData.length === 0) {
      return { revenue: 0, orders: 0 };
    }
    const today = new Date().toISOString().split('T')[0];
    const todayData = salesChartData.find(d => d.date === today);
    return {
      revenue: todayData?.revenue || 0,
      orders: todayData?.orders || 0,
    };
  }, [salesChartData]);

  const totalUsers = allUsers?.length || 0;
  const totalProducts = allProducts?.length || 0;


  const stats = [
     {
      title: "Today's Revenue",
      value: `$${todaysStats.revenue.toLocaleString()}`,
      icon: DollarSign,
      isLoading: isChartLoading,
    },
     {
      title: 'Daily Orders',
      value: todaysStats.orders.toLocaleString(),
      icon: Package,
      isLoading: isChartLoading,
    },
    {
      title: 'Pending Payouts',
      value: `$${pendingPayoutsTotal.toLocaleString(undefined, { minimumFractionDigits: 2})}`,
      icon: Clock,
      isLoading: isPayoutsLoading,
    },
    {
      title: 'Live Visitors',
      value: (liveSessions?.length || 0).toLocaleString(),
      icon: Eye,
      isLoading: areLiveSessionsLoading, 
      color: 'text-green-500',
    },
    {
      title: 'Total Users',
      value: totalUsers.toLocaleString(), 
      icon: Users,
      isLoading: areUsersLoading,
    },
    {
      title: 'Total Products',
      value: totalProducts.toLocaleString(), 
      icon: ShoppingBag,
      isLoading: areProductsLoading,
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
                  {areRecentOrdersLoading ? (
                    <>
                      <TableRow><TableCell colSpan={3}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                      <TableRow><TableCell colSpan={3}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                    </>
                  ) : recentOrders?.length > 0 ? (
                    recentOrders.map((order) => (
                      <RecentSaleRow key={order.id} order={order} />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center h-24">No recent sales.</TableCell>
                    </TableRow>
                  )}
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
          
           <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ScreenShare className="text-primary"/>
                    Live Shopping Control Room
                </CardTitle>
                <CardDescription>Monitor and manage all live streams on the platform.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/dashboard/admin/live-shopping/sessions">View Live Sessions</Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/dashboard/admin/live-shopping/flagged">Moderation Queue</Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/dashboard/admin/live-shopping/analytics">View Analytics</Link>
                </Button>
            </CardContent>
           </Card>

           <Card>
            <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                    <Megaphone className="text-primary"/>
                    Marketing & Growth
                </CardTitle>
                <CardDescription>Manage promotional content and send platform-wide announcements.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                 <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/dashboard/admin/marketing/sliders">Manage Homepage</Link>
                </Button>
                 <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/dashboard/admin/marketing/ads">Ads Manager</Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/dashboard/admin/marketing/notifications">Send Notifications</Link>
                </Button>
            </CardContent>
           </Card>

        </div>
      </div>
    </AdminLayout>
  );
}
