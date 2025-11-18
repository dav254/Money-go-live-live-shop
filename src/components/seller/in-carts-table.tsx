'use client';

import { useUser } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// This is a hypothetical type. We are assuming the structure of documents in the 'orders' collection.
interface CartItem {
  id: string;
  productName: string;
  productImage: string;
  buyerName: string;
  buyerAvatar: string;
  addedAt: any; // Firestore Timestamp
  quantity: number;
}

export function InCartsTable() {
  const { user, isLoading: isUserLoading } = useUser();
  const db = useFirestore();

  const cartItemsQuery = useMemoFirebase(
    () =>
      user
        ? query(
            collection(db, 'orders'), // Target the 'orders' collection.
            where('sellerId', '==', user.uid), // Filter by the current seller.
            where('status', '==', 'in-cart') // Filter by status.
          )
        : null, // Pass null if the user is not loaded yet to prevent the query from running.
    [user]
  );

  const { data: cartItems, isLoading: isDataLoading, error } = useCollection<CartItem>(cartItemsQuery);

  const isLoading = isUserLoading || isDataLoading;

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Date Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-10 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-10 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-20" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed border-red-500">
        <h2 className="text-xl font-semibold text-red-600">Error Loading Data</h2>
        <p className="text-muted-foreground">{error.message}</p>
        <p className="text-sm text-muted-foreground">
          This is likely due to a permission issue. Ensure your Firestore rules allow sellers to read their own orders.
        </p>
      </div>
    );
  }

  if (!cartItems || cartItems.length === 0) {
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
            <TableHead className="hidden sm:table-cell">Image</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead className="text-center">Quantity</TableHead>
            <TableHead className="hidden md:table-cell text-right">Date Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cartItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="hidden sm:table-cell">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={item.productImage} alt={item.productName} />
                  <AvatarFallback>{item.productName.charAt(0)}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell className="font-medium">{item.productName}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={item.buyerAvatar} alt={item.buyerName} />
                    <AvatarFallback>{item.buyerName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span>{item.buyerName}</span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline">{item.quantity}</Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-right">
                {item.addedAt ? new Date(item.addedAt.seconds * 1000).toLocaleDateString() : 'N/A'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
