
import { ResellerLayout } from '@/components/layout/reseller-layout';
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
  CircleDollarSign,
  ArrowRight,
  Download,
  Settings,
  ShieldCheck,
  CreditCard,
  History,
  CheckCircle,
} from 'lucide-react';

const walletData = {
  available: 4200.0,
  pending: 3100.0,
  totalEarned: 22300.0,
};

const transactions = [
  { type: 'commission', amount: 127.50, date: '2024-08-26', description: 'Sale: Classic Leather Handbag' },
  { type: 'commission', amount: 600.00, date: '2024-08-25', description: 'Sale: NextGen Smartphone' },
  { type: 'payout', amount: -15000.00, date: '2024-08-25', description: 'Withdrawal to M-Pesa' },
  { type: 'commission', amount: 180.00, date: '2024-08-24', description: 'Sale: Urban Explorer Sneakers' },
  { type: 'bonus', amount: 500.00, date: '2024-08-23', description: 'Weekly Top Performer Bonus' },
];

export default function ResellerWalletPage() {
  return (
    <ResellerLayout>
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Reseller Wallet & Payouts
          </h1>
          <Button variant="destructive" className="font-bold text-lg px-6">
            Withdraw Funds <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        {/* Wallet Balance Overview */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Balance (Withdrawable)</CardTitle>
              <Wallet className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{walletData.available.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              <p className="text-xs text-muted-foreground">Ready for immediate withdrawal.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{walletData.pending.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              <p className="text-xs text-muted-foreground">From orders awaiting completion.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Lifetime Earnings</CardTitle>
              <CircleDollarSign className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{walletData.totalEarned.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              <p className="text-xs text-muted-foreground">All commissions earned to date.</p>
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
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-muted-foreground text-xs">{tx.date}</TableCell>
                            <TableCell>
                              <Badge variant={ tx.type === 'payout' ? 'destructive' : 'secondary'}>
                                {tx.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{tx.description}</TableCell>
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
                {/* Payout Settings */}
                 <Card>
                    <CardHeader>
                        <CardTitle>Payout Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <Button variant="outline" className="w-full justify-start gap-2"><CreditCard /> Manage Payment Methods</Button>
                        <Button variant="outline" className="w-full justify-start gap-2"><ShieldCheck /> Withdrawal Security (PIN/2FA)</Button>
                         <Button variant="outline" className="w-full justify-start gap-2"><Download /> Download Payout Reports</Button>
                    </CardContent>
                </Card>
            </div>
        </div>

      </div>
    </ResellerLayout>
  );
}
