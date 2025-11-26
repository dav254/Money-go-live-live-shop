
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
import { BadgePercent } from 'lucide-react';
import { CommissionSettingsTable } from '@/components/seller/commission-settings-table';
import { ManageResellersTable } from '@/components/seller/manage-resellers-table';

export default function ResellerCenterPage() {
  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Reseller Center
        </h1>
        <Tabs defaultValue="requests" className="space-y-4">
            <TabsList>
                <TabsTrigger value="requests">Manage Resellers</TabsTrigger>
                <TabsTrigger value="commissions">Commission Rules</TabsTrigger>
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
        </Tabs>
      </div>
    </SellerLayout>
  );
}
