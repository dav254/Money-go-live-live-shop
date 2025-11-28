
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
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, updateDoc, orderBy } from 'firebase/firestore';
import type { AIPosterRequest, UserProfile, Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';

const UserCell = ({ userId }: { userId: string }) => {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', userId), [firestore, userId]);
  const { data: user, isLoading } = useDoc<UserProfile>(userRef);

  if (isLoading) return <Skeleton className="h-5 w-24" />;
  return <div className="font-medium">{user?.fullName || userId}</div>;
};

const ProductCell = ({ productId }: { productId: string }) => {
  const firestore = useFirestore();
  const productRef = useMemoFirebase(() => doc(firestore, 'products', productId), [firestore, productId]);
  const { data: product, isLoading } = useDoc<Product>(productRef);

  if (isLoading) return <Skeleton className="h-10 w-24" />;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-10 w-10 rounded-md overflow-hidden">
        {product?.imageUrl && <Image src={product.imageUrl} alt={product.name || 'product'} fill className="object-cover" />}
      </div>
      <span>{product?.name}</span>
    </div>
  );
};


const DataTableSkeleton = () => (
  <div className="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: 5 }).map((_, j) => (
              <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export default function AdminAIPostersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const requestsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'aiPosterRequests'), orderBy('requestedAt', 'desc'));
  }, [firestore]);

  const { data: requests, isLoading } = useCollection<AIPosterRequest>(requestsQuery);

  const handleStatusUpdate = async (requestId: string, status: 'approved' | 'rejected') => {
    const requestRef = doc(firestore, 'aiPosterRequests', requestId);
    try {
      await updateDoc(requestRef, { status });
      toast({ title: 'Success', description: `Request has been ${status}.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update request status.' });
    }
  };

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Marketing & Growth: AI Poster Requests
        </h1>
        {isLoading ? <DataTableSkeleton /> : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requester</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests && requests.length > 0 ? (
                  requests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell><UserCell userId={req.userId} /></TableCell>
                      <TableCell><ProductCell productId={req.productId} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{req.prompt}</TableCell>
                      <TableCell>
                        <Badge
                          variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'}
                          className={`capitalize ${req.status === 'approved' ? 'bg-green-600/80' : ''}`}
                        >
                          {req.status}
                        </Badge>
                      </TableCell>
                       <TableCell className="text-sm text-muted-foreground">
                        {req.requestedAt ? formatDistanceToNow(req.requestedAt.toDate(), { addSuffix: true }) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {req.status === 'pending' && (
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(req.id, 'rejected')}>Reject</Button>
                            <Button size="sm" onClick={() => handleStatusUpdate(req.id, 'approved')}>Approve</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No poster requests found.
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

    