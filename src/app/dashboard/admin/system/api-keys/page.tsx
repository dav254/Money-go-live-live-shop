
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
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';


type ApiKey = {
  id: string;
  key: string;
  service: string;
  status: 'active' | 'revoked';
  created: string;
  expires: string;
};

// --- Mock Data ---
const mockApiKeys: ApiKey[] = [
  { id: 'key-1', key: 'pk_test_************************', service: 'Paystack', status: 'active', created: '2024-01-15', expires: 'Never' },
  { id: 'key-2', key: 'sk_live_************************', service: 'Mux', status: 'active', created: '2024-03-20', expires: 'Never' },
  { id: 'key-3', key: 'AIzaSy**************************', service: 'Google Maps', status: 'active', created: '2023-11-01', expires: '2024-11-01' },
  { id: 'key-4', key: '845*****************************', service: 'Cloudinary', status: 'revoked', created: '2023-09-10', expires: '2024-09-10' },
];
// --- End Mock Data ---


export const columns: ColumnDef<ApiKey>[] = [
  {
    accessorKey: 'key',
    header: 'Key',
    cell: ({ row }) => <div className="font-mono text-xs">{row.original.key}</div>,
  },
  {
    accessorKey: 'service',
    header: 'Service',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      return <Badge variant={status === 'active' ? 'default' : 'destructive'} className={`capitalize ${status === 'active' ? 'bg-green-600/80' : ''}`}>{status}</Badge>;
    },
  },
  {
    accessorKey: 'created',
    header: 'Created',
  },
   {
    accessorKey: 'expires',
    header: 'Expires',
  },
  {
      id: 'actions',
      cell: ({row}) => (
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem>Edit Key</DropdownMenuItem>
              <DropdownMenuItem>Revoke Key</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Delete Key</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      )
  }
];

export default function AdminApiKeysPage() {
  const table = useReactTable({
    data: mockApiKeys,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
                System & Settings: API Keys
            </h1>
            <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New API Key
            </Button>
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
                        No API keys configured.
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
