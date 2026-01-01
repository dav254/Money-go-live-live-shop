
'use client';

import React, { useMemo } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CircleDollarSign, ShoppingBag, Users } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Order, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


const StatCard = ({ title, value, icon: Icon, description, isLoading }: { title: string, value: string | number, icon: React.ElementType, description?: string, isLoading?: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{value}</div>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const UserCell = ({ userId }: { userId: string }) => {
    const firestore = useFirestore();
    const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', userId), [firestore, userId]);
    const { data: user, isLoading } = useDoc<UserProfile>(userRef);

    if (isLoading) return <Skeleton className="h-6 w-24" />;

    return (
        <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profilePictureUrl} alt={user?.fullName} />
                <AvatarFallback>{user?.fullName?.[0]}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{user?.fullName}</span>
        </div>
    );
};


export default function ResellerAnalyticsPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const resellerOrdersQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'orders'),
            where('sellerId', '==', user.uid),
            where('resellerId', '!=', null)
        );
    }, [firestore, user]);

    const { data: orders, isLoading } = useCollection<Order>(resellerOrdersQuery);
    
    const resellerStats = useMemo(() => {
        if (!orders) return [];

        const statsMap = new Map<string, { id: string; sales: number; commission: number }>();
        
        orders.forEach(order => {
            if (order.resellerId) {
                const existing = statsMap.get(order.resellerId) || { id: order.resellerId, sales: 0, commission: 0 };
                existing.sales += 1;
                existing.commission += order.resellerCommission || 0;
                statsMap.set(order.resellerId, existing);
            }
        });
        
        return Array.from(statsMap.values()).sort((a,b) => b.commission - a.commission);

    }, [orders]);

    const totalResellerSales = resellerStats.reduce((sum, r) => sum + r.sales, 0);
    const totalCommission = resellerStats.reduce((sum, r) => sum + r.commission, 0);

    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Reseller Analytics</h1>
                
                <div className="grid gap-4 md:grid-cols-3">
                    <StatCard title="Total Reseller Sales" value={totalResellerSales.toLocaleString()} icon={ShoppingBag} isLoading={isLoading} />
                    <StatCard title="Total Commissions Paid" value={`$${totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={CircleDollarSign} isLoading={isLoading} />
                    <StatCard title="Active Resellers" value={resellerStats.length.toLocaleString()} icon={Users} isLoading={isLoading} />
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Top Performing Resellers</CardTitle>
                        <CardDescription>Your resellers ranked by total commission earned.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Reseller</TableHead>
                                    <TableHead className="text-center">Sales</TableHead>
                                    <TableHead className="text-right">Commission Earned</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">Loading reseller data...</TableCell>
                                    </TableRow>
                                ) : resellerStats.length > 0 ? (
                                    resellerStats.map(reseller => (
                                        <TableRow key={reseller.id}>
                                            <TableCell><UserCell userId={reseller.id} /></TableCell>
                                            <TableCell className="text-center font-medium">{reseller.sales}</TableCell>
                                            <TableCell className="text-right font-bold text-primary">${reseller.commission.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                            No sales from resellers yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}
