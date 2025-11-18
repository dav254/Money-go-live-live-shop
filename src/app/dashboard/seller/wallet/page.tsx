
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
  Wallet,
  ArrowRight,
  Download,
  Settings,
  ShieldCheck,
  CreditCard,
  History,
  CircleDollarSign,
} from 'lucide-react';

const walletData = {
  totalRevenue: 52600.0,
  payouts: 48400.0,
  platformFees: 4200.00,
};

const transactions = [
  { type: 'payout', amount: -15000.00, date: '2024-08-25 18:00', balance: 3400.50, description: 'Withdrawal to M-Pesa' },
  { type: 'sale', amount: 950.00, date: '2024-08-26 14:30', balance: 4200.50, description: 'Order #ORD-001' },
  { type: 'sale', amount: 1200.00, date: '2024-08-24 11:45', balance: 8100.50, description: 'Order #ORD-002' },
];

export default function SellerWalletPage() {
  return (
    <SellerLayout>
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Seller Wallet
          </h1>
          <Button variant="destructive" className="font-bold text-lg px-6">
            Withdraw Funds <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        {/* Wallet Balance Overview */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available for Payout</CardTitle>
              <Wallet className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{walletData.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">This is your total earned revenue.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid Out</CardTitle>
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{walletData.payouts.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Funds successfully sent to you.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Platform Fees</CardTitle>
              <CircleDollarSign className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{walletData.platformFees.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Commission paid to MoneyGo.</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                {/* Transaction History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History /> Payout History</CardTitle>
                    <CardDescription>A record of all your wallet activities.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date &amp; Time</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">New Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                            <TableCell>
                              <Badge variant={ tx.type === 'payout' ? 'destructive' : 'secondary'}>
                                {tx.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{tx.description}</TableCell>
                            <TableCell className={`text-right font-semibold ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                             <TableCell className="text-right">{tx.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                     <Button variant="link" className="mt-4">View all transactions</Button>
                  </CardContent>
                </Card>
            </div>
            <div className="space-y-8">
                 {/* Security & Settings */}
                 <Card>
                    <CardHeader>
                        <CardTitle>Wallet Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button variant="outline" className="w-full justify-start gap-2"><CreditCard /> Manage Payout Accounts</Button>
                        <Button variant="outline" className="w-full justify-start gap-2"><ShieldCheck /> Withdrawal Security (2FA)</Button>
                        <Button variant="outline" className="w-full justify-start gap-2"><Download /> Download Payout Reports</Button>
                        <Button variant="outline" className="w-full justify-start gap-2"><Settings /> Notification Settings</Button>
                    </CardContent>
                </Card>
            </div>
        </div>

      </div>
    </SellerLayout>
  );
}
