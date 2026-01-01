
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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Badge, BadgePercent, PackagePlus, Loader2 } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { updateResellerSettings } from '@/app/actions/product-actions';
import { useCallback, useState, useEffect } from 'react';

function CommissionRow({ product, onUpdate, isChanged, onSave, isSaving }: { product: Product; onUpdate: (productId: string, field: 'isResellable' | 'commissionRate', value: boolean | number) => void; isChanged: boolean; onSave: (productId: string) => void; isSaving: boolean; }) {
    const isEnabled = product.isResellable || false;
    const commissionRate = product.commissionRate || 10;
    const resellerEarns = (product.price * commissionRate) / 100;
    const youGet = product.price - resellerEarns;
    const commissionRates = [5, 10, 15, 20, 25];

    return (
        <TableRow>
            <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                    <Image src={product.imageUrl || 'https://picsum.photos/seed/product/40'} alt={product.name || 'Product Image'} width={40} height={40} className="rounded-md object-cover" />
                    <span className="truncate">{product.name}</span>
                </div>
            </TableCell>
            <TableCell className="font-semibold">${product.price.toFixed(2)}</TableCell>
            <TableCell className="w-[150px]">
                 <Select
                    value={String(commissionRate)}
                    onValueChange={(value) => onUpdate(product.id, 'commissionRate', Number(value))}
                >
                    <SelectTrigger className="w-24 mx-auto">
                        <SelectValue placeholder="Rate" />
                    </SelectTrigger>
                    <SelectContent>
                        {commissionRates.map(rate => (
                            <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell className="font-semibold text-green-600">+ ${resellerEarns.toFixed(2)}</TableCell>
            <TableCell className="font-semibold text-primary">+ ${youGet.toFixed(2)}</TableCell>
            <TableCell className="text-center">
                <Switch
                    checked={isEnabled}
                    onCheckedChange={(enabled) => onUpdate(product.id, 'isResellable', enabled)}
                />
            </TableCell>
            <TableCell className="text-right">
                <Button size="sm" onClick={() => onSave(product.id)} disabled={!isChanged || isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
            </TableCell>
        </TableRow>
    );
}

export function CommissionSettingsTable() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    
    const [managedProducts, setManagedProducts] = useState<Product[]>([]);
    const [changedProducts, setChangedProducts] = useState<Record<string, Partial<Product>>>({});
    const [savingId, setSavingId] = useState<string | null>(null);

    const productsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

    const { data: initialProducts, isLoading } = useCollection<Product>(productsQuery);

    useEffect(() => {
        if (initialProducts) {
            setManagedProducts(initialProducts);
        }
    }, [initialProducts]);

    const handleProductUpdate = (productId: string, field: 'isResellable' | 'commissionRate', value: boolean | number) => {
        setManagedProducts(currentProducts => 
            currentProducts.map(p => {
                if (p.id === productId) {
                    return { ...p, [field]: value };
                }
                return p;
            })
        );
        setChangedProducts(currentChanges => ({
            ...currentChanges,
            [productId]: {
                ...currentChanges[productId],
                [field]: value
            }
        }));
    };

    const handleSaveChange = useCallback(async (productId: string) => {
        if (!user) return;

        const changes = changedProducts[productId];
        if (!changes) return;
        
        setSavingId(productId);

        const payload = {
            productId,
            isResellable: managedProducts.find(p => p.id === productId)?.isResellable || false,
            commissionRate: managedProducts.find(p => p.id === productId)?.commissionRate || 0,
            ...changes
        };

        try {
            const token = await user.getIdToken();
            const result = await updateResellerSettings(payload, token);
            
            if (result.success) {
                 toast({
                    title: "Setting Saved!",
                    description: `Changes for the product have been saved.`
                });
                setChangedProducts(currentChanges => {
                    const newChanges = { ...currentChanges };
                    delete newChanges[productId];
                    return newChanges;
                });
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error Saving', description: error.message || 'You do not have permission to perform this action.' });
        } finally {
            setSavingId(null);
        }
    }, [changedProducts, firestore, toast, user, managedProducts]);

    if (isLoading) {
        return (
            <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="w-full h-16" />)}
            </div>
        );
    }
    
    if (!managedProducts || managedProducts.length === 0) {
        return (
             <div className="text-center py-10 border-2 border-dashed rounded-lg">
                <PackagePlus className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium">No products found</h3>
                <p className="mt-1 text-sm text-muted-foreground">You haven't added any products yet. Add one to get started!</p>
                <div className="mt-6">
                    <Button asChild>
                        <Link href="/dashboard/products?tab=add-new">Add Product</Link>
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                <BadgePercent />
                Set Product Commission Rules
                </CardTitle>
                <CardDescription>Review and set the commission for each of your products. The table below shows a clear breakdown of earnings for you and your resellers. Use the toggle to enable or disable reselling for specific items.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[250px]">Product</TableHead>
                            <TableHead>Product Price</TableHead>
                            <TableHead className="text-center">Commission Rate (%)</TableHead>
                            <TableHead>Reseller Earns</TableHead>
                            <TableHead>You Get</TableHead>
                            <TableHead className="text-center">Enable Reselling</TableHead>
                            <TableHead className="text-right">Save</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {managedProducts.map((product) => (
                            <CommissionRow 
                                key={product.id} 
                                product={product} 
                                onUpdate={handleProductUpdate} 
                                isChanged={!!changedProducts[product.id]}
                                onSave={handleSaveChange}
                                isSaving={savingId === product.id}
                            />
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
