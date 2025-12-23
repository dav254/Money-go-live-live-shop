
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
import { BadgePercent, Lightbulb } from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Product, ResellActivity } from '@/lib/types';
import { TopSharedProductsTable } from '@/components/reseller/top-shared-products-table';
import { CommissionSettingsTable } from '@/components/seller/commission-settings-table';


const mockAlerts = [
    {
        title: "Top Performer: 'Classic Handbag'",
        description: "This item is being shared a lot but has a low commission rate (5%). Consider increasing it to 10-15% to motivate resellers even more.",
    },
    {
        title: "Stale Product: 'Winter Scarf'",
        description: "This product hasn't been shared by any resellers in over 30 days. Consider pausing it or creating new video content to promote it.",
    }
];

export default function ResellerCenterPage() {
    return (
        <SellerLayout>
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
            Reseller Center
            </h1>
            
            <Tabs defaultValue="analytics" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="commissions">Commission Rules</TabsTrigger>
                </TabsList>

                <TabsContent value="analytics" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Lightbulb /> Performance Alerts</CardTitle>
                            <CardDescription>AI-powered suggestions to optimize your reseller program.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {mockAlerts.map(alert => (
                                <Alert key={alert.title} variant='default' className="bg-primary/5">
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
