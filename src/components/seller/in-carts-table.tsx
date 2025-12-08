

'use client';

import { useUser } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product } from '@/lib/types';
import Image from 'next/image';


export function InCartsTable() {
  const { user, isLoading: isUserLoading } = useUser();
  const db = useFirestore();

  // Query products for the current seller that are in at least one cart
  const productsInCartQuery = useMemoFirebase(
    () =>
      user
        ? query(
            collection(db, 'products'),
            where('sellerId', '==', user.uid),
            where('inCartCount', '>', 0),
            orderBy('inCartCount', 'desc')
          )
        : null,
    [user, db]
  );

  const { data: products, isLoading: isDataLoading } = useCollection<Product>(productsInCartQuery);

  const isLoading = isUserLoading || isDataLoading;

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Times in Cart</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(3)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-10 w-48" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-8 w-12 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
        <h2 className="text-xl font-semibold">No Items in Carts</h2>
        <p className="text-muted-foreground">When potential buyers add your products to their carts, you'll see them here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Times in Cart</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex items-center gap-4">
                    <div className="relative h-12 w-12 rounded-md overflow-hidden">
                        <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                    </div>
                    <span className="font-medium">{item.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="default" className="text-lg">{item.inCartCount}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
