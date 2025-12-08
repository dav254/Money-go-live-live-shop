
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
import { Loader2, Pencil, Percent } from 'lucide-react';

function CommissionTableRow({ product }: { product: Product }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = React.useState(false);
  const [commissionRate, setCommissionRate] = React.useState(product.commissionRate || 0);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    if (!firestore || commissionRate < 0 || commissionRate > 100) {
      toast({ variant: 'destructive', title: 'Invalid Rate', description: 'Commission must be between 0 and 100.' });
      return;
    }
    setIsSaving(true);
    const productRef = doc(firestore, 'products', product.id);
    try {
      await updateDoc(productRef, { commissionRate });
      toast({ title: 'Success', description: `Commission for ${product.name} updated.` });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update commission rate:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update commission rate.' });
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
      <TableCell className="text-right font-semibold">{product.price.toLocaleString()}</TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <div className="flex justify-end items-center gap-2">
            <div className="relative">
                <Input
                type="number"
                value={commissionRate}
                onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                className="w-24 text-right pr-7"
                autoFocus
                />
                <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Button size="sm" onClick={handleSave} disabled={isSaving || commissionRate === (product.commissionRate || 0)}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="text-right flex justify-end items-center gap-2 group min-h-[40px]">
            <span className="font-medium">{product.commissionRate || 0}%</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              onClick={() => {
                setCommissionRate(product.commissionRate || 0);
                setIsEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
      </TableCell>
      <TableCell className="text-center">{product.stock}</TableCell>
    </TableRow>
  );
}

export function CommissionSettingsTable() {
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
                        <TableHead className="text-right">Price (USD)</TableHead>
                        <TableHead className="text-right">Commission Rate</TableHead>
                        <TableHead className="text-center">Stock</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-16 mx-auto" /></TableCell>
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
              <TableHead className="text-right">Price (USD)</TableHead>
              <TableHead className="text-right">Commission Rate</TableHead>
              <TableHead className="text-center">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productsData && productsData.length > 0 ? (
              productsData.map((product) => (
                <CommissionTableRow key={product.id} product={product} />
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
