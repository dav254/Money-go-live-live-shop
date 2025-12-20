
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, FileText, Percent } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/dashboard/date-range-picker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AdminTaxPage() {
  // Mock data for demonstration purposes
  const taxRate = 16.0;
  const taxCollected = 12540.50;

  return (
    <AdminLayout>
      <div className="flex-1 space-y-6 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Finance: Tax Center
        </h1>
        
        <Alert variant="default" className="bg-yellow-600/10 border-yellow-500/50 text-yellow-200">
          <AlertCircle className="h-4 w-4 !text-yellow-400" />
          <AlertTitle className="font-bold !text-yellow-300">Important Legal Information</AlertTitle>
          <AlertDescription>
            This module is for reporting purposes only. You are responsible for ensuring tax compliance, including setting the correct rates and remitting all collected taxes to the relevant government authorities (e.g., KRA). Consult a tax professional for guidance.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tax Rate Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Percent /> Tax Rate Configuration</CardTitle>
                    <CardDescription>Set the Value Added Tax (VAT) rate for sales on the platform.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="tax-rate">Default VAT Rate (%)</Label>
                        <Input id="tax-rate" type="number" defaultValue={taxRate} />
                    </div>
                    <Button>Save Tax Rate</Button>
                    <p className="text-xs text-muted-foreground">This rate will be automatically applied to all sales at checkout.</p>
                </CardContent>
            </Card>

            {/* Tax Reporting */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileText /> Tax Reporting</CardTitle>
                    <CardDescription>Generate reports of collected taxes for remittance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Select Date Range</Label>
                        <DatePicker date={new Date()} setDate={() => {}} />
                    </div>
                     <div className="rounded-lg border bg-background p-4 space-y-1">
                        <p className="text-sm text-muted-foreground">Total Tax Collected for Period</p>
                        <p className="text-2xl font-bold">${taxCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <Button variant="outline" className="w-full">Download Tax Report (CSV)</Button>
                </CardContent>
            </Card>
        </div>

      </div>
    </AdminLayout>
  );
}
