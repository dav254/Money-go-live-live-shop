
'use client';

import * as React from 'react';
import {
  CaretSortIcon,
  ChevronDownIcon,
  DotsHorizontalIcon,
} from '@radix-ui/react-icons';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
import { collection, query } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const DataTableSkeleton = () => (
    <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    {Array.from({ length: 7 }).map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>)}
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);

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
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'id',
    header: 'Order ID',
    cell: ({ row }) => <div className="text-xs text-muted-foreground">#{row.original.id.substring(0, 6)}...</div>,
  },
  {
    accessorKey: 'productName',
    header: 'Product',
    cell: ({ row }) => (
        <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-md overflow-hidden">
                <Avatar className="h-10 w-10 rounded-md">
                    <AvatarImage src={row.original.productImage || 'https://picsum.photos/seed/product/100'} />
                    <AvatarFallback>{row.original.productName?.charAt(0)}</AvatarFallback>
                </Avatar>
            </div>
            <span className="font-medium capitalize">{row.original.productName}</span>
        </div>
    ),
  },
  {
    accessorKey: 'totalAmount',
    header: () => <div className="text-right">Amount (USD)</div>,
    cell: ({ row }) => <div className="text-right font-medium">${row.original.totalAmount.toLocaleString()}</div>,
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
  {
    id: 'actions',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <DotsHorizontalIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem>View Order Details</DropdownMenuItem>
          <DropdownMenuItem>View Buyer Profile</DropdownMenuItem>
           <DropdownMenuItem>View Seller Profile</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Update Status</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">Issue Refund</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function AdminAllOrdersPage() {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState({});
  
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'orders'));
  }, [firestore]);

  const { data: ordersData, isLoading } = useCollection<Order>(ordersQuery);

  const table = useReactTable({
    data: ordersData || [],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, rowSelection },
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Orders & Transactions: All Orders
        </h1>
        <div className="w-full">
          <div className="flex items-center py-4">
            <Input
              placeholder="Filter by product name, ID..."
              value={(table.getColumn('productName')?.getFilterValue() as string) ?? ''}
              onChange={(event) => table.getColumn('productName')?.setFilterValue(event.target.value)}
              className="max-w-sm"
            />
          </div>
          {isLoading ? <DataTableSkeleton /> : (
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
                    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
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
          <div className="flex items-center justify-end space-x-2 py-4">
             <div className="flex-1 text-sm text-muted-foreground">
                {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
