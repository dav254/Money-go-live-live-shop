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
import { Badge } from '@/components/ui/badge';
import type { Product } from '@/lib/types';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';


type ProductRow = Product;

export function DiscountedProductsTable() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();

  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: productsData, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  const discountedProducts = React.useMemo(() => {
    return productsData?.filter(p => p.wasPrice != null && p.wasPrice > p.price) || [];
  }, [productsData]);

  const columns: ColumnDef<ProductRow>[] = React.useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Product',
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
      accessorKey: 'originalPrice',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="text-right w-full justify-end"
          >
            Original Price
            <CaretSortIcon className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const amount = parseFloat(row.original.wasPrice?.toString() || row.original.originalPrice?.toString() || '0');
        const formatted = new Intl.NumberFormat('en-US').format(amount);
        return <div className="text-right font-medium text-muted-foreground line-through">{formatted}</div>;
      },
    },
    {
      accessorKey: 'price',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="text-right w-full justify-end"
          >
            Sale Price
            <CaretSortIcon className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('price'));
        const formatted = new Intl.NumberFormat('en-US').format(amount);
        return <div className="text-right font-bold text-primary">{formatted}</div>;
      },
    },
    {
      id: 'discount',
      header: () => <div className="text-center">Discount</div>,
      cell: ({row}) => {
          const price = row.original.price;
          const originalPrice = row.original.wasPrice || row.original.originalPrice;
          if (!originalPrice || !price || originalPrice <= price) {
              return <div className="text-center">-</div>
          }
          const discount = Math.round(((originalPrice - price) / originalPrice) * 100);
          return <div className="text-center"><Badge variant="destructive">{discount}% OFF</Badge></div>
      }
    },
    {
      accessorKey: 'stock',
      header: () => <div className="text-center">Stock</div>,
      cell: ({ row }) => <div className="text-center">{row.getValue('stock')}</div>,
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        return (
          <div className="text-right">
              <Button variant="outline">Edit Discount</Button>
          </div>
        );
      },
    },
  ], []);


  const [sorting, setSorting] = React.useState<SortingState>([]);
  
  const isLoading = isUserLoading || areProductsLoading;

  const table = useReactTable({
    data: discountedProducts,
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
                    Loading your discounted products...
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
                  You have no products currently on discount.
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
