
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
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/dashboard/date-picker';
import Image from 'next/image';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import type { Order, Product, SellerShop } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChartConfig } from '@/components/ui/chart';

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
    // These stats are not filtered by date
    const totalProducts = products.length;
    const followers = shop?.followers || 0;

    return { totalRevenue, totalSales, totalProducts, followers };
  }, [filteredOrders, products, shop]);

  const chartData = React.useMemo(() => {
    if (!orders) return [];
    const salesByDay: { [key: string]: number } = {};
    const daysToDisplay = selectedDate ? 1 : 7;
    const baseDate = selectedDate || new Date();

    // Initialize last 7 days (or 1 if selected) with 0 revenue
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
  }, [orders, selectedDate]);
  
  const topProducts = React.useMemo(() => {
    if (!products) return [];
    return [...products]
        .sort((a,b) => (b.viewCount || 0) - (a.viewCount || 0))
        .slice(0, 5);
    }, [products]);


  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            My Analytics
          </h1>
          <div className="flex items-center gap-2">
            <DatePicker date={selectedDate} setDate={setSelectedDate} />
            {selectedDate && <Button variant="ghost" onClick={() => setSelectedDate(undefined)}>View All Time</Button>}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={selectedDate ? "Revenue for Date" : "Total Revenue"}
            value={`$${stats.totalRevenue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}`}
            icon={DollarSign}
            description={selectedDate ? `For ${selectedDate.toLocaleDateString()}` : "Lifetime revenue from all sales."}
            isLoading={isLoading}
          />
          <StatCard
            title={selectedDate ? "Sales for Date" : "Total Sales"}
            value={stats.totalSales.toLocaleString()}
            icon={ShoppingBag}
            description={selectedDate ? `On ${selectedDate.toLocaleDateString()}` : "Total number of orders processed."}
            isLoading={isLoading}
          />
          <StatCard
            title="Total Products"
            value={stats.totalProducts.toLocaleString()}
            icon={Package}
            description="Number of products in your shop."
            isLoading={isLoading}
          />
           <StatCard
            title="Followers"
            value={stats.followers.toLocaleString()}
            icon={Users}
            description="Total number of shop followers."
            isLoading={isLoading}
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            <Card className="lg:col-span-4">
                <CardHeader>
                    <CardTitle>Sales Overview</CardTitle>
                     <CardDescription>
                        {selectedDate ? `Revenue for ${selectedDate.toLocaleDateString()}` : 'Revenue from the last 7 days.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                    <SalesChart chartData={chartData} chartConfig={chartConfig} />
                </CardContent>
            </Card>
            <Card className="lg:col-span-3">
                <CardHeader>
                    <CardTitle>Top Performing Products</CardTitle>
                    <CardDescription>Your most viewed products.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({length: 4}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : topProducts.length > 0 ? (
                                topProducts.map(product => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <Image src={product.imageUrl || 'https://picsum.photos/seed/product/40'} alt={product.name || 'product image'} width={40} height={40} className="rounded-md" />
                                        <span>{product.name}</span>
                                    </TableCell>
                                    <TableCell className="text-right">${product.price.toLocaleString()}</TableCell>
                                </TableRow>
                            ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                                        No product data available.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </div>
    </SellerLayout>
  );
}
