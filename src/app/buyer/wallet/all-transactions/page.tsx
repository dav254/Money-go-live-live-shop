'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


// More extensive mock data for the dedicated page
const mockTransactions = [
    {
        id: 'tx_1',
        paymentDate: new Date(),
        transactionType: 'product-purchase',
        orderId: 'ORD12345',
        paymentStatus: 'completed',
        amount: 55.00
    },
    {
        id: 'tx_2',
        paymentDate: new Date(new Date().setDate(new Date().getDate() - 2)),
        transactionType: 'points-purchase',
        orderId: null,
        paymentStatus: 'completed',
        amount: 10.00
    },
    {
        id: 'tx_3',
        paymentDate: new Date(new Date().setDate(new Date().getDate() - 5)),
        transactionType: 'product-purchase',
        orderId: 'ORD12340',
        paymentStatus: 'completed',
        amount: 120.50
    },
    {
        id: 'tx_4',
        paymentDate: new Date(new Date().setDate(new Date().getDate() - 10)),
        transactionType: 'product-purchase',
        orderId: 'ORD12333',
        paymentStatus: 'refunded',
        amount: -30.00
    },
     {
        id: 'tx_5',
        paymentDate: new Date(new Date().setDate(new Date().getDate() - 15)),
        transactionType: 'product-purchase',
        orderId: 'ORD12321',
        paymentStatus: 'completed',
        amount: 78.00
    },
];

const DownloadReportDialog = () => {
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

        // Simulate a short delay for generation
        setTimeout(() => {
            const fromDate = date?.from ? format(date.from, 'yyyy-MM-dd') : 'start';
            const toDate = date?.to ? format(date.to, 'yyyy-MM-dd') : 'end';
            const fileName = `transaction_report_${fromDate}_to_${toDate}`;

            if (formatType === 'csv') {
                const headers = "Date,Type,Description,Status,Amount (USD)";
                const rows = mockTransactions.map(tx => {
                    const description = tx.orderId ? `Order #${tx.orderId}` : 'AI Points Purchase';
                    return `${format(tx.paymentDate, 'yyyy-MM-dd')},${tx.transactionType},"${description}",${tx.paymentStatus},${tx.amount}`;
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
                    body: mockTransactions.map(tx => [
                        format(tx.paymentDate, 'yyyy-MM-dd'),
                        tx.transactionType.replace('-', ' '),
                        tx.orderId ? `Order #${tx.orderId}` : 'AI Points Purchase',
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

export default function AllTransactionsPage() {

    return (
        <BuyerLayout>
            <div className="container mx-auto max-w-4xl py-8 space-y-8">
                 <div className="flex items-center justify-between">
                    <h1 className="font-headline text-3xl font-bold">All Transactions</h1>
                    <Dialog>
                        <DialogTrigger asChild>
                             <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> Download Report</Button>
                        </DialogTrigger>
                        <DownloadReportDialog />
                    </Dialog>
                </div>
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
                                {mockTransactions.map((tx) => (
                                    <TableRow key={tx.id}>
                                        <TableCell className="text-muted-foreground">{format(tx.paymentDate, 'PPP')}</TableCell>
                                        <TableCell><Badge variant="outline" className="capitalize">{tx.transactionType.replace('-', ' ')}</Badge></TableCell>
                                        <TableCell className="font-medium">
                                            {tx.orderId ? `Order #${tx.orderId}` : 'AI Points Purchase'}
                                        </TableCell>
                                        <TableCell><Badge variant={tx.paymentStatus === 'completed' ? 'default' : 'secondary'} className={tx.paymentStatus === 'completed' ? 'bg-green-600/80' : 'bg-yellow-500/80'}>{tx.paymentStatus}</Badge></TableCell>
                                        <TableCell className={`text-right font-semibold ${tx.amount >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                                            {tx.amount < 0 ? `-$${Math.abs(tx.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}` : `$${tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </BuyerLayout>
    )
}
