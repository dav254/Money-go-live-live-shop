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
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, doc, updateDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function AdminRolesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'userProfiles')), [firestore]);
    const { data: users, isLoading } = useCollection<UserProfile>(usersQuery);

    const handleRoleChange = async (userId: string, newRole: UserProfile['userRole']) => {
        const userDocRef = doc(firestore, 'userProfiles', userId);
        try {
            await updateDoc(userDocRef, { userRole: newRole });
            toast({
                title: 'Role Updated',
                description: `User has been assigned the ${newRole} role.`,
            });
        } catch (error) {
            console.error("Failed to update role:", error);
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: 'Could not update user role. Check console for errors.',
            });
        }
    };

    const columns: ColumnDef<UserProfile>[] = React.useMemo(() => [
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
            cell: ({ row }) => row.original.joinDate ? new Date(row.original.joinDate).toLocaleDateString() : 'N/A'
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const user = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <DotsHorizontalIcon className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'buyer')}>Set as Buyer</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'seller')}>Set as Seller</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'reseller')}>Set as Reseller</DropdownMenuItem>
                            {/* Admin changes go through the Admins section, which enforces the last-admin and self-demotion guards this screen cannot. */}
                            <DropdownMenuItem onClick={() => router.push('/dashboard/admin/users/admins')}>Set as Admin…</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            }
        }
    ], [handleRoleChange]);

    const table = useReactTable({
        data: users || [],
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
                {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">Loading users...</TableCell>
                    </TableRow>
                ) : table.getRowModel().rows?.length ? (
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
