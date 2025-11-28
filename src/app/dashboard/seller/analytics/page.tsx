
'use client';

import * as React from 'react';
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
import {
  DollarSign,
  ShoppingBag,
  Users,
  Package,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart as RechartsBarChart, XAxis, YAxis } from 'recharts';
import { DateRangePicker } from '@/components/dashboard/date-range-picker';
import Image from 'next/image';

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
};

const mockStats = {
  totalRevenue: 7850.50,
  totalSales: 125,
  totalProducts: 42,
  followers: 2345,
};

const mockChartData = [
  { date: 'Jan 23', revenue: 650 },
  { date: 'Jan 24', revenue: 700 },
  { date: 'Jan 25', revenue: 550 },
  { date: 'Jan 26', revenue: 800 },
  { date: 'Jan 27', revenue: 950 },
  { date: 'Jan 28', revenue: 750 },
  { date: 'Jan 29', revenue: 1100 },
];

const mockTopProducts = [
    { id: 'prod-1', name: 'Classic Leather Handbag', price: 850, imageUrl: 'https://picsum.photos/seed/p1/40' },
    { id: 'prod-2', name: 'Urban Explorer Sneakers', price: 120, imageUrl: 'https://picsum.photos/seed/p2/40' },
    { id: 'prod-5', name: 'Chronograph Watch', price: 350, imageUrl: 'https://picsum.photos/seed/p5/40' },
    { id: 'prod-6', name: 'Noise-Cancelling Headphones', price: 250, imageUrl: 'https://picsum.photos/seed/p6/40' },
];


const StatCard = ({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  description: string;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

export default function SellerAnalyticsPage() {
  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            My Analytics
          </h1>
          <DateRangePicker />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Revenue"
            value={`$${mockStats.totalRevenue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}`}
            icon={DollarSign}
            description="Lifetime revenue from all sales."
          />
          <StatCard
            title="Total Sales"
            value={mockStats.totalSales.toLocaleString()}
            icon={ShoppingBag}
            description="Total number of orders processed."
          />
          <StatCard
            title="Total Products"
            value={mockStats.totalProducts.toLocaleString()}
            icon={Package}
            description="Number of products in your shop."
          />
           <StatCard
            title="Followers"
            value={mockStats.followers.toLocaleString()}
            icon={Users}
            description="Total number of shop followers."
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            <Card className="lg:col-span-4">
                <CardHeader>
                    <CardTitle>Sales Overview</CardTitle>
                     <CardDescription>
                        Revenue from recent sales activity.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                    <ChartContainer config={chartConfig} className="h-80 w-full">
                        <RechartsBarChart data={mockChartData}>
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                            <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `$${value}`} />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                        </RechartsBarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
            <Card className="lg:col-span-3">
                <CardHeader>
                    <CardTitle>Top Performing Products</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockTopProducts.map(product => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <Image src={product.imageUrl || ''} alt={product.name} width={40} height={40} className="rounded-md" />
                                        <span>{product.name}</span>
                                    </TableCell>
                                    <TableCell className="text-right">${product.price.toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </div>
    </SellerLayout>
  );
}
