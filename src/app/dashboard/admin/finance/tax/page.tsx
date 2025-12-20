
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, FileText, Percent, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import React, { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { WalletTransaction } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminTaxPage() {
  // In a real application, this value would be fetched from a global settings document.
  const [taxRate, setTaxRate] = React.useState(16.0);
  const firestore = useFirestore();

  const taxTransactionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'walletTransactions'), where('type', '==', 'TAX'));
  }, [firestore]);

  const { data: taxTransactions, isLoading } = useCollection<WalletTransaction>(taxTransactionsQuery);

  const taxCollected = useMemo(() => {
    if (!taxTransactions) return 0;
    return taxTransactions.reduce((acc, tx) => acc + tx.amount, 0);
  }, [taxTransactions]);

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
                        <Input id="tax-rate" type="number" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} />
                    </div>
                    <Button disabled>Save Tax Rate (Coming Soon)</Button>
                </CardContent>
            </Card>

            {/* Tax Reporting */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileText /> Tax Reporting</CardTitle>
                    <CardDescription>Generate reports of collected taxes for remittance to the government (e.g., KRA).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="rounded-lg border bg-background p-4 space-y-1">
                        <p className="text-sm text-muted-foreground">Total Tax Collected (All Time)</p>
                        {isLoading ? (
                            <Skeleton className="h-8 w-1/2" />
                        ) : (
                            <p className="text-2xl font-bold">${taxCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        )}
                    </div>
                    <Button variant="outline" className="w-full" disabled>Download Tax Report (Coming Soon)</Button>
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
