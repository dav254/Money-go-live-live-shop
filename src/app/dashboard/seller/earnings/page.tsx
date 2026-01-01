
"use client";

import React, { useMemo } from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { WalletTransaction } from '@/lib/types';

// Helper to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

// Helper to format dates
const formatDate = (timestamp: any) => {
  if (!timestamp || !timestamp.toDate) {
    return 'Invalid Date';
  }
  return timestamp.toDate().toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

const SellerEarningsPage = () => {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();

  const earningsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'walletTransactions'), 
      where('userId', '==', user.uid),
      where('type', 'in', ['SALE_EARNING', 'SHIPPING_FEE']),
      orderBy('timestamp', 'desc')
    );
  }, [user, firestore]);

  const { data: earnings, isLoading: areEarningsLoading } = useCollection<WalletTransaction>(earningsQuery);
  const isLoading = isUserLoading || areEarningsLoading;

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="text-2xl font-bold">Your Earnings</h1>
        <p className="text-muted-foreground">
          Here is a detailed history of the earnings you've received from your sales.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Your Earnings Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </div>
            ) : !earnings || earnings.length === 0 ? (
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>No Earnings Yet</AlertTitle>
                <AlertDescription>
                  You haven't received any earnings yet. Once a sale is completed, your earnings will appear here.
                </AlertDescription>
              </Alert>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings.map((earning) => (
                    <TableRow key={earning.id}>
                      <TableCell>{formatDate(earning.timestamp)}</TableCell>
                      <TableCell>{earning.description}</TableCell>
                       <TableCell className="text-muted-foreground">{earning.orderId.substring(0, 8)}...</TableCell>
                      <TableCell className="text-right font-medium text-green-500">{formatCurrency(earning.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
};

export default SellerEarningsPage;
