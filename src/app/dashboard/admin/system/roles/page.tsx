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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, doc, updateDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

const RoleSelector = ({ user, currentRole }: { user: UserProfile, currentRole: string }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isUpdating, setIsUpdating] = React.useState(false);
    
    const handleRoleChange = async (newRole: string) => {
        if (!firestore || newRole === currentRole) return;

        setIsUpdating(true);
        const userRef = doc(firestore, 'userProfiles', user.id);
        try {
            await updateDoc(userRef, { userRole: newRole });
            toast({ title: 'Success!', description: `${user.fullName}'s role has been updated to ${newRole}.`});
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update user role.' });
            console.error(error);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Select onValueChange={handleRoleChange} defaultValue={currentRole} disabled={isUpdating}>
            <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="seller">Seller</SelectItem>
                <SelectItem value="reseller">Reseller</SelectItem>
                <SelectItem value="buyer">Buyer</SelectItem>
            </SelectContent>
        </Select>
    );
};


const DataTableSkeleton = () => (
    <div className="rounded-md border">
        <Table>
        <TableHeader>
            <TableRow>
            {['User', 'Email', 'Role', 'Joined'].map((h) => <TableHead key={h}><Skeleton className="h-5 w-full" /></TableHead>)}
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
                {[...Array(4)].map((_, j) => <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>)}
            </TableRow>
            ))}
        </TableBody>
        </Table>
    </div>
);

export default function AdminRolesPage() {
    const firestore = useFirestore();
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'userProfiles')), [firestore]);
    const { data: users, isLoading } = useCollection<UserProfile>(usersQuery);

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
            cell: ({ row }) => <RoleSelector user={row.original} currentRole={row.original.userRole} />
        },
        {
            accessorKey: 'joinDate',
            header: 'Joined Date',
            cell: ({ row }) => row.original.joinDate ? new Date(row.original.joinDate).toLocaleDateString() : 'N/A'
        },
    ], []);

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
        {isLoading ? <DataTableSkeleton /> : (
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
        )}
      </div>
    </AdminLayout>
  );
}
