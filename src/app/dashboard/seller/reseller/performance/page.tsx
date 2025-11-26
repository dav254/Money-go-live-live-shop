
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
import { DollarSign, LineChart, Users, BarChart, BadgePercent, CircleDollarSign, FolderKanban, Bot, Sparkles } from 'lucide-react';
import { CommissionSettingsTable } from '@/components/seller/commission-settings-table';
import { ManageResellersTable } from '@/components/seller/manage-resellers-table';

export default function ResellerPerformancePage() {
  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Reseller Center
        </h1>
        <Tabs defaultValue="commissions" className="space-y-4">
            <TabsList>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="manage-resellers">Manage Resellers</TabsTrigger>
                <TabsTrigger value="commissions">Commission Rules</TabsTrigger>
            </TabsList>
            <TabsContent value="performance" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Resellers</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">48</div>
                      <p className="text-xs text-muted-foreground">13 active this month</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Sales via Resellers</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">KES 178,550</div>
                      <p className="text-xs text-muted-foreground">+19% from last month</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Commissions Paid</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">KES 14,200</div>
                      <p className="text-xs text-muted-foreground">Total paid out to resellers</p>
                    </CardContent>
                  </Card>
                   <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Top Reseller</CardTitle>
                       <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">@Nairobiseller</div>
                      <p className="text-xs text-muted-foreground">35 sales this month</p>
                    </CardContent>
                  </Card>
                </div>
                 <Card>
                    <CardHeader>
                        <CardTitle>Performance Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center h-64 bg-muted/50 rounded-md">
                         <p className="text-muted-foreground">Chart and detailed analytics will be displayed here.</p>
                    </CardContent>
                </Card>
            </TabsContent>
             <TabsContent value="manage-resellers" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Manage Resellers</CardTitle>
                        <CardDescription>Approve or deny requests from users who want to resell your products.</CardDescription>
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
                    <CardDescription>Set the percentage a reseller will earn for selling each product. A rate of 0 means the product is not available for reselling.</CardDescription>
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

