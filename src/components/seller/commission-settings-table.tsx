
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
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

const TableSkeleton = () => {
    return (
        <div className="rounded-md border">
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead><Skeleton className="h-5 w-48"/></TableHead>
                        <TableHead><Skeleton className="h-5 w-24"/></TableHead>
                        <TableHead className="text-right"><Skeleton className="h-5 w-32 ml-auto"/></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {[...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><div className="flex items-center gap-4"><Skeleton className="h-12 w-12 rounded-md" /><Skeleton className="h-6 w-32" /></div></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
        </div>
    )
}

function CommissionCell({ product }: { product: Product }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isEditing, setIsEditing] = React.useState(false);
    const [commissionRate, setCommissionRate] = React.useState(product.commissionRate || 0);
    const [isSaving, setIsSaving] = React.useState(false);

    const commissionAmount = (product.price * commissionRate) / 100;

    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        const productRef = doc(firestore, 'products', product.id);
        try {
            await updateDoc(productRef, { commissionRate });
            toast({ title: 'Commission Updated', description: `Commission for ${product.name} is now ${commissionRate}%.` });
            setIsEditing(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error updating commission' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isEditing) {
        return (
            <div className="flex justify-end items-center gap-2">
                <div className="relative">
                    <Input
                        type="number"
                        value={commissionRate}
                        onChange={(e) => setCommissionRate(Number(e.target.value))}
                        className="w-24 text-right pr-7"
                        autoFocus
                    />
                     <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                    Cancel
                </Button>
            </div>
        );
    }

    return (
        <div className="text-right flex justify-end items-center gap-2 group min-h-[40px]">
            {commissionRate > 0 ? (
                <span className="font-semibold text-green-500">${commissionAmount.toFixed(2)}
                    <span className="text-xs text-muted-foreground ml-1">({commissionRate}%)</span>
                </span>
            ) : (
                <span className="text-sm text-muted-foreground">Disabled</span>
            )}
             <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              onClick={() => {
                setCommissionRate(product.commissionRate || 0);
                setIsEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
        </div>
    );
}

export function CommissionSettingsTable() {
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();

    const productsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);
    const isLoading = isUserLoading || areProductsLoading;

    const columns: ColumnDef<Product>[] = [
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
            header: () => <div className="text-right">Reseller Commission</div>,
            cell: ({ row }) => <CommissionCell product={row.original} />
        },
    ];

    const table = useReactTable({
        data: products || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    if (isLoading) {
        return <TableSkeleton />;
    }

    return (
        <div className="w-full">
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
