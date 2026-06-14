'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
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
import {
  DollarSign,
  ShoppingBag,
  CreditCard,
  BarChart,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import type { Order } from '@/lib/types';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart as RechartsBarChart, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/dashboard/date-range-picker';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { subDays, startOfDay, isSameDay } from 'date-fns';

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
};

// --- High-Fidelity Mock Data Node ---
const MOCK_ORDERS: Order[] = [
  {
    id: 'ord_node_1',
    productName: 'Cyber-Streetwear V1',
    totalAmount: 1250.00,
    orderStatus: 'delivered',
    orderDate: { toDate: () => subDays(new Date(), 0) } as any,
    platformFee: 125.0,
    resellerCommission: 125.0,
    productPrice: 1000.0,
    shippingAddress: 'Nairobi Core',
    buyerId: 'u1',
    sellerId: 's1'
  },
  {
    id: 'ord_node_2',
    productName: 'Neural Hub Pro',
    totalAmount: 850.50,
    orderStatus: 'shipped',
    orderDate: { toDate: () => subDays(new Date(), 1) } as any,
    platformFee: 85.05,
    resellerCommission: 0,
    productPrice: 765.45,
    shippingAddress: 'Lagos Gateway',
    buyerId: 'u2',
    sellerId: 's2'
  },
  {
    id: 'ord_node_3',
    productName: 'Minimalist Studio Desk',
    totalAmount: 2100.00,
    orderStatus: 'delivered',
    orderDate: { toDate: () => subDays(new Date(), 2) } as any,
    platformFee: 210.0,
    resellerCommission: 210.0,
    productPrice: 1680.0,
    shippingAddress: 'London Node',
    buyerId: 'u3',
    sellerId: 's3'
  },
  {
    id: 'ord_node_4',
    productName: 'Artisan Brew Kit',
    totalAmount: 45.00,
    orderStatus: 'processing',
    orderDate: { toDate: () => subDays(new Date(), 3) } as any,
    platformFee: 4.5,
    resellerCommission: 4.5,
    productPrice: 36.0,
    shippingAddress: 'Tokyo Pulse',
    buyerId: 'u4',
    sellerId: 's4'
  },
  {
    id: 'ord_node_5',
    productName: 'Velocity Runners',
    totalAmount: 120.00,
    orderStatus: 'cancelled',
    orderDate: { toDate: () => subDays(new Date(), 4) } as any,
    platformFee: 0,
    resellerCommission: 0,
    productPrice: 120.0,
    shippingAddress: 'NYC Active',
    buyerId: 'u5',
    sellerId: 's5'
  },
  {
    id: 'ord_node_6',
    productName: 'Holographic Display',
    totalAmount: 3400.00,
    orderStatus: 'delivered',
    orderDate: { toDate: () => subDays(new Date(), 5) } as any,
    platformFee: 340.0,
    resellerCommission: 340.0,
    productPrice: 2720.0,
    shippingAddress: 'Dubai Node',
    buyerId: 'u6',
    sellerId: 's1'
  },
  {
    id: 'ord_node_7',
    productName: 'Smart Living Controller',
    totalAmount: 560.00,
    orderStatus: 'delivered',
    orderDate: { toDate: () => subDays(new Date(), 6) } as any,
    platformFee: 56.0,
    resellerCommission: 0,
    productPrice: 504.0,
    shippingAddress: 'Nairobi Core',
    buyerId: 'u7',
    sellerId: 's2'
  }
];

const StatCard = ({
  title,
  value,
  icon: Icon,
  description,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  description: string;
  trend?: string;
}) => (
  <Card className="bg-neutral-900 border-white/5 rounded-[1.5rem] shadow-2xl relative overflow-hidden group">
    <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
      <Icon className="h-4 w-4 text-primary" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-black font-cyber text-foreground">{value}</div>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">{description}</p>
        {trend && <span className="text-[9px] font-black text-green-500">{trend}</span>}
      </div>
    </CardContent>
  </Card>
);

