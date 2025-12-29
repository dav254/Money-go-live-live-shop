
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgePercent, Users, ShoppingBag, CircleDollarSign } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import Image from 'next/image';

// --- Static Components with Placeholder Data ---

const StatCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const MyResellersTable = () => {
    const staticResellers = [
        { id: 'reseller1', fullName: 'Alice Johnson', profilePictureUrl: 'https://picsum.photos/seed/alice/40', salesCount: 15, totalEarnings: 450.75, status: 'Active' },
        { id: 'reseller2', fullName: 'Bob Williams', profilePictureUrl: 'https://picsum.photos/seed/bob/40', salesCount: 8, totalEarnings: 210.50, status: 'Active' },
        { id: 'reseller3', fullName: 'Charlie Brown', profilePictureUrl: 'https://picsum.photos/seed/charlie/40', salesCount: 2, totalEarnings: 35.00, status: 'Active' },
    ];

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Reseller</TableHead>
                    <TableHead className="text-center">Sales</TableHead>
                    <TableHead className="text-right">Commission Paid (USD)</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                            <div>
                                <span>{reseller.fullName}</span>
                                <p className="text-xs font-mono text-muted-foreground">ID: #{reseller.id.substring(0,6)}</p>
                            </div>
                        </TableCell>
                        <TableCell className="text-center">{reseller.salesCount}</TableCell>
                        <TableCell className="text-right">${reseller.totalEarnings.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                            <Badge variant="default" className="bg-green-600/80">{reseller.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="outline" size="sm">View Sales</Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

const SellerTopSharedProductsTable = () => {
    const staticProducts = [
        { id: 'prod1', name: 'Vintage Leather Jacket', imageUrl: 'https://picsum.photos/seed/jacket/40', shareCount: 128, salesCount: 12 },
        { id: 'prod2', name: 'Handmade Ceramic Mug', imageUrl: 'https://picsum.photos/seed/mug/40', shareCount: 95, salesCount: 8 },
        { id: 'prod3', name: 'Retro Sunglasses', imageUrl: 'https://picsum.photos/seed/glasses/40', shareCount: 72, salesCount: 5 },
    ];
    
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Total Shares</TableHead>
                    <TableHead className="text-center">Sales from Shares</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {staticProducts.map(product => (
                    <TableRow key={product.id}>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md object-cover" />
                                <span className="font-medium">{product.name}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{product.shareCount}</TableCell>
                        <TableCell className="text-center font-semibold">{product.salesCount}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

const CommissionSettingsTable = () => {
    const staticProducts = [
        { id: 'prod1', name: 'Vintage Leather Jacket', imageUrl: 'https://picsum.photos/seed/jacket/40', commission: 10, enabled: true },
        { id: 'prod2', name: 'Handmade Ceramic Mug', imageUrl: 'https://picsum.photos/seed/mug/40', commission: 10, enabled: false },
        { id: 'prod3', name: 'Retro Sunglasses', imageUrl: 'https://picsum.photos/seed/glasses/40', commission: 10, enabled: true },
        { id: 'prod4', name: 'Designer Handbag', imageUrl: 'https://picsum.photos/seed/bag/40', commission: 10, enabled: true },
    ];

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead className="text-right">Enable Reselling</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {staticProducts.map((product) => (
                    <TableRow key={product.id}>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                                <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md object-cover" />
                                <span>{product.name}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="secondary">{product.commission}%</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <Switch checked={product.enabled} aria-label={`Enable reselling for ${product.name}`}/>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

// --- Main Page Component ---

export default function ResellerCenterPage() {

    const staticStats = {
        totalResellers: 12,
        totalSales: 47,
        totalCommissionPaid: 1255.80
    };

    return (
        <SellerLayout>
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
            Reseller Center
            </h1>
            
            <Tabs defaultValue="analytics" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="commissions">Commission Rules</TabsTrigger>
                </TabsList>

                <TabsContent value="analytics" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                        <StatCard title="Total Resellers" value={staticStats.totalResellers.toString()} icon={Users} />
                        <StatCard title="Total Reseller Sales" value={staticStats.totalSales.toString()} icon={ShoppingBag} />
                        <StatCard title="Total Commission Paid" value={`$${staticStats.totalCommissionPaid.toLocaleString()}`} icon={CircleDollarSign} />
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>My Resellers</CardTitle>
                            <CardDescription>Manage and view the performance of your resellers.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <MyResellersTable />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Top Shared Products</CardTitle>
                            <CardDescription>Your products being shared most frequently by the reseller network.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           {/* This is the component that was causing the error */}
                           <SellerTopSharedProductsTable />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="commissions" className="space-y-4">
                    <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                        <BadgePercent />
                        Set Product Commission
                        </CardTitle>
                        <CardDescription>Enable reselling for a product to automatically offer a fixed 10% commission. A disabled switch means the product is not available for reselling.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CommissionSettingsTable />
                    </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
        </SellerLayout>
    );
}
