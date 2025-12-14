
'use client';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Download,
  Wallet,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { DatePicker } from '@/components/dashboard/date-picker';
import React, { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Order, Payout } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';

const StatCard = ({ title, value, icon: Icon, description, isLoading, isPrimary }: { title: string, value: string, icon: React.ElementType, description?: string, isLoading: boolean, isPrimary?: boolean }) => (
    <Card className={isPrimary ? 'bg-primary/10 border-primary' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <>
                <Skeleton className="h-8 w-3/4 mb-2" />
                <Skeleton className="h-3 w-full" />
            </>
        ) : (
            <>
                <div className="text-2xl font-bold">{value}</div>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </>
        )}
      </CardContent>
    </Card>
);

const DownloadReportDialog = () => {
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: addDays(new Date(), -30),
      to: new Date(),
    });
    const { toast } = useToast();

    const handleGenerate = () => {
        toast({
            title: 'Feature Coming Soon!',
            description: 'Report generation is currently under development.',
        });
    }

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Download Commission Report</DialogTitle>
                <DialogDescription>Select a date range and format for your report.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Date Range</Label>
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={1}
                    />
                </div>
                 <div className="space-y-2">
                    <Label>Format</Label>
                    <Select defaultValue="csv">
                        <SelectTrigger>
                            <SelectValue placeholder="Select a format" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="csv">CSV (Comma-Separated Values)</SelectItem>
                            <SelectItem value="pdf">PDF (Portable Document Format)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleGenerate}>
                    <Download className="mr-2 h-4 w-4" />
                    Generate & Download
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}

export default function ResellerCommissionsPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();

    const ordersQuery = useMemoFirebase(() => {
        if (!user?.uid || !firestore) return null;
        return query(collection(firestore, 'orders'), where('resellerId', '==', user.uid));
    }, [firestore, user?.uid]);

    const payoutsQuery = useMemoFirebase(() => {
        if (!user?.uid || !firestore) return null;
        return query(collection(firestore, 'payouts'), where('sellerId', '==', user.uid), where('status', '==', 'completed'));
    }, [firestore, user?.uid]);
    
    const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);
    const { data: payouts, isLoading: arePayoutsLoading } = useCollection<Payout>(payoutsQuery);

    const isLoading = isUserLoading || areOrdersLoading || arePayoutsLoading;

    const commissionStats = React.useMemo(() => {
        if (!orders || !payouts) {
            return { total: 0, pending: 0, withdrawable: 0, paidOut: 0 };
        }
        
        let total = 0;
        let pending = 0;
        let withdrawable = 0;

        orders.forEach(order => {
            const commission = order.resellerCommission || 0;
            if (commission > 0) {
                total += commission;
                if (order.orderStatus === 'delivered') {
                    withdrawable += commission;
                } else if (order.orderStatus === 'processing' || order.orderStatus === 'shipped') {
                    pending += commission;
                }
            }
        });
        
        const paidOut = payouts.reduce((acc, p) => acc + p.amount, 0);
        withdrawable = withdrawable - paidOut;


        return { total, pending, withdrawable, paidOut };

    }, [orders, payouts]);
    
    const recentHistory = React.useMemo(() => {
        if (!orders) return [];
        return [...orders]
            .filter(o => o.resellerCommission && o.resellerCommission > 0)
            .sort((a,b) => b.orderDate.toDate().getTime() - a.orderDate.toDate().getTime())
            .slice(0, 5);
    }, [orders]);


  return (
    <ResellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Commissions & Earnings
          </h1>
          <div className="flex items-center space-x-2">
            <Dialog>
                <DialogTrigger asChild>
                     <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Download Report
                    </Button>
                </DialogTrigger>
                <DownloadReportDialog />
            </Dialog>
            <Button asChild variant="destructive" className="font-bold">
              <Link href="/dashboard/reseller/wallet">
                Request Payout <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Commission Earned" value={`$${commissionStats.total.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={Wallet} description="Lifetime earnings from all sales." isLoading={isLoading} />
            <StatCard title="Pending Commission" value={`$${commissionStats.pending.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={Wallet} description="From orders not yet delivered." isLoading={isLoading} />
            <StatCard title="Paid Out Commission" value={`$${commissionStats.paidOut.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={Wallet} description="Successfully sent to your account." isLoading={isLoading} />
            <StatCard title="Ready for Payout" value={`$${commissionStats.withdrawable.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={Wallet} description="Available for withdrawal now." isLoading={isLoading} isPrimary />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Recent Commission History</CardTitle>
                <CardDescription>Commissions are marked as 'pending' until the order is delivered.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                    [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        </TableRow>
                    ))
                ) : recentHistory.length > 0 ? (
                recentHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-xs text-muted-foreground">#{item.id.substring(0, 6)}...</TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="font-semibold text-green-500">${item.resellerCommission?.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                    <TableCell>
                       <Badge variant={item.orderStatus === 'delivered' ? 'default' : 'secondary'} className={item.orderStatus === 'delivered' ? 'bg-green-600/80' : 'bg-yellow-500/80'}>
                        {item.orderStatus === 'delivered' ? 'Cleared' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.orderDate.toDate().toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No commission history found.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
             <Button variant="link" className="mt-4 px-0">View all commission history</Button>
          </CardContent>
        </Card>
      </div>
    </ResellerLayout>
  );
}
