
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { ResellActivity } from '@/lib/types';
import { ResellerLayout } from '@/components/layout/reseller-layout';
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

const ResellerCommissionsPage = () => {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();

  const activitiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'resellActivities'), 
      where('resellerId', '==', user.uid),
      where('type', '==', 'sale'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: activities, isLoading: areActivitiesLoading } = useCollection<ResellActivity>(activitiesQuery);
  const isLoading = isUserLoading || areActivitiesLoading;
  
  return (
    <ResellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="text-2xl font-bold">Your Commissions</h1>
        <p className="text-muted-foreground">
          Here is a detailed history of the commissions you've earned from your sales.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Your Commission Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Loading your commission history...</p>
            ) : !activities || activities.length === 0 ? (
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>No Commissions Yet</AlertTitle>
                <AlertDescription>
                  You haven't earned any commissions yet. Start sharing product links to see your earnings grow!
                </AlertDescription>
              </Alert>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Your Commission</TableHead>
                    <TableHead>Order ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>{activity.productName}</TableCell>
                      <TableCell>{formatDate(activity.createdAt)}</TableCell>
                      <TableCell className="text-right font-medium text-green-500">{formatCurrency(activity.resellerEarns)}</TableCell>
                      <TableCell className="text-muted-foreground">{activity.orderId.substring(0, 8)}...</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ResellerLayout>
  );
};

export default ResellerCommissionsPage;
