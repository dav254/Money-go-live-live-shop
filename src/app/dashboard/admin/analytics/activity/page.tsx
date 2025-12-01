
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';

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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserProfile, ActivityLog } from '@/lib/types';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';


const UserCell = ({ userId }: { userId: string }) => {
    const firestore = useFirestore();
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return doc(firestore, 'userProfiles', userId);
    }, [firestore, userId]);
    
    const { data: user, isLoading } = useDoc<UserProfile>(userProfileRef);

    if (isLoading) {
        return (
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-12" />
                </div>
            </div>
        );
    }

    if (!user) {
        return <span className="text-muted-foreground">System/Unknown</span>
    }

    return (
        <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
                <AvatarImage src={user.profilePictureUrl} />
                <AvatarFallback>{user.fullName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
                <p className="font-semibold">{user.fullName}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.userRole}</p>
            </div>
        </div>
    );
};


const columns: ColumnDef<ActivityLog>[] = [
  {
    accessorKey: 'userId',
    header: 'User',
    cell: ({ row }) => {
        return <UserCell userId={row.original.userId} />;
    },
    filterFn: (row, id, value) => {
      // This is a placeholder for a more complex filter that would need user data
      return row.original.userId.toLowerCase().includes(value.toLowerCase());
    },
  },
  {
    accessorKey: 'action',
    header: 'Action',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      return <Badge variant={status === 'Success' ? 'default' : 'destructive'} className={status === 'Success' ? 'bg-green-600/80' : ''}>{status}</Badge>;
    },
  },
  {
    accessorKey: 'details',
    header: 'Details',
  },
  {
    accessorKey: 'timestamp',
    header: 'Timestamp',
     cell: ({ row }) => {
        const timestamp = row.original.timestamp;
        return timestamp ? formatDistanceToNow(timestamp.toDate(), { addSuffix: true }) : 'N/A';
    },
  },
];


export default function AdminActivityLogsPage() {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const firestore = useFirestore();

  const activityLogsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'activityLogs'), orderBy('timestamp', 'desc'));
  }, [firestore]);

  const { data: activityLogs, isLoading } = useCollection<ActivityLog>(activityLogsQuery);


  const table = useReactTable({
    data: activityLogs || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      columnFilters,
    },
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          User Activity Logs
        </h1>
        <div className="w-full">
            <div className="flex items-center py-4">
                <Input
                placeholder="Filter by user ID..."
                value={(table.getColumn('userId')?.getFilterValue() as string) ?? ''}
                onChange={(event) =>
                    table.getColumn('userId')?.setFilterValue(event.target.value)
                }
                className="max-w-sm"
                />
            </div>
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
                     <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                            Loading activity logs...
                        </TableCell>
                    </TableRow>
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
                        No activity found.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </div>
        </div>
      </div>
    </AdminLayout>
  );
}
