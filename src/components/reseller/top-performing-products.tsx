
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

// Define a type for our mock product stats
interface ProductStats {
  id: string;
  name: string;
  clicks: number;
  orders: number;
  commission: number;
}

// Sample data for demonstration purposes
const topProducts: ProductStats[] = [
  { id: 'prod-1', name: 'Classic Leather Handbag', clicks: 150, orders: 25, commission: 212.50 },
  { id: 'prod-2', name: 'NextGen Smartphone', clicks: 120, orders: 15, commission: 180.00 },
  { id: 'prod-5', name: 'Chronograph Watch', clicks: 95, orders: 10, commission: 150.00 },
  { id: 'prod-6', name: 'Noise-Cancelling Headphones', clicks: 80, orders: 8, commission: 96.00 },
];

export function TopPerformingProducts() {
  const isLoading = false; // Set to false as we are using static data

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
            <TableHead className="text-right">Commission Earned (USD)</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {topProducts.length > 0 ? (
                topProducts.map((p) => (
                <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.clicks.toLocaleString()}</TableCell>
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
