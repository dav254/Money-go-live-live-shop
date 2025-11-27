
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
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Payment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { CaretSortIcon } from '@radix-ui/react-icons';
import Link from 'next/link';

const DataTableSkeleton = () => (
  <div className="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 10 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: 5 }).map((_, j) => (
              <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
    case 'succeeded':
      return <Badge className="bg-green-600/80 hover:bg-green-600/70">{status}</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-500/80 hover:bg-yellow-500/70">{status}</Badge>;
    case 'failed':
      return <Badge variant="destructive">{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: 'orderId',
    header: 'Order ID',
    cell: ({ row }) => (
      <Button variant="link" asChild className="p-0 text-xs text-muted-foreground">
        <Link href={`/dashboard/admin/orders/all?orderId=${row.original.orderId}`}>
            #{row.original.orderId.substring(0, 8)}...
        </Link>
      </Button>
    ),
  },
  {
    accessorKey: 'paymentMethod',
    header: 'Method',
    cell: ({ row }) => <p className="capitalize">{row.original.paymentMethod?.replace('_', ' ')}</p>,
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Amount (USD)
            <CaretSortIcon className="ml-2 h-4 w-4" />
        </Button>
    ),
    cell: ({ row }) => <div className="font-medium">${row.original.amount.toLocaleString()}</div>,
  },
  {
    accessorKey: 'paymentStatus',
    header: 'Status',
    cell: ({ row }) => getStatusBadge(row.original.paymentStatus),
  },
  {
    accessorKey: 'paymentDate',
    header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Date
            <CaretSortIcon className="ml-2 h-4 w-4" />
        </Button>
    ),
    cell: ({ row }) => {
        const date = row.original.paymentDate?.toDate();
        return date ? date.toLocaleDateString() : 'N/A';
    },
  },
];

export default function AdminPaymentsPage() {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'paymentDate', desc: true }]);
  const firestore = useFirestore();

  const paymentsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'payments'), orderBy('paymentDate', 'desc'));
  }, [firestore]);

  const { data: payments, isLoading } = useCollection<Payment>(paymentsQuery);

  const table = useReactTable({
    data: payments || [],
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
          Finance Management: All Payments
        </h1>
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
                      No payments found.
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
