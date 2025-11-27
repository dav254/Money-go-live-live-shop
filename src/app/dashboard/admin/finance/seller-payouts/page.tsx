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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, updateDoc, orderBy } from 'firebase/firestore';
import type { Payout, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { DotsHorizontalIcon, CaretSortIcon } from '@radix-ui/react-icons';

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
        {Array.from({ length: 5 }).map((_, i) => (
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

export default function AdminSellerPayoutsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'requestedAt', desc: true }]);

  const payoutsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'payouts'), orderBy('requestedAt', 'desc'));
  }, [firestore]);

  const { data: payouts, isLoading } = useCollection<Payout>(payoutsQuery);

  const handleStatusUpdate = async (payoutId: string, status: 'processing' | 'completed' | 'failed') => {
    const payoutRef = doc(firestore, 'payouts', payoutId);
    try {
      const updateData: any = { status };
      if (status === 'completed') {
        updateData.processedAt = new Date();
      }
      await updateDoc(payoutRef, updateData);
      toast({ title: 'Success', description: `Payout status updated to ${status}.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update payout status.' });
    }
  };

  const columns: ColumnDef<Payout>[] = React.useMemo(() => [
    {
      accessorKey: 'sellerId',
      header: 'Seller',
      cell: ({ row }) => <SellerCell sellerId={row.original.sellerId} />,
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Amount (USD)
            <CaretSortIcon className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="font-semibold">${row.original.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
    },
    {
      accessorKey: 'payoutMethodInfo',
      header: 'Method',
      cell: ({ row }) => <div className="text-sm text-muted-foreground">{row.original.payoutMethodInfo}</div>
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        const variant = status === 'completed' ? 'default' : (status === 'pending' ? 'secondary' : 'destructive');
        const color = status === 'completed' ? 'bg-green-600/80' : (status === 'pending' ? 'bg-yellow-500/80' : '');
        return <Badge variant={variant} className={`capitalize ${color}`}>{status}</Badge>;
      },
    },
    {
      accessorKey: 'requestedAt',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Requested
          <CaretSortIcon className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => row.original.requestedAt?.toDate().toLocaleDateString(),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const payout = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <DotsHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleStatusUpdate(payout.id, 'processing')}>Mark as Processing</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusUpdate(payout.id, 'completed')}>Mark as Completed</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => handleStatusUpdate(payout.id, 'failed')}>Mark as Failed</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [handleStatusUpdate]);

  const table = useReactTable({
    data: payouts || [],
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
          Finance: Seller Payouts
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
                      No pending payout requests.
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
