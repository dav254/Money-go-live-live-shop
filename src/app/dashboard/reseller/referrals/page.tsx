
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
import type { UserProfile } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Mock data for referred users
const mockReferredUsers: UserProfile[] = [
    { 
        id: 'user1', 
        uid: 'user1', 
        fullName: 'Alice Johnson', 
        username: 'alicej', 
        email: 'alice@example.com', 
        userRole: 'buyer', 
        joinDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        aiPoints: 0,
        createdAt: new Date() as any,
        status: 'active',
    },
    { 
        id: 'user2', 
        uid: 'user2', 
        fullName: 'Bob Williams', 
        username: 'bobw', 
        email: 'bob@example.com', 
        userRole: 'seller', 
        joinDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        aiPoints: 0,
        createdAt: new Date() as any,
        status: 'active',
    },
    { 
        id: 'user3', 
        uid: 'user3', 
        fullName: 'Charlie Brown', 
        username: 'charlieb', 
        email: 'charlie@example.com', 
        userRole: 'buyer', 
        joinDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        aiPoints: 0,
        createdAt: new Date() as any,
        status: 'active',
    },
];

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
  const table = useReactTable({
    data: mockReferredUsers,
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
            </CardContent>
        </Card>
      </div>
    </ResellerLayout>
  );
}
