
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
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

type Referral = {
  newUser: UserProfile;
  referrer: UserProfile;
};

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


const columns: ColumnDef<Referral>[] = [
  {
    header: 'New User',
    cell: ({ row }) => {
        const user = row.original.newUser;
        return (
            <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user.profilePictureUrl} />
                    <AvatarFallback>{user.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <Link href={`/dashboard/admin/users/buyers?id=${user.id}`} className="font-medium hover:underline">{user.fullName}</Link>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
            </div>
        )
    },
  },
  {
    header: 'Referred By',
     cell: ({ row }) => {
        const referrer = row.original.referrer;
        return (
             <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={referrer.profilePictureUrl} />
                    <AvatarFallback>{referrer.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <Link href={`/dashboard/admin/users/resellers?id=${referrer.id}`} className="font-medium hover:underline">{referrer.fullName}</Link>
                    <p className="text-xs text-muted-foreground">{referrer.email}</p>
                </div>
            </div>
        )
    },
  },
   {
    header: 'New User Role',
    cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.newUser.userRole}</Badge>,
  },
  {
    header: 'Registration Date',
    cell: ({ row }) => {
        const date = row.original.newUser.joinDate;
        return date ? new Date(date).toLocaleDateString() : 'N/A';
    }
  },
];

export default function AdminReferralsPage() {
  const firestore = useFirestore();
  const [referrals, setReferrals] = React.useState<Referral[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // 1. Fetch all users who have a 'referredBy' field.
  const referredUsersQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'userProfiles'), where('referredBy', '!=', null));
  }, [firestore]);

  const { data: referredUsers, isLoading: isLoadingReferred } = useCollection<UserProfile>(referredUsersQuery);

  // 2. Once we have the referred users, fetch the profiles of the referrers.
  React.useEffect(() => {
    if (isLoadingReferred || !referredUsers) {
      return;
    }
    
    if (referredUsers.length === 0) {
        setReferrals([]);
        setIsLoading(false);
        return;
    }

    const fetchReferrers = async () => {
      const referrerIds = [...new Set(referredUsers.map(u => u.referredBy).filter(Boolean) as string[])];
      
      if (referrerIds.length === 0) {
        setReferrals([]);
        setIsLoading(false);
        return;
      }
      
      const referrersQuery = query(collection(firestore, 'userProfiles'), where('id', 'in', referrerIds));
      const querySnapshot = await getDocs(referrersQuery);
      const referrersMap = new Map(querySnapshot.docs.map(doc => [doc.id, doc.data() as UserProfile]));

      const combinedData = referredUsers.map(newUser => {
          const referrer = newUser.referredBy ? referrersMap.get(newUser.referredBy) : undefined;
          return { newUser, referrer };
      }).filter(item => item.referrer) as Referral[];

      setReferrals(combinedData);
      setIsLoading(false);
    };

    fetchReferrers();

  }, [referredUsers, isLoadingReferred, firestore]);
  

  const table = useReactTable({
    data: referrals,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          User Management: Referrals
        </h1>
        <p className="text-muted-foreground">
            This table shows all new users who have signed up using a reseller's referral link.
        </p>
         <div className="w-full">
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
                      No referred users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
