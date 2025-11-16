
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
import { sellers } from '@/lib/placeholder-data';


type Buyer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  ordersCount: number;
  walletBalance: number;
  joinedDate: string;
  status: 'active' | 'suspended';
  avatarUrl: string;
};

const data: Buyer[] = [
    { id: 'usr-001', name: 'John Doe', email: 'john.d@example.com', phone: '+254712345678', ordersCount: 12, walletBalance: 550.00, joinedDate: '2024-08-15', status: 'active', avatarUrl: 'https://picsum.photos/seed/user1/40/40' },
    { id: 'usr-002', name: 'Amina Kamau', email: 'amina.k@example.com', phone: '+254723456789', ordersCount: 5, walletBalance: 1250.75, joinedDate: '2024-07-20', status: 'active', avatarUrl: 'https://picsum.photos/seed/user2/40/40' },
    { id: 'usr-003', name: 'David Otieno', email: 'david.o@example.com', phone: '+254734567890', ordersCount: 0, walletBalance: 0.00, joinedDate: '2024-06-01', status: 'suspended', avatarUrl: 'https://picsum.photos/seed/user3/40/40' },
    { id: 'usr-004', name: 'Grace Mwende', email: 'grace.m@example.com', phone: '+254745678901', ordersCount: 25, walletBalance: 8200.00, joinedDate: '2023-11-11', status: 'active', avatarUrl: 'https://picsum.photos/seed/user4/40/40' },
];

export const columns: ColumnDef<Buyer>[] = [
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
    accessorKey: 'name',
    header: 'Profile',
    cell: ({ row }) => (
        <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
                <AvatarImage src={row.original.avatarUrl} />
                <AvatarFallback>{row.original.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{row.getValue('name')}</span>
        </div>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
   {
    accessorKey: 'phone',
    header: 'Phone',
  },
  {
    accessorKey: 'ordersCount',
    header: 'Orders',
    cell: ({ row }) => <div className="text-center">{row.getValue('ordersCount')}</div>,
  },
  {
    accessorKey: 'walletBalance',
    header: ({ column }) => (
        <div className="text-right">
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                Wallet Balance
                <CaretSortIcon className="ml-2 h-4 w-4" />
            </Button>
        </div>
    ),
    cell: ({ row }) => <div className="text-right">{row.original.walletBalance.toLocaleString()}</div>,
  },
  {
    accessorKey: 'joinedDate',
    header: 'Joined Date',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
        const status = row.getValue('status') as string;
        return <Badge variant={status === 'active' ? 'default' : 'destructive'} className={status === 'active' ? 'bg-green-600/80' : ''}>{status}</Badge>;
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
          <DropdownMenuItem>View Profile</DropdownMenuItem>
          <DropdownMenuItem>View Orders</DropdownMenuItem>
          <DropdownMenuItem>Send Notification</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-yellow-600">Suspend</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function AdminBuyersPage() {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          User Management: Buyers
        </h1>
         <div className="w-full">
            <div className="flex items-center py-4">
                <Input
                placeholder="Filter by name, email, or phone..."
                value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
                onChange={(event) =>
                    table.getColumn('name')?.setFilterValue(event.target.value)
                }
                className="max-w-sm"
                />
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="ml-auto">
                    Columns <ChevronDownIcon className="ml-2 h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => {
                        return (
                        <DropdownMenuItem
                            key={column.id}
                            className="capitalize"
                            onSelect={(e) => {
                                e.preventDefault();
                                column.toggleVisibility(!column.getIsVisible())
                            }}
                        >
                            <Checkbox
                                checked={column.getIsVisible()}
                                className="mr-2"
                            />
                            {column.id}
                        </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="rounded-md border">
                <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                        return (
                            <TableHead key={header.id}>
                            {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                )}
                            </TableHead>
                        );
                        })}
                    </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                        <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                        >
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
                        <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                        >
                        No results.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                {table.getFilteredSelectedRowModel().rows.length} of{' '}
                {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <div className="space-x-2">
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
      </div>
    </AdminLayout>
  );
}
