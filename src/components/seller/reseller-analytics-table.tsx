
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
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Order } from '@/lib/types';


export function ResellerAnalyticsTable() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'orders'), where('sellerId', '==', user.uid), where('resellerId', '!=', null));
  }, [firestore, user]);

  const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);

  const isLoading = isUserLoading || areOrdersLoading;

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


  if (isLoading) {
    return (
      <Table>
        <TableHeader>
            <TableRow>
                <TableHead>Reseller</TableHead>
                <TableHead className="text-right">Sales Generated (USD)</TableHead>
                <TableHead className="text-right">Commission Paid (USD)</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <Table>
        <TableHeader>
            <TableRow>
                <TableHead>Reseller ID</TableHead>
                <TableHead className="text-right">Sales Generated (USD)</TableHead>
                <TableHead className="text-right">Commission Paid (USD)</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {topResellers.length > 0 ? (
                topResellers.map((reseller) => (
                <TableRow key={reseller.resellerId}>
                    <TableCell className="font-mono text-xs">{reseller.resellerId}</TableCell>
                    <TableCell className="text-right font-medium">${reseller.sales.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold text-green-500">${reseller.commission.toFixed(2)}</TableCell>
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
  );
}

