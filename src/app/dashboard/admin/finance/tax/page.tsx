
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, FileText, Percent, Loader2, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import React, { useMemo, useState, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, setDoc } from 'firebase/firestore';
import type { WalletTransaction } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export default function AdminTaxPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const settingsRef = useMemoFirebase(() => doc(firestore, 'systemSettings', 'tax'), [firestore]);
  const { data: taxSettings, isLoading: isSettingsLoading } = useDoc<{ rate: number }>(settingsRef);

  const [taxRate, setTaxRate] = useState(16.0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (taxSettings) {
        setTaxRate(taxSettings.rate || 16.0);
    }
  }, [taxSettings]);

  const taxTransactionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'walletTransactions'), where('type', '==', 'TAX'));
  }, [firestore]);

  const { data: taxTransactions, isLoading: isTransactionsLoading } = useCollection<WalletTransaction>(taxTransactionsQuery);

  const taxCollected = useMemo(() => {
    if (!taxTransactions) return 0;
    return taxTransactions.reduce((acc, tx) => acc + tx.amount, 0);
  }, [taxTransactions]);

  const handleSaveTaxRate = async () => {
      if (!firestore) return;
      setIsSaving(true);
      try {
          await setDoc(settingsRef, { rate: taxRate }, { merge: true });
          toast({ title: 'Tax Rate Updated', description: `The default VAT rate is now ${taxRate}%.` });
      } catch (error) {
          toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not save tax settings.' });
      } finally {
          setIsSaving(false);
      }
  };

  const isLoading = isSettingsLoading || isTransactionsLoading;

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
            Taxes are **paid by the buyer** at checkout. The rate set here is automatically added to the buyer's invoice. Collected taxes are pooled here for you to remit to government authorities. This model ensures seller earnings remain untouched.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Percent /> Tax Rate Configuration</CardTitle>
                    <CardDescription>Set the Value Added Tax (VAT) rate for all marketplace sales.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="tax-rate">Current VAT Rate (%)</Label>
                        <Input 
                            id="tax-rate" 
                            type="number" 
                            value={taxRate} 
                            onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} 
                        />
                    </div>
                    <Button onClick={handleSaveTaxRate} disabled={isSaving || isSettingsLoading} className="w-full">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Tax Rate
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileText /> Tax Reporting</CardTitle>
                    <CardDescription>View total tax liability collected from successful transactions.</CardDescription>
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
                    <Button variant="outline" className="w-full" disabled>
                        <Download className="mr-2 h-4 w-4" />
                        Download KRA Report (Coming Soon)
                    </Button>
                </CardContent>
            </Card>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-bold">Legal Disclaimer</AlertTitle>
          <AlertDescription>
            This module provides financial data for reporting only. You are responsible for ensuring tax compliance and remitting all collected funds to the relevant authorities.
          </AlertDescription>
        </Alert>
      </div>
    </AdminLayout>
  );
}
