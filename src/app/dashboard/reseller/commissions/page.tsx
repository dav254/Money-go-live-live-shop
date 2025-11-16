
import { ResellerLayout } from '@/components/layout/reseller-layout';
import {
  Card,
  CardContent,
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
  BadgePercent,
  CheckCircle,
  CircleDollarSign,
  Clock,
  Download,
  Wallet,
} from 'lucide-react';
import { DateRangePicker } from '@/components/dashboard/date-range-picker';

const commissionData = [
  {
    title: 'Total Commission Earned',
    amount: '22,300',
    icon: CircleDollarSign,
    description: 'Lifetime earnings from all sales.',
  },
  {
    title: 'Pending Commission',
    amount: '3,100',
    icon: Clock,
    description: 'From orders not yet delivered.',
  },
  {
    title: 'Paid Out Commission',
    amount: '15,000',
    icon: CheckCircle,
    description: 'Successfully sent to your account.',
  },
   {
    title: 'Ready for Payout',
    amount: '4,200',
    icon: Wallet,
    description: 'Available for withdrawal now.',
    isPrimary: true,
  },
];

const history = [
  { orderId: '#ORD-101', product: 'Classic Leather Handbag', commission: 127.50, status: 'paid', date: '2024-08-25' },
  { orderId: '#ORD-102', product: 'Urban Explorer Sneakers', commission: 180.00, status: 'paid', date: '2024-08-25' },
  { orderId: '#ORD-105', product: 'NextGen Smartphone', commission: 600.00, status: 'pending', date: '2024-08-26' },
  { orderId: '#ORD-108', product: 'Chronograph Watch', commission: 262.50, status: 'paid', date: '2024-08-23' },
  { orderId: '#ORD-112', product: 'Gourmet Pasta Kit', commission: 6.75, status: 'pending', date: '2024-08-27' },
];

export default function ResellerCommissionsPage() {
  return (
    <ResellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Commissions & Earnings
          </h1>
          <div className="flex items-center space-x-2">
            <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download Report
            </Button>
            <Button variant="destructive" className="font-bold">
              Request Payout <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {commissionData.map((data) => (
            <Card key={data.title} className={data.isPrimary ? 'bg-primary/10 border-primary' : ''}>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Recent Commission History</CardTitle>
            </div>
            <DateRangePicker />
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
                {history.map((item) => (
                  <TableRow key={item.orderId}>
                    <TableCell className="font-medium">{item.orderId}</TableCell>
                    <TableCell>{item.product}</TableCell>
                    <TableCell className="font-semibold text-green-500">{item.commission.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                    <TableCell>
                       <Badge variant={item.status === 'paid' ? 'default' : 'secondary'} className={item.status === 'paid' ? 'bg-green-600/80' : 'bg-yellow-500/80'}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
             <Button variant="link" className="mt-4 px-0">View all commission history</Button>
          </CardContent>
        </Card>
      </div>
    </ResellerLayout>
  );
}
