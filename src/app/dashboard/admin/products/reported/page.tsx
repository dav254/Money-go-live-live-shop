
'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AdminLayout } from '@/components/layout/admin-layout';
import type { Product, UserProfile } from '@/lib/types';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAdminComplaints } from '@/hooks/use-admin-complaints';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';

const UserCell = ({ userId, label }: { userId: string, label: string }) => {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', userId), [firestore, userId]);
  const { data: user, isLoading } = useDoc<UserProfile>(userRef);

  if (isLoading) return <Skeleton className="h-5 w-24" />;
  return (
    <div>
      <p className="font-medium">{user?.fullName || 'N/A'}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
};

const ProductCell = ({ productId }: { productId: string }) => {
  const firestore = useFirestore();
  const productRef = useMemoFirebase(() => doc(firestore, 'products', productId), [firestore, productId]);
  const { data: product, isLoading } = useDoc<Product>(productRef);

  if (isLoading) return <Skeleton className="h-12 w-32" />;
  if (!product) return <p className="text-sm text-destructive">Product not found</p>;

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-12 w-12 rounded-md overflow-hidden">
        <Image src={product.imageUrl} alt={product.name || 'product image'} fill className="object-cover" />
      </div>
      <div>
        <Link href={`/products/${product.id}`} className="font-semibold hover:underline" target="_blank">
            {product.name}
        </Link>
        <p className="text-xs text-muted-foreground">ID: {productId.substring(0, 6)}...</p>
      </div>
    </div>
  );
};

export default function AdminReportedProductsPage() {
  const { toast } = useToast();

  // Product reports come through the Admin-SDK API: the deployed rules deny
  // client `list` on `complaints`, which used to throw a permission-denied
  // error on load. See `hooks/use-admin-complaints.ts`.
  const { complaints, isLoading, updateStatus } = useAdminComplaints({ targetType: 'product' });
  const { user } = useUser();
  const [pendingRemove, setPendingRemove] = React.useState<{ productId: string; complaintId: string } | null>(null);
  const [removeBusy, setRemoveBusy] = React.useState(false);

  const handleStatusUpdate = async (complaintId: string, status: 'resolved' | 'dismissed') => {
    try {
      await updateStatus(complaintId, status);
      toast({ title: 'Success!', description: `The report has been marked as ${status}.` });
    } catch (error) {
      console.error('Failed to update complaint status:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update the report status.' });
    }
  };

  const handleRemoveListing = async () => {
    if (!pendingRemove) return;
    setRemoveBusy(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/products/${encodeURIComponent(pendingRemove.productId)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      // Close the report too, so the queue does not keep a row for a product
      // that no longer exists.
      await updateStatus(pendingRemove.complaintId, 'resolved');
      toast({ title: 'Listing removed', description: 'The product is off the marketplace and the report is resolved.' });
      setPendingRemove(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not remove the listing.',
      });
    } finally {
      setRemoveBusy(false);
    }
  };


  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Product Management: Reported Products
        </h1>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Reported By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-12 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : complaints && complaints.length > 0 ? (
                complaints.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <ProductCell productId={c.targetId ?? ''} />
                    </TableCell>
                    <TableCell>
                        <p className="font-medium">{c.reason ?? '—'}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.description ?? c.details}</p>
                    </TableCell>
                    <TableCell>
                      <UserCell userId={c.complainantId || 'unknown'} label="Complainant" />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                        {(() => { const ts = c.createdAt as { toDate?: () => Date } | null | undefined; const d = typeof ts?.toDate === 'function' ? ts.toDate() : ts ? new Date(String(ts)) : null; return d ? formatDistanceToNow(d, { addSuffix: true }) : 'N/A'; })()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'open' ? 'secondary' : 'default'} className="capitalize">{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <DotsHorizontalIcon className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Moderation</DropdownMenuLabel>
                             <DropdownMenuItem asChild>
                                <Link href={`/products/${c.targetId}`} target="_blank">View Product</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleStatusUpdate(c.id, 'dismissed')}>Dismiss Report</DropdownMenuItem>
                            {/* Product has no status field to "unpublish" into, so the
                                honourable moderation action is removal (with confirm),
                                which also resolves the report. */}
                            <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => c.targetId && setPendingRemove({ productId: c.targetId, complaintId: c.id })}
                            >Remove Listing</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No reported products found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!pendingRemove} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              The product will be taken off the marketplace permanently and this
              report will be marked resolved. Media files are cleaned up
              automatically afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeBusy}
              onClick={(e) => {
                e.preventDefault();
                void handleRemoveListing();
              }}
            >
              {removeBusy ? 'Removing…' : 'Remove Listing'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
