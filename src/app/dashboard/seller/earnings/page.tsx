
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  Banknote,
  CircleDollarSign,
  DollarSign,
  Package,
} from 'lucide-react';
import { DateRangePicker } from '@/components/dashboard/date-range-picker';
import Link from 'next/link';

const analyticsData = [
  {
    title: 'Total Revenue',
    amount: '52,600',
    icon: DollarSign,
    description: '+20.1% from last month',
  },
  {
    title: 'Total Payouts',
    amount: '48,400',
    icon: Banknote,
    description: 'Successfully sent to your account.',
  },
  {
    title: 'Live Sales Today',
    amount: '2,040',
    icon: Package,
    description: 'From 12 orders today',
  },
  {
    title: 'Platform Fees',
    amount: '4,200',
    icon: CircleDollarSign,
    description: 'Total commission paid to MoneyGo.',
  },
];

const transactions = [
  {
    orderId: '#ORD-001',
    amount: 950.0,
    status: 'paid',
    method: 'M-Pesa',
    date: '2024-08-18',
  },
  {
    orderId: '#ORD-002',
    amount: 1200.0,
    status: 'paid',
    method: 'Card',
    date: '2024-08-25',
  },
  {
    orderId: '#ORD-003',
    amount: 450.0,
    status: 'paid',
    method: 'M-Pesa',
    date: '2024-08-17',
  },
  {
    orderId: '#ORD-004',
    amount: 2500.0,
    status: 'paid',
    method: 'Bank Transfer',
    date: '2024-08-23',
  },
    {
    orderId: '#ORD-005',
    amount: 85.0,
    status: 'paid',
    method: 'M-Pesa',
    date: '2024-08-23',
  },
];

export default function SellerEarningsPage() {
  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Sales & Payouts
          </h1>
          <div className="flex items-center space-x-2">
            <DateRangePicker />
            <Button asChild variant="destructive" className="font-bold">
              <Link href="/dashboard/seller/wallet">
                Go to Wallet <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {analyticsData.map((data, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {data.title}
                </CardTitle>
                <data.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.amount}</div>
                <p className="text-xs text-muted-foreground">
                  {data.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Sales Transactions</CardTitle>
            <CardDescription>This history reflects completed sales where payment has been processed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.orderId}>
                    <TableCell className="font-medium">{tx.orderId}</TableCell>
                    <TableCell>{tx.amount.toLocaleString()}</TableCell>
                    <TableCell>
                       <Badge variant={'default'} className={'bg-green-600/80'}>
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{tx.method}</TableCell>
                    <TableCell>{tx.date}</TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="sm">View Order</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
}
