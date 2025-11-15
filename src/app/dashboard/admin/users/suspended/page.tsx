
'use client';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import * as React from 'react';
import {
  DotsHorizontalIcon,
} from '@radix-ui/react-icons';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


type SuspendedUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Buyer' | 'Seller' | 'Reseller';
  reason: string;
  suspendedDate: string;
  admin: string;
  avatarUrl: string;
};

const suspendedBuyers: SuspendedUser[] = [
    { id: 'usr-003', name: 'David Otieno', email: 'david.o@example.com', phone: '+254734567890', role: 'Buyer', reason: 'Chargeback fraud', suspendedDate: '2024-05-10', admin: 'AdminJane', avatarUrl: 'https://picsum.photos/seed/user3/40/40' },
];
const suspendedSellers: SuspendedUser[] = [
     { id: 'sel-003', name: 'Gourmet Delights', email: 'owner3@example.com', phone: '+254712345673', role: 'Seller', reason: 'Selling prohibited items', suspendedDate: '2024-08-01', admin: 'AdminJohn', avatarUrl: 'https://picsum.photos/seed/seller3/40/40' },
];
const suspendedResellers: SuspendedUser[] = [
    { id: 'res-004', name: 'Suspended User', email: 'suspended@example.com', phone: '+254744444444', role: 'Reseller', reason: 'Spamming links', suspendedDate: '2024-07-22', admin: 'AdminJane', avatarUrl: 'https://picsum.photos/seed/reseller4/40/40' },
];

export const columns: ColumnDef<SuspendedUser>[] = [
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
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'phone', header: 'Phone' },
  { accessorKey: 'reason', header: 'Reason for Suspension' },
  { accessorKey: 'suspendedDate', header: 'Suspended Date' },
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
          <DropdownMenuItem className="text-green-600">Unsuspend Account</DropdownMenuItem>
          <DropdownMenuItem>View Profile</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">Delete Permanently</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];


const SuspendedTable = ({ data }: { data: SuspendedUser[] }) => {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
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
                        No suspended users in this category.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
        </div>
    );
}

export default function AdminSuspendedPage() {
  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          User Management: Suspended Accounts
        </h1>
        <Tabs defaultValue="buyers">
          <TabsList>
            <TabsTrigger value="buyers">Buyers</TabsTrigger>
            <TabsTrigger value="sellers">Sellers</TabsTrigger>
            <TabsTrigger value="resellers">Resellers</TabsTrigger>
          </TabsList>
          <TabsContent value="buyers" className="mt-4">
            <Card>
                <CardContent className="p-4">
                    <SuspendedTable data={suspendedBuyers} />
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="sellers" className="mt-4">
             <Card>
                <CardContent className="p-4">
                    <SuspendedTable data={suspendedSellers} />
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="resellers" className="mt-4">
             <Card>
                <CardContent className="p-4">
                    <SuspendedTable data={suspendedResellers} />
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
