
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
import { collection, query, where, doc } from 'firebase/firestore';
import type { LiveSession, UserProfile } from '@/lib/types';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Users, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const SellerCell = ({ sellerId }: { sellerId: string }) => {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', sellerId), [
    firestore,
    sellerId,
  ]);
  const { data: user, isLoading } = useDoc<UserProfile>(userRef);
  if (isLoading) return <Skeleton className="h-8 w-24" />;
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarImage src={user?.profilePictureUrl} />
        <AvatarFallback>{user?.fullName?.charAt(0)}</AvatarFallback>
      </Avatar>
      <span className="text-xs">{user?.fullName}</span>
    </div>
  );
};

const columns: ColumnDef<LiveSession>[] = [
  {
    accessorKey: 'title',
    header: 'Stream Title',
     cell: ({ row }) => <div className="font-medium">{row.original.title}</div>
  },
  {
    accessorKey: 'sellerId',
    header: 'Seller',
    cell: ({ row }) => <SellerCell sellerId={row.original.sellerId} />,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge className="bg-red-500 hover:bg-red-500/80"><Video className="mr-2 h-3 w-3" /> {row.original.status}</Badge>,
  },
  {
    accessorKey: 'viewerCount',
    header: () => <div className="text-right">Viewers</div>,
    cell: ({ row }) => <div className="text-right flex items-center justify-end gap-2"><Users className="h-4 w-4 text-muted-foreground" /> {(row.original.viewerCount || 0).toLocaleString()}</div>,
  },
   {
    accessorKey: 'startTime',
    header: () => <div className="text-right">Duration</div>,
    cell: ({ row }) => {
        const startTime = row.original.startTime?.toDate();
        if (!startTime) return <div className="text-right">-</div>;
        return <div className="text-right">{formatDistanceToNow(startTime, { addSuffix: true })}</div>
    },
  },
  {
      id: 'actions',
      cell: ({row}) => (
          <div className="text-right">
              <Button variant="outline" size="sm">Monitor</Button>
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
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
               {Array.from({ length: columns.length }).map((_, j) => (
                <TableCell key={j}>
                    <Skeleton className="h-6 w-full" />
                </TableCell>
            ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
);


export default function AdminLiveSessionsPage() {
  const firestore = useFirestore();

  const liveSessionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'liveSessions'),
      where('status', '==', 'live')
    );
  }, [firestore]);

  const { data: liveSessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);
  
  const table = useReactTable({
    data: liveSessions || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Live Shopping: Active Sessions
        </h1>
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
                        No sellers are currently live.
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
