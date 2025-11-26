
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, LineChart, Users, BarChart, BadgePercent, CircleDollarSign, FolderKanban, Bot, Sparkles } from 'lucide-react';
import { CommissionSettingsTable } from '@/components/seller/commission-settings-table';

export default function ResellerPerformancePage() {
  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Reseller Center
        </h1>
        <Tabs defaultValue="performance" className="space-y-4">
            <TabsList>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="commissions">Commissions</TabsTrigger>
                <TabsTrigger value="payouts">Payouts</TabsTrigger>
                <TabsTrigger value="media-kits">Media Kits</TabsTrigger>
                <TabsTrigger value="ai-autoresell">AI Auto-Resell</TabsTrigger>
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
            <TabsContent value="commissions" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BadgePercent />
                      Set Commission Rules
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CommissionSettingsTable />
                  </CardContent>
                </Card>
            </TabsContent>
             <TabsContent value="payouts" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                        <CircleDollarSign />
                        Payout Control
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
                        <p className="text-muted-foreground">
                            View pending and released payouts to your resellers here.
                        </p>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="media-kits" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                        <FolderKanban />
                        Product Media for Resellers
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
                        <p className="text-muted-foreground">
                            Upload product videos, images, and descriptions for your resellers to use.
                        </p>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="ai-autoresell" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                        <Bot />
                        AI-Powered Reselling (Premium)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                        <Sparkles className="h-12 w-12 text-primary mb-4" />
                        <p className="text-muted-foreground max-w-md">
                            Enable our AI to automatically promote your products across the platform, create ads, and generate marketing content.
                        </p>
                        <p className="text-sm text-primary font-bold mt-4">This is a premium feature.</p>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
