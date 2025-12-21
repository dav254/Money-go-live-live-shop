
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format } from 'date-fns';

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

export default function AllTransactionsPage() {

    return (
        <BuyerLayout>
            <div className="container mx-auto max-w-4xl py-8 space-y-8">
                 <div className="flex items-center justify-between">
                    <h1 className="font-headline text-3xl font-bold">All Transactions</h1>
                    <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> Download Report</Button>
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
