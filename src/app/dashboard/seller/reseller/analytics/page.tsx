
'use client';

import React, { useMemo } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
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
import { CircleDollarSign, ShoppingBag, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// --- MOCK DATA ---
const mockResellerStats = [
    { id: 'reseller-1', name: 'Alice', avatarUrl: 'https://picsum.photos/seed/alice/40', sales: 42, commission: 315.50 },
    { id: 'reseller-2', name: 'Ben', avatarUrl: 'https://picsum.photos/seed/ben/40', sales: 35, commission: 280.00 },
    { id: 'reseller-3', name: 'Clara', avatarUrl: 'https://picsum.photos/seed/clara/40', sales: 28, commission: 210.75 },
    { id: 'reseller-4', name: 'David', avatarUrl: 'https://picsum.photos/seed/david/40', sales: 15, commission: 115.25 },
];
// --- END MOCK DATA ---

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

const UserCell = ({ name, avatarUrl }: { name: string, avatarUrl: string }) => {
    return (
        <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl} alt={name} />
                <AvatarFallback>{name?.[0]}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{name}</span>
        </div>
    );
};


export default function ResellerAnalyticsPage() {
    
    // Calculations are now based on the mock data
    const totalResellerSales = mockResellerStats.reduce((sum, r) => sum + r.sales, 0);
    const totalCommission = mockResellerStats.reduce((sum, r) => sum + r.commission, 0);

    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Reseller Analytics</h1>
                
                <div className="grid gap-4 md:grid-cols-3">
                    <StatCard title="Total Reseller Sales" value={totalResellerSales.toLocaleString()} icon={ShoppingBag} />
                    <StatCard title="Total Commissions Paid" value={`$${totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={CircleDollarSign} />
                    <StatCard title="Active Resellers" value={mockResellerStats.length.toLocaleString()} icon={Users} />
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Top Performing Resellers</CardTitle>
                        <CardDescription>Your resellers ranked by total commission earned.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Reseller</TableHead>
                                    <TableHead className="text-center">Sales</TableHead>
                                    <TableHead className="text-right">Commission Earned</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {mockResellerStats.length > 0 ? (
                                    mockResellerStats.map(reseller => (
                                        <TableRow key={reseller.id}>
                                            <TableCell><UserCell name={reseller.name} avatarUrl={reseller.avatarUrl} /></TableCell>
                                            <TableCell className="text-center font-medium">{reseller.sales}</TableCell>
                                            <TableCell className="text-right font-bold text-primary">${reseller.commission.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                            No sales from resellers yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}
