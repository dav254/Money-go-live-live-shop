'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const DataTableSkeleton = () => (
    <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    {Array.from({ length: 4 }).map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>)}
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                        {Array.from({ length: 4 }).map((_, j) => <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>)}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);


const columns: ColumnDef<UserProfile>[] = [
  {
    accessorKey: 'fullName',
    header: 'New User',
    cell: ({ row }) => {
        const user = row.original;
        return (
            <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user.profilePictureUrl} />
                    <AvatarFallback>{user.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-medium">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
            </div>
        )
    },
  },
  {
    accessorKey: 'userRole',
    header: 'Role',
    cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.userRole}</Badge>,
  },
  {
    accessorKey: 'joinDate',
    header: 'Registration Date',
    cell: ({ row }) => {
        const date = row.original.joinDate;
        return date ? new Date(date).toLocaleDateString() : 'N/A';
    }
  },
  {
      id: 'points',
      header: () => <div className="text-right">Points Earned</div>,
      cell: () => <div className="text-right font-semibold text-primary">+5</div>
  }
];

export default function ResellerReferralsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const referralsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'userProfiles'), where('referredBy', '==', user.uid), orderBy('joinDate', 'desc'));
  }, [firestore, user]);

  const { data: referrals, isLoading } = useCollection<UserProfile>(referralsQuery);
  
  const table = useReactTable({
    data: referrals || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <ResellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-3xl font-bold tracking-tight flex items-center gap-3">
                    <Users />
                    My Referrals
                </CardTitle>
                <CardDescription>
                    A list of new users who have signed up using your referral link. You earn 5 AI points for each new user.
                </CardDescription>
            </CardHeader>
            <CardContent>
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
                                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                            ))}
                            </TableRow>
                        ))
                        ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                            No referred users found yet. Share your links to get started!
                            </TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                    </Table>
                </div>
                )}
            </CardContent>
        </Card>
      </div>
    </ResellerLayout>
  );
}
