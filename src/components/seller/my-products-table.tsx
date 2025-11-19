
'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  CaretSortIcon,
  ChevronDownIcon,
  DotsHorizontalIcon,
} from '@radix-ui/react-icons';
import { differenceInDays, addDays, formatDistanceToNow } from 'date-fns';

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { ProductUploadForm } from './product-upload-form';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { cn } from '@/lib/utils';


type ProductRow = Product & {
    status: 'active' | 'draft' | 'out-of-stock';
    sales: number;
}


export function MyProductsTable() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<Product | undefined>(undefined);

  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: productsData, isLoading: areProductsLoading, error } = useCollection<Product>(productsQuery);

  const handleDelete = async (productId: string) => {
    if (!firestore) return;
    const productRef = doc(firestore, 'products', productId);
    try {
        await deleteDoc(productRef);
        toast({ title: "Product Deleted", description: "The product has been successfully removed." });
    } catch (e) {
        console.error("Error deleting product: ", e);
        toast({ variant: 'destructive', title: "Error", description: "Could not delete the product." });
    }
  };
  
  const handleEditOpen = (product: Product) => {
    setSelectedProduct(product);
    setIsEditDialogOpen(true);
  }

  const columns: ColumnDef<ProductRow>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: 'Product',
      cell: ({ row }) => {
          const isExpired = row.original.uploadDate && differenceInDays(new Date(), row.original.uploadDate.toDate()) > 30;
          return (
            <div className={cn("flex items-center gap-4", isExpired && "opacity-50")}>
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
          )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
          const stock = row.original.stock;
          const status = stock > 0 ? 'active' : 'out-of-stock';
          const variant = status === 'active' ? 'default' : 'destructive';
          
          return <Badge variant={variant} className={cn(`capitalize`, status === 'active' ? 'bg-green-600/80' : '')}>{status.replace('-', ' ')}</Badge>
      }
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
            Price
            <CaretSortIcon className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('price'));
        const formatted = new Intl.NumberFormat('en-US').format(amount);

        return <div className="text-right font-medium">{formatted}</div>;
      },
    },
     {
      accessorKey: 'stock',
      header: ({ column }) => (
           <div className="text-center">Stock</div>
      ),
      cell: ({ row }) => <div className="text-center">{row.getValue('stock')}</div>,
    },
    {
        accessorKey: 'uploadDate',
        header: 'Expires',
        cell: ({ row }) => {
            const uploadDate = row.original.uploadDate?.toDate();
            if (!uploadDate) return <div className="text-center">-</div>;

            const expiryDate = addDays(uploadDate, 30);
            const now = new Date();
            const isExpired = expiryDate < now;
            
            if (isExpired) {
                return <Badge variant="destructive">Expired</Badge>
            }

            return <div className="text-sm text-muted-foreground">{formatDistanceToNow(expiryDate, { addSuffix: true })}</div>;
        }
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const product = row.original;

        return (
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <DotsHorizontalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(product.id)}
                >
                  Copy product ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>View product page</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleEditOpen(product)}>Edit product</DropdownMenuItem>
                 <DropdownMenuItem>Relist Product</DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-destructive">Delete product</DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete "{product.name}". This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(product.id)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      },
    },
  ];

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  
  const isLoading = isUserLoading || areProductsLoading;

  const table = useReactTable({
    data: productsData || [],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filter products by name..."
          value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('name')?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDownIcon className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuItem
                    key={column.id}
                    className="capitalize"
                    onSelect={(e) => {
                        e.preventDefault();
                        column.toggleVisibility(!column.getIsVisible())
                    }}
                  >
                    <Checkbox
                        checked={column.getIsVisible()}
                        className="mr-2"
                    />
                    {column.id}
                  </DropdownMenuItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
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
       <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[800px]">
                <DialogHeader>
                    <DialogTitle>Edit Product</DialogTitle>
                </DialogHeader>
                <ProductUploadForm 
                    productToEdit={selectedProduct} 
                    onFormSubmit={() => setIsEditDialogOpen(false)} 
                />
            </DialogContent>
        </Dialog>
    </div>
  );
}
