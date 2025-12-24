
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { CommissionSettingsTable } from '@/components/seller/commission-settings-table';
import { SellerTopSharedProductsTable } from '@/components/seller/seller-top-shared-products-table';
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


const mockResellers = [
    { name: 'Alice', sales: 15, earnings: 450.75, status: 'Active' },
    { name: 'Bob', sales: 10, earnings: 320.50, status: 'Active' },
    { name: 'Charlie', sales: 5, earnings: 150.00, status: 'Pending' },
    { name: 'Diana', sales: 2, earnings: 65.20, status: 'Active' },
];

const mockStats = {
    totalResellers: 4,
    totalSales: 32,
    totalCommissionPaid: 986.45,
};

const StatCard = ({ title, value, icon: Icon }: { title: string, value: string, icon: React.ElementType }) => (
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

export default function ResellerCenterPage() {
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
                        <StatCard title="Total Resellers" value={mockStats.totalResellers.toString()} icon={Users} />
                        <StatCard title="Total Reseller Sales" value={mockStats.totalSales.toString()} icon={ShoppingBag} />
                        <StatCard title="Total Commission Paid" value={`$${mockStats.totalCommissionPaid.toLocaleString()}`} icon={CircleDollarSign} />
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>My Resellers</CardTitle>
                            <CardDescription>Manage and view the performance of your resellers.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Reseller</TableHead>
                                        <TableHead>Sales</TableHead>
                                        <TableHead>Your Earnings (USD)</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mockResellers.map(reseller => (
                                        <TableRow key={reseller.name}>
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={`https://picsum.photos/seed/${reseller.name}/40`} />
                                                    <AvatarFallback>{reseller.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                {reseller.name}
                                            </TableCell>
                                            <TableCell>{reseller.sales}</TableCell>
                                            <TableCell>${reseller.earnings.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Badge variant={reseller.status === 'Active' ? 'default' : 'secondary'} className={reseller.status === 'Active' ? 'bg-green-600/80' : ''}>
                                                    {reseller.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Top Shared Products</CardTitle>
                            <CardDescription>Your products being shared most frequently by the reseller network.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <SellerTopSharedProductsTable />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="commissions" className="space-y-4">
                    <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                        <BadgePercent />
                        Set Product Commission Rates
                        </CardTitle>
                        <CardDescription>Set the percentage a reseller will earn for selling each product. A rate of 0% means the product is not available for reselling.</CardDescription>
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
