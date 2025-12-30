
"use client";

import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/firebase';
import { ResellActivity } from '@/lib/types';
import SellerLayout from '@/components/SellerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
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

const SellerEarningsPage = () => {
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState<ResellActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchEarnings = async () => {
      try {
        setLoading(true);
        // Query to get all sales activities where the current user is the seller
        const q = query(
          collection(db, 'resellActivities'), 
          where('sellerId', '==', currentUser.uid),
          where('type', '==', 'sale'),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const earningsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResellActivity));
        setActivities(earningsData);
        setError(null);
      } catch (err) {
        console.error("Error fetching earnings activities:", err);
        setError('Failed to load your earnings history. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, [currentUser]);

  return (
    <SellerLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Reseller Earnings</h1>
        <p className="text-muted-foreground">
          Here is a detailed history of the earnings you've received from reseller sales.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Your Earnings Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading your earnings history...</p>
            ) : error ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : activities.length === 0 ? (
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>No Earnings Yet</AlertTitle>
                <AlertDescription>
                  You haven't received any earnings from reseller sales yet. Once a reseller sells one of your enabled products, the details will appear here.
                </AlertDescription>
              </Alert>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Your Earnings</TableHead>
                    <TableHead>Commission Paid</TableHead>
                    <TableHead>Reseller ID</TableHead>
                     <TableHead>Order ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>{activity.productName}</TableCell>
                      <TableCell>{formatDate(activity.createdAt)}</TableCell>
                      <TableCell className="text-right font-medium text-green-500">{formatCurrency(activity.sellerGets)}</TableCell>
                      <TableCell className="text-red-500">{formatCurrency(activity.resellerEarns)}</TableCell>
                      <TableCell><Badge variant="outline">{activity.resellerId.substring(0, 8)}...</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{activity.orderId.substring(0, 8)}...</TableCell>
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
