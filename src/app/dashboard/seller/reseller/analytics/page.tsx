
'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SellerLayout } from '@/components/layout/seller-layout';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { ResellerApplication, UserProfile, Order } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BarChart, DollarSign } from 'lucide-react';
import Link from 'next/link';

const ResellerCell = ({ resellerId }: { resellerId: string }) => {
    const firestore = useFirestore();
    const resellerProfileRef = useMemoFirebase(() => {
        if (!firestore || !resellerId) return null;
        return doc(firestore, 'userProfiles', resellerId);
    }, [firestore, resellerId]);
    
    const { data: reseller, isLoading } = useDoc<UserProfile>(resellerProfileRef);

    if (isLoading) {
        return (
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                </div>
            </div>
        );
    }

    if (!reseller) return <span className="text-xs text-muted-foreground">Unknown Reseller</span>;

    return (
        <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
                <AvatarImage src={reseller.profilePictureUrl} />
                <AvatarFallback>{reseller.fullName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
                <p className="font-semibold">{reseller.fullName}</p>
                <p className="text-xs text-muted-foreground">{reseller.email}</p>
            </div>
        </div>
    );
};

export default function ResellerAnalyticsPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const resellerOrdersQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'orders'), where('sellerId', '==', user.uid), where('resellerId', '!=', null));
    }, [firestore, user]);

    const { data: orders, isLoading } = useCollection<Order>(resellerOrdersQuery);

    const topResellers = React.useMemo(() => {
        if (!orders) return [];

        const resellerStats = orders.reduce((acc, order) => {
            if (!order.resellerId) return acc;

            if (!acc[order.resellerId]) {
                acc[order.resellerId] = { resellerId: order.resellerId, sales: 0, commission: 0 };
            }
            acc[order.resellerId].sales += order.totalAmount;
            acc[order.resellerId].commission += order.resellerCommission || 0;

            return acc;
        }, {} as Record<string, { resellerId: string; sales: number; commission: number; }>);

        return Object.values(resellerStats).sort((a, b) => b.commission - a.commission).slice(0, 5);

    }, [orders]);


    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Reseller Analytics</h1>
                <p className="text-muted-foreground">
                    Track the performance of your top resellers.
                </p>
                
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BarChart /> Top Resellers by Commission</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Reseller</TableHead>
                                        <TableHead className="text-right">Total Sales Generated (USD)</TableHead>
                                        <TableHead className="text-right">Total Commission Earned (USD)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        [...Array(3)].map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell><Skeleton className="h-8 w-48" /></TableCell>
                                                <TableCell><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                                                <TableCell><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : topResellers.length > 0 ? (
                                        topResellers.map(reseller => (
                                            <TableRow key={reseller.resellerId}>
                                                <TableCell>
                                                    <ResellerCell resellerId={reseller.resellerId} />
                                                </TableCell>
                                                <TableCell className="text-right font-medium">${reseller.sales.toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-semibold text-green-500">${reseller.commission.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                                No reseller sales data found yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}
