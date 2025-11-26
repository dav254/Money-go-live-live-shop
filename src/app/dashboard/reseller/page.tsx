
'use client';

import React from 'react';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, DollarSign, ExternalLink, LinkIcon, TrendingUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Order, Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const earningsData = [
  { title: "Today's Earnings", amount: "1,250", icon: DollarSign },
  { title: "This Week", amount: "8,600", icon: DollarSign },
  { title: "This Month", amount: "22,300", icon: DollarSign },
  { title: "Withdrawable", amount: "15,000", icon: DollarSign, isPrimary: true },
];

const statsData = [
    { title: "Products Shared", value: "312" },
    { title: "Total Clicks", value: "1,845" },
    { title: "Conversions", value: "98" },
    { title: "Avg. Commission", value: "12%" },
]

interface ProductPerformance {
    name: string;
    clicks: number | 'N/A';
    orders: number;
    commission: number;
}


export default function ResellerDashboardPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();

    // Query for orders attributed to this reseller
    const ordersQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'orders'), where('resellerId', '==', user.uid), where('orderStatus', '==', 'delivered'));
    }, [firestore, user]);
    const { data: resellerOrders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);

    // Get a list of unique product IDs from those orders
    const productIds = React.useMemo(() => {
        if (!resellerOrders) return [];
        return [...new Set(resellerOrders.map(order => order.productId))];
    }, [resellerOrders]);
    
    // Query for the details of those specific products
    const productsQuery = useMemoFirebase(() => {
        if (!productIds || productIds.length === 0) return null;
        return query(collection(firestore, 'products'), where('id', 'in', productIds));
    }, [firestore, productIds]);
    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
    
    const isLoading = isUserLoading || areOrdersLoading || areProductsLoading;

    // Calculate top performing products
    const topProducts: ProductPerformance[] = React.useMemo(() => {
        if (!resellerOrders || !products) return [];

        const performanceMap: { [productId: string]: ProductPerformance } = {};

        resellerOrders.forEach(order => {
            const product = products.find(p => p.id === order.productId);
            if (!product) return;

            const commissionRate = product.commissionRate || 10; // Default to 10% if not set
            const commission = order.totalAmount * (commissionRate / 100);

            if (!performanceMap[order.productId]) {
                performanceMap[order.productId] = {
                    name: product.name,
                    clicks: 'N/A', // Click tracking not implemented yet
                    orders: 0,
                    commission: 0,
                };
            }
            performanceMap[order.productId].orders += 1;
            performanceMap[order.productId].commission += commission;
        });

        return Object.values(performanceMap).sort((a, b) => b.commission - a.commission);

    }, [resellerOrders, products]);


  return (
    <ResellerLayout>
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
                Reseller Dashboard
            </h1>
            <div className="flex items-center space-x-2">
                <Button>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Share New Product
                </Button>
                <Button variant="secondary">Check Commission Rates</Button>
            </div>
        </div>

        {/* Earnings Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {earningsData.map((data) => (
            <Card key={data.title} className={data.isPrimary ? 'bg-primary/10 border-primary' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {data.title}
                </CardTitle>
                <data.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.amount}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsData.map((data) => (
            <Card key={data.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{data.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                {/* Performance Graphs */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp />
                            Performance Overview
                        </CardTitle>
                        <CardDescription>Clicks vs. Conversions this month.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-72 flex items-center justify-center bg-muted/50 rounded-md">
                        <BarChart3 className="h-16 w-16 text-muted-foreground/50" />
                        <p className="text-muted-foreground ml-4">Earnings & Clicks chart will be here.</p>
                    </CardContent>
                </Card>
            </div>
            <div className="space-y-8">
                 {/* Reseller Toolkit */}
                <Card>
                    <CardHeader>
                        <CardTitle>Reseller Toolkit</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                         <Button variant="outline" className="justify-start">AI Poster & Video Maker</Button>
                        <Button variant="outline" className="justify-start">Link Shortener</Button>
                        <Link href="/dashboard/reseller/products">
                             <Button variant="secondary" className="w-full justify-start"><ExternalLink className="mr-2" /> Find More Products</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>

        {/* Top Performing Products */}
        <Card>
            <CardHeader>
                <CardTitle>Top Performing Products</CardTitle>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Clicks</TableHead>
                        <TableHead>Orders</TableHead>
                        <TableHead className="text-right">Commission Earned</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [...Array(3)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-5 w-24" /></TableCell>
                                </TableRow>
                            ))
                        ) : topProducts.length > 0 ? (
                            topProducts.map((p) => (
                            <TableRow key={p.name}>
                                <TableCell className="font-medium">{p.name}</TableCell>
                                <TableCell>{p.clicks}</TableCell>
                                <TableCell>{p.orders}</TableCell>
                                <TableCell className="text-right font-semibold text-green-500">${p.commission.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                            </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    No sales data found. Share some products to get started!
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        
      </div>
    </ResellerLayout>
  );
}
