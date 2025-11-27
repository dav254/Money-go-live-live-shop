
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
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

type ActivityLog = {
  id: string;
  user: {
    name: string;
    avatar: string;
    role: 'seller' | 'buyer' | 'reseller';
  };
  action: 'Login' | 'Product Upload' | 'Order Placed' | 'Profile Update' | 'Payout Request';
  status: 'Success' | 'Failure';
  details: string;
  timestamp: string;
};

// --- Mock Data ---
const mockActivityLogs: ActivityLog[] = [
  { id: 'log-1', user: { name: 'Aisha K.', avatar: 'https://picsum.photos/seed/user1/40', role: 'seller' }, action: 'Product Upload', status: 'Success', details: 'Uploaded "Classic Leather Handbag"', timestamp: '2 minutes ago' },
  { id: 'log-2', user: { name: 'Ben O.', avatar: 'https://picsum.photos/seed/user2/40', role: 'buyer' }, action: 'Order Placed', status: 'Success', details: 'Order #ORD-123 for $850', timestamp: '5 minutes ago' },
  { id: 'log-3', user: { name: 'Charlie D.', avatar: 'https://picsum.photos/seed/user3/40', role: 'reseller' }, action: 'Payout Request', status: 'Success', details: 'Requested $250.00', timestamp: '1 hour ago' },
  { id: 'log-4', user: { name: 'David E.', avatar: 'https://picsum.photos/seed/user4/40', role: 'buyer' }, action: 'Login', status: 'Success', details: 'From Nairobi, Kenya', timestamp: '2 hours ago' },
  { id: 'log-5', user: { name: 'Aisha K.', avatar: 'https://picsum.photos/seed/user1/40', role: 'seller' }, action: 'Profile Update', status: 'Success', details: 'Updated shop description', timestamp: 'Yesterday' },
  { id: 'log-6', user: { name: 'Frank G.', avatar: 'https://picsum.photos/seed/user5/40', role: 'buyer' }, action: 'Login', status: 'Failure', details: 'Failed login attempt', timestamp: 'Yesterday' },
];
// --- End Mock Data ---


const columns: ColumnDef<ActivityLog>[] = [
  {
    accessorKey: 'user',
    header: 'User',
    cell: ({ row }) => {
        const user = row.original.user;
        return (
             <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                </div>
            </div>
        )
    },
    filterFn: (row, id, value) => {
      return row.original.user.name.toLowerCase().includes(value.toLowerCase());
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
  },
];


export default function AdminActivityLogsPage() {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: mockActivityLogs,
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
                placeholder="Filter by user name..."
                value={(table.getColumn('user')?.getFilterValue() as string) ?? ''}
                onChange={(event) =>
                    table.getColumn('user')?.setFilterValue(event.target.value)
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

