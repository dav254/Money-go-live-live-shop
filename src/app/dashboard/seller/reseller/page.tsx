
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
import { BadgePercent, Users, Trophy, BarChart2, Share2, Target, Percent } from 'lucide-react';
import { CommissionSettingsTable } from '@/components/seller/commission-settings-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import React from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { Progress } from '@/components/ui/progress';


interface ResellerStat {
  id: string;
  name: string;
  avatar: string;
  sales: number;
  commission: number;
}

const mockTopResellers: ResellerStat[] = [
    { id: 'reseller-1', name: 'John Doe', avatar: 'https://picsum.photos/seed/john/40', sales: 152, commission: 450.75 },
    { id: 'reseller-2', name: 'Jane Smith', avatar: 'https://picsum.photos/seed/jane/40', sales: 121, commission: 380.50 },
    { id: 'reseller-3', name: 'Mike Williams', avatar: 'https://picsum.photos/seed/mike/40', sales: 98, commission: 290.00 },
];

const mockTopSharedProducts = [
    { id: 'prod-1', name: 'Classic Leather Handbag', shares: 543, conversion: 5.2 },
    { id: 'prod-5', name: 'Chronograph Watch', shares: 412, conversion: 7.1 },
    { id: 'prod-6', name: 'Noise-Cancelling Headphones', shares: 388, conversion: 4.5 },
];

const mockCommissionPayoutData = [
    { date: 'Week 1', 'Commission Paid': 250 },
    { date: 'Week 2', 'Commission Paid': 450 },
    { date: 'Week 3', 'Commission Paid': 380 },
    { date: 'This Week', 'Commission Paid': 610 },
];

const TopResellersTable = () => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Reseller</TableHead>
                    <TableHead className="text-center">Sales Made</TableHead>
                    <TableHead className="text-right">Commission Earned (USD)</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                 {mockTopResellers.length > 0 ? (
                    mockTopResellers.map((reseller, index) => (
                        <TableRow key={reseller.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-lg w-6 text-center">{index + 1}</span>
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={reseller.avatar} />
                                        <AvatarFallback>{reseller.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{reseller.name}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-center font-medium">{reseller.sales}</TableCell>
                            <TableCell className="text-right font-semibold text-primary">${reseller.commission.toFixed(2)}</TableCell>
                        </TableRow>
                    ))
                 ) : (
                    <TableRow>
                        <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                            No sales from resellers yet.
                        </TableCell>
                    </TableRow>
                 )}
            </TableBody>
        </Table>
    );
};


export default function ResellerCenterPage() {
  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Reseller Center
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">5.8%</div>
                    <p className="text-xs text-muted-foreground">Average from all reseller links</p>
                    <Progress value={5.8} className="mt-2 h-2" />
                </CardContent>
            </Card>
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BarChart2 /> Commission Payouts</CardTitle>
                    <CardDescription>Total commission paid to all resellers in the last 4 weeks.</CardDescription>
                </CardHeader>
                <CardContent className="h-40">
                   <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={mockCommissionPayoutData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`}/>
                            <RechartsTooltip cursor={{ fill: 'hsla(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                            <Bar dataKey="Commission Paid" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
        <Tabs defaultValue="commissions" className="space-y-4">
            <TabsList>
                <TabsTrigger value="commissions"><BadgePercent className="mr-2 h-4 w-4"/>Commission Rules</TabsTrigger>
                <TabsTrigger value="top-performers"><Trophy className="mr-2 h-4 w-4"/>Top Performers</TabsTrigger>
                <TabsTrigger value="top-shared"><Share2 className="mr-2 h-4 w-4"/>Top Shared Products</TabsTrigger>
            </TabsList>
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
            <TabsContent value="top-performers" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Top Performing Resellers</CardTitle>
                        <CardDescription>This leaderboard shows which of your resellers are driving the most sales.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TopResellersTable />
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="top-shared" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Top Shared Products</CardTitle>
                        <CardDescription>Products most frequently shared by your reseller network.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead className="text-center">Total Shares</TableHead>
                                    <TableHead className="text-right">Conversion Rate</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mockTopSharedProducts.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">{p.name}</TableCell>
                                        <TableCell className="text-center font-bold">{p.shares}</TableCell>
                                        <TableCell className="text-right font-semibold">{p.conversion}%</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
