
'use client';

import React, { useMemo } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import {
    DollarSign,
    Users,
    ShoppingBag,
    Video,
    CircleDollarSign,
    Clock,
    Package,
    ShieldAlert,
    ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import type { Order, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';


// --- Static Placeholder Data ---
const mockRecentSales = [
    { id: 'ORD-001', productName: 'Classic Handbag', buyerName: 'Alice', buyerAvatar: 'A', amount: 850 },
    { id: 'ORD-002', productName: 'NextGen Smartphone', buyerName: 'Bob', buyerAvatar: 'B', amount: 1200 },
    { id: 'ORD-003', productName: 'Gourmet Pasta Kit', buyerName: 'Charlie', buyerAvatar: 'C', amount: 45 },
];

const chartData = [
  { date: "Jan 23", revenue: Math.floor(Math.random() * 900) + 100 },
  { date: "Jan 24", revenue: Math.floor(Math.random() * 900) + 100 },
  { date: "Jan 25", revenue: Math.floor(Math.random() * 900) + 100 },
  { date: "Jan 26", revenue: Math.floor(Math.random() * 900) + 100 },
  { date: "Jan 27", revenue: Math.floor(Math.random() * 900) + 100 },
  { date: "Jan 28", revenue: Math.floor(Math.random() * 900) + 100 },
  { date: "Jan 29", revenue: Math.floor(Math.random() * 900) + 100 },
]

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--primary))",
  },
}


// --- Component Definitions ---

const StatCard = ({ title, value, icon: Icon, color, isLoading }: { title: string, value: string, icon: React.ElementType, color?: string, isLoading: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className={cn('h-4 w-4 text-muted-foreground', color)} />
        </CardHeader>
        <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{value}</div>}
        </CardContent>
    </Card>
);

export default function AdminDashboardPage() {
  const firestore = useFirestore();

  const buyersQuery = useMemoFirebase(() => query(collection(firestore, 'userProfiles'), where('userRole', '==', 'buyer')), [firestore]);
  const sellersQuery = useMemoFirebase(() => query(collection(firestore, 'userProfiles'), where('userRole', '==', 'seller')), [firestore]);
  const resellersQuery = useMemoFirebase(() => query(collection(firestore, 'userProfiles'), where('userRole', '==', 'reseller')), [firestore]);
  const productsQuery = useMemoFirebase(() => query(collection(firestore, 'products')), [firestore]);

  const { data: buyers, isLoading: isLoadingBuyers } = useCollection(buyersQuery);
  const { data: sellers, isLoading: isLoadingSellers } = useCollection(sellersQuery);
  const { data: resellers, isLoading: isLoadingResellers } = useCollection(resellersQuery);
  const { data: products, isLoading: isLoadingProducts } = useCollection(productsQuery);
  
  const isLoading = isLoadingBuyers || isLoadingSellers || isLoadingResellers || isLoadingProducts;

  const stats = [
    { title: 'Total Buyers', value: (buyers?.length || 0).toLocaleString(), icon: Users, isLoading },
    { title: 'Total Sellers', value: (sellers?.length || 0).toLocaleString(), icon: Users, isLoading },
    { title: 'Total Resellers', value: (resellers?.length || 0).toLocaleString(), icon: Users, isLoading },
    { title: 'Total Products', value: (products?.length || 0).toLocaleString(), icon: ShoppingBag, isLoading },
    { title: 'Live Users Online', value: '1,890', icon: Video, color: 'text-red-500', isLoading: false }, // Placeholder
    { title: 'Today\'s Revenue', value: '$1,420', icon: DollarSign, color: 'text-green-500', isLoading: false }, // Placeholder
    { title: 'Commission Paid', value: '$22,500', icon: CircleDollarSign, color: 'text-green-500', isLoading: false }, // Placeholder
    { title: 'Pending Payouts', value: '$4,200', icon: Clock, color: 'text-yellow-500', isLoading: false }, // Placeholder
    { title: 'Daily Orders', value: '89', icon: Package, isLoading: false }, // Placeholder
    { title: 'Flagged Issues', value: '12', icon: ShieldAlert, color: 'text-red-500', isLoading: false }, // Placeholder
  ];

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Admin Dashboard
        </h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {stats.map(stat => (
                <StatCard key={stat.title} {...stat} />
            ))}
        </div>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>Recent Sales</CardTitle>
                    <CardDescription>New orders that have been paid and are ready for processing.</CardDescription>
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
                         {mockRecentSales.map(order => (
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
                               <TableCell className="text-right">${order.amount.toLocaleString()}</TableCell>
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
                   <ChartContainer config={chartConfig} className="w-full h-full">
                      <BarChart accessibilityLayer data={chartData}>
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tickFormatter={(value) => value.slice(0, 3)}
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
                        <Bar
                          dataKey="revenue"
                          fill="var(--color-revenue)"
                          radius={4}
                        />
                      </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
