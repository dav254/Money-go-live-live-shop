
'use client';

import React, { Suspense, useMemo, useState, useEffect, useCallback } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import {
  BadgePercent,
  CircleDollarSign,
  BarChart3,
  PackagePlus,
  ShoppingBag,
  Loader2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter } from '@/firebase';
import { collection, doc, query, where, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Product, UserProfile, Order } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const SalesOverTimeChart = () => (
    <Card>
        <CardHeader>
            <CardTitle>Sales Over Time</CardTitle>
            <CardDescription>Your gross revenue over the last 30 days.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="h-80 w-full bg-muted rounded-md flex items-center justify-center">
                <div className="flex flex-col items-center text-center">
                    <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground mt-2">[Chart Placeholder]</p>
                </div>
            </div>
        </CardContent>
    </Card>
);

const TopPerformingProductsTable = () => {
    const staticProducts = [
        { id: 'prod1', name: 'Vintage Leather Jacket', imageUrl: 'https://picsum.photos/seed/jacket/40', views: 2500, sales: 15, revenue: 2250.00 },
        { id: 'prod4', name: 'Designer Handbag', imageUrl: 'https://picsum.photos/seed/bag/40', views: 1200, sales: 12, revenue: 5400.00 },
        { id: 'prod3', name: 'Retro Sunglasses', imageUrl: 'https://picsum.photos/seed/glasses/40', views: 3100, sales: 8, revenue: 600.00 },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Top Performing Products</CardTitle>
                <CardDescription>Your best-selling products by revenue.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-center">Views</TableHead>
                            <TableHead className="text-center">Sales</TableHead>
                            <TableHead className="text-center">Conversion</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {staticProducts.map(product => {
                            const conversionRate = product.views > 0 ? (product.sales / product.views) * 100 : 0;
                            return (
                                <TableRow key={product.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Image src={product.imageUrl || 'https://picsum.photos/seed/placeholder/40'} alt={product.name} width={40} height={40} className="rounded-md object-cover" />
                                            <span className="font-medium">{product.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">{product.views.toLocaleString()}</TableCell>
                                    <TableCell className="text-center">{product.sales}</TableCell>
                                    <TableCell className="text-center text-muted-foreground">{conversionRate.toFixed(1)}%</TableCell>
                                    <TableCell className="text-right font-semibold">${product.revenue.toFixed(2)}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

const CustomerAnalytics = () => (
     <Card>
        <CardHeader>
            <CardTitle>Customer Snapshot</CardTitle>
             <CardDescription>An overview of your customer loyalty.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">New Customers</p>
                <p className="text-3xl font-bold">38</p>
                 <p className="text-xs text-muted-foreground">in the last 30 days</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">Returning Customers</p>
                <p className="text-3xl font-bold">12</p>
                 <p className="text-xs text-muted-foreground">made a repeat purchase</p>
            </div>
        </CardContent>
    </Card>
);

const MyResellersTable = () => {
    const staticResellers = [
        { id: 'reseller1', fullName: 'Alice Johnson', profilePictureUrl: 'https://picsum.photos/seed/alice/40', salesCount: 15, totalEarnings: 450.75 },
        { id: 'reseller2', fullName: 'Bob Williams', profilePictureUrl: 'https://picsum.photos/seed/bob/40', salesCount: 8, totalEarnings: 210.50 },
    ];

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Top Resellers</TableHead>
                    <TableHead className="text-center">Sales Generated</TableHead>
                    <TableHead className="text-right">Commission Paid</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {staticResellers.map(reseller => (
                    <TableRow key={reseller.id}>
                        <TableCell className="font-medium flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={reseller.profilePictureUrl} />
                                <AvatarFallback>{reseller.fullName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span>{reseller.fullName}</span>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{reseller.salesCount}</TableCell>
                        <TableCell className="text-right text-muted-foreground">${reseller.totalEarnings.toFixed(2)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};


function CommissionRow({ product, onUpdate, isChanged, onSave, isSaving }: { product: Product; onUpdate: (productId: string, field: 'isResellable' | 'commissionRate', value: boolean | number) => void; isChanged: boolean; onSave: (productId: string) => void; isSaving: boolean; }) {
    const isEnabled = product.isResellable || false;
    const commissionRate = isEnabled ? (product.commissionRate ?? 10) : 0;
    const resellerEarns = (product.price * commissionRate) / 100;
    const youGet = product.price - resellerEarns;

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
                <Input
                    type="number"
                    value={product.commissionRate ?? 10}
                    onChange={(e) => onUpdate(product.id, 'commissionRate', parseInt(e.target.value))}
                    className="w-24 text-center mx-auto"
                    disabled={!isEnabled}
                />
            </TableCell>
            <TableCell className="font-semibold text-green-600">+ ${resellerEarns.toFixed(2)}</TableCell>
            <TableCell className="font-semibold text-primary">+ ${youGet.toFixed(2)}</TableCell>
            <TableCell className="text-right flex items-center justify-end gap-2">
                <Switch
                    checked={isEnabled}
                    onCheckedChange={(enabled) => onUpdate(product.id, 'isResellable', enabled)}
                />
                <Button size="sm" onClick={() => onSave(product.id)} disabled={!isChanged || isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
            </TableCell>
        </TableRow>
    );
}

const CommissionSettingsTable = () => {
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

    const handleSaveChange = async (productId: string) => {
        if (!changedProducts[productId] || !firestore) return;
        setSavingId(productId);
        
        const product = managedProducts.find(p => p.id === productId);
        if (!product) return;

        const productRef = doc(firestore, 'products', productId);
        
        const dataToSave = {
            isResellable: product.isResellable,
            commissionRate: product.isResellable ? (product.commissionRate || 10) : 0,
            updatedAt: serverTimestamp(),
        };

        try {
            await updateDoc(productRef, dataToSave);
            toast({
                title: "Setting Saved!",
                description: `Changes for ${product.name} have been saved.`
            });
            // Remove from changed products after successful save
            setChangedProducts(currentChanges => {
                const newChanges = { ...currentChanges };
                delete newChanges[productId];
                return newChanges;
            });
        } catch (error) {
            console.error("Failed to save product setting:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: productRef.path,
                operation: 'update',
                requestResourceData: dataToSave,
            }));
        } finally {
            setSavingId(null);
        }
    };

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
                            <TableHead className="text-right">Enable Reselling & Save</TableHead>
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
};

export default function ResellerCenterPage() {
    const staticStats = {
        totalRevenue: 28450.50,
        totalSales: 249,
        totalResellers: 12,
        avgOrderValue: 114.26,
    };

    return (
        <SellerLayout>
        <div className="flex-1 space-y-4 p-8 pt-6">
             <div className="flex items-center justify-between space-y-2">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                Reseller Center
                </h1>
            </div>
            
            <Tabs defaultValue="commissions" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="commissions">Commission Rules</TabsTrigger>
                </TabsList>

                <TabsContent value="analytics" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard title="Total Revenue" value={`$${staticStats.totalRevenue.toLocaleString()}`} icon={CircleDollarSign} description="+20.1% from last month" />
                        <StatCard title="Total Sales" value={`+${staticStats.totalSales.toString()}`} icon={ShoppingBag} description="+18.1% from last month" />
                        <StatCard title="Active Resellers" value={staticStats.totalResellers.toString()} icon={Users} description="+2 since last month" />
                        <StatCard title="Average Order Value" value={`$${staticStats.avgOrderValue.toFixed(2)}`} icon={BadgePercent} description="+5.2% from last month" />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <SalesOverTimeChart />
                        </div>
                        <div className="space-y-4">
                            <CustomerAnalytics />
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <TopPerformingProductsTable />
                        <Card>
                            <CardHeader>
                                <CardTitle>Reseller Channel</CardTitle>
                                <CardDescription>Your top partners driving sales.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <MyResellersTable />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="commissions" className="space-y-4">
                   <CommissionSettingsTable />
                </TabsContent>
            </Tabs>
        </div>
        </SellerLayout>
    );
}
