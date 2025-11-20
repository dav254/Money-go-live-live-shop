
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import * as React from 'react';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
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
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

// Combine UserProfile with suspension-specific data if needed in the future
type SuspendedUser = UserProfile & {
  reason?: string; // Placeholder for future use
  suspendedDate?: string; // Placeholder for future use
  admin?: string; // Placeholder for future use
};

export const columns: ColumnDef<SuspendedUser>[] = [
  {
    accessorKey: 'fullName',
    header: 'Profile',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={row.original.profilePictureUrl} />
          <AvatarFallback>{row.original.fullName?.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="font-medium">{row.getValue('fullName')}</span>
      </div>
    ),
  },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'phoneNumber', header: 'Phone' },
  { accessorKey: 'reason', header: 'Reason for Suspension', cell: () => 'Not specified' },
  { accessorKey: 'suspendedDate', header: 'Suspended Date', cell: () => 'N/A' },
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
          <DropdownMenuItem className="text-green-600">
            Unsuspend Account
          </DropdownMenuItem>
          <DropdownMenuItem>View Profile</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">
            Delete Permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

const SuspendedTable = ({
  data,
  isLoading,
}: {
  data: SuspendedUser[];
  isLoading: boolean;
}) => {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
        <div className="rounded-md border">
            <Table>
                 <TableHeader>
                    <TableRow>
                        {columns.map((col) => <TableHead key={col.id || col.accessorKey}><Skeleton className="h-5 w-full" /></TableHead>)}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                             {columns.map((col) => <TableCell key={col.id || col.accessorKey}><Skeleton className="h-6 w-full" /></TableCell>)}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
  }

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
};

export default function AdminSuspendedPage() {
  const firestore = useFirestore();

  const suspendedUsersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'userProfiles'),
      where('status', '==', 'suspended')
    );
  }, [firestore]);

  const { data: suspendedUsers, isLoading } = useCollection<SuspendedUser>(suspendedUsersQuery);

  const suspendedBuyers = React.useMemo(
    () => suspendedUsers?.filter((u) => u.userRole === 'buyer') || [],
    [suspendedUsers]
  );
  const suspendedSellers = React.useMemo(
    () => suspendedUsers?.filter((u) => u.userRole === 'seller') || [],
    [suspendedUsers]
  );
  const suspendedResellers = React.useMemo(
    () => suspendedUsers?.filter((u) => u.userRole === 'reseller') || [],
    [suspendedUsers]
  );

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
                <SuspendedTable data={suspendedBuyers} isLoading={isLoading} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="sellers" className="mt-4">
            <Card>
              <CardContent className="p-4">
                <SuspendedTable data={suspendedSellers} isLoading={isLoading} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="resellers" className="mt-4">
            <Card>
              <CardContent className="p-4">
                <SuspendedTable data={suspendedResellers} isLoading={isLoading} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
