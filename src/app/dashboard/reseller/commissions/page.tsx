
"use client";

import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/firebase';
import { ResellActivity } from '@/lib/types';
import ResellerLayout from '@/components/ResellerLayout';
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
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState<ResellActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchCommissions = async () => {
      try {
        setLoading(true);
        // Query to get all sales activities where the current user is the reseller
        const q = query(
          collection(db, 'resellActivities'), 
          where('resellerId', '==', currentUser.uid),
          where('type', '==', 'sale'),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const commissionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResellActivity));
        setActivities(commissionsData);
        setError(null);
      } catch (err) {
        console.error("Error fetching commission activities:", err);
        setError('Failed to load your commission history. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCommissions();
  }, [currentUser]);

  return (
    <ResellerLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Your Commissions</h1>
        <p className="text-muted-foreground">
          Here is a detailed history of the commissions you've earned from your sales.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Your Commission Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading your commission history...</p>
            ) : error ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : activities.length === 0 ? (
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
