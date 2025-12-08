
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

// Define a type for our aggregated product stats
interface ProductStats {
  id: string;
  name: string;
  clicks: number; // Note: Clicks are not tracked in the current data model.
  orders: number;
  commission: number;
}

export function TopPerformingProducts() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();

  // 1. Create a query to get all orders for the current reseller
  const ordersQuery = useMemoFirebase(() => {
    if (!user) return null;
    // This query assumes that an 'order' document has a 'resellerId' field.
    return query(collection(firestore, 'orders'), where('resellerId', '==', user.uid));
  }, [firestore, user]);

  // 2. Fetch the collection of orders
  const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);

  // 3. Process the fetched orders to aggregate stats
  const topProducts = React.useMemo(() => {
    if (!orders) return [];

    const stats: Record<string, ProductStats> = {};

    orders.forEach(order => {
      if (!stats[order.productId]) {
        stats[order.productId] = {
          id: order.productId,
          name: order.productName || 'Unknown Product',
          orders: 0,
          commission: 0,
          clicks: 0, // Clicks are not tracked, so this will remain 0
        };
      }
      stats[order.productId].orders += 1;
      stats[order.productId].commission += order.commissionEarned || 0;
    });

    // Sort by commission earned in descending order
    return Object.values(stats).sort((a, b) => b.commission - a.commission);

  }, [orders]);

  const isLoading = isUserLoading || areOrdersLoading;

  if (isLoading) {
    return (
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
            {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
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
            <TableHead>Clicks</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead className="text-right">Commission Earned</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {topProducts.length > 0 ? (
                topProducts.map((p) => (
                <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">N/A</TableCell>
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
  );
}
