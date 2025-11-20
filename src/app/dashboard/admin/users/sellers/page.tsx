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
import { collection, query, where } from 'firebase/firestore';
import type { UserProfile, SellerShop } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

type SellerRow = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone?: string;
  totalSales: number; // Placeholder
  productCount: number; // Placeholder
  status: 'active' | 'pending' | 'suspended'; // Placeholder
  verified: boolean; // Placeholder
  avatarUrl?: string;
};

const DataTableSkeleton = () => (
    <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    {Array.from({ length: 8 }).map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>)}
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                        {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);


export const columns: ColumnDef<SellerRow>[] = [
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
    accessorKey: 'businessName',
    header: 'Store',
    cell: ({ row }) => (
        <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
                <AvatarImage src={row.original.avatarUrl} />
                <AvatarFallback>{row.original.businessName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
                <span className="font-medium">{row.getValue('businessName')}</span>
                <span className="text-xs text-muted-foreground">{row.original.ownerName}</span>
            </div>
        </div>
    ),
  },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'phone', header: 'Phone' },
  {
    accessorKey: 'totalSales',
    header: () => <div className="text-right">Total Sales</div>,
    cell: ({ row }) => <div className="text-right font-medium">{row.original.totalSales.toLocaleString()}</div>,
  },
  {
    accessorKey: 'productCount',
    header: () => <div className="text-center">Products</div>,
    cell: ({ row }) => <div className="text-center">{row.original.productCount}</div>,
  },
   {
    accessorKey: 'verified',
    header: 'Verification',
    cell: ({ row }) => {
        const verified = row.getValue('verified') as boolean;
        return <Badge variant={verified ? 'default' : 'secondary'} className={verified ? 'bg-blue-600/80' : ''}>{verified ? 'Verified' : 'Not Verified'}</Badge>;
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const variant = {
        active: 'default',
        pending: 'secondary',
        suspended: 'destructive',
      }[status] as 'default' | 'secondary' | 'destructive';
      return <Badge variant={variant} className={`capitalize ${status === 'active' ? 'bg-green-600/80' : ''}`}>{status}</Badge>;
    },
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
          <DropdownMenuItem>View Store</DropdownMenuItem>
          <DropdownMenuItem>View Products</DropdownMenuItem>
          {!row.original.verified && row.original.status === 'pending' && <DropdownMenuItem className="text-green-600">Approve Verification</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem>Freeze Payouts</DropdownMenuItem>
          <DropdownMenuItem className="text-yellow-600">Suspend Seller</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">Delete Seller</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function AdminSellersPage() {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState({});
  
  const firestore = useFirestore();

  const sellersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'userProfiles'), where('userRole', '==', 'seller'));
  }, [firestore]);

  const { data: sellersData, isLoading } = useCollection<UserProfile>(sellersQuery);

  const data: SellerRow[] = React.useMemo(() => {
    if (!sellersData) return [];
    return sellersData.map(profile => ({
      id: profile.id,
      businessName: profile.shopName || profile.username, // Placeholder
      ownerName: profile.fullName,
      email: profile.email,
      phone: profile.phoneNumber,
      totalSales: 0, // Placeholder
      productCount: 0, // Placeholder
      status: 'active', // Placeholder
      verified: true, // Placeholder
      avatarUrl: profile.profilePictureUrl,
    }));
  }, [sellersData]);


  const table = useReactTable({
    data,
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
          User Management: Sellers
        </h1>
        <div className="w-full">
          <div className="flex items-center py-4">
            <Input
              placeholder="Filter by store, owner, or email..."
              value={(table.getColumn('businessName')?.getFilterValue() as string) ?? ''}
              onChange={(event) => table.getColumn('businessName')?.setFilterValue(event.target.value)}
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
                      No sellers found.
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
