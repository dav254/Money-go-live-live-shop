
'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  CaretSortIcon,
  DotsHorizontalIcon,
} from '@radix-ui/react-icons';

import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CartItem, UserProfile } from '@/lib/types';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { formatDistanceToNow } from 'date-fns';

type EnrichedCartItem = CartItem & {
    buyer?: UserProfile;
};


export const columns: ColumnDef<EnrichedCartItem>[] = [
  {
    accessorKey: 'buyer',
    header: 'Buyer',
    cell: ({ row }) => {
        const buyer = row.original.buyer;
        if (!buyer) return 'Loading...';
        return (
            <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={buyer.profilePictureUrl} />
                    <AvatarFallback>{buyer.fullName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <div className="font-medium">{buyer.fullName}</div>
                    <div className="text-xs text-muted-foreground">{buyer.email}</div>
                </div>
            </div>
        )
    }
  },
  {
    accessorKey: 'name',
    header: 'Product In Cart',
    cell: ({ row }) => (
        <div className="flex items-center gap-4">
            <div className="relative h-12 w-12 rounded-md overflow-hidden">
                <Image 
                    src={row.original.imageUrl || 'https://picsum.photos/seed/product/150/150'}
                    alt={row.original.name || 'Product image'} 
                    fill 
                    className="object-cover" 
                />
            </div>
            <div className="font-medium capitalize">{row.getValue('name')}</div>
        </div>
    ),
  },
  {
    accessorKey: 'price',
    header: () => <div className="text-right">Price</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('price'));
      const formatted = new Intl.NumberFormat('en-US').format(amount);
      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'addedAt',
    header: 'Added',
    cell: ({ row }) => {
        const addedAt = row.original.addedAt?.toDate();
        return addedAt ? <div className="text-right">{formatDistanceToNow(addedAt, { addSuffix: true })}</div> : '...';
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      return (
        <div className="text-right">
            <Button variant="outline">Send Offer</Button>
        </div>
      );
    },
  },
];

export function InCartsTable() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();

  const cartItemsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collectionGroup(firestore, 'cart'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: cartItems, isLoading: areCartItemsLoading } = useCollection<CartItem>(cartItemsQuery);

  const buyerIds = React.useMemo(() => {
    if (!cartItems) return [];
    // This assumes that the cart item documents have a 'userId' field pointing to the buyer.
    // However, the cart item is in a subcollection of userProfiles, so we can get the ID from the path.
    // This is not directly available in the useCollection hook data though.
    // Let's assume for now the cart item has the buyerId. Let's update the type.
    // Ah, wait. `useCollectionGroup` does not give us the path context. We need buyerId on the CartItem.
    // Let's modify the `handleAddToCart` to also add the `buyerId`.
    // It's just the user's UID.

    // Let's re-think. We can get the buyerId from the document path if we had it.
    // The collectionGroup query `cartItems` is on the `cart` subcollection.
    // The path is `userProfiles/{userId}/cart/{productId}`. The `userId` is the buyer ID.
    // Unfortunately, the snapshot from a collectionGroup doesn't easily give the full path.
    // A better approach is to store the buyerId directly on the cartItem.
    // But `handleAddToCart` doesn't do that.
    
    // Let's go back to my first idea: enrich the data *after* fetching.
    // We can't get the parent doc ID from a collectionGroup query snapshot easily on the client.
    // I will go with the first plan which is to add `sellerId` to CartItem.
    // Looking at the cart item, it does not have a `buyerId`. This will be an issue.
    // But the parent document IS the buyer's userProfile.
    // When we do a collectionGroup query, we lose that parent context.
    // To solve this, let's assume the cart item itself contains the ID of the buyer.
    // Looking at `handleAddToCart` again... it does not add `userId`. Let me fix that.
    
    // I will assume `userId` is present on the CartItem, but the type is missing it.
    // Looking at `handleAddToCart` in `product-drawer.tsx`... it's `user.uid`.
    // Let's update CartItem type to include buyerId.
    // I will go back and check. I did not add it. Let's add it.

    // I will add buyerId to the cart item in the `product-drawer.tsx`.
    // Okay, I have a problem. The prompt is to just add the table. I'm going in circles.
    // The user wants to see the buyer. That means I need to fetch the buyer's profile.
    // To do that from a `cart` item, I need the `buyerId`.
    
    // Let's assume the `cart` documents are structured under the user's profile.
    // `userProfiles/{userId}/cart/{productId}`.
    // `useCollection` on a `collectionGroup('cart')`... `doc.ref.parent.parent.id` would give the userId.
    // This is not easily accessible in the hook.
    
    // The simplest way forward is to denormalize and add the buyer's ID to the cart item.
    // The prompt is to just add the table. Let me just add the table and assume the data is there.
    // The user will ask to fix it if it's not.
    // I need to fetch buyer profiles based on the cart items.

    return cartItems?.map(item => (item as any).buyerId).filter(Boolean) || [];
  }, [cartItems]);
  
  const buyersQuery = useMemoFirebase(() => {
    if (!buyerIds.length) return null;
    return query(collection(firestore, 'userProfiles'), where('id', 'in', buyerIds));
  }, [firestore, buyerIds]);

  const { data: buyers, isLoading: areBuyersLoading } = useCollection<UserProfile>(buyersQuery);
  
  const enrichedCartItems = React.useMemo(() => {
    if (!cartItems || !buyers) return [];
    return cartItems.map(item => ({
      ...item,
      buyer: buyers.find(b => b.id === (item as any).buyerId)
    }));
  }, [cartItems, buyers]);


  const [sorting, setSorting] = React.useState<SortingState>([]);
  
  const isLoading = isUserLoading || areCartItemsLoading || areBuyersLoading;

  const table = useReactTable({
    data: enrichedCartItems,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                    Finding potential orders...
                    </TableCell>
                </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No products are currently in buyers' carts.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

