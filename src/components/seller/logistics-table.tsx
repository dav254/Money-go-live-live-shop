
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
import { Input } from '@/components/ui/input';
import type { Product } from '@/lib/types';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pencil } from 'lucide-react';

type ProductRow = Product;

export function LogisticsTable() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: productsData, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [editingRowId, setEditingRowId] = React.useState<string | null>(null);
  const [shippingCost, setShippingCost] = React.useState<number>(0);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleEdit = (row: ProductRow) => {
    setEditingRowId(row.id);
    setShippingCost(row.shippingCost || 0);
  };
  
  const handleCancel = () => {
    setEditingRowId(null);
  }

  const handleSave = async (productId: string) => {
    if (!firestore) return;
    setIsSaving(true);
    const productRef = doc(firestore, 'products', productId);
    try {
        await updateDoc(productRef, { shippingCost: shippingCost });
        toast({ title: "Success", description: "Shipping cost updated." });
        setEditingRowId(null);
    } catch (error) {
        console.error("Failed to update shipping cost:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not update shipping cost." });
    } finally {
        setIsSaving(false);
    }
  };


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
      accessorKey: 'shippingCost',
      header: ({ column }) => {
        return (
          <div className="text-right">Shipping Cost (USD)</div>
        );
      },
      cell: ({ row }) => {
        const isEditing = editingRowId === row.original.id;
        const currentShippingCost = row.original.shippingCost || 0;

        if (isEditing) {
            return (
                 <div className="flex justify-end items-center gap-2">
                    <Input 
                        type="number"
                        value={shippingCost}
                        onChange={(e) => setShippingCost(parseFloat(e.target.value))}
                        className="w-24 text-right"
                        autoFocus
                    />
                    <Button size="sm" onClick={() => handleSave(row.original.id)} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancel}>Cancel</Button>
                 </div>
            )
        }

        return (
            <div className="text-right flex justify-end items-center gap-2 group">
                <span className="font-medium">{currentShippingCost.toLocaleString()}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleEdit(row.original)}>
                    <Pencil className="h-4 w-4" />
                </Button>
            </div>
        )
      },
    },
    {
        accessorKey: 'location',
        header: 'Location',
    },
    {
        accessorKey: 'deliveryOptions',
        header: 'Delivery Options',
        cell: ({ row }) => <div className="text-sm text-muted-foreground truncate max-w-xs">{row.getValue('deliveryOptions')}</div>,
    }
  ], [editingRowId, shippingCost, isSaving]);


  const isLoading = isUserLoading || areProductsLoading;

  const table = useReactTable({
    data: productsData || [],
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
                    Loading your products...
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
                  You haven't uploaded any products yet.
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
