
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
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { LiveSession, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const SellerCell = ({ sellerId }: { sellerId: string }) => {
  const firestore = useFirestore();
  const sellerProfileRef = useMemoFirebase(() => doc(firestore, 'userProfiles', sellerId), [firestore, sellerId]);
  const { data: seller, isLoading } = useDoc<UserProfile>(sellerProfileRef);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-9 w-9">
        <AvatarImage src={seller?.profilePictureUrl} />
        <AvatarFallback>{seller?.fullName?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div>
        <p className="font-medium">{seller?.fullName}</p>
        <p className="text-xs text-muted-foreground">{seller?.username}</p>
      </div>
    </div>
  );
};


const columns: ColumnDef<LiveSession>[] = [
  {
    accessorKey: 'title',
    header: 'Stream',
    cell: ({ row }) => (
      <SellerCell sellerId={row.original.sellerId} />
    ),
  },
   {
    accessorKey: 'endTime',
    header: 'Date Ended',
    cell: ({ row }) => format(row.original.endTime.toDate(), 'PPP'),
  },
  {
    accessorKey: 'viewerCount',
    header: 'Peak Viewers',
    cell: ({ row }) => (row.original.viewerCount || 0).toLocaleString(),
  },
  {
    id: 'totalSales', // Placeholder
    header: 'Total Sales (USD)',
    cell: () => `$${(Math.random() * 2000).toLocaleString(undefined, {minimumFractionDigits: 2})}`,
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return (
        <div className="text-right">
            <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/admin/live-shopping/analytics?streamId=${row.original.id}`}>
                    <BarChart2 className="mr-2 h-4 w-4" />
                    View Analytics
                </Link>
            </Button>
        </div>
      );
    },
  },
];

export default function AdminApprovedStreamsPage() {
  const firestore = useFirestore();

  // Query for sessions that have ended, which are considered "approved" and completed.
  const endedSessionsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'liveSessions'), where('status', '==', 'ended'));
  }, [firestore]);

  const { data: sessions, isLoading } = useCollection<LiveSession>(endedSessionsQuery);

  const table = useReactTable({
      data: sessions || [],
      columns,
      getCoreRowModel: getCoreRowModel(),
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight flex items-center gap-3">
          <CheckCircle className="h-8 w-8 text-green-500" />
          Completed Live Streams
        </h1>
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
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      {columns.map((col, j) => (
                        <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows?.length ? (
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
                        No completed streams found.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
