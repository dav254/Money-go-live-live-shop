'use client';

import * as React from 'react';
import {
  CaretSortIcon,
  DotsHorizontalIcon,
} from '@radix-ui/react-icons';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
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
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type VerificationRequest = UserProfile;

const DataTableSkeleton = () => (
    <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    {Array.from({ length: 6 }).map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>)}
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);


export default function AdminVerificationPage() {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'joinDate', desc: true },
  ]);
  const firestore = useFirestore();
  const { toast } = useToast();

  const verificationQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'userProfiles'), where('verificationStatus', '==', 'pending'));
  }, [firestore]);

  const { data: requests, isLoading } = useCollection<VerificationRequest>(verificationQuery);
  
  const handleVerification = async (userId: string, newStatus: 'verified' | 'rejected') => {
      if (!firestore) return;
      const userRef = doc(firestore, 'userProfiles', userId);
      try {
          await updateDoc(userRef, { verificationStatus: newStatus });
          toast({
              title: `User ${newStatus}`,
              description: `The user has been successfully ${newStatus}.`
          });
      } catch (error) {
          toast({
              variant: 'destructive',
              title: 'Update failed',
              description: 'Could not update user verification status.'
          });
          console.error("Verification update error:", error);
      }
  };

  const columns: ColumnDef<VerificationRequest>[] = React.useMemo(() => [
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
                  <span className="text-xs text-muted-foreground">{row.original.email}</span>
              </div>
          </div>
      ),
    },
    {
      accessorKey: 'userRole',
      header: 'User Role',
       cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.getValue('userRole')}</Badge>,
    },
    {
      accessorKey: 'documents',
      header: 'Documents Uploaded',
      cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">National ID</Badge>
              <Badge variant="secondary">Business Permit</Badge>
          </div>
      ),
    },
    {
      accessorKey: 'joinDate',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Submitted
          <CaretSortIcon className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => new Date(row.original.joinDate).toLocaleDateString(),
    },
    {
      accessorKey: 'verificationStatus',
      header: 'Status',
      cell: ({ row }) => <Badge variant="secondary" className="bg-yellow-500/80 capitalize">{row.getValue('verificationStatus')}</Badge>,
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
            <DropdownMenuItem className="text-green-600" onClick={() => handleVerification(row.original.id, 'verified')}>
                Approve Request
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => handleVerification(row.original.id, 'rejected')}>
                Reject Request
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [firestore]);
  
  const table = useReactTable({
    data: requests || [],
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
          User Management: Verification Requests ({requests?.length || 0})
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
        )}
      </div>
    </AdminLayout>
  );
}