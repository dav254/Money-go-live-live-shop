
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Order, UserProfile, Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { CaretSortIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';


const UserCell = ({ userId, label }: { userId: string; label: string }) => {
    const firestore = useFirestore();

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return doc(firestore, 'userProfiles', userId);
    }, [firestore, userId]);
    
    const { data: user, isLoading } = useDoc<UserProfile>(userProfileRef);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="flex flex-col space-y-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-12" />
                </div>
            </div>
        );
    }
    
    if (!user) {
        return <span className="text-xs text-muted-foreground">Unknown User</span>;
    }

    return (
        <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
                <AvatarImage src={user?.profilePictureUrl} />
                <AvatarFallback>{user?.fullName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
                <span className="text-xs font-medium">{user?.fullName}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
            </div>
        </div>
    );
};


const DataTableSkeleton = () => (
  <div className="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: 6 }).map((_, i) => (
            <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 10 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: 6 }).map((_, j) => (
              <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const getStatusBadge = (status: Order['orderStatus']) => {
  switch (status) {
    case 'delivered':
      return <Badge className="bg-green-600/80 hover:bg-green-600/70">Cleared</Badge>;
    case 'shipped':
    case 'processing':
    case 'pending':
      return <Badge variant="secondary" className="bg-yellow-500/80 hover:bg-yellow-500/70">Pending</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const columns: ColumnDef<Order>[] = [
  {
    accessorKey: 'productName',
    header: 'Product',
    cell: ({ row }) => {
      const order = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-md overflow-hidden">
            <Avatar className="h-10 w-10 rounded-md">
              <AvatarImage src={order.productImage} />
              <AvatarFallback>{order.productName?.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
          <div>
              <Button variant="link" asChild className="p-0 h-auto font-medium capitalize text-base">
                <Link href={`/products/${order.productId}`}>
                  {order.productName}
                </Link>
              </Button>
              <div className="text-xs text-muted-foreground">#{order.id.substring(0, 6)}...</div>
          </div>
        </div>
      );
    },
  },
  {
    id: 'participants',
    header: 'Participants',
    cell: ({ row }) => (
      <div className="space-y-2">
        <UserCell userId={row.original.resellerId!} label="Reseller" />
        <UserCell userId={row.original.sellerId} label="Seller" />
      </div>
    )
  },
  {
    accessorKey: 'resellerCommission',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="w-full justify-end">
        Commission
        <CaretSortIcon className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="text-right font-semibold text-green-500">
        ${(row.original.resellerCommission || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </div>
    ),
  },
  {
    accessorKey: 'orderStatus',
    header: 'Commission Status',
    cell: ({ row }) => getStatusBadge(row.original.orderStatus),
  },
  {
    accessorKey: 'orderDate',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="w-full justify-end">
        Date
        <CaretSortIcon className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="text-right">{row.original.orderDate?.toDate().toLocaleDateString()}</div>,
  },
];

export default function AdminCommissionsPage() {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'orderDate', desc: true }]);
  const firestore = useFirestore();

  // Query for orders that have a resellerId
  const resellerOrdersQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'orders'), where('resellerId', '!=', null));
  }, [firestore]);

  const { data: orders, isLoading } = useCollection<Order>(resellerOrdersQuery);


  const table = useReactTable({
    data: orders || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Finance: Reseller Commissions
        </h1>
        <p className="text-muted-foreground">This table shows all commissions generated from reseller sales.</p>
        {isLoading ? <DataTableSkeleton /> : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No reseller commissions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
