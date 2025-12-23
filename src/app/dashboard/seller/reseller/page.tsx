
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
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
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

const mockTopShared = [
    { id: 'prod-1', name: 'Classic Leather Handbag', imageUrl: 'https://picsum.photos/seed/product1/40', shares: 542 },
    { id: 'prod-6', name: 'Noise-Cancelling Headphones', imageUrl: 'https://picsum.photos/seed/product6/40', shares: 488 },
    { id: 'prod-5', name: 'Chronograph Watch', imageUrl: 'https://picsum.photos/seed/product5/40', shares: 310 },
];

const TopSharedProductsTable = () => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Total Shares by Resellers</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {mockTopShared.map(product => (
                    <TableRow key={product.id}>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md" />
                                <span className="font-medium">{product.name}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{product.shares}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

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
