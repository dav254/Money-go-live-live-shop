
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
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Order, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Truck } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const UserCell = ({ userId }: { userId: string }) => {
    const firestore = useFirestore();
    const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', userId), [firestore, userId]);
    const { data: user, isLoading } = useDoc<UserProfile>(userRef);
    if (isLoading) return <Skeleton className="h-5 w-24" />;
    return <span className="font-medium text-xs">{user?.fullName || 'N/A'}</span>;
}

const columns: ColumnDef<Order>[] = [
  {
    accessorKey: 'productName',
    header: 'Product',
  },
  {
    accessorKey: 'buyerId',
    header: 'Buyer',
    cell: ({ row }) => <UserCell userId={row.original.buyerId} />
  },
  {
    accessorKey: 'sellerId',
    header: 'Seller',
    cell: ({ row }) => <UserCell userId={row.original.sellerId} />
  },
  {
    accessorKey: 'trackingNumber',
    header: 'Tracking Info',
    cell: ({ row }) => (
        <div>
            <Badge variant="secondary">{row.original.shippingProvider || 'Not Specified'}</Badge>
            <p className="font-mono text-xs mt-1">{row.original.trackingNumber || 'N/A'}</p>
        </div>
    )
  },
  {
    id: 'deliveryStatus',
    header: 'Delivery Status & Proof',
    cell: ({ row }) => {
        const { orderStatus, deliveryProof, buyerConfirmed } = row.original;
        if (orderStatus === 'delivered' && buyerConfirmed && deliveryProof) {
            return (
                <div className="flex items-center gap-2">
                    <Badge className="bg-green-600/80 hover:bg-green-600/70">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Delivered
                    </Badge>
                    <a href={deliveryProof} target="_blank" rel="noopener noreferrer" title="View Delivery Proof">
                        <Image 
                            src={deliveryProof} 
                            alt="Delivery Proof" 
                            width={40} 
                            height={40} 
                            className="rounded-md object-cover hover:scale-110 transition-transform cursor-pointer"
                        />
                    </a>
                </div>
            )
        }
        return <span className="text-xs text-muted-foreground">Awaiting Confirmation</span>
    }
  },
  {
      id: 'actions',
      cell: ({row}) => (
          <div className="text-right">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/admin/orders/all?orderId=${row.original.id}`} passHref>
                    View Details
                </Link>
              </Button>
          </div>
      )
  }
];

const DataTableSkeleton = () => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns.length }).map((_, i) => (
                <TableHead key={i}>
                    <Skeleton className="h-5 w-full" />
                </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
               {Array.from({ length: columns.length }).map((_, j) => (
                <TableCell key={j}>
                    <Skeleton className="h-8 w-full" />
                </TableCell>
            ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
);


export default function AdminTrackingPage() {
  const firestore = useFirestore();

  // Updated query to include both 'shipped' and 'delivered' orders
  const relevantOrdersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('orderStatus', 'in', ['shipped', 'delivered'])
    );
  }, [firestore]);

  const { data: relevantOrders, isLoading } = useCollection<Order>(relevantOrdersQuery);

  const table = useReactTable({
    data: relevantOrders || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });


  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Orders & Transactions: Delivery Tracking
        </h1>
        <p className="text-muted-foreground">
            Monitor items in transit and verify recent deliveries.
        </p>
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
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
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
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Truck className="h-8 w-8" />
                        <p className="font-semibold">No orders are currently in shipment or recently delivered.</p>
                    </div>
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
