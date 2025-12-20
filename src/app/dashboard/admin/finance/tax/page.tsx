
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, FileText, Percent } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/dashboard/date-picker';
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
        
        <Alert variant="default" className="bg-blue-950/50 border-blue-500/30 text-blue-200">
          <AlertCircle className="h-4 w-4 !text-blue-400" />
          <AlertTitle className="font-bold !text-blue-300">How Tax Works on Go Earn</AlertTitle>
          <AlertDescription>
            Taxes (like VAT) are **paid by the buyer**, not deducted from the seller. The tax rate you set here is automatically added to the buyer's total at checkout. The collected tax is then reported here for you to remit to the authorities. This ensures sellers receive their expected earnings without seeing tax as a deduction from their revenue.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tax Rate Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Percent /> Tax Rate Configuration</CardTitle>
                    <CardDescription>Set the Value Added Tax (VAT) rate that will be applied to all sales at checkout.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="tax-rate">Default VAT Rate (%)</Label>
                        <Input id="tax-rate" type="number" defaultValue={taxRate} />
                    </div>
                    <Button>Save Tax Rate</Button>
                </CardContent>
            </Card>

            {/* Tax Reporting */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileText /> Tax Reporting</CardTitle>
                    <CardDescription>Generate reports of collected taxes for remittance to the government (e.g., KRA).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Select Reporting Period</Label>
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
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-bold">Legal Disclaimer</AlertTitle>
          <AlertDescription>
            This module is for reporting purposes only. You are responsible for ensuring tax compliance, including setting the correct rates and remitting all collected taxes to the relevant government authorities. Consult a tax professional for guidance.
          </AlertDescription>
        </Alert>

      </div>
    </AdminLayout>
  );
}
