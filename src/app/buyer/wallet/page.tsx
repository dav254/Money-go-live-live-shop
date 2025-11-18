
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Download, Gift, PlusCircle, Wallet, Bot } from 'lucide-react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const walletData = {
  balance: 1250.75,
  coupons: 3,
};

const transactions = [
    { id: 'TX001', date: '2024-08-26', description: 'Purchase from Aisha\'s Handbags', amount: -850.00, status: 'Completed' },
    { id: 'TX002', date: '2024-08-25', description: 'Top-up via M-Pesa', amount: 2000.00, status: 'Completed' },
    { id: 'TX003', date: '2024-08-24', description: 'Refund for returned item', amount: 120.75, status: 'Completed' },
    { id: 'TX004', date: '2024-08-22', description: 'Purchase from TechUnboxed', amount: -1200.00, status: 'Completed' },
];

const paymentMethods = [
    { id: 'pm1', type: 'mpesa', details: '**** **** **78', logo: '/mpesa-logo.png' },
    { id: 'pm2', type: 'visa', details: '**** **** **** 4242', logo: '/visa-logo.png' },
];

export default function BuyerWalletPage() {
  return (
    <BuyerLayout>
      <div className="container mx-auto max-w-7xl py-8">
        <h1 className="font-headline text-3xl font-bold mb-8">Wallet & Payments</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                {/* Balance & Coupons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-primary">
                                <Wallet />
                                Wallet Balance
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold">{walletData.balance.toLocaleString()}</p>
                            <Button className="mt-4 w-full">Top Up Wallet</Button>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Gift />
                                Coupons & Rewards
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold">{walletData.coupons}</p>
                            <p className="text-muted-foreground">Available coupons</p>
                            <Button variant="outline" className="mt-4 w-full">View Coupons</Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Transaction History */}
                <Card>
                    <CardHeader>
                        <CardTitle>Transaction History</CardTitle>
                        <CardDescription>A record of your recent wallet activity.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell>{tx.date}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell>
                                            <Badge variant={tx.status === 'Completed' ? 'default' : 'secondary'} className={tx.status === 'Completed' ? 'bg-green-600/80' : ''}>
                                                {tx.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`text-right font-semibold ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         <Button variant="link" className="mt-4 px-0">View all transactions</Button>
                    </CardContent>
                </Card>
            </div>
            
            <div className="space-y-8">
                 {/* Payment Methods */}
                <Card>
                    <CardHeader>
                        <CardTitle>Payment Methods</CardTitle>
                        <CardDescription>Manage your saved payment options for faster checkout.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {paymentMethods.map(pm => (
                             <div key={pm.id} className="flex items-center justify-between rounded-lg border p-3">
                                <div className="flex items-center gap-3">
                                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                                    <div>
                                        <p className="font-semibold uppercase">{pm.type}</p>
                                        <p className="text-sm text-muted-foreground">{pm.details}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm">Edit</Button>
                            </div>
                        ))}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add New Method
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                <DialogTitle>Add a Payment Method</DialogTitle>
                                <DialogDescription>
                                    Securely add a new way to pay.
                                </DialogDescription>
                                </DialogHeader>
                                <Tabs defaultValue="card" className="w-full">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="card">Card (Paystack)</TabsTrigger>
                                        <TabsTrigger value="paypal">PayPal</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="card">
                                        <div className="grid gap-4 py-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="card-number">Card Number</Label>
                                                <Input id="card-number" placeholder="**** **** **** 1234" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="expiry">Expiry</Label>
                                                    <Input id="expiry" placeholder="MM / YY" />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="cvc">CVC</Label>
                                                    <Input id="cvc" placeholder="123" />
                                                </div>
                                            </div>
                                        </div>
                                         <DialogFooter>
                                            <Button type="submit" className="w-full">Save Card</Button>
                                        </DialogFooter>
                                    </TabsContent>
                                    <TabsContent value="paypal">
                                        <div className="py-4 text-center">
                                            <p className="text-sm text-muted-foreground mb-4">You will be redirected to PayPal to securely link your account.</p>
                                            <Button type="button" className="w-full bg-[#0070BA] hover:bg-[#005ea6]">
                                                <Bot className="mr-2 h-4 w-4" /> {/* Using Bot as a placeholder for PayPal icon */}
                                                Continue with PayPal
                                            </Button>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </DialogContent>
                        </Dialog>

                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </BuyerLayout>
  );
}
