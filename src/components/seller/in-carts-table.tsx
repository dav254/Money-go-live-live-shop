
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
    if (!user || !firestore) return null;
    return query(collectionGroup(firestore, 'cart'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: cartItems, isLoading: areCartItemsLoading } = useCollection<CartItem>(cartItemsQuery);

  const buyerIds = React.useMemo(() => {
    if (!cartItems) return [];
    // The parent document ID is the buyer's UID. This is a common Firestore pattern,
    // but collectionGroup queries don't directly provide parent IDs in the snapshot data.
    // A robust solution is to denormalize and store `buyerId` on the cart item itself.
    // Assuming `buyerId` will be added to the CartItem type and data.
    const ids = cartItems.map(item => (item as any).buyerId).filter(Boolean);
    return [...new Set(ids)]; // Return unique IDs
  }, [cartItems]);
  
  const buyersQuery = useMemoFirebase(() => {
    // CRITICAL FIX: Do not create a query if there are no buyer IDs to fetch.
    if (!firestore || buyerIds.length === 0) return null;
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
