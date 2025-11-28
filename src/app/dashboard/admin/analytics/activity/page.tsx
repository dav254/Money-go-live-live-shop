
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
import type { UserProfile } from '@/lib/types';


interface ActivityLog {
  id: string;
  userId: string;
  action: 'Login' | 'Product Upload' | 'Order Placed' | 'Profile Update' | 'Payout Request' | 'Admin Action';
  status: 'Success' | 'Failure';
  details: string;
  timestamp: Date; // Use Date for mock data
}

// --- Mock Data ---
const mockUsers: { [key: string]: { fullName: string; profilePictureUrl?: string; userRole: string } } = {
  'user-1': { fullName: 'Alice Johnson', userRole: 'buyer' },
  'user-2': { fullName: 'Bob Williams', userRole: 'seller' },
  'user-3': { fullName: 'Charlie Brown', userRole: 'admin' },
};

const mockActivityLogs: ActivityLog[] = [
  { id: 'log-1', userId: 'user-1', action: 'Order Placed', status: 'Success', details: 'Order #ORD-123 placed for "Classic Handbag"', timestamp: new Date(new Date().getTime() - 2 * 60 * 1000) },
  { id: 'log-2', userId: 'user-2', action: 'Product Upload', status: 'Success', details: 'Uploaded new product: "Summer Dress"', timestamp: new Date(new Date().getTime() - 15 * 60 * 1000) },
  { id: 'log-3', userId: 'user-3', action: 'Admin Action', status: 'Success', details: 'Updated system settings for promotions', timestamp: new Date(new Date().getTime() - 60 * 60 * 1000) },
  { id: 'log-4', userId: 'user-1', action: 'Login', status: 'Failure', details: 'Failed login attempt from IP 192.168.1.1', timestamp: new Date(new Date().getTime() - 2 * 60 * 60 * 1000) },
  { id: 'log-5', userId: 'user-2', action: 'Payout Request', status: 'Success', details: 'Requested payout of $250.00', timestamp: new Date(new Date().getTime() - 5 * 60 * 60 * 1000) },
];
// --- End Mock Data ---


const UserCell = ({ userId }: { userId: string }) => {
    const user = mockUsers[userId];

    if (!user) {
        return <span className="text-muted-foreground">Unknown User</span>
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
        return timestamp ? formatDistanceToNow(timestamp, { addSuffix: true }) : 'N/A';
    },
  },
];


export default function AdminActivityLogsPage() {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [activityLogs, setActivityLogs] = React.useState(mockActivityLogs); // Use state for mock data
  const isLoading = false; // Data is now static

  const table = useReactTable({
    data: activityLogs,
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
