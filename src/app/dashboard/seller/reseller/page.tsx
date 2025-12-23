
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
import { BadgePercent, Users, Trophy, BarChart2, Share2, Target, Percent, PlusCircle, Trash2, AlertTriangle, TrendingUp, Lightbulb, Loader2 } from 'lucide-react';
import { CommissionSettingsTable } from '@/components/seller/commission-settings-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, deleteDoc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { Product, UserProfile, ResellActivity, CommissionTier } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
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

const mockTopPerformingProducts = [
    { id: 'prod-1', name: 'Classic Leather Handbag', sales: 42, commission: 450.75 },
    { id: 'prod-5', name: 'Chronograph Watch', sales: 25, commission: 310.20 },
    { id: 'prod-6', name: 'Noise-Cancelling Headphones', sales: 18, commission: 215.50 },
];

const TopPerformingProductsTable = () => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Reseller Sales</TableHead>
                    <TableHead className="text-right">Total Commission Paid</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {mockTopPerformingProducts.map(p => (
                    <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-center">{p.sales}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">${p.commission.toFixed(2)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};


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
        let unsubscribe: (() => void) | undefined;

        const fetchAndAggregateData = async () => {
            setIsLoading(true);
            try {
                // Fetch all of the seller's products once.
                const productsQuery = query(collection(firestore, 'products'), where('sellerId', '==', sellerId));
                const productsSnapshot = await getDocs(productsQuery);
                const productsMap = new Map(productsSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Product]));

                // Set up a real-time listener for resell activities.
                const activitiesQuery = query(collection(firestore, 'resellActivities'), where('sellerId', '==', sellerId));
                
                unsubscribe = onSnapshot(activitiesQuery, (activitiesSnapshot) => {
                    const activities = activitiesSnapshot.docs.map(doc => doc.data() as ResellActivity);

                    // Aggregate share counts.
                    const shareCounts = activities.reduce((acc, activity) => {
                        acc[activity.productId] = (acc[activity.productId] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);
                    
                    // Combine product details with share counts.
                    const combinedData = Array.from(productsMap.values()).map(product => ({
                        product,
                        shares: shareCounts[product.id] || 0,
                    }))
                    .filter(item => item.shares > 0) // Only show products that have been shared
                    .sort((a, b) => b.shares - a.shares)
                    .slice(0, 5); // Get top 5

                    setTopShared(combinedData);
                    setIsLoading(false); // Set loading to false after initial data load
                }, (error) => {
                    console.error("Error with real-time listener for activities: ", error);
                    setIsLoading(false);
                });

            } catch (error) {
                console.error("Error fetching initial product data:", error);
                setIsLoading(false);
            }
        };

        fetchAndAggregateData();

        // Cleanup the listener when the component unmounts
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
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
                            <TableCell><Skeleton className="h-10 w-48" /></TableCell>
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
    const { user } = useUser();

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
                            <CardTitle>Top Performing Products (by Resellers)</CardTitle>
                            <CardDescription>Products generating the most commission from reseller sales.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TopPerformingProductsTable />
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
