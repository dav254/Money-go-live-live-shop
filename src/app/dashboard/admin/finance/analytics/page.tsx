
'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DollarSign,
  TrendingUp,
} from 'lucide-react';

export default function AdminFinanceAnalyticsPage() {
  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Financial Analytics
        </h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Network Yield</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">$0.00</div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Real-time signal inactive</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Platform Fees</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">$0.00</div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Verified earnings inactive</p>
            </CardContent>
          </Card>
        </div>
        
        <Card className="bg-neutral-900 border-dashed border-white/10 rounded-[2rem]">
            <CardContent className="h-64 flex flex-col items-center justify-center text-center opacity-30">
                <DollarSign className="h-12 w-12 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Financial Telemetry Restricted</p>
            </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
