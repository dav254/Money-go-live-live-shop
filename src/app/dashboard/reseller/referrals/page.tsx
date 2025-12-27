
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
import { Users, BadgeCent, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const columns: ColumnDef<UserProfile>[] = [
  {
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
                    <Link href={`/dashboard/admin/users/buyers?id=${user.id}`} className="font-medium hover:underline">{user.fullName}</Link>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                </div>
            </div>
        )
    },
  },
  {
    header: 'Role',
    accessorKey: 'userRole',
    cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.userRole}</Badge>,
  },
  {
    header: 'Registration Date',
    accessorKey: 'joinDate',
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

const StatCard = ({ title, value, icon: Icon, isLoading, isPrimary, children }: { title: string, value: string, icon: React.ElementType, isLoading: boolean, isPrimary?: boolean, children?: React.ReactNode }) => (
    <Card className={isPrimary ? 'bg-primary/10 border-primary flex flex-col' : 'flex flex-col'}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <Skeleton className="h-8 w-3/4" />
        ) : (
            <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
       {children && <CardFooter className="mt-auto">{children}</CardFooter>}
    </Card>
);

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


export default function ResellerReferralsPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const [referrals, setReferrals] = React.useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // 1. Fetch all users who have a 'referredBy' field.
  const referredUsersQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'userProfiles'), where('referredBy', '==', user.uid));
  }, [user, firestore]);

  const { data: referredUsers, isLoading: areUsersLoading } = useCollection<UserProfile>(referredUsersQuery);
  
  React.useEffect(() => {
    if (areUsersLoading) {
      setIsLoading(true);
    } else {
      setReferrals(referredUsers || []);
      setIsLoading(false);
    }
  }, [referredUsers, areUsersLoading]);

  const totalReferralPoints = (referrals?.length || 0) * 5;

  const table = useReactTable({
    data: referrals,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <ResellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight flex items-center gap-3">
                <Users />
                My Referrals
            </h1>
            <p className="text-muted-foreground">
                Users who have signed up using your referral link. You earn 5 AI points for each new user.
            </p>
          </div>
           <div className="grid grid-cols-1 gap-4">
                <StatCard 
                    title="Total Referral Earnings"
                    value={`${totalReferralPoints.toLocaleString()} Points`}
                    icon={BadgeCent}
                    isLoading={isLoading}
                    isPrimary
                >
                     <Button size="sm" variant="outline" className="w-full" asChild>
                        <Link href="/dashboard/reseller/wallet">
                            <Wallet className="mr-2 h-4 w-4" /> Withdraw
                        </Link>
                    </Button>
                </StatCard>
            </div>
        </div>

        <Card>
            <CardContent className="p-0">
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
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    Loading your referrals...
                                </TableCell>
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
