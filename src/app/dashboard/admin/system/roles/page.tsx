
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
import { Input } from '@/components/ui/input';

type UserRole = 'admin' | 'seller' | 'reseller' | 'buyer';

type MockUser = {
    id: string;
    fullName: string;
    username: string;
    email: string;
    profilePictureUrl?: string;
    joinDate: string;
    userRole: UserRole;
};

// --- Mock Data ---
const mockUsers: MockUser[] = [
    { id: '1', fullName: 'Admin User', username: 'admin', email: 'admin@goearn.com', userRole: 'admin', joinDate: '2024-01-01', profilePictureUrl: 'https://picsum.photos/seed/user1/40' },
    { id: '2', fullName: 'Aisha Seller', username: 'aishas_shop', email: 'aisha@example.com', userRole: 'seller', joinDate: '2024-02-15', profilePictureUrl: 'https://picsum.photos/seed/user2/40' },
    { id: '3', fullName: 'Ben Reseller', username: 'ben_sells', email: 'ben@example.com', userRole: 'reseller', joinDate: '2024-03-10', profilePictureUrl: 'https://picsum.photos/seed/user3/40' },
    { id: '4', fullName: 'Charlie Buyer', username: 'charlie_b', email: 'charlie@example.com', userRole: 'buyer', joinDate: '2024-05-20', profilePictureUrl: 'https://picsum.photos/seed/user4/40' },
];
// --- End Mock Data ---


export default function AdminRolesPage() {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const columns: ColumnDef<MockUser>[] = React.useMemo(() => [
        {
            accessorKey: 'fullName',
            header: 'User',
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={row.original.profilePictureUrl} />
                        <AvatarFallback>{row.original.fullName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-medium">{row.getValue('fullName')}</span>
                        <span className="text-xs text-muted-foreground">@{row.original.username}</span>
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'email',
            header: 'Email',
        },
        {
            accessorKey: 'userRole',
            header: 'Role',
            cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.userRole}</Badge>
        },
        {
            accessorKey: 'joinDate',
            header: 'Joined Date',
            cell: ({ row }) => new Date(row.original.joinDate).toLocaleDateString()
        },
    ], []);

    const table = useReactTable({
        data: mockUsers,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: { sorting, columnFilters },
    });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          System: Roles & Permissions
        </h1>
        <div className="flex items-center py-4">
            <Input
              placeholder="Filter by name, email, or role..."
              value={(table.getColumn('fullName')?.getFilterValue() as string) ?? ''}
              onChange={(event) => table.getColumn('fullName')?.setFilterValue(event.target.value)}
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
                    No users found.
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
