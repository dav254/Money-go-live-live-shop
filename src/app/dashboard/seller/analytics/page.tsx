
'use client';

import * as React from 'react';
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
import { useUser, useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, doc } from 'firebase/firestore';
import type { Order, Product, SellerShop } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart as RechartsBarChart, XAxis, YAxis } from 'recharts';
import { DateRangePicker } from '@/components/dashboard/date-range-picker';
import Image from 'next/image';

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

export default function SellerAnalyticsPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'orders'), where('sellerId', '==', user.uid), orderBy('orderDate', 'desc'));
  }, [firestore, user]);
  
  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const sellerShopRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'sellerShops', user.uid);
  }, [firestore, user]);


  const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);
  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
  const { data: sellerShop, isLoading: isShopLoading } = useDoc<SellerShop>(sellerShopRef);

  const isLoading = isUserLoading || areOrdersLoading || areProductsLoading || isShopLoading;

  const stats = React.useMemo(() => {
    if (!orders || !products) {
      return { totalRevenue: 0, totalSales: 0, totalProducts: 0, followers: 0 };
    }
    const totalRevenue = orders.reduce((acc, o) => acc + o.totalAmount, 0);
    const totalSales = orders.length;
    const totalProducts = products.length;
    const followers = sellerShop?.followers || 0;
    return { totalRevenue, totalSales, totalProducts, followers };
  }, [orders, products, sellerShop]);

  const chartData = React.useMemo(() => {
    if (!orders) return [];
    const salesByDay: { [key: string]: number } = {};
    orders.forEach((order) => {
      const date = order.orderDate.toDate().toLocaleDateString();
      salesByDay[date] = (salesByDay[date] || 0) + order.totalAmount;
    });
    return Object.entries(salesByDay)
      .map(([date, revenue]) => ({ date, revenue }))
      .slice(0, 10)
      .reverse();
  }, [orders]);
  
  const topProducts = React.useMemo(() => products?.slice(0, 5) || [], [products]);


  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            My Analytics
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
            description="Lifetime revenue from all sales."
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
                        Revenue from recent sales activity.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                    {isLoading ? <Skeleton className="h-80 w-full" /> : (
                        <ChartContainer config={chartConfig} className="h-80 w-full">
                            <RechartsBarChart data={chartData}>
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
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
                    <CardTitle>Top Performing Products</CardTitle>
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
                                Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-6 w-12 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : topProducts.map(product => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <Image src={product.imageUrl || ''} alt={product.name} width={40} height={40} className="rounded-md" />
                                        <span>{product.name}</span>
                                    </TableCell>
                                    <TableCell className="text-right">${product.price.toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </div>
    </SellerLayout>
  );
}