export default function AdminRevenueChartsPage() {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();

  const filteredOrders = React.useMemo(() => {
    if (!selectedDate) return MOCK_ORDERS;
    return MOCK_ORDERS.filter(order => isSameDay(order.orderDate.toDate(), selectedDate));
  }, [selectedDate]);

  const stats = React.useMemo(() => {
    const completedOrders = filteredOrders.filter(o => ['delivered', 'shipped', 'processing'].includes(o.orderStatus));
    const totalRevenue = completedOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const totalSales = completedOrders.length;
    const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
    const cancellations = filteredOrders.filter(o => o.orderStatus === 'cancelled').length;
    return { totalRevenue, totalSales, avgOrderValue, cancellations };
  }, [filteredOrders]);

  const chartData = React.useMemo(() => {
    const data: { date: string, revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateString = date.toISOString().split('T')[0];
      const dailyRevenue = MOCK_ORDERS
        .filter(o => isSameDay(o.orderDate.toDate(), date) && ['delivered', 'shipped', 'processing'].includes(o.orderStatus))
        .reduce((acc, o) => acc + o.totalAmount, 0);
      
      data.push({ date: dateString, revenue: dailyRevenue });
    }
    return data;
  }, []);

  return (
    <AdminLayout>
      <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-headline text-4xl font-black uppercase tracking-tighter text-white leading-none">
              Yield Analysis
            </h1>
            <p className="text-muted-foreground font-medium text-[10px] uppercase tracking-widest mt-2 flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-primary" /> 
              Network Transaction Velocity • Node Sync Active
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DatePicker date={selectedDate} setDate={setSelectedDate} />
            {selectedDate && <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest h-10 px-4 rounded-xl border-white/5" onClick={() => setSelectedDate(undefined)}>Clear</Button>}
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard
            title="Gross Revenue"
            value={`$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            description="Verified Signal"
            trend="+12.5%"
          />
          <StatCard
            title="Yield Velocity"
            value={stats.totalSales.toLocaleString()}
            icon={ShoppingBag}
            description="Active Conversions"
          />
          <StatCard
            title="Avg Unit Value"
            value={`$${stats.avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            icon={CreditCard}
            description="Per Node Entry"
          />
           <StatCard
            title="Signal Drops"
            value={stats.cancellations.toString()}
            icon={XCircle}
            description="Cancelled Sequences"
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
            <Card className="lg:col-span-4 bg-neutral-950 border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden">
                <CardHeader className="bg-white/5 p-8 border-b border-white/5">
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <BarChart className="h-4 w-4 text-primary" /> NETWORK OVERVIEW
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Revenue across global nodes (Last 7 Days)</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                    <ChartContainer config={chartConfig} className="h-80 w-full">
                        <RechartsBarChart data={chartData}>
                            <XAxis 
                                dataKey="date" 
                                tickLine={false} 
                                axisLine={false} 
                                tickMargin={8} 
                                fontSize={10} 
                                stroke="rgba(255,255,255,0.3)"
                                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            />
                            <YAxis 
                                tickLine={false} 
                                axisLine={false} 
                                tickMargin={8} 
                                fontSize={10} 
                                stroke="rgba(255,255,255,0.3)"
                                tickFormatter={(value) => `$${value}`} 
                            />
                            <ChartTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<ChartTooltipContent />} />
                            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[8, 8, 0, 0]} />
                        </RechartsBarChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            <Card className="lg:col-span-3 bg-neutral-950 border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
                <CardHeader className="bg-white/5 p-8 border-b border-white/5">
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">LATEST TRANSACTIONS</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Real-time signal validation queue</CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-white/5">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-[9px] font-black uppercase text-neutral-500 px-8 h-12">Entry</TableHead>
                                <TableHead className="text-[9px] font-black uppercase text-neutral-500 h-12">Status</TableHead>
                                <TableHead className="text-right text-[9px] font-black uppercase text-neutral-500 px-8 h-12">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredOrders.slice(0, 8).map(order => (
                                <TableRow key={order.id} className="border-white/5 hover:bg-white/5 transition-colors h-16 group">
                                    <TableCell className="px-8">
                                        <div className="font-black text-[11px] uppercase tracking-tight text-white truncate max-w-[150px]">{order.productName}</div>
                                        <div className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest">NODE_{order.id.slice(-6)}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "text-[8px] font-black uppercase tracking-widest border-none px-2",
                                            order.orderStatus === 'delivered' ? "bg-green-600/20 text-green-500" : "bg-primary/20 text-primary"
                                        )}>
                                            {order.orderStatus}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right px-8 font-black font-cyber text-sm text-foreground group-hover:text-primary transition-colors">
                                        ${order.totalAmount.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
