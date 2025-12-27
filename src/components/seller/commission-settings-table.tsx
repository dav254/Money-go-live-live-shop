

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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/lib/types';
import { Loader2, Percent } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Checkbox } from '../ui/checkbox';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Badge } from '@/components/ui/badge';

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

function ResellSwitch({ product }: { product: Product }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isEnabled, setIsEnabled] = React.useState((product.commissionRate || 0) > 0);
    const [isSaving, setIsSaving] = React.useState(false);
    
    const handleToggle = async (checked: boolean) => {
        if (!firestore) return;
        setIsSaving(true);
        setIsEnabled(checked);
        const productRef = doc(firestore, 'products', product.id);
        const newRate = checked ? 10 : 0;
        try {
            await updateDoc(productRef, { commissionRate: newRate });
            toast({ title: `Reselling ${checked ? 'Enabled' : 'Disabled'}`, description: `Commission for this product is now ${newRate}%.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error updating commission' });
            setIsEnabled(!checked); // Revert on error
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="flex items-center justify-end gap-2">
            {isEnabled && <Badge className="bg-primary/80">10%</Badge>}
            <Switch
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={isSaving}
                aria-label="Toggle reselling"
            />
        </div>
    )
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
            header: () => <div className="text-right">Enable Reselling (10% Rate)</div>,
            cell: ({ row }) => <ResellSwitch product={row.original} />
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
