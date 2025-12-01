
'use client';

import { useUser } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, collectionGroup } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';
import type { CartItem, UserProfile } from '@/lib/types';


const BuyerCell = ({ userId }: { userId: string }) => {
    const firestore = useFirestore();
    const userProfileRef = useMemoFirebase(() => doc(firestore, 'userProfiles', userId), [firestore, userId]);
    const { data: userProfile, isLoading } = useDoc<UserProfile>(userProfileRef);

    if (isLoading) return <Skeleton className="h-8 w-24" />;

    return (
        <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
                <AvatarImage src={userProfile?.profilePictureUrl} alt={userProfile?.fullName} />
                <AvatarFallback>{userProfile?.fullName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <span>{userProfile?.fullName}</span>
        </div>
    );
};


export function InCartsTable() {
  const { user, isLoading: isUserLoading } = useUser();
  const db = useFirestore();

  // Query the 'cart' subcollection across all 'userProfiles' documents
  // and filter by the sellerId of the items within.
  const cartItemsQuery = useMemoFirebase(
    () =>
      user
        ? query(
            collectionGroup(db, 'cart'),
            where('sellerId', '==', user.uid)
          )
        : null,
    [user, db]
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
            {[...Array(3)].map((_, i) => (
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
                  <AvatarImage src={item.imageUrl} alt={item.name} />
                  <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>
                <BuyerCell userId={item.buyerId} />
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
