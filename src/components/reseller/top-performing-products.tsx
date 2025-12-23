
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


export function TopPerformingProducts() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'orders'), where('resellerId', '==', user.uid), where('orderStatus', 'in', ['delivered', 'shipped', 'processing']));
  }, [firestore, user]);

  const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);

  const isLoading = isUserLoading || areOrdersLoading;

  const topProducts = React.useMemo(() => {
    if (!orders) return [];

    const productStats = orders.reduce((acc, order) => {
        order.items.forEach(item => {
            if (!acc[item.productId]) {
                acc[item.productId] = { id: item.productId, name: item.name, orders: 0, commission: 0, clicks: 0 };
            }
            acc[item.productId].orders += 1;
            acc[item.productId].commission += (order.resellerCommission || 0) / order.items.length; // Approximate commission per item
        });
        return acc;
    }, {} as Record<string, { id: string; name: string; clicks: number; orders: number; commission: number; }>);

    return Object.values(productStats).sort((a, b) => b.commission - a.commission).slice(0, 5);

  }, [orders]);


  if (isLoading) {
    return (
      <Table>
        <TableHeader>
            <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead className="text-right">Commission Earned</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
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
            <TableHead>Product</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead className="text-right">Commission Earned (USD)</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {topProducts.length > 0 ? (
                topProducts.map((p) => (
                <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.orders}</TableCell>
                    <TableCell className="text-right font-semibold text-green-500">${p.commission.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                </TableRow>
                ))
            ) : (
                    <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        No sales data found. Share some products to get started!
                    </TableCell>
                </TableRow>
            )}
        </TableBody>
    </Table>
  );
}
