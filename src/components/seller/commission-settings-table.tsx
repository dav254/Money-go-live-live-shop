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
import { collection, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
import { formatDistanceToNow, subDays } from 'date-fns';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';


type ProductWithStatus = Product & {
    lastShare?: Date;
    status: 'active' | 'stale';
};

const mockProductData: ProductWithStatus[] = [
    { id: 'prod-1', name: 'Classic Leather Handbag', price: 85, stock: 15, imageUrl: 'https://picsum.photos/seed/p1/100', sellerId: '', uploadDate: new Date(), lastShare: new Date(), status: 'active', commissionRate: 10 },
    { id: 'prod-2', name: 'Urban Explorer Sneakers', price: 120, stock: 8, imageUrl: 'https://picsum.photos/seed/p2/100', sellerId: '', uploadDate: new Date(), lastShare: subDays(new Date(), 45), status: 'stale', commissionRate: 15 },
    { id: 'prod-3', name: 'Chronograph Watch', price: 350, stock: 2, imageUrl: 'https://picsum.photos/seed/p3/100', sellerId: '', uploadDate: new Date(), lastShare: subDays(new Date(), 5), status: 'active', commissionRate: 12 },
    { id: 'prod-4', name: 'Wireless Headphones', price: 250, stock: 20, imageUrl: 'https://picsum.photos/seed/p4/100', sellerId: '', uploadDate: new Date(), lastShare: subDays(new Date(), 90), status: 'stale', commissionRate: 0 },
];

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
                />
                <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
        </div>
    );
}

export function CommissionSettingsTable() {
    const [data, setData] = React.useState(mockProductData);
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [rowSelection, setRowSelection] = React.useState({});
    const [isEditing, setIsEditing] = React.useState<string | null>(null);

    const columns: ColumnDef<ProductWithStatus>[] = [
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
                        <Image src={row.original.imageUrl || ''} alt={row.original.name || ''} fill className="object-cover" />
                    </div>
                    <div className="font-medium">{row.getValue('name')}</div>
                </div>
            )
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
                <Badge variant={row.original.status === 'stale' ? 'destructive' : 'default'} className={row.original.status === 'active' ? 'bg-green-600/80' : ''}>
                    {row.original.status}
                </Badge>
            )
        },
        {
            accessorKey: 'lastShare',
            header: 'Last Shared',
            cell: ({ row }) => row.original.lastShare ? formatDistanceToNow(row.original.lastShare, { addSuffix: true }) : 'Never'
        },
        {
            accessorKey: 'commissionRate',
            header: () => <div className="text-right">Commission</div>,
            cell: ({ row }) => {
                return isEditing === row.original.id ? (
                    <CommissionInput product={row.original} onSave={() => setIsEditing(null)} />
                ) : (
                    <div className="text-right flex items-center justify-end gap-2 group min-h-[40px]">
                        <span>{row.original.commissionRate || 0}%</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setIsEditing(row.original.id)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                    </div>
                )
            }
        },
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onRowSelectionChange: setRowSelection,
        state: { sorting, rowSelection },
    });

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
                            <DropdownMenuItem>Pause from Reselling</DropdownMenuItem>
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
                                    No products available for reselling.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
