
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgePercent, BarChart2, Share2, AlertTriangle, TrendingUp, Lightbulb } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Product, ResellActivity } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';

const mockAlerts = [
    {
        type: 'boost',
        title: "Top Performer: 'Classic Handbag'",
        description: "This item is being shared a lot but has a low commission rate (5%). Consider increasing it to 10-15% to motivate resellers even more.",
        icon: TrendingUp,
        color: 'text-green-400'
    },
    {
        type: 'stale',
        title: "Stale Product: 'Winter Scarf'",
        description: "This product hasn't been shared by any resellers in over 30 days. Consider pausing it or creating new video content to promote it.",
        icon: AlertTriangle,
        color: 'text-yellow-400'
    }
];

const TopSharedProductsTable = () => {
    const { user } = useUser();
    const firestore = useFirestore();
    const [topShared, setTopShared] = useState<{ product: Product; shares: number }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user || !firestore) {
            setIsLoading(false);
            return;
        }

        const sellerId = user.uid;
        let productsUnsubscribe: (() => void) | undefined;
        let activitiesUnsubscribe: (() => void) | undefined;

        // Start loading whenever this effect runs
        setIsLoading(true);

        // State to hold products and activities separately
        let allProducts: Product[] = [];
        let allActivities: ResellActivity[] = [];
        let productDataLoaded = false;
        let activityDataLoaded = false;

        const processData = () => {
            // Only process when both datasets have been loaded at least once
            if (!productDataLoaded || !activityDataLoaded) return;
            
            if (!allProducts.length) {
                setTopShared([]);
                return;
            }
            const shareCounts = allActivities.reduce((acc, activity) => {
                acc[activity.productId] = (acc[activity.productId] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const combinedData = allProducts.map(product => ({
                product,
                shares: shareCounts[product.id] || 0,
            }))
            .filter(item => item.shares > 0)
            .sort((a, b) => b.shares - a.shares)
            .slice(0, 10); // Show top 10

            setTopShared(combinedData);
        };
        
        // Listener for Products
        const productsQuery = query(collection(firestore, 'products'), where('sellerId', '==', sellerId));
        productsUnsubscribe = onSnapshot(productsQuery, (snapshot) => {
            allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            productDataLoaded = true; // Mark as loaded
            processData();
            setIsLoading(false); // Stop loading after the first successful data fetch
        }, (error) => {
            console.error("Error fetching products:", error);
            productDataLoaded = true;
            setIsLoading(false);
        });

        // Listener for Activities
        const activitiesQuery = query(collection(firestore, 'resellActivities'), where('sellerId', '==', sellerId));
        activitiesUnsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
            allActivities = snapshot.docs.map(doc => doc.data() as ResellActivity);
            activityDataLoaded = true; // Mark as loaded
            processData();
        }, (error) => {
            console.error("Error fetching resell activities:", error);
            activityDataLoaded = true;
            setIsLoading(false);
        });

        // Cleanup listeners on unmount
        return () => {
            if (productsUnsubscribe) productsUnsubscribe();
            if (activitiesUnsubscribe) activitiesUnsubscribe();
        };

    }, [user, firestore]);

    if (isLoading) {
        return (
             <Table>
                <TableHeader>
                    <TableRow><TableHead>Product</TableHead><TableHead className="text-right">Total Shares by Resellers</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-md" /><Skeleton className="h-6 w-48" /></div></TableCell>
                            <TableCell><Skeleton className="h-6 w-12 ml-auto" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        )
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Total Shares by Resellers</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {topShared.length > 0 ? (
                    topShared.map(item => (
                        <TableRow key={item.product.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Image src={item.product.imageUrl || 'https://picsum.photos/seed/placeholder/40'} alt={item.product.name || 'Product'} width={40} height={40} className="rounded-md object-cover" />
                                    <span className="font-medium">{item.product.name}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{item.shares}</TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                            No products have been shared by resellers yet.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    )
}


export default function ResellerCenterPage() {
    return (
        <SellerLayout>
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
            Reseller Center
            </h1>
            
            <Tabs defaultValue="analytics" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="analytics"><BarChart2 className="mr-2 h-4 w-4"/>Analytics</TabsTrigger>
                    <TabsTrigger value="commissions"><BadgePercent className="mr-2 h-4 w-4"/>Commission Rules</TabsTrigger>
                </TabsList>

                <TabsContent value="analytics" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Lightbulb /> Performance Alerts</CardTitle>
                            <CardDescription>AI-powered suggestions to optimize your reseller program.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {mockAlerts.map(alert => (
                                <Alert key={alert.title} variant={alert.type === 'stale' ? 'destructive' : 'default'} className="bg-primary/5">
                                    <alert.icon className={`h-4 w-4 ${alert.color}`} />
                                    <AlertTitle className="font-semibold">{alert.title}</AlertTitle>
                                    <AlertDescription>
                                        {alert.description}
                                        <Button variant="link" className="p-0 h-auto ml-2">Take Action</Button>
                                    </AlertDescription>
                                </Alert>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Top Shared Products</CardTitle>
                            <CardDescription>Your products being shared most frequently by the reseller network.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <TopSharedProductsTable />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="commissions" className="space-y-4">
                    <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                        <BadgePercent />
                        Set Product Commission Rates
                        </CardTitle>
                        <CardDescription>Set the percentage a reseller will earn for selling each product. A rate of 0% means the product is not available for reselling.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CommissionSettingsTable />
                    </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
        </SellerLayout>
    );
}
