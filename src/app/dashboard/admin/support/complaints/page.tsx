
'use client';

import * as React from 'react';
import { firestoreDate } from '@/lib/firestore-date';
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
import { collection, query, doc, updateDoc, orderBy } from 'firebase/firestore';
import type { Complaint, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const UserCell = ({ userId }: { userId: string }) => {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', userId), [firestore, userId]);
  const { data: user, isLoading } = useDoc<UserProfile>(userRef);

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

export default function AdminComplaintsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const { toast } = useToast();
  const adminReady = !!user && !isProfileLoading &&
    (userProfile?.userRole === 'admin' || userProfile?.role === 'admin');


  const complaintsQuery = useMemoFirebase(() => {
    if (!firestore || !adminReady) return null;
    return query(collection(firestore, 'complaints'), orderBy('createdAt', 'desc'));
  }, [firestore, adminReady]);

  const { data: complaints, isLoading } = useCollection<Complaint>(complaintsQuery);

  const handleStatusUpdate = async (complaintId: string, status: 'investigating' | 'resolved' | 'dismissed') => {
    const complaintRef = doc(firestore, 'complaints', complaintId);
    try {
      await updateDoc(complaintRef, { status });
      toast({ title: 'Success', description: `Complaint status updated to ${status}.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update complaint status.' });
    }
  };

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Support & Moderation: Resolve Complaints
        </h1>
        {isLoading ? <DataTableSkeleton /> : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Complainant</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complaints && complaints.length > 0 ? (
                  complaints.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell><UserCell userId={c.complainantId || 'unknown'} /></TableCell>
                      <TableCell><UserCell userId={c.targetId || 'unknown'} /></TableCell>
                      <TableCell><Badge variant="secondary">{c.reason}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'resolved' ? 'default' : 'outline'} className={`capitalize ${c.status === 'resolved' ? 'bg-green-600/80' : ''}`}>
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
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleStatusUpdate(c.id, 'investigating')}>Mark as Investigating</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusUpdate(c.id, 'resolved')}>Mark as Resolved</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusUpdate(c.id, 'dismissed')}>Dismiss</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No complaints found.
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

    