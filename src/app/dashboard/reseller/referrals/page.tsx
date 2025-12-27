
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
import { Users, BadgeCent, Wallet, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

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
                    <p className="font-medium">{user.fullName}</p>
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
    <Card className={cn(isPrimary ? 'bg-primary/10 border-primary flex flex-col' : 'flex flex-col')}>
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
  const firestore = useFirestore();
  const [referrals, setReferrals] = React.useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

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
  
  const tiers = [
      { name: 'Bronze', points: 350, prize: 'Go Earn T-Shirt', color: 'bg-yellow-700/80' },
      { name: 'Silver', points: 700, prize: 'KES 1,000 Shopping Voucher', color: 'bg-gray-400/80' },
      { name: 'Gold', points: 1000, prize: 'KES 2,500 Cash Prize', color: 'bg-yellow-400/80 text-black' },
  ];

  const table = useReactTable({
    data: referrals,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <ResellerLayout>
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between space-y-4 md:space-y-0">
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
                     <Button size="sm" variant="secondary" className="w-full">
                        Redeem Points (Coming Soon)
                    </Button>
                </StatCard>
            </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Trophy /> Referral Tiers & Rewards</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6">
                {tiers.map(tier => {
                    const progress = Math.min((totalReferralPoints / tier.points) * 100, 100);
                    const achieved = totalReferralPoints >= tier.points;
                    return (
                        <Card key={tier.name} className={cn(achieved && "bg-primary/10 border-primary")}>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle className="flex items-center gap-2">
                                        <Trophy className={cn(achieved ? "text-primary" : "text-muted-foreground")} />
                                        {tier.name}
                                    </CardTitle>
                                    <Badge className={tier.color}>{tier.points} Points</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-xs text-muted-foreground text-center">
                                    {totalReferralPoints} / {tier.points} points
                                </p>
                                <p className="font-semibold text-center">{tier.prize}</p>
                            </CardContent>
                             <CardFooter>
                                <Button className="w-full" disabled={!achieved}>Redeem Prize</Button>
                            </CardFooter>
                        </Card>
                    )
                })}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Referred Users</CardTitle>
            </CardHeader>
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
