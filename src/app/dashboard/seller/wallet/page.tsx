
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
  Clock,
  Gift,
  ArrowRight,
  Download,
  Settings,
  ShieldCheck,
  CreditCard,
  History,
} from 'lucide-react';

const walletData = {
  available: 4200.50,
  pending: 1850.00,
  bonus: 300.00,
};

const transactions = [
  { type: 'sale', amount: 950.00, date: '2024-08-26 14:30', balance: 4200.50, description: 'Order #ORD-001' },
  { type: 'promo', amount: -150.00, date: '2024-08-26 10:15', balance: 3250.50, description: 'Boost for "Classic Handbag"' },
  { type: 'payout', amount: -5000.00, date: '2024-08-25 18:00', balance: 3400.50, description: 'Withdrawal to M-Pesa' },
  { type: 'bonus', amount: 300.00, date: '2024-08-25 09:00', balance: 8400.50, description: 'New Seller Welcome Bonus' },
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
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
              <Wallet className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">KES {walletData.available.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Ready for withdrawal or promotions.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">KES {walletData.pending.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">From orders awaiting completion.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bonus / Credits</CardTitle>
              <Gift className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">KES {walletData.bonus.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Promotional credits for boosting sales.</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                {/* Transaction History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History /> Transaction History</CardTitle>
                    <CardDescription>A record of all your wallet activities.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount (KES)</TableHead>
                          <TableHead className="text-right">New Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                            <TableCell>
                              <Badge variant={
                                tx.type === 'sale' ? 'default' :
                                tx.type === 'bonus' ? 'default' :
                                'secondary'
                                } className={
                                tx.amount > 0 ? 'bg-green-600/80' : 'bg-yellow-500/80'
                                }>
                                {tx.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{tx.description}</TableCell>
                            <TableCell className={`text-right font-semibold ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {tx.amount.toLocaleString(undefined, { style: 'currency', currency: 'KES', minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('KES', '')}
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
                {/* Quick Actions */}
                 <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <Button variant="secondary" size="lg" className="justify-start text-base"><ArrowRight className="mr-3"/> Send to Promo</Button>
                         <Button variant="outline" size="lg" className="justify-start text-base"><Download className="mr-3"/> Download Statement</Button>
                    </CardContent>
                </Card>

                 {/* Security & Settings */}
                 <Card>
                    <CardHeader>
                        <CardTitle>Wallet Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button variant="outline" className="w-full justify-start gap-2"><CreditCard /> Manage Payout Accounts</Button>
                        <Button variant="outline" className="w-full justify-start gap-2"><ShieldCheck /> Withdrawal Security (2FA)</Button>
                        <Button variant="outline" className="w-full justify-start gap-2"><Settings /> Notification Settings</Button>
                    </CardContent>
                </Card>
            </div>
        </div>

      </div>
    </SellerLayout>
  );
}
