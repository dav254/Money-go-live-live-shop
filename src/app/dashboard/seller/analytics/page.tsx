'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
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
import {
  DollarSign,
  ShoppingBag,
  Users,
  Package,
  Share2,
  BadgePercent,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/dashboard/date-picker';
import Image from 'next/image';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import type { Order, Product, SellerShop } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChartConfig } from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const SalesChart = dynamic(() =>
  import('@/components/seller/sales-chart').then((mod) => mod.SalesChart),
  { ssr: false, loading: () => <Skeleton className="h-80 w-full" /> }
);

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
} as ChartConfig;

const StatCard = ({
  title,
  value,
  icon: Icon,
  description,
  isLoading,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  description: string;
  isLoading?: boolean;
  trend?: string;
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
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">{description}</p>
            {trend && <span className="text-[10px] font-bold text-green-500">{trend}</span>}
          </div>
        </>
      )}
    </CardContent>
  </Card>
);

export default function SellerAnalyticsPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();

  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const ordersQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'orders'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  
  const shopQuery = useMemoFirebase(() => {
    if(!user) return null;
    return doc(firestore, 'sellerShops', user.uid);
  }, [firestore, user]);

  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
  const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);
  const { data: shop, isLoading: isShopLoading } = useDoc<SellerShop>(shopQuery);

  const isLoading = isUserLoading || areProductsLoading || areOrdersLoading || isShopLoading;

  const filteredOrders = React.useMemo(() => {
    if (!orders) return [];
    if (!selectedDate) return orders;
    return orders.filter(order => {
        const orderDate = order.orderDate.toDate();
        return orderDate.getFullYear() === selectedDate.getFullYear() &&
               orderDate.getMonth() === selectedDate.getMonth() &&
               orderDate.getDate() === selectedDate.getDate();
    });
  }, [orders, selectedDate]);

  const stats = React.useMemo(() => {
    if (!products || !shop) {
      return { totalRevenue: 0, totalSales: 0, totalProducts: 0, followers: 0 };
    }
    const relevantOrders = filteredOrders || [];
    const totalRevenue = relevantOrders
        .filter(o => o.orderStatus === 'delivered' || o.orderStatus === 'shipped')
        .reduce((acc, o) => acc + o.totalAmount, 0);
    const totalSales = relevantOrders.length;
    const totalProducts = products.length;
    const followers = shop?.followers || 0;
    return { totalRevenue, totalSales, totalProducts, followers };
  }, [filteredOrders, products, shop]);

  const chartData = React.useMemo(() => {
    if (!orders) return [];
    const salesByDay: { [key: string]: number } = {};
    const daysToDisplay = 7;
    const baseDate = new Date();
    for (let i = daysToDisplay - 1; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        const dateString = d.toISOString().split('T')[0];
        salesByDay[dateString] = 0;
    }
    orders.forEach((order) => {
      if (order.orderDate) {
          const dateString = order.orderDate.toDate().toISOString().split('T')[0];
           if (salesByDay.hasOwnProperty(dateString)) {
              salesByDay[dateString] += order.totalAmount;
           }
      }
    });
    return Object.entries(salesByDay)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [orders]);
  
  const topProducts = React.useMemo(() => {
    if (!products) return [];
    return [...products]
        .sort((a,b) => (b.viewCount || 0) - (a.viewCount || 0))
        .slice(0, 5);
    }, [products]);

  const mockResellerData = [
    { date: '2026-02-15', revenue: 450 },
    { date: '2026-02-16', revenue: 890 },
    { date: '2026-02-17', revenue: 1200 },
    { date: '2026-02-18', revenue: 750 },
    { date: '2026-02-19', revenue: 2100 },
    { date: '2026-02-20', revenue: 1800 },
    { date: '2026-02-21', revenue: 2450 },
  ];

  const mockTopShared = [
    { name: 'Vintage Leather Jacket', shares: 124, commission: 15, earned: 1860 },
    { name: 'Urban Explorer Sneakers', shares: 98, commission: 20, earned: 1176 },
    { name: 'Classic Leather Handbag', shares: 85, commission: 15, earned: 1275 },
    { name: 'Chronograph Watch', shares: 64, commission: 12, earned: 768 },
    { name: 'Noise-Cancelling Headphones', shares: 42, commission: 10, earned: 420 },
  ];

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight uppercase">
            Store Performance
          </h1>
          <div className="flex items-center gap-2">
            <DatePicker date={selectedDate} setDate={setSelectedDate} />
            {selectedDate && <Button variant="ghost" onClick={() => setSelectedDate(undefined)}>View All Time</Button>}
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="overview" className="px-8 uppercase font-black text-xs tracking-widest">Shop Overview</TabsTrigger>
            <TabsTrigger value="reseller" className="px-8 uppercase font-black text-xs tracking-widest">Reseller Network</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-500">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title={selectedDate ? "Revenue for Date" : "Total Revenue"}
                value={`$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                icon={DollarSign}
                description={selectedDate ? `On ${selectedDate.toLocaleDateString()}` : "Lifetime revenue"}
                isLoading={isLoading}
              />
              <StatCard
                title="Total Sales"
                value={stats.totalSales.toLocaleString()}
                icon={ShoppingBag}
                description="Orders processed"
                isLoading={isLoading}
              />
              <StatCard
                title="Products"
                value={stats.totalProducts.toLocaleString()}
                icon={Package}
                description="Active listings"
                isLoading={isLoading}
              />
              <StatCard
                title="Followers"
                value={stats.followers.toLocaleString()}
                icon={Users}
                description="Shop audience"
                isLoading={isLoading}
              />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
                <Card className="lg:col-span-4 bg-card/50 border-white/5">
                    <CardHeader>
                        <CardTitle>Sales Overview</CardTitle>
                        <CardDescription>Performance trend over time.</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <SalesChart chartData={chartData} chartConfig={chartConfig} />
                    </CardContent>
                </Card>
                <Card className="lg:col-span-3 bg-card/50 border-white/5">
                    <CardHeader>
                        <CardTitle>Top Viewed Products</CardTitle>
                        <CardDescription>Most engaging items in your shop.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/5">
                                    <TableHead>Product</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({length: 4}).map((_, i) => (
                                        <TableRow key={i} className="border-white/5">
                                            <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : topProducts.length > 0 ? (
                                    topProducts.map(product => (
                                    <TableRow key={product.id} className="border-white/5 group hover:bg-white/5 transition-colors">
                                        <TableCell className="font-medium flex items-center gap-2 py-3">
                                            <Image src={product.imageUrl || 'https://picsum.photos/seed/product/40'} alt={product.name || 'product image'} width={40} height={40} className="rounded-lg object-cover border border-white/10" />
                                            <span className="truncate">{product.name}</span>
                                        </TableCell>
                                        <TableCell className="text-right font-black text-primary">${product.price.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">No data.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
          </TabsContent>

          <TabsContent value="reseller" className="space-y-6 animate-in fade-in duration-500">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Reseller Revenue"
                value="$12,450.00"
                icon={Share2}
                description="Total sales via network"
                trend="+12.5%"
              />
              <StatCard
                title="Commissions Paid"
                value="$1,245.00"
                icon={BadgePercent}
                description="Distributed to resellers"
              />
              <StatCard
                title="Active Resellers"
                value="48"
                icon={Users}
                description="Promoting your items"
                trend="+4 today"
              />
              <StatCard
                title="Total Shares"
                value="1,840"
                icon={TrendingUp}
                description="External link clicks"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
                <Card className="lg:col-span-4 bg-card/50 border-white/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            Reseller Activity
                        </CardTitle>
                        <CardDescription>Network sales volume over the last 7 days.</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <SalesChart chartData={mockResellerData} chartConfig={chartConfig} />
                    </CardContent>
                </Card>
                <Card className="lg:col-span-3 bg-card/50 border-white/5">
                    <CardHeader>
                        <CardTitle>Viral Products</CardTitle>
                        <CardDescription>Items most shared by resellers.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/5 text-[10px] uppercase font-black tracking-widest">
                                    <TableHead>Product</TableHead>
                                    <TableHead className="text-right">Shares</TableHead>
                                    <TableHead className="text-right">Profit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mockTopShared.map((item, i) => (
                                    <TableRow key={i} className="border-white/5 group hover:bg-white/5 transition-colors">
                                        <TableCell className="py-3">
                                            <p className="font-bold text-sm truncate">{item.name}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase">{item.commission}% Comm.</p>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="secondary" className="bg-primary/10 text-primary border-none">{item.shares}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-black text-green-500">
                                            ${item.earned.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
