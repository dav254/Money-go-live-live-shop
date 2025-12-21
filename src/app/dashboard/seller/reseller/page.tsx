
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
import { BadgePercent, Users, Trophy } from 'lucide-react';
import { CommissionSettingsTable } from '@/components/seller/commission-settings-table';
import { ManageResellersTable } from '@/components/seller/manage-resellers-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import React from 'react';

const mockTopResellers = [
    { id: 'reseller-1', name: 'Digital Hustler', avatar: 'https://picsum.photos/seed/reseller1/40', sales: 25, commission: 350.75 },
    { id: 'reseller-2', name: 'Campus Deals', avatar: 'https://picsum.photos/seed/reseller2/40', sales: 18, commission: 210.50 },
    { id: 'reseller-3', name: 'Nairobi Finds', avatar: 'https://picsum.photos/seed/reseller3/40', sales: 12, commission: 155.00 },
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
                {mockTopResellers.map((reseller, index) => (
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
                ))}
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
        <Tabs defaultValue="requests" className="space-y-4">
            <TabsList>
                <TabsTrigger value="requests"><Users className="mr-2 h-4 w-4"/>Manage Resellers</TabsTrigger>
                <TabsTrigger value="commissions"><BadgePercent className="mr-2 h-4 w-4"/>Commission Rules</TabsTrigger>
                <TabsTrigger value="top-performers"><Trophy className="mr-2 h-4 w-4"/>Top Performers</TabsTrigger>
            </TabsList>
            <TabsContent value="requests" className="space-y-4">
                 <Card>
                  <CardHeader>
                    <CardTitle>Manage Resellers & Requests</CardTitle>
                    <CardDescription>Approve or reject requests from users who want to resell your products. You can also remove existing resellers.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ManageResellersTable />
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
        </Tabs>
      </div>
    </SellerLayout>
  );
}
