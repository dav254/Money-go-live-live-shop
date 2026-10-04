
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import type { Order, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc } from '@/firebase/firestore/use-doc';

const SellerCell = ({ sellerId }: { sellerId: string }) => {
    const firestore = useFirestore();
    const sellerRef = useMemoFirebase(() => doc(firestore, 'userProfiles', sellerId), [firestore, sellerId]);
    const { data: seller, isLoading } = useDoc<UserProfile>(sellerRef);
    if (isLoading) return <Skeleton className="h-8 w-24" />;
    return (
        <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
                <AvatarImage src={seller?.profilePictureUrl} />
                <AvatarFallback>{seller?.fullName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-xs">{seller?.fullName}</span>
        </div>
    )
}

const BuyerCell = ({ buyerId }: { buyerId: string }) => {
    const firestore = useFirestore();
    const buyerRef = useMemoFirebase(() => doc(firestore, 'userProfiles', buyerId), [firestore, buyerId]);
    const { data: buyer, isLoading } = useDoc<UserProfile>(buyerRef);
    if (isLoading) return <Skeleton className="h-8 w-24" />;
    return (
        <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
                <AvatarImage src={buyer?.profilePictureUrl} />
                <AvatarFallback>{buyer?.fullName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-xs">{buyer?.fullName}</span>
        </div>
    )
}

const getStatusBadge = (status: Order['orderStatus']) => {
    switch (status) {
        case 'delivered': return <Badge className="bg-green-600/80 hover:bg-green-600/70">{status}</Badge>;
        case 'shipped': return <Badge className="bg-indigo-500/80 hover:bg-indigo-500/70">{status}</Badge>;
        case 'processing': return <Badge className="bg-blue-500/80 hover:bg-blue-500/70">{status}</Badge>;
        case 'pending': return <Badge className="bg-yellow-500/80 hover:bg-yellow-500/70">{status}</Badge>;
        case 'cancelled': return <Badge variant="destructive">{status}</Badge>;
        default: return <Badge variant="secondary">{status}</Badge>;
    }
}

export const columns: ColumnDef<Order>[] = [
  {
    accessorKey: 'productName',
    header: 'Product',
    cell: ({ row }) => (
        <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 rounded-md">
                <AvatarImage src={row.original.productImage} />
                <AvatarFallback>{row.original.productName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="font-medium capitalize">{row.original.productName}</span>
        </div>
    ),
  },
  {
    accessorKey: 'sellerId',
    header: 'Seller',
    cell: ({ row }) => <SellerCell sellerId={row.original.sellerId} />,
  },
    {
    accessorKey: 'buyerId',
    header: 'Buyer',
    cell: ({ row }) => <BuyerCell buyerId={row.original.buyerId} />,
  },
  {
    accessorKey: 'totalAmount',
    header: () => <div className="text-right">Amount (USD)</div>,
    cell: ({ row }) => <div className="text-right font-medium">${(row.original.totalAmount ?? row.original.productPrice ?? 0).toLocaleString()}</div>,
  },
  {
    accessorKey: 'orderStatus',
    header: 'Status',
    cell: ({ row }) => getStatusBadge(row.original.orderStatus),
  },
   {
    accessorKey: 'orderDate',
    header: 'Date',
     cell: ({ row }) => row.original.orderDate ? new Date(row.original.orderDate.toDate()).toLocaleDateString() : 'N/A',
  },
];

export default function AdminSellerOrdersPage() {
  const firestore = useFirestore();
  const ordersQuery = useMemoFirebase(() => query(collection(firestore, 'orders')), [firestore]);
  const { data: ordersData, isLoading } = useCollection<Order>(ordersQuery);

  const table = useReactTable({
    data: ordersData || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Orders & Transactions: Seller Orders
        </h1>
        <div className="w-full">
          {isLoading ? (
             <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map(col => <TableHead key={col.id}><Skeleton className="h-5 w-full" /></TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                {columns.map(col => <TableCell key={col.id}><Skeleton className="h-8 w-full" /></TableCell>)}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
          ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No orders found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
