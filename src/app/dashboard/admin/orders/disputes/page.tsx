
'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
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
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Order, UserProfile } from '@/lib/types';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

const UserCell = ({ userId, label }: { userId: string; label: string }) => {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', userId), [
    firestore,
    userId,
  ]);
  const { data: user, isLoading } = useDoc<UserProfile>(userRef);
  if (isLoading) return <Skeleton className="h-8 w-24" />;
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarImage src={user?.profilePictureUrl} />
        <AvatarFallback>{user?.fullName?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-xs">{user?.fullName}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
};

const DataTableSkeleton = () => (
  <div className="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Participants</TableHead>
          <TableHead>Dispute Reason</TableHead>
          <TableHead className="text-right">Amount (USD)</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 3 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className="h-5 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-12 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-48" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="h-5 w-16 ml-auto" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-8 w-20 ml-auto" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export default function AdminDisputesPage() {
  const firestore = useFirestore();

  const disputesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('orderStatus', '==', 'disputed')
    );
  }, [firestore]);

  const { data: disputes, isLoading } = useCollection<Order>(disputesQuery);

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Orders & Transactions: Refunds & Disputes
        </h1>
        {isLoading ? (
          <DataTableSkeleton />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Dispute Reason</TableHead>
                  <TableHead className="text-right">Amount (USD)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes && disputes.length > 0 ? (
                  disputes.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-medium text-xs text-muted-foreground">
                          #{order.id.substring(0, 6)}...
                        </div>
                        <div className="text-sm">{order.productName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <UserCell userId={order.buyerId} label="Buyer" />
                          <UserCell userId={order.sellerId} label="Seller" />
                        </div>
                      </TableCell>
                       <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {order.disputeReason || 'No reason provided.'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${(order.totalAmount ?? order.productPrice ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <DotsHorizontalIcon className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>View Order Details</DropdownMenuItem>
                            <DropdownMenuItem>Contact Buyer</DropdownMenuItem>
                            <DropdownMenuItem>Contact Seller</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Mark as Resolved</DropdownMenuItem>
                            <DropdownMenuItem className="text-yellow-600">
                              Refund Buyer
                            </DropdownMenuItem>
                             <DropdownMenuItem className="text-destructive">
                              Suspend Seller
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center"
                    >
                      No active disputes.
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
