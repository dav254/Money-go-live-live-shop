
'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, query, updateDoc, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Loader2, Pencil } from 'lucide-react';

/**
 * A dedicated component for a single row in the logistics table.
 * It manages its own editing state to prevent re-rendering the entire table.
 */
function LogisticsTableRow({ product }: { product: Product }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = React.useState(false);
  const [shippingCost, setShippingCost] = React.useState(product.shippingCost || 0);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);
    const productRef = doc(firestore, 'products', product.id);
    try {
      await updateDoc(productRef, { shippingCost });
      toast({ title: 'Success', description: 'Shipping cost updated.' });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update shipping cost:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update shipping cost.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TableRow key={product.id}>
      <TableCell>
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 rounded-md overflow-hidden">
            <Image
              src={product.imageUrl || 'https://picsum.photos/seed/product/150/150'}
              alt={product.name || 'Product image'}
              fill
              className="object-cover"
            />
          </div>
          <div className="font-medium capitalize">{product.name}</div>
        </div>
      </TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <div className="flex justify-end items-center gap-2">
            <Input
              type="number"
              value={shippingCost}
              onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
              className="w-24 text-right"
              autoFocus
            />
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="text-right flex justify-end items-center gap-2 group min-h-[40px]">
            <span className="font-medium">{(product.shippingCost || 0).toLocaleString()}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              onClick={() => {
                setShippingCost(product.shippingCost || 0);
                setIsEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
      </TableCell>
      <TableCell>{product.location || 'Not set'}</TableCell>
      <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
        {product.deliveryOptions || 'Not set'}
      </TableCell>
    </TableRow>
  );
}


/**
 * Main component to display the logistics management table.
 */
export function LogisticsTable() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();

  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: productsData, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
  const isLoading = isUserLoading || areProductsLoading;

  if (isLoading) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Shipping Cost (USD)</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Delivery Options</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
  }

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Shipping Cost (USD)</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Delivery Options</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productsData && productsData.length > 0 ? (
              productsData.map((product) => (
                <LogisticsTableRow key={product.id} product={product} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  You haven't uploaded any products yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
