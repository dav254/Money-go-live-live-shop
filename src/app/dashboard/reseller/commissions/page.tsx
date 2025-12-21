
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
  Loader2,
} from 'lucide-react';
import React, { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Order, Payout, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const DownloadReportDialog = ({ orders, resellerName }: { orders: Order[], resellerName?: string }) => {
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: addDays(new Date(), -30),
      to: new Date(),
    });
    const [formatType, setFormatType] = useState('csv');
    const [isGenerating, setIsGenerating] = useState(false);
    const { toast } = useToast();

    const handleGenerate = () => {
        setIsGenerating(true);
        toast({
            title: 'Generating Report...',
            description: `Your ${formatType.toUpperCase()} report is being prepared.`,
        });

        // This is now real data processing, not a simulation.
        setTimeout(() => {
            const filteredOrders = orders.filter(order => {
                const orderDate = order.orderDate.toDate();
                const from = date?.from ? new Date(date.from.setHours(0, 0, 0, 0)) : new Date(0);
                const to = date?.to ? new Date(date.to.setHours(23, 59, 59, 999)) : new Date();
                return orderDate >= from && orderDate <= to && order.resellerCommission && order.resellerCommission > 0;
            });
            
            if (filteredOrders.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'No Data',
                    description: 'There are no commissions in the selected date range.',
                });
                setIsGenerating(false);
                return;
            }

            const fromDate = date?.from ? format(date.from, 'yyyy-MM-dd') : 'start';
            const toDate = date?.to ? format(date.to, 'yyyy-MM-dd') : 'end';
            const fileName = `commission_report_${fromDate}_to_${toDate}`;

            if (formatType === 'csv') {
                const headers = "Date,Product,Commission,Status";
                const rows = filteredOrders.map(order => {
                    const status = order.orderStatus === 'delivered' ? 'Cleared' : 'Pending';
                    return `${format(order.orderDate.toDate(), 'yyyy-MM-dd')},"${order.productName}",${order.resellerCommission?.toFixed(2)},${status}`;
                });
                const csvContent = [headers, ...rows].join("\n");
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `${fileName}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else if (formatType === 'pdf') {
                const doc = new jsPDF();
                doc.text(`Commission Report for ${resellerName || 'Reseller'}`, 14, 16);
                doc.text(`From: ${fromDate} To: ${toDate}`, 14, 22);

                autoTable(doc, {
                    startY: 30,
                    head: [['Date', 'Product', 'Commission', 'Status']],
                    body: filteredOrders.map(order => [
                        format(order.orderDate.toDate(), 'yyyy-MM-dd'),
                        order.productName,
                        `$${order.resellerCommission?.toFixed(2)}`,
                        order.orderStatus === 'delivered' ? 'Cleared' : 'Pending'
                    ]),
                });

                doc.save(`${fileName}.pdf`);
            }
            
            setIsGenerating(false);
            toast({
                title: 'Download Started!',
                description: 'Your commission report has been downloaded.',
            });
        }, 1000); // Short delay to allow UI to update
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
                    <Select defaultValue={formatType} onValueChange={setFormatType}>
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
                 <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button onClick={handleGenerate} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {isGenerating ? 'Generating...' : 'Generate & Download'}
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
                <DownloadReportDialog orders={orders || []} resellerName={user?.displayName || ''} />
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
