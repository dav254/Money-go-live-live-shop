
'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  CaretSortIcon,
  ChevronDownIcon,
  DotsHorizontalIcon,
} from '@radix-ui/react-icons';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser } from '@/firebase';
import type { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

type ProductRow = Product;

const DataTableSkeleton = () => (
    <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    {Array.from({ length: 8 }).map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>)}
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                        {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);


export const columns: ColumnDef<ProductRow>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
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
    cell: ({ row }) => (
        <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-md overflow-hidden">
                <Image 
                    src={row.original.imageUrl || '/placeholder-image.svg'}
                    alt={row.original.name || 'product'}
                    fill
                    className="object-cover"
                />
            </div>
            <div className="flex flex-col">
                <span className="font-medium capitalize">{row.getValue('name')}</span>
                {(row.original.featured || row.original.unpublished) && (
                    <span className="flex gap-1">
                        {row.original.featured && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">Featured</span>
                        )}
                        {row.original.unpublished && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-yellow-600">Unpublished</span>
                        )}
                    </span>
                )}
            </div>
        </div>
    ),
  },
  {
    accessorKey: 'sellerId',
    header: 'Seller ID',
  },
  {
    accessorKey: 'price',
    header: () => <div className="text-right">Price (USD)</div>,
    cell: ({ row }) => <div className="text-right font-medium">{(row.original.price ?? 0).toLocaleString()}</div>,
  },
  {
    accessorKey: 'stock',
    header: () => <div className="text-center">Stock</div>,
    cell: ({ row }) => <div className="text-center">{row.original.stock ?? 0}</div>,
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge>
  },
   {
    accessorKey: 'uploadDate',
    header: 'Date Added',
    cell: ({ row }) => {
      const raw = row.original.uploadDate as unknown;
      if (!raw) return 'N/A';
      const d = new Date(raw as string | number | Date);
      return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
    },
  },
  {
    id: 'actions',
    // The real menu lives in the page component (it needs the router, toasts
    // and the PATCH/DELETE handlers); this placeholder keeps the exported
    // column set in sync for any consumer of `columns`.
    cell: () => null,
  },
];

export default function AdminAllProductsPage() {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState({});

  const router = useRouter();
  const { toast } = useToast();
  const { user: adminUser } = useUser();

  /*
   * Data comes from the VPS-backed admin route (PocketBase mirror first,
   * Firestore best-effort), NOT from a client Firestore subscription: the
   * admin console must keep working when the Firestore project is blocked or
   * out of quota — the whole reason the mirror exists.
   */
  const [products, setProducts] = React.useState<Product[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const loadProducts = React.useCallback(async () => {
    if (!adminUser) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const token = await adminUser.getIdToken();
      const res = await fetch('/api/admin/products/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `List failed (${res.status})`);
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load products.');
    } finally {
      setIsLoading(false);
    }
  }, [adminUser]);

  React.useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  /* ── Action handlers — every menu item is wired to a real operation ─── */

  const patchProduct = async (
    product: Product,
    patch: { featured?: boolean; unpublished?: boolean },
  ) => {
    if (!adminUser || busyId) return;
    setBusyId(product.id);
    try {
      const token = await adminUser.getIdToken();
      const res = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error || `Update failed (${res.status})`);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...patch } : p)));
      toast({
        title: 'Updated',
        description:
          patch.featured !== undefined
            ? patch.featured
              ? '“' + (product.name ?? 'Listing') + '” is now featured.'
              : 'Feature removed from “' + (product.name ?? 'Listing') + '”.'
            : patch.unpublished
              ? '“' + (product.name ?? 'Listing') + '” is hidden from buyers.'
              : '“' + (product.name ?? 'Listing') + '” is published again.',
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Update failed.' });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || !adminUser || deleteBusy) return;
    setDeleteBusy(true);
    try {
      const token = await adminUser.getIdToken();
      const res = await fetch(`/api/admin/products/${encodeURIComponent(pendingDelete.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result?.error || `Delete failed (${res.status})`);
      }
      setProducts((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      toast({ title: 'Listing removed', description: '“' + (pendingDelete.name ?? 'Listing') + '” was deleted from the catalog.' });
      setPendingDelete(null);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Delete failed.' });
    } finally {
      setDeleteBusy(false);
    }
  };

  const actionsMenu = (product: Product) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <DotsHorizontalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/products/${product.id}`} target="_blank">View Product</Link>
        </DropdownMenuItem>
        {product.sellerId ? (
          <DropdownMenuItem asChild>
            <Link href={`/sellers/${product.sellerId}`} target="_blank">View Seller</Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>View Seller</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={busyId === product.id}
          onSelect={() => void patchProduct(product, { featured: !product.featured })}
        >
          {product.featured ? 'Remove Feature' : 'Feature Product'}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-yellow-600"
          disabled={busyId === product.id}
          onSelect={() => void patchProduct(product, { unpublished: !product.unpublished })}
        >
          {product.unpublished ? 'Publish' : 'Unpublish'}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          disabled={busyId === product.id}
          onSelect={() => setPendingDelete(product)}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const tableColumns = React.useMemo<ColumnDef<ProductRow>[]>(
    () =>
      columns.map((col) =>
        col.id === 'actions'
          ? { ...col, cell: ({ row }: { row: { original: ProductRow } }) => actionsMenu(row.original) }
          : col,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyId, products],
  );

  const allProducts = products;

  const table = useReactTable({
    data: allProducts,
    columns: tableColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, rowSelection },
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Product Management: All Products
        </h1>
        <div className="w-full">
          {loadError && (
            <div className="mb-4 flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <span>Could not load the product catalog: {loadError}</span>
              <Button variant="outline" size="sm" onClick={() => void loadProducts()}>Retry</Button>
            </div>
          )}
          <div className="flex items-center py-4">
            <Input
              placeholder="Filter by product name..."
              value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
              onChange={(event) => table.getColumn('name')?.setFilterValue(event.target.value)}
              className="max-w-sm"
            />
          </div>
          {isLoading ? <DataTableSkeleton /> : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No products found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          )}
          <div className="flex items-center justify-end space-x-2 py-4">
             <div className="flex-1 text-sm text-muted-foreground">
                {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadProducts()}
              disabled={isLoading}
            >
              Refresh
            </Button>
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

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name ?? 'This listing'}” will be removed from the catalog and
              hidden from buyers. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteBusy}
              onClick={() => void confirmDelete()}
            >
              {deleteBusy ? 'Deleting…' : 'Delete Listing'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
