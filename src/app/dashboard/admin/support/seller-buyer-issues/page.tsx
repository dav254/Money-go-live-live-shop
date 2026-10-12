'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser, useUserProfile } from '@/firebase';
import { collection, query, doc, updateDoc, where, orderBy } from 'firebase/firestore';
import type { Complaint, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { firestoreDate } from '@/lib/firestore-date';

const UserCell = ({ userId }: { userId: string | undefined }) => {
  const firestore = useFirestore();
  const ref = useMemoFirebase(() => userId ? doc(firestore, 'userProfiles', userId) : null, [firestore, userId]);
  const { data: user, isLoading } = useDoc<UserProfile>(ref);

  if (!userId) return <span className="text-muted-foreground">—</span>;
  if (isLoading) return <Skeleton className="h-8 w-24" />;
  return <div className="font-medium">{user?.fullName || userId}</div>;
};

const DataTableSkeleton = () => (
  <div className="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: 6 }).map((_, i) => (
            <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: 6 }).map((_, j) => (
              <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export default function AdminSellerBuyerIssuesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const { toast } = useToast();

  const adminReady = !!user && !isProfileLoading &&
    (userProfile?.userRole === 'admin' || userProfile?.role === 'admin');

  const recentQuery = useMemoFirebase(() => {
    if (!firestore || !adminReady) return null;
    return query(collection(firestore, 'complaints'), orderBy('createdAt', 'desc'));
  }, [firestore, adminReady]);
  const { data: recent, isLoading: recentLoading } = useCollection<Complaint>(recentQuery);

  const sellerComplaintsQuery = useMemoFirebase(() => {
    if (!firestore || !adminReady) return null;
    return query(
      collection(firestore, 'complaints'),
      where('targetType', '==', 'user'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, adminReady]);
  const { data: sellerReports, isLoading: sellerLoading } = useCollection<Complaint>(sellerComplaintsQuery);

  const filtered = React.useMemo(() => {
    const rows = recent ?? sellerReports ?? [];
    return rows
      .filter((row) => !row.targetType || row.targetType === 'user' || row.targetType === 'order')
      .slice(0, 50);
  }, [recent, sellerReports]);

  const handleStatusUpdate = async (complaintId: string, status: 'investigating' | 'resolved' | 'dismissed') => {
    const complaintRef = doc(firestore, 'complaints', complaintId);
    try {
      await updateDoc(complaintRef, { status, resolvedAt: new Date() });
      toast({ title: 'Updated', description: `Issue marked as ${status}.` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update issue status.' });
    }
  };

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Support & Moderation: Seller & Buyer Issues
        </h1>
        <p className="text-sm text-muted-foreground">
          Recent issues filed by sellers or buyers. This includes reports about other users, orders and content.
        </p>

        {recentLoading || sellerLoading ? (
          <DataTableSkeleton />
        ) : filtered.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><UserCell userId={c.complainantId} /></TableCell>
                    <TableCell><UserCell userId={c.targetId} /></TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {c.targetType === 'order' ? 'Order' : c.targetType === 'product' ? 'Product' : c.targetType === 'user' ? 'User' : 'Other'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{c.reason || c.description || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'resolved' ? 'default' : 'outline'} className={c.status === 'resolved' ? 'bg-green-600/80' : ''}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{firestoreDate(c.createdAt)?.toLocaleDateString() ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <DotsHorizontalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleStatusUpdate(c.id!, 'investigating')}>Mark as Investigating</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusUpdate(c.id!, 'resolved')}>Mark as Resolved</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleStatusUpdate(c.id!, 'dismissed')}>Dismiss</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
            No seller or buyer issues found.
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
