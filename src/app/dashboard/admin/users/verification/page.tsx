
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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


type VerificationRequest = {
  id: string;
  name: string;
  email: string;
  role: 'Seller' | 'Reseller';
  documents: string[];
  submittedDate: string;
  status: 'pending';
  avatarUrl: string;
};

const data: VerificationRequest[] = [
    { id: 'vr-001', name: 'Pending Seller', email: 'pending.seller@example.com', role: 'Seller', documents: ['National ID', 'Business Permit'], submittedDate: '2024-08-25', status: 'pending', avatarUrl: 'https://picsum.photos/seed/pending-seller/40/40'},
    { id: 'vr-002', name: 'Digital Nomad', email: 'dnomad@example.com', role: 'Reseller', documents: ['National ID'], submittedDate: '2024-08-24', status: 'pending', avatarUrl: 'https://picsum.photos/seed/reseller3/40/40'},
    { id: 'vr-003', name: 'New Boutique', email: 'new.boutique@example.com', role: 'Seller', documents: ['National ID', 'Business Permit', 'KRA Pin'], submittedDate: '2024-08-22', status: 'pending', avatarUrl: 'https://picsum.photos/seed/new-boutique/40/40'},
];

export const columns: ColumnDef<VerificationRequest>[] = [
  {
    accessorKey: 'name',
    header: 'User',
    cell: ({ row }) => (
        <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
                <AvatarImage src={row.original.avatarUrl} />
                <AvatarFallback>{row.original.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
                <span className="font-medium">{row.getValue('name')}</span>
                <span className="text-xs text-muted-foreground">{row.original.email}</span>
            </div>
        </div>
    ),
  },
  {
    accessorKey: 'role',
    header: 'User Role',
     cell: ({ row }) => <Badge variant="outline">{row.getValue('role')}</Badge>,
  },
  {
    accessorKey: 'documents',
    header: 'Documents Uploaded',
    cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
            {(row.getValue('documents') as string[]).map(doc => <Badge key={doc} variant="secondary">{doc}</Badge>)}
        </div>
    ),
  },
  {
    accessorKey: 'submittedDate',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Submitted
        <CaretSortIcon className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge variant="secondary" className="bg-yellow-500/80">{row.getValue('status')}</Badge>,
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
          <DropdownMenuItem>View Documents</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-green-600">Approve Request</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">Reject Request</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function AdminVerificationPage() {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'submittedDate', desc: true },
  ]);
  
  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          User Management: Verification Requests
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
                          : flexRender(header.column.columnDef.header, header.getContext())}
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
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No pending verification requests.
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
