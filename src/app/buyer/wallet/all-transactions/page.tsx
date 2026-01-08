
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import React, { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Payment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Timestamp } from 'firebase/firestore';


const mockPayments: Payment[] = [
    {
        id: 'pay1',
        amount: 55.00,
        paymentDate: Timestamp.fromDate(addDays(new Date(), -2)),
        paymentMethod: 'paystack_card',
        paymentStatus: 'completed',
        transactionType: 'product-purchase',
        orderId: 'ord123',
        transactionId: 'txn_abc'
    },
    {
        id: 'pay2',
        amount: 10.00,
        paymentDate: Timestamp.fromDate(addDays(new Date(), -5)),
        paymentMethod: 'paypal',
        paymentStatus: 'completed',
        transactionType: 'points-purchase',
        userId: 'user123',
        transactionId: 'txn_def'
    },
    {
        id: 'pay3',
        amount: 120.50,
        paymentDate: Timestamp.fromDate(addDays(new Date(), -10)),
        paymentMethod: 'paystack_card',
        paymentStatus: 'completed',
        transactionType: 'product-purchase',
        orderId: 'ord456',
        transactionId: 'txn_ghi'
    },
    {
        id: 'pay4',
        amount: 25.00,
        paymentDate: Timestamp.fromDate(addDays(new Date(), -15)),
        paymentMethod: 'paypal',
        paymentStatus: 'failed',
        transactionType: 'product-purchase',
        orderId: 'ord789',
        transactionId: 'txn_jkl'
    }
];


const DownloadReportDialog = ({ payments }: { payments: Payment[] }) => {
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

        setTimeout(() => {
            const fromDate = date?.from ? format(date.from, 'yyyy-MM-dd') : 'start';
            const toDate = date?.to ? format(date.to, 'yyyy-MM-dd') : 'end';
            
            const filteredPayments = payments.filter(tx => {
                const txDate = tx.paymentDate.toDate();
                const from = date?.from ? new Date(date.from.setHours(0,0,0,0)) : new Date(0);
                const to = date?.to ? new Date(date.to.setHours(23,59,59,999)) : new Date();
                return txDate >= from && txDate <= to;
            });

            if (filteredPayments.length === 0) {
                 toast({ variant: 'destructive', title: 'No Data', description: 'No transactions found in the selected date range.' });
                 setIsGenerating(false);
                 return;
            }

            const fileName = `transaction_report_${fromDate}_to_${toDate}`;

            if (formatType === 'csv') {
                const headers = "Date,Type,Description,Status,Amount (USD)";
                const rows = filteredPayments.map(tx => {
                    const description = tx.orderId ? `Order #${tx.orderId.substring(0,8)}...` : 'AI Points Purchase';
                    return `${format(tx.paymentDate.toDate(), 'yyyy-MM-dd')},${tx.transactionType},"${description}",${tx.paymentStatus},${tx.amount}`;
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
            } else if (formatType === 'pdf') {
                const doc = new jsPDF();
                doc.text("Transaction Report", 14, 16);
                doc.text(`Date Range: ${fromDate} to ${toDate}`, 14, 22);

                autoTable(doc, {
                    startY: 30,
                    head: [['Date', 'Type', 'Description', 'Status', 'Amount (USD)']],
                    body: filteredPayments.map(tx => [
                        format(tx.paymentDate.toDate(), 'yyyy-MM-dd'),
                        tx.transactionType.replace('-', ' '),
                        tx.orderId ? `Order #${tx.orderId.substring(0,8)}...` : 'AI Points Purchase',
                        tx.paymentStatus,
                        `$${tx.amount.toFixed(2)}`
                    ]),
                });

                doc.save(`${fileName}.pdf`);
            }
            
            setIsGenerating(false);
            toast({
                title: 'Download Started!',
                description: 'Your transaction report has been downloaded.',
            });
        }, 1500);
    }

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Download Transaction Report</DialogTitle>
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

const TableSkeleton = () => (
    <Card>
        <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        {[...Array(5)].map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>)}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(10)].map((_, i) => (
                        <TableRow key={i}>
                             {[...Array(5)].map((_, j) => <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>)}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
);

export default function AllTransactionsPage() {
    const [transactions, setTransactions] = useState<Payment[]>(mockPayments);
    const [isLoading, setIsLoading] = useState(false);


    return (
        <BuyerLayout>
            <div className="container mx-auto max-w-4xl py-8 space-y-8">
                 <div className="flex items-center justify-between">
                    <h1 className="font-headline text-3xl font-bold">All Transactions</h1>
                    <Dialog>
                        <DialogTrigger asChild>
                             <Button variant="outline" size="sm" disabled={!transactions || transactions.length === 0}><Download className="mr-2 h-4 w-4" /> Download Report</Button>
                        </DialogTrigger>
                        <DownloadReportDialog payments={transactions || []} />
                    </Dialog>
                </div>
                {isLoading ? <TableSkeleton /> : (
                    <Card>
                        <CardHeader>
                            <CardTitle>Transaction History</CardTitle>
                            <CardDescription>A complete record of all your payments and wallet activities.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount (USD)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions && transactions.length > 0 ? (
                                        transactions.map((tx) => (
                                            <TableRow key={tx.id}>
                                                <TableCell className="text-muted-foreground">{tx.paymentDate.toDate().toLocaleDateString('en-us', { year:"numeric", month:"short", day:"numeric"})}</TableCell>
                                                <TableCell><Badge variant="outline" className="capitalize">{tx.transactionType.replace('-', ' ')}</Badge></TableCell>
                                                <TableCell className="font-medium">
                                                    {tx.orderId ? `Order #${tx.orderId.substring(0,8)}...` : 'AI Points Purchase'}
                                                </TableCell>
                                                <TableCell><Badge variant={tx.paymentStatus === 'completed' ? 'default' : 'secondary'} className={tx.paymentStatus === 'completed' ? 'bg-green-600/80' : 'bg-yellow-500/80'}>{tx.paymentStatus}</Badge></TableCell>
                                                <TableCell className={`text-right font-semibold ${tx.amount >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                                                    {tx.amount < 0 ? `-$${Math.abs(tx.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}` : `$${tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">No transactions found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>
        </BuyerLayout>
    )
}
