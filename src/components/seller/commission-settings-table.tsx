
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
import type { Product } from '@/lib/types';
import { Loader2, Pencil, Percent } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Checkbox } from '../ui/checkbox';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
} from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

function CommissionInput({ product, onSave }: { product: Product, onSave: () => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [commissionRate, setCommissionRate] = React.useState(product.commissionRate || 0);
    const [isSaving, setIsSaving] = React.useState(false);

    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        const productRef = doc(firestore, 'products', product.id);
        try {
            await updateDoc(productRef, { commissionRate });
            toast({ title: 'Commission Updated' });
            onSave();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error updating commission' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex items-center gap-2 justify-end">
            <div className="relative">
                <Input
                    type="number"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                    className="w-24 text-right pr-7"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                />
                <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
        </div>
    );
}

const TableSkeleton = () => {
    return (
        <div className="rounded-md border">
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead><Skeleton className="h-5 w-5"/></TableHead>
                        <TableHead><Skeleton className="h-5 w-48"/></TableHead>
                        <TableHead><Skeleton className="h-5 w-24"/></TableHead>
                        <TableHead><Skeleton className="h-5 w-32"/></TableHead>
                        <TableHead className="text-right"><Skeleton className="h-5 w-24 ml-auto"/></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {[...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-5"/></TableCell>
                        <TableCell><div className="flex items-center gap-4"><Skeleton className="h-12 w-12 rounded-md" /><Skeleton className="h-6 w-32" /></div></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
        </div>
    )
}

export function CommissionSettingsTable() {
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [rowSelection, setRowSelection] = React.useState({});
    const [isEditing, setIsEditing] = React.useState<string | null>(null);

    const productsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

    const isLoading = isUserLoading || areProductsLoading;

    const columns: ColumnDef<Product>[] = [
        {
            id: 'select',
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                />
            ),
        },
        {
            accessorKey: 'name',
            header: 'Product',
            cell: ({ row }) => (
                <div className="flex items-center gap-4">
                    <div className="relative h-12 w-12 rounded-md overflow-hidden">
                        <Image src={row.original.imageUrl || 'https://picsum.photos/seed/product/150/150'} alt={row.original.name || ''} fill className="object-cover" />
                    </div>
                    <div className="font-medium">{row.getValue('name')}</div>
                </div>
            )
        },
        {
            accessorKey: 'price',
            header: () => <div className="text-right">Price</div>,
            cell: ({ row }) => <div className="text-right">${(row.original.price || 0).toLocaleString()}</div>
        },
        {
            accessorKey: 'commissionRate',
            header: () => <div className="text-right">Commission</div>,
            cell: ({ row }) => {
                return isEditing === row.original.id ? (
                    <CommissionInput product={row.original} onSave={() => setIsEditing(null)} />
                ) : (
                    <div className="text-right flex items-center justify-end gap-2 group min-h-[40px]">
                        <span className="font-semibold text-primary">{row.original.commissionRate || 0}%</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setIsEditing(row.original.id)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                    </div>
                )
            }
        },
    ];

    const table = useReactTable({
        data: products || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onRowSelectionChange: setRowSelection,
        state: { sorting, rowSelection },
    });

    if (isLoading) {
        return <TableSkeleton />;
    }

    return (
        <div className="w-full">
            <div className="flex items-center justify-between py-4">
                <Input placeholder="Filter products..." className="max-w-sm" />
                {Object.keys(rowSelection).length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">Bulk Actions ({Object.keys(rowSelection).length})</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem>Set Commission...</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Remove from Reselling</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    You have no products. Add products to set commission rates.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
