
'use client';

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
  Eye,
  MessageSquare,
  DollarSign,
  Heart,
  BarChart,
  User,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';
import { useMemo } from 'react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar as RechartsBar, BarChart as RechartsBarChart, XAxis, YAxis, ResponsiveContainer } from 'recharts';

const chartConfig = {
  views: { label: 'Views', color: 'hsl(var(--primary))' },
  sales: { label: 'Sales', color: 'hsl(var(--destructive))' },
};

const StatCard = ({ title, value, icon: Icon, isLoading }: { title: string, value: string, icon: React.ElementType, isLoading: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
             {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{value}</div>}
        </CardContent>
    </Card>
);

export default function AdminLiveAnalyticsPage() {
  const firestore = useFirestore();

  const sessionsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'liveSessions'), orderBy('startTime', 'desc'));
  }, [firestore]);

  const { data: sessions, isLoading } = useCollection<LiveSession>(sessionsQuery);

  const overallStats = useMemo(() => {
    if (!sessions) return { totalStreams: 0, totalViewers: 0, totalSales: 0 };
    return {
      totalStreams: sessions.length,
      totalViewers: sessions.reduce((acc, s) => acc + (s.viewerCount || 0), 0),
      totalSales: sessions.reduce((acc, s) => acc + ((s.sales || 0) as number), 0), // Placeholder for sales
    };
  }, [sessions]);

  const chartData = useMemo(() => {
    if (!sessions) return [];
    return sessions.slice(0, 7).reverse().map(s => ({
      date: s.startTime.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric'}),
      views: s.viewerCount || Math.floor(Math.random() * 5000), // Mock data
      sales: (s.sales || Math.floor(Math.random() * 2000)) as number, // Mock data
    }));
  }, [sessions]);

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Live Shopping: Analytics
        </h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Total Streams" value={overallStats.totalStreams.toLocaleString()} icon={BarChart} isLoading={isLoading} />
          <StatCard title="Total Viewers" value={overallStats.totalViewers.toLocaleString()} icon={Eye} isLoading={isLoading} />
          <StatCard title="Total Sales from Live" value={`$${overallStats.totalSales.toLocaleString()}`} icon={DollarSign} isLoading={isLoading} />
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Recent Stream Performance</CardTitle>
                <CardDescription>Viewership and sales from the last 7 streams.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-80 w-full" /> : (
                    <ChartContainer config={chartConfig} className="h-80 w-full">
                        <RechartsBarChart data={chartData}>
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                            <YAxis yAxisId="left" orientation="left" stroke="var(--color-views)" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis yAxisId="right" orientation="right" stroke="var(--color-sales)" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(val) => `$${val}`} />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                            <RechartsBar dataKey="views" fill="var(--color-views)" radius={4} yAxisId="left" />
                            <RechartsBar dataKey="sales" fill="var(--color-sales)" radius={4} yAxisId="right" />
                        </RechartsBarChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
